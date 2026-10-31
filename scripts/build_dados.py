"""Monta o dados.json único do dashboard.

Fontes (out/2026):
- marcos_2026-10-26.py: marcos-chave dos cronogramas (snapshot semanal do ClickUp)
- /home/claude/dre/rows.json: viabilidades da lista Controle de Viabilidades (valores gravados no ClickUp)
Na produção, a tarefa diária gera este mesmo formato direto do ClickUp.
"""
import json, importlib.util, datetime as dt

spec = importlib.util.spec_from_file_location("m", "/home/claude/build/marcos_2026-10-26.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

# Cadastro: nome no dashboard -> sigla do cronograma, cidade, incorporadora, ex-nome
EMP = [
 ("Al Nasser 1","AN1","Curitiba","Make It",""),("Al Nasser 2","AN2","Curitiba","Make It",""),
 ("Alba","ALB","Almirante Tamandaré","Make It","Tanguá"),("Arbo","ARB","Pinhais","Make It","Fênix"),
 ("Arena","ARE","Curitiba","Make It",""),("Aura","AUR","São José dos Pinhais","Make It","Alta Tensão"),
 ("Bravo","BRA","Pinhais","Make It","Forza"),("Container","CON","Curitiba","Make It",""),
 ("Edge","EDG","São José dos Pinhais","Make It","Porto Rico"),("Essence","ESS","Curitiba","Make It","Faculdade"),
 ("Flow","FLO","Araucária","Make It","Matsu II"),("Fundação","FUN","Curitiba","Make It",""),
 ("Horizon","HOR","Pinhais","Make It","Patrulha"),("Lume","LUM","Pinhais","Make It","Jardins"),
 ("Now","NOW","Araucária","Make It","Matsu I"),("Quadratto","QUA","Pinhais","Make It","Leilão"),
 ("Rafitec","RAF","Pinhais","Make It",""),("Uniq","UNI","Pinhais","Make It","Shakespeare"),
 ("Vert","VER","São José dos Pinhais","Make It","Follador"),("Zago","ZAG","São José dos Pinhais","Make It",""),
 ("Tuo","TUO","Curitiba","Make It",""),("La Vita","LAV","Curitiba","Make It",""),
 ("Guadalupe","GUA","Curitiba","Gadens",""),("CORE Evo","EVO","Curitiba","Gadens","João Negrão"),
 ("Martim Afonso","MAR","Curitiba","Gadens",""),
 ("Lens Alto da Glória","LAG","Curitiba","Gadens",""),("Lens Barigui","LBA","Curitiba","Gadens",""),
]
LEGADO = {"TUO","LAV"}  # entregues, sem viabilidade na lista
CENTRO = {"Curitiba":(-25.4284,-49.2733),"Pinhais":(-25.4447,-49.1925),"São José dos Pinhais":(-25.5347,-49.2064),
          "Araucária":(-25.5928,-49.4103),"Almirante Tamandaré":(-25.3249,-49.3101)}
MARCO_NOME = {"nov001":"Reunião de Arrancada","inc001":"Fim da Due Diligence","arq003":"Estudo Preliminar",
  "arq005":"Anteprojeto","leg009":"Emissão de Alvará","leg010":"Registro de Incorporação","inc002":"Lançamento Comercial",
  "orcV4":"Orçamento V4","eng001":"Início de Obra","eng002":"Término de Obra","leg011":"Registro de CVCO",
  "mar001":"Entrega de Chaves","inc003":"Entrega em Contrato"}

def fase(s, lista):
    g = lambda c: m.M.get(c, {}).get(s)
    done = lambda c: bool(g(c) and g(c)[1])
    if s in LEGADO or done("mar001") and not g("eng002"): return "ENT"
    if done("mar001"): return "ENT"
    if done("eng002"): return "ENT"
    if done("eng001"): return "OBR"
    if done("inc002"): return "LIB"
    if done("leg009"): return "LAN"
    if done("arq005"): return "ALV"
    if done("arq003"): return "AP"
    if done("inc001"): return "EP"
    if lista and lista.startswith("OBR"): return "OBR"
    if g("inc001") or g("nov001"): return "DUE"
    return None

rows = json.load(open("/home/claude/dre/rows.json"))
order = {"V0":0,"V1":1,"V2":2,"V3":3,"V4":4}
alias = {"Quadratto":"Quadratto"}
MES = {"Jan":1,"Fev":2,"Mar":3,"Abr":4,"Mai":5,"Jun":6,"Jul":7,"Ago":8,"Set":9,"Out":10,"Nov":11,"Dez":12}
def mes(db):
    try:
        a,b = db.replace(" ","").split("/"); return f"{int(b):04d}-{MES[a]:02d}"
    except Exception: return None

viab = {}
by = {}
for r in rows: by.setdefault(r["emp"],[]).append(r)
for emp, rs in by.items():
    ok=[r for r in rs if not r["obs"].startswith(("Simulação","Pendente"))]
    top=max(ok,key=lambda r:order[r["ver"]]) if ok else None
    for r in rs:
        sit = "Simulação" if r["obs"].startswith("Simulação") else "Pendente aprovação" if r["obs"].startswith("Pendente") else ("Vigente" if r is top else "Substituída")
        vazio = r["task_id"] in ("86ak6kqf7","86ak61abn")  # V0 Al Nasser aguardando valores corretos
        viab.setdefault(emp,[]).append({
            "versao": r["ver"], "obs": r["obs"], "situacao": sit, "task_id": r["task_id"],
            "mes": mes(r["data_base"]),
            "vgv_bruto": None if vazio else r["vgv_b"], "vgv_liquido": None if vazio else r["vgv_l"],
            "lucro": None if vazio else r["lucro"], "margem": None if vazio else r["margem"],
            "exposicao": None if vazio else r["expo"], "area_construida": None if vazio else r["area"],
            "unidades": r["unidades"], "permutas": r["permutas"], "preco_medio": r["preco"], "custo_m2": r["custo"],
        })
for v in viab.values(): v.sort(key=lambda x: order[x["versao"]])

out_emp = []
for i,(nome,s,cid,inc,ex) in enumerate(EMP):
    lst = m.LISTAS.get(s)
    marcos = {c: {"data": d[s][0], "ok": d[s][1]} for c,d in m.M.items() if s in d}
    f = fase(s, lst[1] if lst else None)
    vs = viab.get(nome, [])
    vig = next((x for x in vs if x["situacao"]=="Vigente"), None)
    lat,lng = CENTRO[cid]
    # posição aproximada: centro da cidade + deslocamento determinístico (endereço exato entra depois)
    ang = (i*137.5) % 360; rad = 0.012 + (i%5)*0.006
    import math
    pos = [round(lat + rad*math.sin(math.radians(ang)),5), round(lng + rad*math.cos(math.radians(ang)),5)]
    out_emp.append({
        "nome": nome, "sigla": s, "cidade": cid, "incorporadora": inc, "ex_nome": ex,
        "lista_id": lst[0] if lst else None, "lista": lst[1] if lst else None,
        "fase": f, "legado": s in LEGADO or f=="ENT",
        "marcos": marcos, "viabilidades": vs,
        "vigente": vig["versao"] if vig else None,
        "pos": pos,
    })

variacoes = []
for s,c,a,n in m.VARIACOES:
    e = next(x for x in out_emp if x["sigla"]==s)
    d = (dt.date.fromisoformat(n)-dt.date.fromisoformat(a)).days
    variacoes.append({"empreendimento": e["nome"], "sigla": s, "codigo": c, "marco": MARCO_NOME.get(c,c),
                      "anterior": a, "atual": n, "dias": d})

dados = {
  "gerado_em": dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec="minutes"),
  "fontes": {"cronogramas": f"Snapshot ClickUp de {m.SNAP}", "viabilidades": "ClickUp · Controle de Viabilidades",
             "variacoes": f"{m.SNAP_ANT} → {m.SNAP}"},
  "marco_nome": MARCO_NOME,
  "empreendimentos": out_emp,
  "variacoes": variacoes,
}
json.dump(dados, open("/home/claude/dashboard_incorporacao/dados.json","w"), ensure_ascii=False, indent=1)
for e in out_emp:
    vig = next((v for v in e["viabilidades"] if v["situacao"]=="Vigente"), None)
    print(f'{e["nome"]:20} {e["incorporadora"]:8} {str(e["fase"]):5} vig={e["vigente"]} vgv={vig and vig["vgv_bruto"]} lanc={e["marcos"].get("inc002")}')
