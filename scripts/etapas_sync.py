"""Etapas dos cronogramas e registros de desvio, para a página Análise de Cronogramas
e para o Registro de Desvios do dashboard.

Lê pela API do ClickUp (token do GitHub, sem usar o Claude):
  • todas as tarefas mãe com tipo "Etapa" das listas de cronograma
      Make It: pastas Due Diligence e Incorporação do espaço Cronogramas Make It
      Gadens:  pasta Cronogramas Gadens
  • os campos e as tarefas das listas "Registro de Alteração de Prazos" de cada empresa
Escreve registro/dados-makeit.json e registro/dados-gadens.json e guarda um retrato
diário dos términos em historico/etapas-AAAA-MM-DD.json (referência da semana passada
quando o campo Data Semana Passada estiver vazio). Inclui as subtarefas de cada Etapa (término e término da semana passada).
≈ 60 a 120 chamadas por dia.
"""
import json, re, datetime as dt
from clickup_sync import api, paginas, dia, norm, RAIZ, HIST, TZ

TIPO_ETAPA = 1004
F_SEM, F_LB, F_COD = "943f0c3a-a967-4bd5-8838-b9534e672bcc", "aa589ee0-8706-4d52-8146-f69dd117c65f", "1a4d1964-1f3b-44c9-83ed-92a31741656e"
COD = {"lanc": "09029f7f-4c5b-4e80-b2b1-cf42b20de14b", "reg": "c36bb815-d581-44cb-9331-862f73700447", "due": "10e0c8b1-d975-4353-af0a-cfe935608793"}
EMPRESAS = {
  "makeit": {"nome": "Make It", "pastas": {"901316256175": "Due Diligence", "901316256189": "Incorporação"}, "reg": "901312786569"},
  "gadens": {"nome": "Gadens", "pastas": {"901318303880": "Incorporação"}, "reg": "1400450000011724"},
}
R = {"tarefa": "ba153e8c-da16-4f58-91ff-2b249582ecd2", "emp": "887c28de-dff3-4d37-a940-c7b61c68dd8c", "tipoCrono": "5ae8ebdf-6584-4fb0-b2ed-77766f69caba",
     "semana": "ae46a9ce-2356-4e88-a573-3b8525d1886d", "lb": "b0bb6827-f602-44ce-89fa-1a4e489249a9", "pre": "0b65f8ad-16d4-4e53-b576-54c55e2cd501",
     "pos": "1bc8dcb0-c235-4430-b827-e23fe59c406b", "reprog": "76e39619-ef60-4155-b030-0418e5877768", "tipoAlt": "2b9c98c5-7b05-461f-bd6c-f7ebcb9e505d",
     "causa": "572a8894-0827-4dcd-8c99-169e4bac1654", "origem": "cfc9bb8f-e2aa-45ba-a749-1df226743131", "setor": "8c7a4aa8-78f3-48bd-9cf3-af55f2b86af5",
     "acao": "0921287f-03f0-41dd-8304-cdca66174a53", "subs": "f19b4c69-97ae-404c-8204-53f5e87868a1", "desc": "7549e404-2e2e-40c7-9fdf-0c2784eb4194", "motivos": "4db3ba48-6e5d-4e29-a8a7-f7a9b1c2900f"}
EXCLUI = re.compile(r"\(c[oó]pia\)|c[oó]pia|teste|tempor[aá]rio", re.I)
RID = re.compile(r"\[rd:([a-z0-9-]+)\]")

def cf(t, fid):
    return next((c for c in t.get("custom_fields", []) if c.get("id") == fid), None)

def opcao(c, v):
    """Nome da opção de um drop_down/labels a partir do valor da API (id ou orderindex)."""
    ops = (c or {}).get("type_config", {}).get("options", [])
    o = next((o for o in ops if o.get("id") == v or str(o.get("orderindex")) == str(v)), None)
    return (o.get("name") or o.get("label")) if o else None

COD_NOMES = {}
def etapas_da_lista(li):
    out, subs = [], []
    for t in paginas(f"list/{li['id']}/task", {"subtasks": "true", "include_closed": "true"}):
        if t.get("parent"): subs.append(t); continue
        if t.get("custom_item_id") != TIPO_ETAPA: continue
        st = t.get("status") or {}
        cc = cf(t, F_COD) or {}
        for o in cc.get("type_config", {}).get("options", []): COD_NOMES[o["id"]] = o.get("label")
        cods = json.dumps(cc.get("value") or [])
        rot = [COD_NOMES.get(x, x) for x in (cc.get("value") or [])]
        v = lambda fid: (cf(t, fid) or {}).get("value")
        out.append({
            "id": t["id"], "name": t.get("name", ""), "url": t.get("url"),
            "tags": [g.get("name") for g in t.get("tags", []) if g.get("name")],
            "assignees": [a.get("username") or a.get("email") for a in t.get("assignees", []) if a],
            "status": st.get("status"), "stType": st.get("type"), "stColor": st.get("color"),
            "start": dia(t.get("start_date")), "pos": dia(t.get("due_date")),
            "pre": dia(v(F_SEM)) if v(F_SEM) else None, "lb": dia(v(F_LB)) if v(F_LB) else None,
            "cods": rot,
            "marco": "lanc" if COD["lanc"] in cods else "reg" if COD["reg"] in cods else "due" if COD["due"] in cods else None,
        })
    # subtarefas de cada Etapa (em qualquer nível), para o registro apontar a tarefa operacional que atrasou
    pai = {t["id"]: t.get("parent") for t in subs}
    por_id = {e["id"]: e for e in out}
    def etapa_de(tid, n=0):
        p = pai.get(tid)
        return p if p in por_id else (etapa_de(p, n + 1) if p and n < 6 else None)
    for t in subs:
        e = por_id.get(etapa_de(t["id"]))
        if not e: continue
        v = (cf(t, F_SEM) or {}).get("value")
        e.setdefault("subs", []).append({"id": t["id"], "n": t.get("name", ""), "pos": dia(t.get("due_date")),
            "pre": dia(v) if v else None, "st": (t.get("status") or {}).get("type"), "nv": 1 if t.get("parent") == e["id"] else 2})
    return out

def opcoes_registro(campos):
    get = lambda fid: [{"id": o["id"], "name": o.get("name") or o.get("label"), "i": o.get("orderindex", i)}
                       for i, o in enumerate(next((c for c in campos if c["id"] == fid), {}).get("type_config", {}).get("options", []))]
    proj = next((c["id"] for c in campos if c["id"] != R["causa"] and re.search(r"projetista|consultor", norm(c["name"])) and "text" in (c.get("type") or "")), None)
    return {"emp": get(R["emp"]), "tipoCrono": get(R["tipoCrono"]), "tipoAlt": get(R["tipoAlt"]), "causa": get(R["causa"]),
            "origem": get(R["origem"]), "setor": get(R["setor"]), "motivos": get(R["motivos"]), "projField": proj,
            "tipos": {c["id"]: c.get("type") for c in campos}}

def registros(reg):
    out = []
    for t in paginas(f"list/{reg}/task", {"include_closed": "true", "subtasks": "true"}):
        val = lambda k: (cf(t, R[k]) or {}).get("value")
        rel = val("tarefa") or []
        ids = [x.get("id") if isinstance(x, dict) else x for x in rel] if isinstance(rel, list) else []
        mot = val("motivos")
        desc = (val("desc") or "").strip() if isinstance(val("desc"), str) else ""
        proj = None
        for c in t.get("custom_fields", []):
            if c["id"] != R["causa"] and re.search(r"projetista|consultor", norm(c.get("name", ""))) and isinstance(c.get("value"), str) and c["value"].strip():
                proj = c["value"].strip()
        if not proj:
            m = re.search(r"Projetista/consultor:\s*(.+)", desc, re.I); proj = m.group(1).strip() if m else None
        rid = RID.search(t.get("description") or t.get("text_content") or "")
        out.append({
            "id": t["id"], "nome": t.get("name", ""), "t": ids, "created": dia(t.get("date_created")),
            "semana": dia(val("semana")) if val("semana") else dia(t.get("date_created")),
            "pre": dia(val("pre")) if val("pre") else None, "pos": dia(val("pos")) if val("pos") else None,
            "causa": opcao(cf(t, R["causa"]), val("causa")) if val("causa") is not None else None,
            "setor": opcao(cf(t, R["setor"]), val("setor")) if val("setor") is not None else None,
            "origem": opcao(cf(t, R["origem"]), val("origem")) if val("origem") is not None else None,
            "tipo": opcao(cf(t, R["tipoAlt"]), val("tipoAlt")) if val("tipoAlt") is not None else None,
            "emp": opcao(cf(t, R["emp"]), val("emp")) if val("emp") is not None else ((t.get("tags") or [{}])[0].get("name") if t.get("tags") else None),
            "motivo": opcao(cf(t, R["motivos"]), mot[0]) if isinstance(mot, list) and mot else None,
            "desc": desc, "proj": proj, "rid": rid.group(1) if rid else None,
            "subs": [x.get("id") if isinstance(x, dict) else x for x in (val("subs") or [])] if isinstance(val("subs"), list) else [],
        })
    return out

def retrato_anterior(hoje):
    """Términos guardados no retrato mais recente anterior à segunda-feira desta semana."""
    d = dt.date.fromisoformat(hoje); seg = d - dt.timedelta(days=d.weekday())
    fs = sorted(p for p in HIST.glob("etapas-*.json") if p.stem[7:] < seg.isoformat())
    if not fs: return None, {}
    j = json.loads(fs[-1].read_text(encoding="utf-8")); return j.get("data"), j.get("t", {})

def rodar(cad):
    hoje = dt.datetime.now(TZ).date().isoformat()
    snap_data, snap = retrato_anterior(hoje)
    pasta = RAIZ / "registro"; pasta.mkdir(exist_ok=True)
    por_lista = {e["lista_id"]: e["sigla"] for e in cad["empreendimentos"] if e.get("lista_id")}
    retrato, resumo = {}, []
    for k, E in EMPRESAS.items():
        listas = []
        for fid, tipo in E["pastas"].items():
            for li in api(f"folder/{fid}/list", {"archived": "false"}).get("lists", []):
                if EXCLUI.search(li["name"]): continue
                es = etapas_da_lista(li)
                for e in es:
                    retrato[e["id"]] = e["pos"]
                    if not e["pre"] and snap.get(e["id"]) and snap_data:
                        e["pre"], e["preSrc"] = snap[e["id"]], "retrato de " + snap_data[8:10] + "/" + snap_data[5:7]
                    for x in e.get("subs", []):
                        retrato[x["id"]] = x["pos"]
                        if not x["pre"] and snap.get(x["id"]): x["pre"], x["src"] = snap[x["id"]], 1
                short = re.sub(r"\(.*?\)", "", li["name"].split("|")[-1]).strip()
                lanc = next((e["pos"] for e in es if e["marco"] == "lanc"), None)
                listas.append({"id": li["id"], "name": li["name"], "short": short, "tipo": tipo, "sigla": por_lista.get(li["id"]), "lanc": lanc, "etapas": es})
        campos = api(f"list/{E['reg']}/field").get("fields", [])
        regs = registros(E["reg"])
        due = sorted([l for l in listas if l["tipo"] == "Due Diligence"], key=lambda l: norm(l["short"]))
        inc = sorted([l for l in listas if l["tipo"] != "Due Diligence"], key=lambda l: (l["lanc"] is None, "" if l["lanc"] is None else "".join(chr(255 - ord(c)) for c in l["lanc"]), norm(l["short"])))
        (pasta / f"dados-{k}.json").write_text(json.dumps({
            "co": k, "nome": E["nome"], "at": dt.datetime.now(TZ).isoformat(timespec="minutes"), "reg": E["reg"],
            "snap": snap_data, "listas": due + inc, "opts": opcoes_registro(campos), "registros": regs,
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        resumo.append(f"{E['nome']}: {len(listas)} cronogramas, {sum(len(l['etapas']) for l in listas)} etapas, {len(regs)} registros")
    HIST.mkdir(exist_ok=True)
    (HIST / f"etapas-{hoje}.json").write_text(json.dumps({"data": hoje, "t": retrato}, separators=(",", ":")), encoding="utf-8")
    # guarda três semanas de retratos
    lim = (dt.date.fromisoformat(hoje) - dt.timedelta(days=21)).isoformat()
    for p in HIST.glob("etapas-*.json"):
        if p.stem[7:] < lim: p.unlink()
    print("Etapas · " + " · ".join(resumo))
