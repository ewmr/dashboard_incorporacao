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
# Posição provisória (bairro/rua, estimada a partir dos endereços da antiga BD Geral) até o campo
# "📍 Endereço do empreendimento" ser preenchido no ClickUp. Com o campo preenchido, vale a coordenada do ClickUp.
COORD = {
 "Essence":[-25.4720,-49.2380],"Alba":[-25.3230,-49.3080],"Now":[-25.5720,-49.4020],"Flow":[-25.5726,-49.4012],
 "Bravo":[-25.4380,-49.1880],"Tuo":[-25.4095,-49.1460],"La Vita":[-25.4110,-49.1490],"Arbo":[-25.4100,-49.1470],
 "Edge":[-25.5290,-49.1880],"Uniq":[-25.4405,-49.1900],"Lume":[-25.4000,-49.2100],"Horizon":[-25.4385,-49.1885],
 "Vert":[-25.5310,-49.2010],"Al Nasser 1":[-25.4010,-49.2360],"Al Nasser 2":[-25.4020,-49.2370],"Aura":[-25.5350,-49.2050],
 "Quadratto":[-25.4448,-49.1930],"Zago":[-25.5330,-49.2030],"Fundação":[-25.4620,-49.2660],"Arena":[-25.4590,-49.2280],
 "Container":[-25.5240,-49.2560],"Rafitec":[-25.4300,-49.1700],
 "Guadalupe":[-25.4370,-49.2780],"CORE Evo":[-25.4390,-49.2680],"Martim Afonso":[-25.4270,-49.2900],
 "Lens Alto da Glória":[-25.4195,-49.2620],"Lens Barigui":[-25.4290,-49.3050],
}
ENDERECO = json.load(open("/home/claude/dre/geo.json"))   # nome -> {lat,lng,endereco}: espelho do campo "📍 Endereço do empreendimento" (31/10/2026)
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
for r in rows:
    vazio = r["task_id"] in ("86ak6kqf7","86ak61abn")  # V0 Al Nasser aguardando valores corretos
    sit = "Simulação" if r["obs"].startswith("Simulação") else "Pendente aprovação" if r["obs"].startswith("Pendente") else ""
    viab.setdefault(r["emp"],[]).append({
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
    loc = ENDERECO.get(nome)
    pos = [loc["lat"],loc["lng"]] if loc else COORD.get(nome)
    out_emp.append({
        "nome": nome, "sigla": s, "cidade": cid, "incorporadora": inc, "ex_nome": ex,
        "lista_id": lst[0] if lst else None, "lista": lst[1] if lst else None,
        "fase": f, "legado": s in LEGADO or f=="ENT",
        "marcos": marcos, "viabilidades": vs,
        "pos": pos, "pos_fonte": "clickup" if loc else "aproximada",
        "endereco": loc["endereco"] if loc else None,
    })

variacoes = []
for s,c,a,n in m.VARIACOES:
    e = next(x for x in out_emp if x["sigla"]==s)
    d = (dt.date.fromisoformat(n)-dt.date.fromisoformat(a)).days
    variacoes.append({"empreendimento": e["nome"], "sigla": s, "codigo": c, "marco": MARCO_NOME.get(c,c),
                      "anterior": a, "atual": n, "dias": d})

dados = {
  "gerado_em": dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec="minutes"),
  "fontes": {"cronogramas": f"Snapshot ClickUp de {m.SNAP}", "viabilidades": "ClickUp · lista Controle de Viabilidades",
             "variacoes": f"{m.SNAP_ANT} → {m.SNAP}"},
  "marco_nome": MARCO_NOME,
  "empreendimentos": out_emp,
  "variacoes": variacoes,
}
json.dump(dados, open("/home/claude/dashboard_incorporacao/dados.json","w"), ensure_ascii=False, indent=1)
print(len(out_emp), "empreendimentos")
