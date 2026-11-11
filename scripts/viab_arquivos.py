"""Leitura das planilhas anexadas às viabilidades (DRE e Fluxo).

DRE  -> aba "Padrão DRE": grupos na coluna B, linhas na coluna C,
        total = Realizado (J) + A Realizar (O), em R$ mil.
Fluxo -> aba "Gráficos": série mensal acumulada (CV Meses, CW Entradas,
        CX Saídas, CY Juros, CZ Saldo), em R$ mil; aba "Fluxo": eventos na coluna C.

Os valores são devolvidos em R$ (não em milhares). Não há separação entre
realizado e a realizar: viabilidade é previsão, só o total importa.
"""
import datetime as _dt
import openpyxl

# grupos que encerram/abrem blocos da cascata
SUBTOTAIS = {"Receita Bruta", "Receita Líquida", "Resultado Bruto", "EBITDA",
             "Resultado Operacional", "Saldo"}
PARAR = {"Saldo pós-Juros", "Resultados sem Alavancagem"}


def _num(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _txt(v):
    return str(v).strip() if v not in (None, "") else ""


def _aba(wb, nome):
    for n in wb.sheetnames:
        if n.strip().lower() == nome.lower():
            return wb[n]
    return None


def ler_dre(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True, read_only=True)
    ws = _aba(wb, "Padrão DRE")
    if ws is None:
        raise ValueError("aba 'Padrão DRE' não encontrada")
    linhas = list(ws.iter_rows(min_row=1, max_row=min(ws.max_row or 200, 200),
                               max_col=16, values_only=True))
    # localiza o cabeçalho (coluna J = "Realizado", O = "A Realizar")
    ini = None
    cJ, cO = 9, 14
    for i, r in enumerate(linhas):
        vals = [_txt(x) for x in r]
        if "Realizado" in vals and "A Realizar" in vals:
            cJ, cO, ini = vals.index("Realizado"), vals.index("A Realizar"), i + 1
            break
    if ini is None:
        raise ValueError("cabeçalho Realizado/A Realizar não encontrado")
    area_priv = area_terr = None
    for i, r in enumerate(linhas[:ini]):
        for j, x in enumerate(r):
            t = _txt(x)
            if t in ("Área Privativa Total",) and i + 1 < len(linhas):
                v = linhas[i + 1][j]
                if isinstance(v, (int, float)):
                    area_priv = area_priv or v
            if t == "Área do Terreno (Total)" and i + 1 < len(linhas):
                v = linhas[i + 1][j]
                if isinstance(v, (int, float)):
                    area_terr = v
    grupos, atual, vistos_imp = [], None, 0
    for r in linhas[ini:]:
        b = _txt(r[1]) if len(r) > 1 else ""
        c = _txt(r[2]) if len(r) > 2 else ""
        tot = round((_num(r[cJ]) + _num(r[cO])) * 1000, 2)
        if b:
            if b in PARAR or b.startswith("Investimentos em Permutas"):
                break
            nome = b
            if b == "Impostos":
                vistos_imp += 1
                nome = "Impostos s/ receita" if vistos_imp == 1 else "IR / CSLL"
            if b == "Venda de Unidades":
                nome = "Receita Bruta"
                b = "Receita Bruta"
            if grupos and grupos[-1]["nome"] == nome:  # "Venda de Unidades" seguido de "Receita Bruta"
                atual = grupos[-1]
                atual["valor"] = tot
                continue
            atual = {"nome": nome, "valor": tot,
                     "subtotal": b in SUBTOTAIS, "linhas": []}
            grupos.append(atual)
            if b == "Saldo":
                break
        elif c and atual is not None and (not atual["subtotal"] or atual["nome"] == "Receita Bruta"):
            atual["linhas"].append({"nome": c, "valor": tot})
    if not grupos or grupos[0]["nome"] != "Receita Bruta":
        raise ValueError("estrutura da DRE não reconhecida")
    return {"grupos": grupos, "area_privativa": area_priv, "area_terreno": area_terr}


def ler_fluxo(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True, read_only=True)
    g = _aba(wb, "Gráficos")
    if g is None:
        raise ValueError("aba 'Gráficos' não encontrada")
    # procura a coluna "Meses" na linha 4
    hdr = next(g.iter_rows(min_row=4, max_row=4, values_only=True))
    try:
        cM = [_txt(x) for x in hdr].index("Meses")
    except ValueError:
        raise ValueError("série 'Meses' não encontrada em Gráficos")
    meses, ent, sai, jur, sal = [], [], [], [], []
    for r in g.iter_rows(min_row=5, values_only=True):
        if len(r) <= cM + 4:
            continue
        d = r[cM]
        if not isinstance(d, (_dt.datetime, _dt.date)):
            continue
        meses.append(d.strftime("%Y-%m"))
        ent.append(_num(r[cM + 1]) * 1000)
        sai.append(_num(r[cM + 2]) * 1000)
        jur.append(_num(r[cM + 3]) * 1000)
        sal.append(_num(r[cM + 4]) * 1000)
    if not meses:
        raise ValueError("série mensal vazia")
    # a série do gráfico é acumulada -> mensal por diferença
    def dif(a):
        return [round(a[i] - (a[i - 1] if i else 0)) for i in range(len(a))]
    E, S, J = dif(ent), dif(sai), dif(jur)
    # recorta meses vazios no início e no fim
    ativos = [i for i in range(len(meses)) if E[i] or S[i] or J[i]]
    a, b = (ativos[0], ativos[-1]) if ativos else (0, len(meses) - 1)
    eventos = []
    f = _aba(wb, "Fluxo")
    if f is not None:
        for r in f.iter_rows(min_row=15, max_col=3, values_only=True):
            d, ev = r[1], _txt(r[2])
            if ev and isinstance(d, (_dt.datetime, _dt.date)):
                for t in ev.split("\n"):
                    t = t.strip()
                    if t:
                        eventos.append({"mes": d.strftime("%Y-%m"), "nome": t})
    serie = {
        "meses": meses[a:b + 1],
        "entradas": E[a:b + 1],
        "saidas": S[a:b + 1],
        "juros": J[a:b + 1],
        "saldo": [round(x) for x in sal[a:b + 1]],
    }
    s = serie["saldo"]
    imin = min(range(len(s)), key=lambda i: s[i])
    pos = next((i for i in range(imin, len(s)) if s[i] >= 0), None)
    return {
        **serie,
        "eventos": eventos,
        "exposicao": {"valor": s[imin], "mes": serie["meses"][imin]},
        "payback": serie["meses"][pos] if pos is not None else None,
        "saldo_final": s[-1],
    }


if __name__ == "__main__":
    import json, sys
    for p in sys.argv[1:]:
        try:
            if "FLUXO" in p.upper():
                r = ler_fluxo(p)
                print(p, len(r["meses"]), r["exposicao"], r["payback"], r["saldo_final"], r["eventos"])
            else:
                r = ler_dre(p)
                print(p, [(g["nome"], round(g["valor"] / 1e6, 2), len(g["linhas"])) for g in r["grupos"]])
        except Exception as e:
            print("ERRO", p, e)
