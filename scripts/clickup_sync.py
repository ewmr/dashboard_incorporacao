"""Lê o ClickUp pela API e atualiza scripts/dados/viabilidades.json e scripts/dados/marcos.json.

Roda todo dia na rotina do GitHub (.github/workflows/atualiza.yml), sem usar o Claude.
Precisa do segredo CLICKUP_TOKEN (token pessoal do ClickUp, "pk_..."), guardado em
Settings → Secrets and variables → Actions do repositório. O token nunca fica no código.

Leituras (≈ 10 a 20 chamadas por dia, bem abaixo do limite do ClickUp):
  1. tarefas da lista Controle de Viabilidades (com os campos personalizados)
  2. tarefas com "🗓️ Código tarefa" dos marcos-chave nos cronogramas Make It e Gadens
Também guarda um retrato diário dos marcos em historico/ e calcula as variações da semana.
"""
import json, os, re, sys, time, unicodedata, datetime as dt, pathlib, urllib.request, urllib.parse

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DADOS, HIST = RAIZ / "scripts" / "dados", RAIZ / "historico"
TOKEN = os.environ.get("CLICKUP_TOKEN", "").strip()
TEAM = "9013344143"
LISTA_VIAB = "901328289749"
ESPACO_MAKEIT = "90131670080"
PASTA_GADENS = "901318303880"
F_CODIGO = "1a4d1964-1f3b-44c9-83ed-92a31741656e"
TZ = dt.timezone(dt.timedelta(hours=-3))
# marcos-chave usados pelo dashboard (orçamento V4: orç003/orç004 com "V4" no nome)
CODIGOS = ["nov001","inc001","nov002","arq002","arq003","arq005","leg008","leg009","leg010","inc002","cef003","cef004","eng001","eng002","leg011","mar001","inc003","orç003","orç004"]
F = {  # campos da lista Controle de Viabilidades
  "emp":"10612552-df74-4208-9c9f-f392bc192914", "end":"260ee6ef-9ae2-4a38-be18-f5c3b569e148", "margem":"2c80f097-e15e-4d06-9157-85be25960bf4",
  "area":"38eb77de-76ab-4553-89e2-d563c579478b", "permutas":"3ca392cc-9cd0-4ba0-8044-0d3d048b1d0b", "expo":"41157ca5-386e-49d8-87d9-4f4ae36950e9",
  "vgv_b":"415a5b6c-aaf7-4b9f-8193-da0682e60f4d", "data":"559b0d3a-a036-431a-9ac2-8b4b497378e4", "custo":"5d222343-54ea-44a1-952a-4c569fa4bcc8",
  "cidade":"8e02eb35-cf12-487a-b731-62cb5aa9dcef", "vgv_l":"b143b0bf-0853-4f7e-930f-fe7fa38272e9", "preco":"bd95e178-3e11-400d-ac0f-76d1f38a055b",
  "situacao":"c5595233-1695-4d97-b5bc-4d982834e13f", "unidades":"ce96a927-0fea-41e8-a08e-c69673816184", "lucro":"d39cf368-9792-48a9-bba6-918d9548e4bb",
  "linha":"da749a5b-9a72-409c-8c94-071d2d9d356c", "empresa":"fc9a48bf-549c-4641-8b8d-ae2fbf1d8616",
  "area_privativa":"29154718-4a97-410c-ae8f-5cc832767138", "area_terreno":"5a47426d-acd4-4f28-a3e1-2838d1d36167",
  "dre":"680c4801-87d1-40ab-acac-225113d5f8f7", "fluxo":"5f7ad38c-bc65-441b-8590-a357b4a63602",
}
VIAB_DIR = RAIZ / "viab"
chamadas = 0

def api(caminho, params=None):
    global chamadas
    base = "https://api.clickup.com/api/" + ("" if caminho.startswith("v3/") else "v2/")
    url = base + caminho + ("?" + urllib.parse.urlencode(params, doseq=True) if params else "")
    for tentativa in range(4):
        req = urllib.request.Request(url, headers={"Authorization": TOKEN, "Content-Type": "application/json"})
        try:
            chamadas += 1
            with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and tentativa < 3: time.sleep(30); continue
            raise SystemExit(f"ClickUp respondeu {e.code} em {caminho}: {e.read()[:300]}")
    raise SystemExit("ClickUp indisponível")

def paginas(caminho, params):
    out, p = [], 0
    while True:
        d = api(caminho, {**params, "page": p}); out += d.get("tasks", [])
        if d.get("last_page", True) or not d.get("tasks"): return out
        p += 1

dia = lambda ms: dt.datetime.fromtimestamp(int(ms) / 1000, TZ).date().isoformat() if ms else None
norm = lambda s: unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower().strip()

def campo(t, fid):
    return next((c for c in t.get("custom_fields", []) if c.get("id") == fid), None)
def valor(t, fid):
    c = campo(t, fid)
    if not c or c.get("value") in (None, ""): return None
    v = c["value"]
    if c.get("type") == "drop_down":
        ops = c.get("type_config", {}).get("options", [])
        o = next((o for o in ops if o.get("id") == v or o.get("orderindex") == v or str(o.get("orderindex")) == str(v)), None)
        return o.get("name") if o else None
    if c.get("type") in ("number", "currency"):
        try: return float(v)
        except Exception: return None
    return v

def anexo(t, fid):
    """Anexo mais recente de um campo do tipo arquivo (id, título, url)."""
    c = campo(t, fid)
    v = [a for a in (c or {}).get("value") or [] if isinstance(a, dict) and not a.get("deleted")]
    if not v: return None
    a = max(v, key=lambda a: int(a.get("date") or 0))
    return {"id": a.get("id"), "titulo": a.get("title"), "url": a.get("url_w_host") or a.get("url")}

def urls_assinadas(fid):
    """Lista os arquivos de um campo do tipo arquivo (API v3): devolve id -> url assinada.
    Uma ou duas chamadas por campo, em vez de uma por arquivo."""
    out, cur = {}, None
    for _ in range(20):
        p = {"limit": 100, **({"cursor": cur} if cur else {})}
        d = api(f"v3/workspaces/{TEAM}/custom_fields/{fid}/attachments", p)
        for a in d.get("data") or []: out[a.get("id")] = a.get("url")
        cur = d.get("next_cursor")
        if not cur or not d.get("data"): break
    return out

def baixar(url):
    with urllib.request.urlopen(urllib.request.Request(url), timeout=90) as r:
        corpo = r.read()
    if corpo[:2] != b"PK": raise RuntimeError("o arquivo baixado não é uma planilha .xlsx")
    return corpo

def planilhas(rows):
    """Lê DRE e Fluxo anexados; só baixa o que mudou desde a última leitura."""
    import tempfile
    sys.path.insert(0, str(RAIZ / "scripts"))
    from viab_arquivos import ler_dre, ler_fluxo
    VIAB_DIR.mkdir(exist_ok=True)
    cache_p = DADOS / "anexos.json"
    cache = json.loads(cache_p.read_text(encoding="utf-8")) if cache_p.exists() else {}
    erros, baixados, assin = [], 0, {}
    for r in rows:
        ax = r.pop("_anexos", {}) or {}
        tid, c = r["task_id"], cache.get(r["task_id"], {})
        destino = VIAB_DIR / f"{tid}.json"
        atual = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else {}
        mudou = False
        for k, ler in (("dre", ler_dre), ("fluxo", ler_fluxo)):
            a = ax.get(k)
            if not a:
                if k in atual: atual.pop(k); mudou = True
                c.pop(k, None); continue
            if c.get(k) == a["id"] and k in atual: continue
            try:
                if k not in assin: assin[k] = urls_assinadas(F[k])
                url = assin[k].get(a["id"])
                if not url: raise RuntimeError("arquivo não encontrado na lista de anexos do campo")
                with tempfile.NamedTemporaryFile(suffix=".xlsx") as tmp:
                    tmp.write(baixar(url)); tmp.flush(); baixados += 1
                    atual[k] = {**ler(tmp.name), "arquivo": a["titulo"]}
                c[k] = a["id"]; mudou = True
            except Exception as e:
                erros.append({"task_id": tid, "emp": r["emp"], "ver": r["ver"], "tipo": k.upper(), "arquivo": a["titulo"], "erro": str(e)[:160]})
        cache[tid] = c
        if mudou:
            if atual: destino.write_text(json.dumps(atual, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            elif destino.exists(): destino.unlink()
        r["planilhas"] = sorted(k for k in ("dre", "fluxo") if k in atual)
    vivos = {r["task_id"] for r in rows}
    for f in VIAB_DIR.glob("*.json"):
        if f.stem not in vivos: f.unlink()
    cache_p.write_text(json.dumps({k: v for k, v in cache.items() if k in vivos}, ensure_ascii=False, indent=1), encoding="utf-8")
    (DADOS / "planilhas_erros.json").write_text(json.dumps(erros, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Planilhas: {baixados} baixadas · {len(erros)} com problema")
    for e in erros: print("  ·", e["emp"], e["ver"], e["tipo"], "-", e["erro"])

def viabilidades(cad):
    alias = cad.get("alias_viabilidade", {})
    rows = []
    for t in paginas(f"list/{LISTA_VIAB}/task", {"include_closed": "true", "subtasks": "true"}):
        ver = (t.get("status", {}).get("status") or "").upper()
        if not re.fullmatch(r"V[0-4]", ver): continue
        nome = valor(t, F["emp"]) or (t["name"].split("|")[1].strip() if "|" in t["name"] else t["name"])
        emp = alias.get(nome, re.sub(r"\s*\(.*\)$", "", nome))
        loc = valor(t, F["end"]) or {}
        dm = valor(t, F["data"])
        mg = valor(t, F["margem"])
        obs = re.search(r"\(([^)]*)\)\s*$", t["name"])
        rows.append({
            "task_id": t["id"], "emp": emp, "ver": ver, "obs": obs.group(1) if obs else "", "titulo": t["name"],
            "mes": dia(dm)[:7] if dm else None, "data_base": None,
            "unidades": valor(t, F["unidades"]), "permutas": valor(t, F["permutas"]), "area": valor(t, F["area"]),
            "area_privativa": valor(t, F["area_privativa"]), "area_terreno": valor(t, F["area_terreno"]),
            "vgv_b": valor(t, F["vgv_b"]), "vgv_l": valor(t, F["vgv_l"]), "lucro": valor(t, F["lucro"]),
            "margem": mg / 100 if mg is not None else None, "expo": valor(t, F["expo"]), "preco": valor(t, F["preco"]), "custo": valor(t, F["custo"]),
            "situacao_cu": valor(t, F["situacao"]) or "", "linha": valor(t, F["linha"]), "cidade": valor(t, F["cidade"]),
            "incorporadora": valor(t, F["empresa"]),
            "_anexos": {k: anexo(t, F[k]) for k in ("dre", "fluxo")},
            "endereco": loc.get("formatted_address"), "lat": (loc.get("location") or {}).get("lat"), "lng": (loc.get("location") or {}).get("lng"),
        })
    return rows

def marcos(cad):
    # dicionário de códigos (id da opção → código)
    campos = api(f"space/{ESPACO_MAKEIT}/field").get("fields", [])
    cod = next(c for c in campos if c["id"] == F_CODIGO)
    op = {o["id"]: o["label"] for o in cod["type_config"]["options"]}
    ids = [i for i, l in op.items() if l in CODIGOS]
    filtro = json.dumps([{"field_id": F_CODIGO, "operator": "ANY", "value": ids}])
    # escopos: espaço Make It e listas "PREFIXO | Nome" da pasta Cronogramas Gadens
    gad = [l for l in api(f"folder/{PASTA_GADENS}/list", {"archived": "false"}).get("lists", []) if re.match(r"^[^|]+\|\s*\S", l["name"])]
    tarefas = [(t, "Make It") for t in paginas(f"team/{TEAM}/task", {"space_ids[]": ESPACO_MAKEIT, "include_closed": "true", "subtasks": "true", "custom_fields": filtro})]
    if gad:
        tarefas += [(t, "Gadens") for t in paginas(f"team/{TEAM}/task", {"list_ids[]": [l["id"] for l in gad], "include_closed": "true", "subtasks": "true", "custom_fields": filtro})]
    # sigla de cada lista: pelo cadastro (lista_id), senão pelo nome do empreendimento
    emps = cad["empreendimentos"]
    por_lista = {e["lista_id"]: e["sigla"] for e in emps if e.get("lista_id")}
    def sigla(lst, inc):
        if lst["id"] in por_lista: return por_lista[lst["id"]]
        base = norm(re.sub(r"\(.*?\)", "", lst["name"].split("|")[-1]))
        for e in emps:
            if e["incorporadora"] == inc and (norm(e["nome"]) == base or (e.get("ex_nome") and norm(e["ex_nome"]) in norm(lst["name"])) or base.startswith(norm(e["nome"]))):
                por_lista[lst["id"]] = e["sigla"]; return e["sigla"]
        return None
    M, listas, sem = {}, {}, set()
    for t, inc in tarefas:
        lst = t.get("list") or {}
        if re.search(r"c[oó]pia|teste", lst.get("name", ""), re.I): continue
        s = sigla(lst, inc)
        if not s: sem.add(lst.get("name")); continue
        listas[s] = [lst["id"], lst["name"], inc]
        st = t.get("status") or {}
        ok = 1 if st.get("type") in ("done", "closed") and norm(st.get("status")) != "cancelado" else 0
        if norm(st.get("status")) == "cancelado": continue
        d = dia(t.get("due_date"))
        if not d: continue
        cods = [op.get(x.get("id") if isinstance(x, dict) else x) for x in (valor(t, F_CODIGO) or [])]
        for c in cods:
            if c in ("orç003", "orç004"):
                if "v4" not in norm(t["name"]): continue
                c = "orcV4"
            if c not in CODIGOS and c != "orcV4": continue
            ant = M.setdefault(c, {}).get(s)
            if not ant or d > ant[0]: M[c][s] = [d, ok]
    return M, listas, sorted(x for x in sem if x)

def variacoes(hoje, M):
    """Compara com o retrato de uma semana atrás (o mais próximo entre 6 e 10 dias antes)."""
    alvo = None
    for f in sorted(HIST.glob("marcos-*.json")):
        d = f.stem[7:]
        if (dt.date.fromisoformat(hoje) - dt.date.fromisoformat(d)).days in range(6, 11): alvo = f
    if not alvo: return None, []
    A = json.loads(alvo.read_text(encoding="utf-8"))["M"]
    out = []
    for c, d in M.items():
        for s, (data, _) in d.items():
            a = A.get(c, {}).get(s)
            if a and a[0] != data and abs((dt.date.fromisoformat(data) - dt.date.fromisoformat(a[0])).days) >= 20:
                out.append([s, c, a[0], data])
    return alvo.stem[7:], out

def main():
    if not TOKEN:
        print("Sem CLICKUP_TOKEN: nada a fazer (o dashboard segue com os últimos dados)."); return 0
    cad = json.loads((DADOS / "cadastro.json").read_text(encoding="utf-8"))
    rows = viabilidades(cad)
    if not rows: raise SystemExit("A lista Controle de Viabilidades voltou vazia; nada foi alterado.")
    planilhas(rows)
    M, listas, sem = marcos(cad)
    if sum(len(v) for v in M.values()) < 50: raise SystemExit("Poucos marcos lidos do ClickUp; nada foi alterado.")
    hoje = dt.datetime.now(TZ).date().isoformat()
    HIST.mkdir(exist_ok=True)
    (HIST / f"marcos-{hoje}.json").write_text(json.dumps({"data": hoje, "M": M}, ensure_ascii=False), encoding="utf-8")
    ant, var = variacoes(hoje, M)
    velho = json.loads((DADOS / "marcos.json").read_text(encoding="utf-8"))
    (DADOS / "viabilidades.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    (DADOS / "marcos.json").write_text(json.dumps({
        "snap": hoje, "snap_ant": ant or velho.get("snap_ant"), "fonte": "rotina diária do GitHub (API do ClickUp)",
        "listas": listas, "M": M, "variacoes": var if ant else velho.get("variacoes", []), "listas_sem_cadastro": sem,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} viabilidades · {sum(len(v) for v in M.values())} marcos em {len(listas)} cronogramas · {len(var)} variações · {chamadas} chamadas")
    if sem: print("Cronogramas sem empreendimento no cadastro:", ", ".join(sem))
    return 0

if __name__ == "__main__": sys.exit(main())
