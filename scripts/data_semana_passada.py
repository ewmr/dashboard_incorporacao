"""Preenche o campo "Data Semana Passada" dos cronogramas Make It no ClickUp.

Roda no domingo à noite pela rotina do GitHub (.github/workflows/data_semana_passada.yml),
sem usar o Claude. Substitui a tarefa agendada "Preencher Data Semana Passada" da conta do Claude.

Por que domingo: os cronogramas são atualizados na segunda à tarde. No domingo, o término atual
de cada tarefa é exatamente a data reportada na semana anterior, que é a referência da reunião
semanal de registro de atrasos.

Regras (as mesmas da tarefa do Claude):
  • escopo: espaço "INC | 📆 Cronogramas Make It", só tarefas mãe (sem subtarefas) e não concluídas;
  • fora: listas com "(cópia)" ou "teste" no nome (simulações) e tarefas sem data de término;
  • só grava onde o valor atual é diferente do término (inclusive vazio);
  • nunca altera datas da tarefa, LBs, campos BASELINE_* nem os cronogramas Gadens;
  • teto de 700 gravações; se passar, grava primeiro as de término mais próximo de hoje.

SIMULAR=1 lê tudo e mostra o que seria gravado, sem gravar nada.
Leituras: 1 chamada a cada 100 tarefas. Gravações: 1 chamada por tarefa que mudou.
"""
import json, os, re, sys, time, datetime as dt, urllib.request, urllib.error, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import clickup_sync as cs
from clickup_sync import paginas, dia, norm, TEAM, ESPACO_MAKEIT, TZ, RAIZ

F_SEM = "943f0c3a-a967-4bd5-8838-b9534e672bcc"   # Data Semana Passada
EXCLUI = re.compile(r"\(copia\)|teste")             # comparado com o nome sem acento e em minúsculas
TETO = 700
SIMULAR = os.environ.get("SIMULAR", "").strip().lower() in ("1", "true", "sim", "yes")


def grava(task_id, iso):
    """Grava a data no campo. Usa meio-dia de Brasília para o dia não mudar em nenhum fuso do Brasil."""
    y, m, d = map(int, iso.split("-"))
    ms = int(dt.datetime(y, m, d, 12, tzinfo=TZ).timestamp() * 1000)
    corpo = json.dumps({"value": ms, "value_options": {"time": False}}).encode()
    url = f"https://api.clickup.com/api/v2/task/{task_id}/field/{F_SEM}"
    for tentativa in range(3):
        req = urllib.request.Request(url, data=corpo, method="POST",
                                     headers={"Authorization": cs.TOKEN, "Content-Type": "application/json"})
        try:
            cs.chamadas += 1
            with urllib.request.urlopen(req, timeout=60):
                return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and tentativa < 2:
                time.sleep(60); continue
            return f"{e.code} {e.read()[:200].decode(errors='ignore')}"
        except Exception as e:  # rede instável: tenta de novo uma vez
            if tentativa < 1:
                time.sleep(5); continue
            return str(e)[:200]
    return "limite de chamadas do ClickUp"


def planeja(tarefas, hoje):
    """Separa o que já está certo do que precisa ser gravado. Não chama a API."""
    lidas, certas, fora, alvo = 0, 0, 0, []
    for t in tarefas:
        if t.get("parent"):
            continue
        lista = (t.get("list") or {}).get("name", "")
        if EXCLUI.search(norm(lista)):
            fora += 1; continue
        if t.get("date_closed") or (t.get("status") or {}).get("type") == "closed":
            continue
        termino = dia(t.get("due_date"))
        if not termino:
            continue
        lidas += 1
        c = next((c for c in t.get("custom_fields", []) if c.get("id") == F_SEM), {})
        atual = dia(c.get("value")) if c.get("value") not in (None, "") else None
        if atual == termino:
            certas += 1
        else:
            alvo.append({"id": t["id"], "nome": t.get("name", ""), "lista": lista, "de": atual, "para": termino})
    alvo.sort(key=lambda a: abs((dt.date.fromisoformat(a["para"]) - hoje).days))
    return lidas, certas, fora, alvo[:TETO], alvo[TETO:]


def main():
    if not cs.TOKEN:
        raise SystemExit("Falta o segredo CLICKUP_TOKEN.")
    hoje = dt.datetime.now(TZ).date()
    tarefas = paginas(f"team/{TEAM}/task", {"space_ids[]": ESPACO_MAKEIT, "include_closed": "false",
                                            "subtasks": "false"})
    if not tarefas:
        raise SystemExit("ATENÇÃO: a busca no ClickUp voltou vazia; nada foi gravado.")
    lidas, certas, fora, alvo, sobra = planeja(tarefas, hoje)

    falhas = []
    if not SIMULAR:
        for a in alvo:
            erro = grava(a["id"], a["para"])
            if erro:
                falhas.append({**a, "erro": erro})
                if erro.startswith("429") or "limite" in erro:
                    idx = alvo.index(a)
                    falhas += [{**b, "erro": "não tentada (limite)"} for b in alvo[idx + 1:]]
                    break

    gravadas = 0 if SIMULAR else len(alvo) - len(falhas)
    resumo = {
        "data": hoje.isoformat(), "simulacao": SIMULAR, "etapas_lidas": lidas, "ja_certas": certas,
        "gravadas": gravadas, "a_gravar": len(alvo), "fora_do_teto": len(sobra), "falhas": falhas,
        "listas_ignoradas_tarefas": fora, "chamadas": cs.chamadas,
        "alteracoes": [{k: a[k] for k in ("id", "lista", "nome", "de", "para")} for a in alvo],
    }
    log = RAIZ / "historico" / f"data-semana-passada-{hoje.isoformat()}.json"
    log.parent.mkdir(exist_ok=True)
    log.write_text(json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")

    titulo = "SIMULAÇÃO — nada foi gravado" if SIMULAR else "Data Semana Passada preenchida"
    if falhas and not SIMULAR:
        titulo = f"ATENÇÃO: {len(falhas)} tarefa(s) não foram gravadas"
    linhas = [f"## {titulo}", "",
              f"- Tarefas lidas: {lidas}", f"- Já estavam certas: {certas}",
              f"- {'Seriam gravadas' if SIMULAR else 'Gravadas'}: {len(alvo) if SIMULAR else gravadas}",
              f"- Acima do teto de {TETO}: {len(sobra)}", f"- Falhas: {len(falhas)}",
              f"- Chamadas ao ClickUp: {cs.chamadas}", "",
              "| Lista | Tarefa | De | Para |", "| --- | --- | --- | --- |"]
    cel = lambda s: str(s).replace("|", "\\|")
    linhas += [f"| {cel(a['lista'])} | {cel(a['nome'])} | {a['de'] or 'vazio'} | {a['para']} |" for a in alvo[:200]]
    texto = "\n".join(linhas)
    print(texto)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(texto + "\n")
    if falhas and not SIMULAR:
        sys.exit(1)  # a rotina fica vermelha e o GitHub avisa por e-mail


if __name__ == "__main__":
    main()
