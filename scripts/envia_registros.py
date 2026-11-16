"""Envia ao ClickUp os registros de desvio exportados pelo Registro de Desvios do dashboard.

Cada arquivo em registros/pendentes/*.json (baixado no painel "A enviar") vira tarefas na
lista "Registro de Alteração de Prazos" da empresa, com os mesmos campos que o artefato
gravava. Roda na rotina do GitHub (.github/workflows/envia_registros.yml), com o token do
ClickUp guardado nos segredos do repositório, sem usar o Claude.

Nunca grava duas vezes o mesmo registro: cada um tem um identificador (rid), anotado em
registros/enviados/log.json e também no fim da descrição da tarefa ("[rd:...]").
Arquivos processados vão para registros/enviados/ com o resultado de cada item.
"""
import json, os, sys, time, datetime as dt, pathlib, urllib.request, urllib.error

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PEND, ENV = RAIZ / "registros" / "pendentes", RAIZ / "registros" / "enviados"
TOKEN = os.environ.get("CLICKUP_TOKEN", "").strip()
TZ = dt.timezone(dt.timedelta(hours=-3))
REGS_VALIDAS = {"901312786569", "1400450000011724"}  # Registro de Alteração de Prazos: Make It e Gadens

def req(metodo, caminho, corpo=None):
    url = "https://api.clickup.com/api/v2/" + caminho
    dados = json.dumps(corpo).encode() if corpo is not None else None
    for tentativa in range(4):
        r = urllib.request.Request(url, data=dados, method=metodo, headers={"Authorization": TOKEN, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=60) as resp: return json.loads(resp.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            if e.code == 429 and tentativa < 3: time.sleep(30); continue
            raise RuntimeError(f"ClickUp {e.code}: {e.read()[:300].decode(errors='ignore')}")
    raise RuntimeError("ClickUp indisponível")

def ms(iso):
    """Data (AAAA-MM-DD) → milissegundos ao meio-dia de Brasília, para não trocar de dia."""
    d = dt.datetime.fromisoformat(iso).replace(hour=12, tzinfo=TZ)
    return int(d.timestamp() * 1000)

def converte(tipo, v):
    if v is None or v == "": return None
    if tipo == "date": return {"value": ms(v), "value_options": {"time": False}}
    if tipo == "tasks": return {"value": {"add": v if isinstance(v, list) else [v]}}
    if tipo == "checkbox": return {"value": bool(v) if not isinstance(v, str) else v.lower() == "true"}
    if tipo in ("number", "currency"): return {"value": float(v)}
    if tipo == "labels": return {"value": v if isinstance(v, list) else [v]}
    return {"value": v}

def main():
    if not TOKEN: print("Sem CLICKUP_TOKEN."); return 1
    arquivos = sorted(PEND.glob("*.json"))
    if not arquivos: print("Nenhum arquivo pendente."); return 0
    ENV.mkdir(parents=True, exist_ok=True)
    log_p = ENV / "log.json"
    log = json.loads(log_p.read_text(encoding="utf-8")) if log_p.exists() else {}
    tipos, criados, erros = {}, 0, 0
    for arq in arquivos:
        try:
            j = json.loads(arq.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"✗ {arq.name}: arquivo inválido ({e})"); erros += 1
            arq.rename(ENV / ("invalido-" + arq.name)); continue
        itens = j if isinstance(j, list) else j.get("itens", [])
        resultado = []
        for it in itens:
            rid, reg = it.get("rid"), str(it.get("reg", ""))
            if not rid or reg not in REGS_VALIDAS or not it.get("campos"):
                resultado.append({"rid": rid, "erro": "item incompleto ou lista de registro desconhecida"}); erros += 1; continue
            if rid in log:
                resultado.append({"rid": rid, "task": log[rid], "obs": "já enviado antes"}); continue
            if reg not in tipos:
                tipos[reg] = {c["id"]: c.get("type") for c in req("GET", f"list/{reg}/field").get("fields", [])}
            cf = []
            for fid, v in it["campos"].items():
                if fid not in tipos[reg]: continue
                c = converte(tipos[reg][fid], v)
                if c is not None: cf.append({"id": fid, **c})
            corpo = {"name": it.get("nome") or "Registro de desvio", "markdown_description": it.get("descricao") or f"[rd:{rid}]",
                     "tags": it.get("tags") or [], "custom_fields": cf}
            try:
                t = req("POST", f"list/{reg}/task", corpo)
                log[rid] = t.get("id"); criados += 1
                resultado.append({"rid": rid, "task": t.get("id"), "emp": it.get("emp"), "etapa": it.get("nome")})
                print(f"✓ {it.get('emp')} · {it.get('nome')} → {t.get('id')}")
                log_p.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
            except Exception as e:
                resultado.append({"rid": rid, "erro": str(e)[:300], "emp": it.get("emp"), "etapa": it.get("nome")}); erros += 1
                print(f"✗ {it.get('emp')} · {it.get('nome')}: {e}")
        falhas = [r for r in resultado if r.get("erro")]
        destino = ENV / arq.name
        destino.write_text(json.dumps({"enviado_em": dt.datetime.now(TZ).isoformat(timespec="minutes"), "resultado": resultado, "itens": itens}, ensure_ascii=False, indent=1), encoding="utf-8")
        if falhas:
            # o que falhou continua pendente para a próxima tentativa
            arq.write_text(json.dumps({"v": 1, "itens": [it for it in itens if it.get("rid") in {r["rid"] for r in falhas}]}, ensure_ascii=False, indent=1), encoding="utf-8")
        else:
            arq.unlink()
    print(f"{criados} registro(s) criados no ClickUp · {erros} com problema")
    return 1 if erros and not criados else 0

if __name__ == "__main__": sys.exit(main())
