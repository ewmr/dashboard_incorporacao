"""Monta o dados.json do dashboard a partir de três arquivos em scripts/dados/:

- cadastro.json      cadastro fixo (siglas, cidades, nomes antigos, ajustes manuais de fase)
- viabilidades.json  lista Controle de Viabilidades do ClickUp (gerado por clickup_sync.py)
- marcos.json        marcos-chave dos cronogramas, por código (gerado por clickup_sync.py)

Rodar: python3 scripts/build_dados.py   (escreve dados.json na raiz do site)
"""
import json, re, datetime as dt, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DADOS = RAIZ / "scripts" / "dados"
ler = lambda n: json.loads((DADOS / n).read_text(encoding="utf-8"))
CAD, ROWS, MAR = ler("cadastro.json"), ler("viabilidades.json"), ler("marcos.json")

EMP = CAD["empreendimentos"]
LEGADO = set(CAD.get("legado", []))
FASE_MANUAL = CAD.get("fase_manual", {})
M = {c: {s: tuple(v) for s, v in d.items()} for c, d in MAR["M"].items()}
LISTAS = {s: tuple(v) for s, v in MAR["listas"].items()}

def fase(s, lista):
    if s in FASE_MANUAL: return FASE_MANUAL[s]
    g = lambda c: M.get(c, {}).get(s)
    done = lambda c: bool(g(c) and g(c)[1])
    if s in LEGADO: return "ENT"
    for c, f in (("mar001","ENT"),("eng002","ENT"),("eng001","OBR"),("inc002","LIB"),("leg009","LAN"),("arq005","ALV"),("arq003","AP"),("inc001","EP")):
        if done(c): return f
    if lista and lista.startswith("OBR"): return "OBR"
    if g("inc001") or g("nov001"): return "DUE"
    return None

MES = {"Jan":1,"Fev":2,"Mar":3,"Abr":4,"Mai":5,"Jun":6,"Jul":7,"Ago":8,"Set":9,"Out":10,"Nov":11,"Dez":12}
def mes(r):
    if r.get("mes"): return r["mes"]
    try:
        a, b = (r.get("data_base") or "").replace(" ", "").split("/"); return f"{int(b):04d}-{MES[a]:02d}"
    except Exception: return None

ordem = {"V0":0,"V1":1,"V2":2,"V3":3,"V4":4}
viab, info = {}, {}
for r in ROWS:
    obs = r.get("obs") or ""
    sit = r.get("situacao_cu") or ("Simulação" if obs.startswith("Simulação") else "Pendente aprovação" if obs.startswith("Pendente") else "")
    viab.setdefault(r["emp"], []).append({
        "versao": r["ver"], "obs": obs, "situacao": sit, "task_id": r["task_id"], "mes": mes(r),
        "vgv_bruto": r.get("vgv_b"), "vgv_liquido": r.get("vgv_l"), "lucro": r.get("lucro"), "margem": r.get("margem"),
        "exposicao": r.get("expo"), "area_construida": r.get("area"), "area_privativa": r.get("area_privativa"), "area_terreno": r.get("area_terreno"),
        "unidades": r.get("unidades"), "permutas": r.get("permutas"), "preco_medio": r.get("preco"), "custo_m2": r.get("custo"),
        "planilhas": r.get("planilhas", []),
    })
    # cadastro vindo do ClickUp (linha, cidade, endereço): vale o da versão mais recente
    k = (ordem.get(r["ver"], 0), mes(r) or "")
    if any(r.get(x) for x in ("linha","cidade","endereco","lat")) and (r["emp"] not in info or k >= info[r["emp"]][0]):
        info[r["emp"]] = (k, r)
for v in viab.values(): v.sort(key=lambda x: (ordem[x["versao"]], x["mes"] or ""))

# empreendimentos que só existem no ClickUp entram sozinhos
siglas = {e["sigla"] for e in EMP}
for nome, (_, r) in info.items():
    if any(e["nome"] == nome for e in EMP): continue
    base = re.sub(r"[^A-Z]", "", nome.upper())[:3] or "EMP"; s = base; i = 2
    while s in siglas: s = base[:2] + str(i); i += 1
    siglas.add(s)
    EMP.append({"nome": nome, "sigla": s, "cidade": r.get("cidade") or "Curitiba", "incorporadora": r.get("incorporadora") or "Make It", "ex_nome": "", "lista_id": None})

# fotos de capa: img/emp/<sigla>.jpg (ou .webp/.png), geradas a partir dos arquivos enviados
def foto(e):
    for ext in ("webp","jpg","jpeg","png"):
        f = RAIZ / "img" / "emp" / f"{e['sigla']}.{ext}"
        if f.exists(): return f"img/emp/{f.name}?v={int(f.stat().st_mtime)}"
    return None

out = []
for e in EMP:
    nome, s = e["nome"], e["sigla"]
    lst = LISTAS.get(s)
    marcos = {c: {"data": d[s][0], "ok": d[s][1]} for c, d in M.items() if s in d}
    f = fase(s, lst[1] if lst else None)
    r = info.get(nome, (None, {}))[1]
    loc = CAD.get("endereco", {}).get(nome)
    if r.get("lat") is not None: pos, end, fonte = [r["lat"], r["lng"]], r.get("endereco"), "clickup"
    elif loc: pos, end, fonte = [loc["lat"], loc["lng"]], loc.get("endereco"), "clickup"
    else: pos, end, fonte = CAD.get("coord_aproximada", {}).get(nome), None, "aproximada"
    out.append({
        "nome": nome, "sigla": s, "linha": r.get("linha") or CAD.get("linha_padrao", {}).get(nome),
        "cidade": r.get("cidade") or e["cidade"], "incorporadora": e["incorporadora"], "ex_nome": e.get("ex_nome") or "",
        "lista_id": lst[0] if lst else e.get("lista_id"), "lista": lst[1] if lst else None,
        "fase": f, "legado": s in LEGADO or f == "ENT", "fase_manual": s in FASE_MANUAL,
        "marcos": marcos, "viabilidades": viab.get(nome, []), "foto": foto(e), "pos": pos, "pos_fonte": fonte, "endereco": end,
    })

variacoes = []
for s, c, a, n in MAR.get("variacoes", []):
    e = next((x for x in out if x["sigla"] == s), None)
    if not e: continue
    variacoes.append({"empreendimento": e["nome"], "sigla": s, "codigo": c, "marco": CAD["marco_nome"].get(c, c),
                      "anterior": a, "atual": n, "dias": (dt.date.fromisoformat(n) - dt.date.fromisoformat(a)).days})

dados = {
  "gerado_em": dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec="minutes"),
  "fontes": {"cronogramas": f"Cronogramas do ClickUp em {MAR['snap']}", "viabilidades": "ClickUp · lista Controle de Viabilidades",
             "variacoes": f"{MAR['snap_ant']} → {MAR['snap']}", "rotina": MAR.get("fonte", "")},
  "marco_nome": CAD["marco_nome"], "empreendimentos": out, "variacoes": variacoes,
  "listas_sem_cadastro": MAR.get("listas_sem_cadastro", []),
  "planilhas_erros": (json.loads((RAIZ / "scripts" / "dados" / "planilhas_erros.json").read_text(encoding="utf-8"))
                      if (RAIZ / "scripts" / "dados" / "planilhas_erros.json").exists() else []),
}
(RAIZ / "dados.json").write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(out), "empreendimentos ·", sum(len(e["viabilidades"]) for e in out), "viabilidades ·", len(variacoes), "variações")
