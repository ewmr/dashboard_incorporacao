"use strict";
/* Dashboard de Incorporação · Make It e Gadens
   Lê dados.json (gerado a partir do ClickUp) e monta as páginas.
   Filtros (incorporadora, cidade, ano de lançamento, fase, linha de produto) valem para todos os painéis.
   As cores dos empreendimentos seguem o agrupamento escolhido: fase do projeto ou linha de produto. */

/* ---------- dicionários ---------- */
// cores das fases: as mesmas da apresentação mensal do comitê
const FASES = [
  {id:"DUE", nome:"Due Diligence", curto:"Due", v:"--f-due"},
  {id:"DEV", nome:"Desenvolvimento p/ Lançamento", curto:"Des. Lanç.", v:"--f-dev"},
  {id:"LIB", nome:"Liberação para Obra", curto:"Lib. Obra", v:"--f-lib"},
  {id:"OBR", nome:"Desenvolvimento de Obra", curto:"Obra", v:"--f-obr"},
  {id:"ENT", nome:"Entrega", curto:"Entrega", v:"--f-ent"},
  {id:"ETG", nome:"Entregue", curto:"Entregue", v:"--f-etg"},
  {id:"SEM", nome:"Sem cronograma", curto:"Sem cronograma", v:"--f-none"},
];
const CIDADES = [
  {id:"Curitiba", l:"#5E5CE6", d:"#7D7AFF"},
  {id:"Pinhais", l:"#14A3B8", d:"#38BCD0"},
  {id:"São José dos Pinhais", l:"#E8543F", d:"#F06A56"},
  {id:"Araucária", l:"#A2733F", d:"#C08F57"},
  {id:"Almirante Tamandaré", l:"#B04FD8", d:"#C772EA"},
];
// paleta validada (ordem = ordem de exibição; daltonismo ok com rótulos visíveis)
const LINHAS = [
  {id:"Make It Básico", curto:"Básico", l:"#1baf7a", d:"#199e70"},
  {id:"Make It Intermediário", curto:"Intermediário", l:"#6250d6", d:"#9085e9"},
  {id:"Make It Plus", curto:"Plus", l:"#eda100", d:"#c98500"},
  {id:"Make It Smart", curto:"Smart", l:"#e87ba4", d:"#d55181"},
  {id:"Gadens CORE", curto:"CORE", l:"#008300", d:"#008300"},
  {id:"Gadens Lens", curto:"Lens", l:"#e34948", d:"#e66767"},
  {id:"Make It Outros", curto:"Outros (Make It)", l:"#8E8E93", d:"#8E8E93"},
  {id:"Gadens Outros", curto:"Outros (Gadens)", l:"#A1A1A6", d:"#7C7C80"},
  {id:"Aguardando Definição", curto:"Aguardando definição", l:"#C7C7CC", d:"#545458"},
];
const TATICA = {DUE:"Due Diligence",EP:"Estudo Preliminar",AP:"Anteprojeto",ALV:"Aprovação / Alvará",LAN:"Liberação p/ Lançamento",LIB:"Liberação para Obra",OBR:"Em obra",ENT:"Entrega"};
const estrategica = f => !f ? "SEM" : f==="DUE" ? "DUE" : ["EP","AP","ALV","LAN"].includes(f) ? "DEV" : f;
const PAGES = ["resumo","mapa","cronograma","analise","viabilidade","metas"];
const PNOME = {resumo:"Resumo",mapa:"Mapa da carteira",cronograma:"Cronograma",analise:"Análise de Cronogramas",viabilidade:"Indicadores de Viabilidade",metas:"Indicadores e Metas"};
const VERS = ["V0","V1","V2","V3","V4"];
const VNOME = {V0:"Compra",V1:"Due Diligence (projeto)",V2:"Due Diligence",V3:"Atualização",V4:"Lançamento"};
// metas por ano de lançamento: VGV e margem líquida por incorporadora (nov/2026)
const METAS = {
  2026:{"Make It":{vgv:300e6, m:.20}, Gadens:{vgv:200e6, m:.18}},
  2027:{"Make It":{vgv:400e6, m:.20}, Gadens:{vgv:200e6, m:.18}},
  2028:{"Make It":{vgv:500e6, m:.21}, Gadens:{vgv:200e6, m:.18}},
  2029:{"Make It":{vgv:600e6, m:.22}, Gadens:{vgv:200e6, m:.18}},
};
// meta de margem do ano para a incorporadora (no consolidado, média das duas ponderada pela meta de VGV)
const metaM = (ano, inc=S.inc) => { const t=METAS[ano]; if (!t) return null; if (inc!=="all") return t[inc]?.m ?? null;
  const ks=Object.values(t), w=ks.reduce((a,x)=>a+x.vgv,0); return w ? ks.reduce((a,x)=>a+x.m*x.vgv,0)/w : null; };
const metaV = (ano, inc=S.inc) => { const t=METAS[ano]; if (!t) return null; return inc==="all" ? Object.values(t).reduce((a,x)=>a+x.vgv,0) : t[inc]?.vgv ?? null; };
const MIN_AMOSTRA = 2;
const INCS = [["all","Consolidado"],["Make It","Make It"],["Gadens","Gadens"]];

const CHANGELOG = [
  {v:"0.8", d:"2026-11-05", itens:[
    "Ficha do empreendimento: botão no canto da barra lateral do mapa abre a ficha completa (capa, números, produto e terreno, eficiência, versões da viabilidade e linha do tempo dos marcos). Também abre pelo mapa da página inicial e pela página de viabilidade.",
    "Página de viabilidade mais visual: versão vigente em destaque, linha de versões nas cores do ClickUp, cartões com variação e minigráfico, cascata do VGV ao lucro, produto e eficiência, tendência tracejada da margem nas versões futuras e cartão da margem projetada no lançamento.",
    "Lista da página de viabilidade agrupada e colorida pela viabilidade vigente; tabela de viabilidades recolhida por padrão.",
    "Empreendimentos entregues aparecem na página inicial como uma fase. Fundo da página na cor da incorporadora selecionada.",
    "Área privativa total e área do terreno preenchidas no ClickUp a partir das DREs; eficiência calculada.",
    "Rotina diária no GitHub que lê o ClickUp e atualiza o dashboard sem usar o Claude.",
  ]},
  {v:"0.7", d:"2026-11-04", itens:[
    "Página de Indicadores de Viabilidade no ar, na estrutura validada: comparativo entre fases (segue a fase selecionada), detalhamento por fase e evolução de VGV e margem, com lista lateral de empreendimentos.",
    "Saúde financeira: VGV e lucro líquido por ano de lançamento, com a meta de VGV de cada incorporadora; sai a soma das exposições máximas.",
    "Metas atualizadas por incorporadora: VGV e margem de 2026 a 2029 (Make It 300/400/500/600 mi e 20/20/21/22%; Gadens 200 mi e 18%).",
    "Mapa da página inicial com zoom pela rolagem, arraste e cartão do empreendimento ao clicar. Nomes dos empreendimentos sempre visíveis ao lado dos ícones.",
    "Barra superior: os nomes das páginas continuam aparecendo enquanto o quadro de prévia estiver aberto. “Somente empreendimentos ativos” vem desligado.",
    "Viabilidades novas da Gadens (Ares Juvevê, Morá, CORE Faivre, CORE Palacio e CORE Silva Jardim) e marcos históricos de La Vita, Tuo e Bravo.",
  ]},
  {v:"0.6", d:"2026-11-03", itens:[
    "Mapa no padrão do Mapas da Apple: barra lateral com grupos recolhíveis, ícones com o símbolo da incorporadora, botões de tipo de mapa (padrão ou satélite), 3D, zoom, enquadrar e bússola, e escala.",
    "Ao abrir um empreendimento, o mapa voa para o 3D e gira devagar em volta dele; ao voltar para todos, volta em 2D, com o norte para cima e todos enquadrados.",
    "Cores das fases iguais às da apresentação do comitê; fase “Entregue” para quem já passou da data de entrega e opção de ver só os ativos ou todos.",
    "Novo painel de filtros: colorir por fase, linha de produto ou cidade, ordenar por nome ou data de lançamento, fases em blocos e listas para linha, cidade e ano. O painel não fecha mais ao escolher.",
    "Interruptor da incorporadora no modelo do slide; Consolidado em #45416d. Fundo mais suave, números com fonte arredondada e interface mais enxuta.",
    "Barra inferior com zoom da interface e links úteis (BI Explorer, BI Engenharia, Viabil, CV Make It e CV Gadens).",
    "La Vita e Tuo corrigidos para Pinhais; viabilidades do Al Nasser 1 e 2 (V0) e V4 do La Vita e do Tuo.",
  ]},
  {v:"0.5", d:"2026-10-31", itens:[
    "Mapa próprio de Curitiba e região (OpenStreetMap), guardado no próprio site, com estilo no padrão do Mapas da Apple: ruas, bairros, parques e referências, sem lojas.",
    "Página de mapa em tela cheia com lista e busca; ao abrir um empreendimento, o mapa voa para a visão 3D e mostra a ficha com endereço, números e marcos.",
    "Coordenadas exatas pelo número (Google) para todos os empreendimentos, inclusive Gadens; alfinetes não saem mais do lugar ao mover o mapa.",
  ]},
  {v:"0.4", d:"2026-10-31", itens:[
    "Nova identidade: fundo em degradê na cor da incorporadora, barras em vidro líquido e modo escuro.",
    "Navegação na barra superior: ícones que mostram o nome e uma prévia da página ao passar o mouse.",
    "Filtros num botão próprio, com cores por fase e por linha de produto, e opção de agrupar por linha de produto.",
    "Interruptor da incorporadora com o logo da Make It e da Gadens.",
    "Trajetória mensal com as cores das incorporadoras, distribuição em rosca, mapa vetorial com alfinetes, saúde financeira recolhível.",
    "Linha de produto e endereço dos empreendimentos lidos da lista Controle de Viabilidades.",
  ]},
  {v:"0.3", d:"2026-10-30", itens:[
    "Viabilidade vigente passa a ser a versão mais avançada cadastrada na lista, mesmo pendente de aprovação.",
    "Filtros cruzados em todos os painéis e margem projetada no lançamento (mediana da variação até a V4).",
    "Marcos principais do Arbo e do Uniq criados no ClickUp.",
  ]},
  {v:"0.2", d:"2026-10-28", itens:["Viabilidades lidas da lista Controle de Viabilidades do ClickUp, com os valores das DREs."]},
  {v:"0.1", d:"2026-10-26", itens:["Primeira versão publicada no GitHub Pages e embutida no ClickUp, substituindo o Power BI."]},
];

const S = {mapSel:null, inc:"all", cidades:new Set(), anos:new Set(), fases:new Set(), linhas:new Set(), group:"fase", ordem:"alfa", ativos:false, dd:null, mgFech:new Set(), sel:null, saudeOpen:false, setTab:"dados"};
let D = null, AJ = null;

/* ---------- formatação ---------- */
const nf = (v,d=0) => v==null||isNaN(v) ? "—" : v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const brl = v => { if (v==null) return "—"; const a=Math.abs(v);
  if (a>=1e9) return "R$ "+nf(v/1e9,2)+" bi"; if (a>=1e6) return "R$ "+nf(v/1e6,1)+" mi"; if (a>=1e3) return "R$ "+nf(v/1e3,0)+" mil"; return "R$ "+nf(v); };
const mi = v => v>=1e9 ? nf(v/1e9,1)+" bi" : nf(v/1e6,0)+" mi";
const pct = (v,d=2) => v==null ? "—" : nf(v*100,d)+"%";
const pp = v => v==null ? "—" : (v>0?"+":v<0?"−":"")+nf(Math.abs(v*100),2)+" p.p.";
const dmy = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const my = iso => iso ? iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const esc = s => String(s??"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const median = a => { const s=[...a].sort((x,y)=>x-y), n=s.length; return n ? (n%2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2) : null; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const dark = () => document.documentElement.dataset.theme==="dark";
const $ = id => document.getElementById(id);

/* ---------- cores e grupos ---------- */
const faseCor = id => css(FASES.find(f=>f.id===id)?.v || "--f-none");
const linhaInfo = id => LINHAS.find(l=>l.id===id) || LINHAS[LINHAS.length-1];
const linhaCor = id => { const l=linhaInfo(id); return dark()?l.d:l.l; };
const coCor = inc => css(inc==="Gadens" ? "--gd" : "--mk");
const linhaDe = e => e.linha || "Aguardando Definição";
const cidadeCor = id => { const c=CIDADES.find(x=>x.id===id); return c ? (dark()?c.d:c.l) : "#8E8E93"; };
const grupoDe = e => S.group==="fase" ? faseDe(e) : S.group==="cidade" ? e.cidade : linhaDe(e);
const grupoNome = id => S.group==="fase" ? (FASES.find(f=>f.id===id)?.nome||id) : S.group==="cidade" ? id : linhaInfo(id).curto;
const grupoCor = id => S.group==="fase" ? faseCor(id) : S.group==="cidade" ? cidadeCor(id) : linhaCor(id);
const grupoOrdem = () => S.group==="fase" ? FASES.map(f=>f.id) : S.group==="cidade" ? [...CIDADES.map(c=>c.id), ...new Set(D.empreendimentos.map(e=>e.cidade).filter(c=>!CIDADES.some(x=>x.id===c)))] : LINHAS.map(l=>l.id);
const grupoRotulo = () => ({fase:"fase do projeto", linha:"linha de produto", cidade:"cidade"})[S.group];
const corDe = e => grupoCor(grupoDe(e));

/* ---------- dados derivados ---------- */
const vig = e => e._vig;
const lanc = e => e.marcos.inc002 || null;
const anoLanc = e => lanc(e) ? +lanc(e).data.slice(0,4) : null;
const anoKey = e => String(anoLanc(e) ?? "Sem data");
const HOJE = () => (D.gerado_em||"").slice(0,10) || new Date().toISOString().slice(0,10);
// Entregue: fase de entrega com a Entrega de Chaves concluída ou com a data já passada
const entregue = e => { const m=e.marcos.mar001; return e.legado && (!m || m.ok || m.data<=HOJE()) || (estrategica(e.fase)==="ENT" && !!m && (m.ok || m.data<=HOJE())); };
const faseDe = e => entregue(e) ? "ETG" : estrategica(e.fase);
const faseNome = e => faseDe(e)==="ETG" ? "Entregue" : TATICA[e.fase] || "Sem cronograma";
const ativa = e => faseDe(e)!=="ETG";
const ordena = L => L.slice().sort(S.ordem==="lanc" ? (a,b)=>(lanc(a)?.data||"9999").localeCompare(lanc(b)?.data||"9999")||a.nome.localeCompare(b.nome,"pt-BR") : (a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
const porInc = e => S.inc==="all" || e.incorporadora===S.inc;
const ANO = () => +(D.gerado_em||"").slice(0,4) || new Date().getFullYear();
function filtrados(ignora){
  return D.empreendimentos.filter(e => porInc(e) &&
    (ignora==="cidade" || !S.cidades.size || S.cidades.has(e.cidade)) &&
    (ignora==="ano" || !S.anos.size || S.anos.has(anoKey(e))) &&
    (ignora==="ativos" || !S.ativos || ativa(e)) &&
    (ignora==="fase" || !S.fases.size || S.fases.has(faseDe(e))) &&
    (ignora==="linha" || !S.linhas.size || S.linhas.has(linhaDe(e))));
}
const nFiltros = () => S.cidades.size+S.anos.size+S.fases.size+S.linhas.size;
const toggle = (set,v) => { set.has(v) ? set.delete(v) : set.add(v); S.sel=null; renderAll(); };
const grupoSet = () => S.group==="fase" ? S.fases : S.group==="cidade" ? S.cidades : S.linhas;
const grupoDim = () => S.group==="fase" ? "fase" : S.group==="cidade" ? "cidade" : "linha";

function prepara(){
  const ord = v => VERS.indexOf(v.versao);
  D.empreendimentos.forEach(e=>{
    const vs = e.viabilidades.filter(v=>v.vgv_bruto!=null || v.margem!=null);
    e._vig = vs.length ? vs.reduce((a,b)=> ord(b)>ord(a) || (ord(b)===ord(a) && (b.mes||"")>(a.mes||"")) ? b : a) : null;
  });
  AJ = calibra();
}

/* ---------- margem projetada no lançamento ----------
   Por incorporadora e por versão Vk: mediana de (margem V4 − margem Vk) nos empreendimentos que têm as duas.
   Projetada = margem vigente + mediana (com pelo menos MIN_AMOSTRA casos). Quem já tem V4 fica com a V4. */
function calibra(){
  const out = {};
  ["Make It","Gadens"].forEach(inc=>{
    out[inc] = {};
    const emps = D.empreendimentos.filter(e=>e.incorporadora===inc);
    VERS.slice(0,4).forEach(vk=>{
      const pares = [];
      emps.forEach(e=>{
        const m = ver => { const xs=e.viabilidades.filter(v=>v.versao===ver && v.margem!=null); return xs.length ? xs.reduce((a,b)=>(b.mes||"")>(a.mes||"")?b:a).margem : null; };
        const a=m(vk), b=m("V4");
        if (a!=null && b!=null) pares.push({nome:e.nome, de:a, para:b, d:b-a});
      });
      out[inc][vk] = {pares, n:pares.length, med:median(pares.map(p=>p.d))};
    });
  });
  return out;
}
function proj(e){
  const v = vig(e);
  if (!v || v.margem==null) return null;
  if (v.versao==="V4") return {m:v.margem, aj:0, ok:true, motivo:"já é a viabilidade de lançamento"};
  const a = AJ[e.incorporadora]?.[v.versao];
  if (!a || a.n < MIN_AMOSTRA) return {m:v.margem, aj:0, ok:false, motivo:`sem histórico suficiente de ${v.versao} → V4 na ${e.incorporadora}`};
  return {m:v.margem+a.med, aj:a.med, ok:true, motivo:`mediana de ${a.n} casos ${v.versao} → V4 na ${e.incorporadora}`};
}

/* ---------- dica flutuante ---------- */
const tip = $("tip");
function showTip(html, ev){ tip.innerHTML=html; tip.hidden=false; moveTip(ev); }
function moveTip(ev){ const pad=14, w=tip.offsetWidth, h=tip.offsetHeight; let x=ev.clientX+pad, y=ev.clientY+pad; if (x+w>innerWidth-8) x=ev.clientX-w-pad; if (y+h>innerHeight-8) y=ev.clientY-h-pad; tip.style.left=Math.max(8,x)+"px"; tip.style.top=Math.max(8,y)+"px"; }
function hideTip(){ tip.hidden=true; }
function bindTip(node, html){ node.addEventListener("mousemove", ev=>showTip(typeof html==="function"?html():html, ev)); node.addEventListener("mouseleave", hideTip); }

/* ---------- utilitários de gráfico ---------- */
function niceStep(max, alvo=4){ const raw=max/alvo, p=Math.pow(10,Math.floor(Math.log10(raw))), n=raw/p; return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
const barTop = (x,y,w,h,r=2.5) => h<=0 ? "" : `M${x},${y+h} V${y+Math.min(r,h)} q0,-${Math.min(r,h)} ${Math.min(r,w/2)},-${Math.min(r,h)} h${w-2*Math.min(r,w/2)} q${Math.min(r,w/2)},0 ${Math.min(r,w/2)},${Math.min(r,h)} V${y+h} Z`;

/* =========================================================
   RESUMO
   ========================================================= */
function renderKpis(){
  const L = filtrados();
  const sum = f => L.reduce((a,e)=>a+(f(e)||0),0);
  const Y = ANO();
  const lancAno = L.filter(e=>anoLanc(e)===Y && lanc(e).ok);
  const prox12 = L.filter(e=>{ const l=lanc(e); if (!l||l.ok) return false; const d=(new Date(l.data)-new Date(D.gerado_em))/864e5; return d>=0 && d<=365; });
  const areaC = L.filter(e=>vig(e)?.custo_m2&&vig(e)?.area_construida);
  const custoMed = areaC.length ? areaC.reduce((a,e)=>a+vig(e).custo_m2*vig(e).area_construida,0)/areaC.reduce((a,e)=>a+vig(e).area_construida,0) : null;
  const ic = {up:'<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>', cal:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16"/></svg>', hammer:'<svg viewBox="0 0 24 24"><path d="M4 20l9-9M13 5l6 6-3 3-6-6z"/></svg>', m2:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16M12 4v16"/></svg>'};
  const cards = [
    {id:"vgv", k:"VGV da carteira", v:brl(sum(e=>vig(e)?.vgv_bruto)), f:e=>vig(e)?.vgv_bruto, fmt:brl,
     ins:`${ic.up}<b>${brl(lancAno.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0))}</b> lançado em ${Y}`},
    {id:"uh", k:"Unidades", v:nf(sum(e=>vig(e)?.unidades)), f:e=>vig(e)?.unidades, fmt:v=>nf(v)+" UH",
     ins:`${ic.hammer}<b>${nf(L.filter(e=>faseDe(e)==="OBR").reduce((a,e)=>a+(vig(e)?.unidades||0),0))}</b> UH em obra`},
    {id:"emp", k:"Empreendimentos", v:nf(L.length), f:()=>1, fmt:v=>nf(v),
     ins:`${ic.cal}<b>${prox12.length}</b> lançam nos próximos 12 meses`},
    {id:"area", k:"Área construída", v:nf(sum(e=>vig(e)?.area_construida))+" m²", f:e=>vig(e)?.area_construida, fmt:v=>nf(v)+" m²",
     ins:`${ic.m2}custo de obra médio <b>${custoMed?"R$ "+nf(custoMed):"—"}/m²</b>`},
  ];
  const box = $("sec-kpis"); box.innerHTML="";
  cards.forEach(c=>{
    const g = grupoOrdem().map(id=>({id, v:L.filter(e=>grupoDe(e)===id).reduce((a,e)=>a+(c.f(e)||0),0)})).filter(x=>x.v>0);
    const tot = g.reduce((a,x)=>a+x.v,0)||1;
    const a = document.createElement("article"); a.className="card kpi";
    a.innerHTML = `<span class="k">${c.k}</span><b>${c.v}</b>
      <div class="mbar">${g.map(x=>`<i style="flex-grow:${x.v/tot};background:${grupoCor(x.id)}" data-g="${x.id}"></i>`).join("")}</div>
      <span class="ins">${c.ins}</span>
      <button class="ib exp" aria-label="Ampliar ${c.k}"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg></button>`;
    a.querySelectorAll(".mbar i").forEach(i=>{ const x=g.find(y=>y.id===i.dataset.g); bindTip(i, `<b>${esc(grupoNome(x.id))}</b> · ${c.fmt(x.v)} · ${nf(x.v/tot*100,0)}%`); });
    a.querySelector(".exp").onclick = ()=>abreKpi(c);
    box.appendChild(a);
  });
}
function abreKpi(c){
  const L = filtrados();
  const grupos = grupoOrdem().map(id=>({id, its:L.filter(e=>grupoDe(e)===id).sort((a,b)=>(c.f(b)||0)-(c.f(a)||0))})).filter(g=>g.its.length);
  const tot = L.reduce((a,e)=>a+(c.f(e)||0),0)||1;
  $("expT").innerHTML = `${c.k} <span class="muted" style="font-weight:500;font-size:.9rem">${c.v}</span>`;
  $("expBody").innerHTML = `<p class="muted small">Agrupado por ${grupoRotulo()} · viabilidade vigente de cada empreendimento${nFiltros()||S.inc!=="all"?" · com os filtros atuais":""}.</p>
    <div class="grp">${grupos.map(g=>{ const gt=g.its.reduce((a,e)=>a+(c.f(e)||0),0); const cor=grupoCor(g.id);
      return `<div class="box"><h4><span class="mac" style="--c:${cor}"></span>${esc(grupoNome(g.id))}<span class="muted" style="margin-left:auto;font-weight:500">${c.id==="emp"?nf(g.its.length):c.fmt(gt)} · ${nf(gt/tot*100,0)}%</span></h4>
      ${g.its.map(e=>`<div class="row" style="--c:${cor}"><span>${esc(e.nome)} <span class="muted small">· ${esc(faseNome(e))}</span></span><span class="v">${c.id==="emp"?esc(e.cidade):c.fmt(c.f(e))}</span>${c.id==="emp"?"":`<span class="br"><i style="width:${(c.f(e)||0)/Math.max(...g.its.map(x=>c.f(x)||0),1)*100}%"></i></span>`}</div>`).join("")}</div>`; }).join("")}
</div>`;
  abreFolha("expSheet");
}

/* ---------- Trajetória de lançamentos (mensal, 5 anos, empilhado por incorporadora) ---------- */
function renderTraj(){
  const Y = ANO(), anos = [Y-2,Y-1,Y,Y+1,Y+2];
  const base = filtrados("ano").filter(e=>lanc(e) && vig(e));
  const cel = Array.from({length:60},()=>({mk:[0,0],gd:[0,0],its:[]}));
  let fora = [];
  base.forEach(e=>{
    const [a,m] = lanc(e).data.split("-").map(Number), i=(a-(Y-2))*12+(m-1);
    if (i<0||i>=60){ fora.push(e); return; }
    const k = e.incorporadora==="Gadens"?"gd":"mk";
    cel[i][k][lanc(e).ok?0:1] += vig(e).vgv_bruto||0; cel[i].its.push(e);
  });
  const anoSel = S.anos.size===1 && /^\d+$/.test([...S.anos][0]) ? +[...S.anos][0] : Y;
  const doAno = base.filter(e=>anoLanc(e)===anoSel), tOk = doAno.filter(e=>lanc(e).ok).reduce((a,e)=>a+vig(e).vgv_bruto,0), tPr = doAno.filter(e=>!lanc(e).ok).reduce((a,e)=>a+vig(e).vgv_bruto,0);
  $("trajCap").textContent = `VGV bruto por mês de Lançamento Comercial · ${Y-2} a ${Y+2}`;
  $("trajBig").textContent = brl(tOk+tPr);
  const mv = metaV(anoSel);
  $("trajBigS").textContent = `em ${anoSel}${tOk&&tPr?` · ${brl(tOk)} lançado e ${brl(tPr)} previsto`:tOk?" · lançado":tPr?" · previsto":""}${mv?` · meta ${brl(mv)} (${nf((tOk+tPr)/mv*100,0)}%)`:""}`;
  const incs = S.inc==="all" ? ["Make It","Gadens"] : [S.inc];
  $("trajLeg").innerHTML = incs.map(i=>`<span><i style="background:${coCor(i)}"></i>${i}</span>`).join("") + `<span><i class="lt" style="background:${coCor(incs[0])}"></i>claro = previsto</span>`;
  const box = $("traj");
  const W = Math.max(320, box.clientWidth||600), H = W<560 ? 220 : 290, ml = 4, mr = 46, mt = 10, mb = 26, iw = W-ml-mr, ih = H-mt-mb;
  const tot = c => c.mk[0]+c.mk[1]+c.gd[0]+c.gd[1];
  const maxV = Math.max(...cel.map(tot), 1), st = niceStep(maxV, 3), top = Math.ceil(maxV/st)*st, Yp = v => mt+ih-ih*v/top;
  const step = iw/60, bw = Math.max(4, Math.min(16, step*.84));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="VGV lançado por mês">`;
  // destaque suave do ano atual (meio)
  s += `<rect x="${ml+24*step}" y="${mt}" width="${12*step}" height="${ih}" fill="var(--fill)" opacity=".55" rx="6"/>`;
  for (let v=0; v<=top+1; v+=st) s += `<line x1="${ml}" x2="${W-mr+4}" y1="${Yp(v)}" y2="${Yp(v)}" stroke="var(--grid)" ${v?'':'stroke-width="1.2"'}/><text x="${W-mr+8}" y="${Yp(v)+3.5}">${v?mi(v):"0"}</text>`;
  for (let k=1; k<5; k++) s += `<line x1="${ml+k*12*step}" x2="${ml+k*12*step}" y1="${mt}" y2="${mt+ih}" stroke="var(--grid)" stroke-dasharray="3 3"/>`;
  cel.forEach((c,i)=>{
    const ano = Y-2+Math.floor(i/12), dim = S.anos.size && !S.anos.has(String(ano));
    let y = mt+ih; const x = ml+i*step+(step-bw)/2;
    const segs = [["mk",0,1],["mk",1,.42],["gd",0,1],["gd",1,.42]];
    const parts = segs.filter(([k,j])=>c[k][j]>0);
    parts.forEach(([k,j,op],pi)=>{ const h=ih*c[k][j]/top, last=pi===parts.length-1; y-=h;
      s += last ? `<path d="${barTop(x,y,bw,h-(pi?1:0))}" fill="${coCor(k==="gd"?"Gadens":"Make It")}" opacity="${dim?op*.3:op}"/>` : `<rect x="${x}" y="${y+1}" width="${bw}" height="${Math.max(0,h-1)}" fill="${coCor(k==="gd"?"Gadens":"Make It")}" opacity="${dim?op*.3:op}"/>`; });
    if (c.its.length) s += `<rect class="hit" data-i="${i}" x="${ml+i*step}" y="${mt}" width="${step}" height="${ih}" fill="transparent"/>`;
  });
  anos.forEach((a,k)=>{ const on=S.anos.has(String(a)), cur=a===Y;
    s += `<text x="${ml+(k*12+6)*step}" y="${H-8}" text-anchor="middle" style="${cur||on?"fill:var(--label);font-weight:700":""}">${a}</text>
      <rect class="hit" data-ano="${a}" x="${ml+k*12*step}" y="${mt+ih}" width="${12*step}" height="${mb}" fill="transparent"/>`; });
  box.innerHTML = s + `</svg>`;
  box.querySelectorAll(".hit[data-i]").forEach(r=>{
    const i=+r.dataset.i, c=cel[i], ano=Y-2+Math.floor(i/12), m=i%12;
    bindTip(r, `<b>${MESES[m]}/${ano}</b> · ${brl(tot(c))}<table>${c.its.slice().sort((a,b)=>vig(b).vgv_bruto-vig(a).vgv_bruto).map(e=>`<tr><td><span class="tagc" style="--c:${coCor(e.incorporadora)}">${esc(e.nome)}</span></td><td>${lanc(e).ok?"lançado":"previsto"}</td><td class="n">${brl(vig(e).vgv_bruto)}</td></tr>`).join("")}</table><div class="muted">clique para filtrar ${ano}</div>`);
    r.onclick = ()=>{ hideTip(); toggle(S.anos, String(ano)); };
  });
  box.querySelectorAll(".hit[data-ano]").forEach(r=>{ bindTip(r, `Clique para ${S.anos.has(r.dataset.ano)?"tirar o filtro de":"filtrar"} ${r.dataset.ano}`); r.onclick=()=>{ hideTip(); toggle(S.anos, r.dataset.ano); }; });
  const semData = filtrados("ano").filter(e=>!lanc(e)&&!e.legado).map(e=>e.nome);
  const info = `<b>Trajetória de lançamentos</b><p>Cada barra é o VGV bruto (viabilidade vigente) dos empreendimentos com Lançamento Comercial naquele mês, pela data do marco no cronograma do ClickUp.</p><p>O ano atual fica ao centro, com dois anos para trás e dois para frente. Barra cheia = já lançado; clara = previsto. As cores separam Make It e Gadens.</p>${fora.length?`<p class="muted">Fora da janela: ${esc(fora.map(e=>`${e.nome} (${my(lanc(e).data)})`).join(", "))}.</p>`:""}${semData.length?`<p class="muted">Sem data de lançamento: ${esc(semData.join(", "))}.</p>`:""}`;
  const ib = $("trajInfo"); ib.onmousemove = ev=>showTip(info,ev); ib.onmouseleave = hideTip; ib.onclick = ev=>{ ev.stopPropagation(); tip.hidden ? showTip(info,ev) : hideTip(); };
}

/* ---------- Distribuição: rosca com raio variável ---------- */
function renderDonut(){
  const L = filtrados(grupoDim());
  $("distTitle").textContent = "Distribuição por "+({fase:"fase",linha:"linha de produto",cidade:"cidade"})[S.group];
  const g = grupoOrdem().map(id=>{ const its=L.filter(e=>grupoDe(e)===id); return {id, its, n:its.length, vgv:its.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0)}; }).filter(x=>x.n);
  const box = $("donut"), set = grupoSet();
  if (!g.length){ box.innerHTML="<p class='muted'>Nenhum empreendimento nos filtros atuais.</p>"; $("donutLeg").innerHTML=""; return; }
  const N = g.reduce((a,x)=>a+x.n,0), maxV = Math.max(...g.map(x=>x.vgv),1);
  const S0=150, cx=S0, cy=S0, r0=62, rMin=92, rMax=140, gap=.03;
  let a0 = -Math.PI/2, s = `<svg viewBox="0 0 ${S0*2} ${S0*2}" role="img" aria-label="Distribuição dos empreendimentos">`;
  const P = (r,a)=>[cx+r*Math.cos(a), cy+r*Math.sin(a)];
  g.forEach((x,i)=>{
    const da = x.n/N*Math.PI*2, a1=a0+gap/2, a2=a0+da-gap/2, r=rMin+(rMax-rMin)*Math.sqrt(x.vgv/maxV), lg=(a2-a1)>Math.PI?1:0;
    const [x1,y1]=P(r,a1),[x2,y2]=P(r,a2),[x3,y3]=P(r0,a2),[x4,y4]=P(r0,a1);
    const dim = set.size && !set.has(x.id), cor=grupoCor(x.id);
    s += `<path class="hit${dim?" dim":""}" data-i="${i}" d="M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 ${lg} 0 ${x4},${y4} Z" fill="${cor}" stroke="${cor}" stroke-width="3" stroke-linejoin="round"/>`;
    a0 += da;
  });
  const vt = g.reduce((a,x)=>a+x.vgv,0);
  s += `<g class="ctr"><text x="${cx}" y="${cy+4}" text-anchor="middle"><tspan style="font-family:var(--font-d);font-size:34px;font-weight:700;fill:var(--label)">${N}</tspan></text><text x="${cx}" y="${cy+22}" text-anchor="middle">empreendimentos</text><text x="${cx}" y="${cy+37}" text-anchor="middle" style="fill:var(--label);font-weight:600">${brl(vt)}</text></g></svg>`;
  box.innerHTML = s;
  box.querySelectorAll(".hit").forEach(p=>{
    const x=g[p.dataset.i];
    bindTip(p, `<b>${esc(grupoNome(x.id))}</b> · ${x.n} ${x.n===1?"empreendimento":"empreendimentos"} · ${brl(x.vgv)}<table>${x.its.slice().sort((a,b)=>(vig(b)?.vgv_bruto||0)-(vig(a)?.vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td class="muted">${esc(S.group==="fase"?faseNome(e):(FASES.find(f=>f.id===faseDe(e))||{}).nome)}</td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</table><div class="muted">clique para filtrar</div>`);
    p.onclick = ()=>{ hideTip(); toggle(set, x.id); };
  });
  const lg = $("donutLeg"); lg.innerHTML="";
  g.forEach(x=>{ const b=document.createElement("button"); b.style.setProperty("--c",grupoCor(x.id)); b.setAttribute("aria-pressed",String(set.has(x.id))); if (set.size&&!set.has(x.id)) b.className="dim";
    b.innerHTML=`<i style="background:${grupoCor(x.id)}"></i>${esc(grupoNome(x.id))} <b>${x.n}</b>`; b.onclick=()=>toggle(set,x.id); lg.appendChild(b); });
}

/* ---------- Mapa (mapa próprio: mapa.js) ---------- */
let mini = null, full = null, mapBusca = "";
const tema = () => dark()?"dark":"light";
const UIZ = () => +getComputedStyle(document.documentElement).getPropertyValue("--ui") || 1;
const estreito = () => innerWidth<=720;
// área útil do mapa: desconta a barra superior, a barra lateral, os botões da direita e a barra inferior
const sideW = () => (S.fichaAberta && S.mapSel ? Math.min(innerWidth*.58, 900) : 340) * UIZ();
// área livre para centralizar um empreendimento (sem as barras)
const PADF = () => { const p=PAD(); return {top:p.top, bottom:p.bottom, left:p.left-20, right:p.right}; };
const PAD = () => { const u=UIZ(); return estreito() ? {top:70*u, bottom:innerHeight*.44+36+20, left:30, right:64*u} : {top:72*u+16, bottom:36+36, left:sideW()+44, right:64*u+24}; };
const coNome = e => `<em>${esc(e.incorporadora)}</em>`;
const dicaPino = (e, ev) => { if (!e) return hideTip(); showTip(`<b>${esc(e.nome)}</b> · ${esc(grupoNome(grupoDe(e)))}<div class="muted">${esc(e.endereco||e.cidade)}</div>`, ev); };
function renderMap(){
  if (typeof maplibregl === "undefined" || typeof MP === "undefined"){ $("map").innerHTML="<p class='muted' style='padding:16px'>Não foi possível carregar o mapa.</p>"; return; }
  const Ls = filtrados().filter(e=>e.pos);
  if (!mini){
    $("map").dataset.wheel = "livre";
    mini = MP.novo($("map"), {tema:tema()});
    mini.scrollZoom.enable();
    mini.on("click", ()=>fechaCartao());
    mini.once("load", ()=>MP.enquadra(mini, filtrados().filter(e=>e.pos), 50));
  }
  MP.alfinetes(mini, Ls, {cor:corDe, sel:miniSel, dica:(e,ev)=>{ if (e && e.nome===miniSel) return hideTip(); dicaPino(e,ev); }, aoClicar:e=>{ hideTip(); abreCartao(e); }});
  const chave = Ls.map(e=>e.sigla).join(",");
  if (mini.loaded() && chave!==mini._chave) MP.enquadra(mini, Ls, 50, {animar:true});
  mini._chave = chave;
  if (full) renderMapaPagina();
}
// cartão do empreendimento dentro do mapa da página inicial
let miniSel = null, cartao = null;
function fechaCartao(){ if (cartao){ cartao.remove(); cartao=null; } if (miniSel){ miniSel=null; renderMap(); } }
function abreCartao(e){
  if (cartao) cartao.remove();
  miniSel = e.nome; renderMap();
  const v=vig(e), el=document.createElement("div");
  el.innerHTML = `<div class="mc-h">${MP.icone(e.incorporadora, corDe(e))}<div><b>${esc(e.nome)}</b><span><em style="color:${coCor(e.incorporadora)}">${esc(e.incorporadora)}</em> · ${local(e)}</span></div><button class="mc-x" aria-label="Fechar">×</button></div>
    <div class="mc-k"><div><span>VGV</span><b>${brl(v?.vgv_bruto)}</b></div><div><span>Margem</span><b>${pct(v?.margem,1)}</b></div><div><span>Fase</span><b>${esc(faseNome(e))}</b></div></div>
    <div class="mc-a"><button data-a="ficha">Ver ficha</button><button data-a="viab">Viabilidade</button><button data-a="mapa" class="ic" aria-label="Abrir no mapa" data-tip="Abrir no mapa"><svg viewBox="0 0 24 24"><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"/></svg></button></div>`;
  el.querySelector(".mc-x").onclick = ev=>{ ev.stopPropagation(); fechaCartao(); };
  el.querySelector('[data-a="mapa"]').onclick = ()=>{ fechaCartao(); abreNoMapa(e); };
  el.querySelector('[data-a="ficha"]').onclick = ()=>{ fechaCartao(); abreFicha(e); };
  el.querySelector('[data-a="viab"]').onclick = ()=>{ fechaCartao(); abreViab(e); };
  cartao = new maplibregl.Popup({closeButton:false, closeOnClick:false, offset:[0,-30], maxWidth:"290px", className:"mcard"}).setLngLat([e.pos[1],e.pos[0]]).setDOMContent(el).addTo(mini);
  mini.easeTo({center:[e.pos[1],e.pos[0]], offset:[0,60], duration:500});
}
function abreNoMapa(e){ S.mapSel = e ? e.sigla : null; S.fichaAberta=false; irPara("mapa"); }
function abreFicha(e){ S.mapSel = e.sigla; S.fichaAberta = true; irPara("mapa"); }
function marca3d(){ if (!full) return; $("b3d").setAttribute("aria-pressed", String(full._3d)); const b=$("fVista"); if (b){ b.classList.toggle("on", full._3d); b.lastChild.textContent = full._3d?"3D":"2D"; } }
function voltaTodos(animar=true){
  if (!full) return;
  MP.enquadra(full, filtrados().filter(x=>x.pos), PAD(), {animar, plano:true});
  marca3d();
}
function selMapa(e, voar=true){
  if (!e || e.sigla!==S.mapSel) S.fichaAberta = S.fichaAberta && !!e && false;
  S.mapSel = e ? e.sigla : null;
  history.replaceState(null, "", "#mapa"+(e?":"+e.sigla+(S.fichaAberta?":ficha":""):""));
  if (e && voar && full){ MP.voa3d(full, e.pos, {padding:PADF()}); marca3d(); }
  if (!e) voltaTodos();
  renderMapaPagina();
}
function iniciaMapaPagina(){
  if (full) { full.resize(); return; }
  const el = $("mapaFull"); el.dataset.wheel = "livre";
  full = MP.novo(el, {tema:tema(), controles:true});
  full.scrollZoom.enable();
  full.addControl(new maplibregl.ScaleControl({maxWidth:90, unit:"metric"}), "top-left");
  full.once("load", ()=>{ const e = D.empreendimentos.find(x=>x.sigla===S.mapSel); if (e) MP.voa3d(full, e.pos, {padding:PADF()}); else voltaTodos(false); marca3d(); });
  $("b3d").onclick = ()=>{ if (full._orb) MP.orbita(full,false); MP.aplica3d(full, !full._3d); marca3d(); renderMapaPagina(); };
  $("bTipo").onclick = ()=>{ MP.satelite(full, !full._sat); $("bTipo").setAttribute("aria-pressed", String(full._sat)); document.querySelector(".mapa-page").classList.toggle("sat", full._sat); };
  $("bZin").onclick = ()=>full.zoomIn(); $("bZout").onclick = ()=>full.zoomOut();
  $("bNorte").onclick = ()=>{ if (full._orb) MP.orbita(full,false); full.easeTo({bearing:0, duration:700}); };
  $("bTodos").onclick = ()=>{ if (S.mapSel) selMapa(null,false); else voltaTodos(); };
  const ag = $("agulha"); full.on("rotate", ()=>{ ag.style.transform = `rotate(${-full.getBearing()}deg)`; });
  full.on("pitchend", marca3d);
  full.on("orbita", ()=>{ const b=$("fGira"); if (b){ b.classList.toggle("on", full._orb); b.lastChild.textContent = full._orb?"Girando":"Girar"; } });
  renderMapaPagina();
}
const bairroDe = e => { const m=(e.endereco||"").match(/-\s*([^,]+),\s*[^,]+-\s*PR/) || (e.endereco||"").match(/,\s*\d+\s*[-,]\s*([^,]+),/); return m ? m[1].trim() : ""; };
const local = e => esc(e.cidade)+(bairroDe(e)?" - "+esc(bairroDe(e)):"");
// anel de eficiência e linha do tempo da ficha
function anel(v, cor){ const r=26, c=2*Math.PI*r, f=v==null?0:Math.max(0,Math.min(1,v)); return `<svg class="anel" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--fill-2)" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${cor}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c*f} ${c}" transform="rotate(-90 32 32)"/></svg>`; }
function linhaTempo(e, box){
  const ms = Object.entries(e.marcos).map(([c,m])=>({c, n:D.marco_nome[c]||c, ...m, t:+new Date(m.data)})).sort((a,b)=>a.t-b.t);
  if (!ms.length){ box.innerHTML="<p class='muted'>Sem marcos de cronograma no ClickUp.</p>"; return; }
  const hoje=+new Date(HOJE()), t0=Math.min(ms[0].t, hoje), t1=Math.max(ms[ms.length-1].t, hoje), span=(t1-t0)||1;
  const W=Math.max(420, box.clientWidth||700), ml=18, mr=18, H=200, y0=H/2, X=t=>ml+(W-ml-mr)*(t-t0)/span, cor=corDe(e);
  let s=`<svg viewBox="0 0 ${W} ${H}"><line x1="${ml}" x2="${W-mr}" y1="${y0}" y2="${y0}" stroke="var(--fill-2)" stroke-width="4" stroke-linecap="round"/>`;
  const done=ms.filter(m=>m.ok); if (done.length) s+=`<line x1="${ml}" x2="${X(Math.max(...done.map(m=>m.t)))}" y1="${y0}" y2="${y0}" stroke="${cor}" stroke-width="4" stroke-linecap="round"/>`;
  for (let a=new Date(t0).getFullYear()+1; a<=new Date(t1).getFullYear(); a++){ const x=X(+new Date(a,0,1)); s+=`<line x1="${x}" x2="${x}" y1="${y0-6}" y2="${y0+6}" stroke="var(--label-3)"/><text x="${x}" y="${H-4}" text-anchor="middle">${a}</text>`; }
  s+=`<line x1="${X(hoje)}" x2="${X(hoje)}" y1="16" y2="${H-18}" stroke="var(--red-ink)" stroke-dasharray="3 3"/><text x="${X(hoje)}" y="12" text-anchor="middle" style="fill:var(--red-ink);font-weight:700">hoje</text>`;
  const fila=[0,0]; let ultimo=[-1e9,-1e9];
  ms.forEach((m,i)=>{ const x=X(m.t), lado=i%2, nivel = x-ultimo[lado] < 120 ? 1 : 0; ultimo[lado]=x;
    const yy = lado ? y0+26+nivel*26 : y0-20-nivel*26;
    s+=`<line x1="${x}" x2="${x}" y1="${y0}" y2="${lado?yy-11:yy+4}" stroke="var(--label-3)" stroke-width="1"/><circle cx="${x}" cy="${y0}" r="6" fill="${m.ok?cor:"var(--card-solid)"}" stroke="${cor}" stroke-width="2.4"/>
      <text x="${x}" y="${yy}" text-anchor="middle" style="fill:var(--label);font-weight:600;font-size:10.5px">${esc(m.n)}</text><text x="${x}" y="${yy+12}" text-anchor="middle" style="font-size:9.5px">${my(m.data)}</text>`; });
  box.innerHTML = s+"</svg>";
}
const urlLista = e => e.lista_id ? `https://app.clickup.com/9013344143/v/li/${e.lista_id}` : null;
function renderMapaPagina(){
  if (!full) return;
  const Ls = filtrados().filter(e=>e.pos), sel = D.empreendimentos.find(x=>x.sigla===S.mapSel);
  MP.alfinetes(full, Ls, {cor:corDe, sel:sel?.nome, dica:dicaPino, aoClicar:e=>{ hideTip(); selMapa(e); }});
  const side = $("mside");
  if (sel){
    const v=vig(sel), p=proj(sel), cor=corDe(sel), larga=!!S.fichaAberta;
    document.querySelector(".mapa-page").classList.toggle("ficha-larga", larga);
    document.documentElement.classList.toggle("ficha-larga", larga);
    const marcos = Object.entries(sel.marcos).map(([c,m])=>({c, n:D.marco_nome[c]||c, ...m})).sort((a,b)=>a.data.localeCompare(b.data));
    const ef = v && v.area_privativa && v.area_construida ? v.area_privativa/v.area_construida : null;
    const capa = `<div class="f-capa${sel.foto?"":" vazia"}" style="--c:${cor}">${sel.foto?`<img src="${esc(sel.foto)}" alt="${esc(sel.nome)}" loading="lazy">`:`<span class="f-capa-g">${MP.icone(sel.incorporadora, cor)}</span>`}</div>`;
    const acoes = `<div class="f-acts">
        <button id="fVista" class="${full._3d?"on":""}"><svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>${full._3d?"3D":"2D"}</button>
        <button id="fGira" class="${full._orb?"on":""}"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4.5v4h-4"/></svg>${full._orb?"Girando":"Girar"}</button>
        <a href="https://maps.apple.com/?ll=${sel.pos[0]},${sel.pos[1]}&q=${encodeURIComponent(sel.nome)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"/></svg>Mapas</a>
        <a href="https://www.google.com/maps/search/?api=1&query=${sel.pos[0]},${sel.pos[1]}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/></svg>Google</a>
        <button id="fCopia"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="12" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>Copiar</button>
      </div>`;
    const topo = `<div class="f-top"><button class="f-back" id="fBack"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>Empreendimentos</button>
        <button class="f-exp" id="fExp" aria-pressed="${larga}" data-tip="${larga?"Recolher a ficha":"Abrir a ficha completa do empreendimento"}" aria-label="${larga?"Recolher a ficha":"Abrir a ficha completa"}">${larga?'<svg viewBox="0 0 24 24"><path d="M10 4v6H4M14 20v-6h6M4 10l6-6M20 14l-6 6"/></svg>':'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>'}</button></div>
      ${capa}
      <div class="f-hd">${MP.icone(sel.incorporadora, cor)}<div><h2>${esc(sel.nome)}</h2><div class="f-sub">${coNome(sel)} · ${local(sel)}${sel.ex_nome?" · ex-"+esc(sel.ex_nome):""}</div></div></div>
      <div class="f-tags"><span class="tagc" style="--c:${faseCor(faseDe(sel))}">${esc(faseNome(sel))}</span>${v?`<span class="tagc" style="--c:${verCor(v.versao)}">${v.versao} – ${VNOME_C[v.versao]}</span>`:""}</div>
      <div class="f-end"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg><span>${esc(sel.endereco||sel.cidade)}${sel.pos_fonte!=="clickup"?" · posição aproximada":""}</span></div>
      ${acoes}`;
    const links = `<div class="f-links"><button class="pillbtn" id="fViab2"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.2 0 3 5.6 1.6 5.6 4.5 0 1.3-1.2 2.2-2.8 2.2"/></svg>Página de viabilidade</button>${urlLista(sel)?`<a class="pillbtn" href="${urlLista(sel)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17"/></svg>Cronograma no ClickUp ↗</a>`:""}</div>`;
    if (!larga){
      side.innerHTML = `<div class="ficha" style="--co:${coCor(sel.incorporadora)}">${topo}
      <div class="f-kpi"><div><span>VGV bruto</span><b>${brl(v?.vgv_bruto)}</b></div><div><span>Unidades</span><b>${nf(v?.unidades)}</b></div>
        <div><span>Margem líquida</span><b>${pct(v?.margem,1)}</b></div><div><span>Projetada no lançamento</span><b>${p?pct(p.m,1):"—"}</b></div></div>
      <dl class="f-dl"><div><dt>Linha de produto</dt><dd>${esc(linhaInfo(linhaDe(sel)).curto)}</dd></div>
        <div><dt>Viabilidade vigente</dt><dd>${v?`<a href="#viabilidade:${sel.sigla}" id="fViab">${v.versao+" – "+VNOME[v.versao]+(v.mes?" · "+v.mes.slice(5)+"/"+v.mes.slice(0,4):"")} ↗</a>`:"—"}</dd></div>
        ${urlLista(sel)?`<div><dt>Cronograma</dt><dd><a href="${urlLista(sel)}" target="_blank" rel="noopener">Abrir no ClickUp ↗</a></dd></div>`:""}</dl>
      <button class="f-mais" id="fMais">Ver ficha completa<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      ${marcos.length?`<div class="f-h">Marcos do cronograma</div><ul class="f-tl">${marcos.map(m=>`<li class="${m.ok?"ok":""}"><i></i><span>${esc(m.n)}</span><span>${dmy(m.data)}</span></li>`).join("")}</ul>`:""}
    </div>`;
    } else {
      const ks = [["VGV bruto", brl(v?.vgv_bruto), v?.vgv_liquido!=null?`líquido ${brl(v.vgv_liquido)}`:""],["Unidades", nf(v?.unidades), v?.permutas?`${nf(v.permutas)} permutadas`:"sem permutas"],
        ["Margem líquida", pct(v?.margem,2), p&&p.aj?`projetada no lançamento ${pct(p.m,1)}`:"viabilidade de lançamento"],["Lucro líquido", brl(v?.lucro), v?.exposicao!=null?`exposição máx. ${brl(v.exposicao)}`:""]];
      const prod = [["Área do terreno", v?.area_terreno!=null?nf(v.area_terreno)+" m²":"—"],["Área construída", v?.area_construida!=null?nf(v.area_construida)+" m²":"—"],
        ["Área privativa total", v?.area_privativa!=null?nf(v.area_privativa)+" m²":"—"],["Aproveitamento (construída ÷ terreno)", v?.area_terreno&&v?.area_construida?nf(v.area_construida/v.area_terreno,2)+"×":"—"],
        ["Preço de venda médio", v?.preco_medio!=null?"R$ "+nf(v.preco_medio):"—"],["Custo por m² construído", v?.custo_m2!=null?"R$ "+nf(v.custo_m2):"—"],
        ["Custo de obra", brl(v&&v.custo_m2!=null&&v.area_construida!=null?v.custo_m2*v.area_construida:null)],["Linha de produto", esc(linhaInfo(linhaDe(sel)).curto)]];
      const vers = etapas(sel);
      side.innerHTML = `<div class="ficha larga" style="--co:${coCor(sel.incorporadora)}">
        <div class="fl-cab">${topo}</div>
        <div class="fl-cor">
          <div class="fl-kpis">${ks.map(([k,b,s])=>`<div><span>${k}</span><b>${b}</b><small>${s}</small></div>`).join("")}</div>
          <div class="fl-2">
            <section class="fl-box"><h4>Produto e terreno</h4><div class="fl-ef">${anel(ef, cor)}<div><b>${ef!=null?pct(ef,1):"—"}</b><span>eficiência<br>privativa ÷ construída</span></div></div>
              <dl class="f-dl">${prod.map(([k,x])=>`<div><dt>${k}</dt><dd>${x}</dd></div>`).join("")}</dl></section>
            <section class="fl-box"><h4>Viabilidades</h4><div class="fl-vers">${vers.map(x=>`<div class="fv ${x.st}${v&&x.v===v.versao?" vig":""}" style="--c:${verCor(x.v)}"><i></i><b>${x.v}</b><span>${x.st==="ok"?pct(x.d.margem,1):"aguardando"}</span><small>${x.st==="ok"?brl(x.d.vgv_bruto):""}</small></div>`).join("")}</div>
              <p class="cap" style="margin:8px 0 10px">${v?`Vigente: <b>${v.versao} – ${VNOME_C[v.versao]}</b>, elaborada em ${mesTxt(v.mes)} (${idadeTxt(v.mes)}).`:"Sem viabilidade cadastrada."}${p&&p.aj?` Margem projetada no lançamento: <b>${pct(p.m,1)}</b> (${pp(p.aj)}, ${esc(p.motivo)}).`:""}</p>
              ${links}</section>
          </div>
          <section class="fl-box"><h4>Linha do tempo</h4><div class="chart" id="fTempo"></div></section>
        </div></div>`;
      linhaTempo(sel, $("fTempo"));
    }
    $("fBack").onclick = ()=>{ S.fichaAberta=false; selMapa(null,false); };
    $("fExp").onclick = ()=>{ S.fichaAberta=!S.fichaAberta; hideTip(); history.replaceState(null,"","#mapa:"+sel.sigla+(S.fichaAberta?":ficha":"")); renderMapaPagina(); setTimeout(()=>{ full.resize(); full.easeTo({center:[sel.pos[1],sel.pos[0]], padding:PADF(), duration:500}); }, 320); };
    if ($("fMais")) $("fMais").onclick = ()=>$("fExp").click();
    if ($("fViab")) $("fViab").onclick = ev=>{ ev.preventDefault(); abreViab(sel); };
    if ($("fViab2")) $("fViab2").onclick = ()=>abreViab(sel);
    $("fVista").onclick = ()=>{ if (full._3d){ if (full._orb) MP.orbita(full,false); MP.aplica3d(full,false); } else MP.voa3d(full, sel.pos, {orbitar:false, padding:PADF()}); marca3d(); renderMapaPagina(); };
    $("fGira").onclick = ()=>{ if (full._orb) MP.orbita(full,false); else if (full._3d) MP.orbita(full,true); else MP.voa3d(full, sel.pos, {padding:PADF()}); marca3d(); };
    $("fCopia").onclick = ()=>{ try{ navigator.clipboard.writeText(sel.endereco||""); $("fCopia").lastChild.textContent="Copiado"; }catch(e){} };
    return;
  }
  document.querySelector(".mapa-page").classList.remove("ficha-larga"); document.documentElement.classList.remove("ficha-larga");
  const q = mapBusca.trim().toLowerCase();
  const its = Ls.filter(e=>!q || (e.nome+" "+(e.endereco||"")+" "+e.cidade+" "+(e.ex_nome||"")).toLowerCase().includes(q));
  const grupos = grupoOrdem().map(id=>({id, its:ordena(its.filter(e=>grupoDe(e)===id))})).filter(g=>g.its.length);
  const chev = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>', seta = '<svg viewBox="0 0 24 24"><path d="M8 16L16 8M9.5 8H16v6.5"/></svg>';
  side.innerHTML = `<div class="ms-h"><h2>Empreendimentos <span>${its.length}</span></h2>
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="mBusca" type="search" placeholder="Buscar por nome, rua ou bairro" value="${esc(mapBusca)}"></label></div>
    <div class="ms-b">${grupos.map(g=>{ const ab=!S.mgFech.has(S.group+":"+g.id), vg=g.its.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0);
      return `<button class="mg-h" data-g="${esc(g.id)}" aria-expanded="${ab}" style="--c:${grupoCor(g.id)}"><span class="cv">${chev}</span><b>${esc(S.group==="fase"?({DEV:"Des. p/ Lançamento",LIB:"Liberação p/ Obra",OBR:"Em obra"})[g.id]||grupoNome(g.id):grupoNome(g.id))}</b><span class="n">${g.its.length} Emp.</span><span class="vg">${vg?brl(vg)+" VGV":""}</span></button>
      ${ab?`<div class="mg-c">${g.its.map(e=>`<div class="ms-r" role="button" tabindex="0" data-s="${e.sigla}" style="--co:${coCor(e.incorporadora)}">${MP.icone(e.incorporadora, corDe(e))}<b>${esc(e.nome)}</b>${urlLista(e)?`<a class="go" href="${urlLista(e)}" target="_blank" rel="noopener" data-tip="Abrir o cronograma no ClickUp" aria-label="Abrir o cronograma de ${esc(e.nome)} no ClickUp">${seta}</a>`:`<span class="go" style="opacity:.35">${seta}</span>`}<span class="s">${coNome(e)} · ${local(e)}</span></div>`).join("")}</div>`:""}`; }).join("") || "<p class='muted' style='padding:12px'>Nenhum empreendimento encontrado.</p>"}</div>`;
  const inp = $("mBusca"); inp.oninput = ()=>{ mapBusca = inp.value; const pos=inp.selectionStart; renderMapaPagina(); const n=$("mBusca"); n.focus(); n.setSelectionRange(pos,pos); };
  side.querySelectorAll(".mg-h").forEach(b=>b.onclick=()=>{ const k=S.group+":"+b.dataset.g; S.mgFech.has(k)?S.mgFech.delete(k):S.mgFech.add(k); renderMapaPagina(); });
  side.querySelectorAll(".ms-r").forEach(b=>{ const e=D.empreendimentos.find(x=>x.sigla===b.dataset.s);
    b.onclick = ev=>{ if (ev.target.closest("a")) return; selMapa(e); };
    b.onkeydown = ev=>{ if (ev.key==="Enter") selMapa(e); };
  });
}

/* ---------- Saúde financeira (seção recolhível) ---------- */
function dadosSaude(){
  const L = filtrados().filter(e=>vig(e)&&vig(e).margem!=null);
  const vl=L.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0), lu=L.reduce((a,e)=>a+(vig(e).lucro||0),0), ex=L.reduce((a,e)=>a+(vig(e).exposicao||0),0);
  const P = L.filter(e=>!lanc(e)?.ok && vig(e).versao!=="V4");
  const pv=P.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0), pm=P.reduce((a,e)=>a+proj(e).m*(vig(e).vgv_liquido||0),0), pm0=P.reduce((a,e)=>a+vig(e).margem*(vig(e).vgv_liquido||0),0);
  return {L, P, media:vl?lu/vl:null, projetada:pv?pm/pv:null, delta:pv?(pm-pm0)/pv:null, lucro:lu, expo:ex};
}
function renderSaude(){
  const d = dadosSaude();
  $("saudeSum").textContent = `margem média ${pct(d.media,1)} · projetada no lançamento ${pct(d.projetada,1)} · lucro ${brl(d.lucro)}`;
  $("saudeToggle").setAttribute("aria-expanded", String(S.saudeOpen));
  const body = $("saudeBody"); body.hidden = !S.saudeOpen;
  if (!S.saudeOpen) return;
  body.innerHTML = `
    <div class="tile"><span class="k">Margem líquida média</span><b>${pct(d.media)}</b><span class="s">vigentes · ponderada pelo VGV líquido</span></div>
    <div class="tile"><span class="k">Margem projetada no lançamento</span><b>${pct(d.projetada)}</b><span class="s">${d.P.length} a lançar · ${pp(d.delta)} vs. a vigente</span></div>
    <div class="tile w2"><span class="k">Lucro líquido projetado</span><b>${brl(d.lucro)}</b><span class="s">soma das viabilidades vigentes · por ano de lançamento abaixo</span></div>
    <div class="tile w4"><div class="th"><h4>VGV e lucro líquido por ano de lançamento</h4><div class="leg" id="lucroLeg" style="margin:0"></div></div><p class="cap">barra clara = VGV bruto · barra cheia = lucro líquido da viabilidade vigente · traço = meta de VGV · clique num ano para filtrar</p><div class="chart" id="lucroAnos"></div></div>
    <div class="tile w2"><div class="th"><h4>Margem projetada dos lançamentos × meta</h4><button class="link" id="howBtn">Como é calculada</button></div><p class="cap">média ponderada pelo VGV líquido · clique num ano para filtrar</p><div class="chart" id="metaYears"></div></div>
    <div class="tile w2"><div class="th"><h4>Margem média por ${({fase:"fase",linha:"linha de produto",cidade:"cidade"})[S.group]}</h4></div><p class="cap">vigente → projetada no lançamento</p><div class="chart" id="margGrp"></div></div>
`;
  $("howBtn").onclick = abreHow;
  chartLucro(); chartAnos(); chartGrupo(d.L);
}
function chartLucro(){
  const box=$("lucroAnos"); if (!box) return;
  const Y=ANO(), anos=[Y-2,Y-1,Y,Y+1,Y+2,Y+3], incs=S.inc==="all"?["Make It","Gadens"]:[S.inc];
  const LA = filtrados("ano").filter(e=>vig(e)&&lanc(e));
  const cel = anos.map(a=>incs.map(i=>{ const its=LA.filter(e=>e.incorporadora===i&&anoLanc(e)===a); return {i, its, vgv:its.reduce((s,e)=>s+(vig(e).vgv_bruto||0),0), lucro:its.reduce((s,e)=>s+(vig(e).lucro||0),0), meta:(METAS[a]||{})[i]?.vgv||null}; }));
  $("lucroLeg").innerHTML = incs.map(i=>`<span><i style="background:${coCor(i)}"></i>${i}</span>`).join("");
  const W=Math.max(320,box.clientWidth||900), H=230, mt=26, mb=24, mr=46, iw=W-mr, ih=H-mt-mb;
  const maxV=Math.max(...cel.flat().map(c=>Math.max(c.vgv,c.meta||0)),1), st=niceStep(maxV,3), top=Math.ceil(maxV/st)*st, Yp=v=>mt+ih-ih*v/top;
  const step=iw/anos.length, gw=Math.min(46, step*.36), gap=6, grpW=incs.length*gw+(incs.length-1)*gap;
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  for (let v=0; v<=top+1; v+=st) s+=`<line x1="0" x2="${iw}" y1="${Yp(v)}" y2="${Yp(v)}" stroke="var(--grid)"/><text x="${iw+6}" y="${Yp(v)+3.5}">${v?mi(v):"0"}</text>`;
  anos.forEach((a,k)=>{ const x0=k*step+(step-grpW)/2, dim=S.anos.size&&!S.anos.has(String(a));
    s+=`<g class="${dim?"dim":""}">`;
    cel[k].forEach((c,j)=>{ const x=x0+j*(gw+gap), cor=coCor(c.i);
      if (c.vgv) s+=`<path d="${barTop(x,Yp(c.vgv),gw,mt+ih-Yp(c.vgv),5)}" fill="${cor}" opacity=".28"/>`;
      if (c.lucro) s+=`<path d="${barTop(x+5,Yp(c.lucro),gw-10,mt+ih-Yp(c.lucro),4)}" fill="${cor}"/><text class="val" x="${x+gw/2}" y="${Yp(c.vgv)-6}" text-anchor="middle" style="font-size:10px">${mi(c.lucro)}</text>`;
      if (c.meta) s+=`<rect x="${x-3}" y="${Yp(c.meta)-1}" width="${gw+6}" height="2.4" rx="1.2" fill="var(--label)" opacity=".8"/>`; });
    s+=`<text x="${k*step+step/2}" y="${H-6}" text-anchor="middle" ${a===Y||S.anos.has(String(a))?'style="fill:var(--label);font-weight:700"':""}>${a}</text></g><rect class="hit" data-k="${k}" x="${k*step}" y="0" width="${step}" height="${H}" fill="transparent"/>`; });
  box.innerHTML=s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const k=+r.dataset.k, a=anos[k];
    bindTip(r, `<b>Lançamentos ${a}</b><table>${cel[k].map(c=>`<tr><td><span class="tagc" style="--c:${coCor(c.i)}">${c.i}</span></td><td class="n">VGV ${brl(c.vgv)}</td><td class="n">lucro ${brl(c.lucro)}</td><td class="n">${c.vgv?"margem "+pct(c.lucro/(c.its.reduce((s,e)=>s+(vig(e).vgv_liquido||0),0)||1),1):""}</td></tr><tr><td></td><td class="n muted">${c.meta?"meta "+brl(c.meta)+" ("+nf(c.vgv/c.meta*100,0)+"%)":"sem meta"}</td><td colspan="2" class="muted">${esc(c.its.map(e=>e.nome).join(", "))}</td></tr>`).join("")}</table><div class="muted">clique para filtrar ${a}</div>`);
    r.onclick=()=>{ hideTip(); toggle(S.anos, String(a)); }; });
}
function chartAnos(){
  const LA = filtrados("ano").filter(e=>vig(e)&&vig(e).margem!=null&&lanc(e));
  const anos = {}; LA.forEach(e=>{ const a=anoLanc(e); (anos[a] ||= {v:0,m:0,its:[]}); const w=vig(e).vgv_liquido||0; anos[a].v+=w; anos[a].m+=proj(e).m*w; anos[a].its.push(e); });
  const ks = Object.keys(anos).map(Number).filter(k=>k>=ANO()-1).sort();
  const box = $("metaYears"); if (!ks.length){ box.innerHTML="<p class='muted'>Sem lançamentos nos filtros atuais.</p>"; return; }
  const W=Math.max(280,box.clientWidth||420), H=200, mt=22, mb=22, mr=36, iw=W-mr, ih=H-mt-mb, step=iw/ks.length, bw=Math.min(40,step*.46), top=.30, Y=v=>mt+ih-ih*Math.max(0,v)/top;
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  [0,.1,.2,.3].forEach(v=> s+=`<line x1="0" x2="${iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${iw+6}" y="${Y(v)+3.5}">${nf(v*100,0)}%</text>`);
  ks.forEach((k,i)=>{ const a=anos[k], m=a.v?a.m/a.v:0, x=step*i+(step-bw)/2, meta=metaM(k), dim=S.anos.size&&!S.anos.has(String(k)), abaixo=meta&&m<meta;
    s+=`<g class="${dim?"dim":""}"><path d="${barTop(x,Y(m),bw,mt+ih-Y(m),5)}" fill="var(--accent)"/>`;
    if (meta) s+=`<rect x="${x-6}" y="${Y(meta)-1}" width="${bw+12}" height="2.4" rx="1.2" fill="var(--label)"/>`;
    s+=`<text class="val" x="${x+bw/2}" y="${Math.min(Y(m),meta?Y(meta):1e9)-7}" text-anchor="middle">${nf(m*100,1)}%${abaixo?" ▼":""}</text><text x="${x+bw/2}" y="${H-6}" text-anchor="middle" ${S.anos.has(String(k))?'style="fill:var(--label);font-weight:700"':""}>${k}</text></g>`;
    s+=`<rect class="hit" data-k="${k}" x="${step*i}" y="0" width="${step}" height="${H}" fill="transparent"/>`; });
  box.innerHTML = s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const k=+r.dataset.k, a=anos[k], m=a.v?a.m/a.v:null, meta=metaM(k);
    bindTip(r, `<b>Lançamentos ${k}</b> · projetada ${pct(m)}${meta?` · meta ${pct(meta,0)} (${pp(m-meta)})`:" · sem meta definida"}<table>${a.its.slice().sort((x,y)=>proj(y).m-proj(x).m).map(e=>`<tr><td><span class="tagc" style="--c:${corDe(e)}">${esc(e.nome)}</span></td><td class="muted">${vig(e).versao}</td><td class="n">${pct(proj(e).m,1)}</td></tr>`).join("")}</table><div class="muted">▼ abaixo da meta · traço = meta</div>`);
    r.onclick=()=>{ hideTip(); toggle(S.anos, String(k)); }; });
}
function chartGrupo(L){
  const g = grupoOrdem().map(id=>{ const its=L.filter(e=>grupoDe(e)===id); const v=its.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0);
    return {id, its, m:v?its.reduce((a,e)=>a+vig(e).margem*(vig(e).vgv_liquido||0),0)/v:null, p:v?its.reduce((a,e)=>a+proj(e).m*(vig(e).vgv_liquido||0),0)/v:null}; }).filter(x=>x.its.length);
  const box=$("margGrp"); if (!g.length){ box.innerHTML=""; return; }
  const W=Math.max(280,box.clientWidth||420), rowH=30, ml=196, mr=92, H=g.length*rowH+18, iw=W-ml-mr, top=.32, X=v=>ml+iw*Math.max(0,v)/top;
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  [0,.1,.2,.3].forEach(v=> s+=`<line x1="${X(v)}" x2="${X(v)}" y1="0" y2="${H-16}" stroke="var(--grid)"/><text x="${X(v)}" y="${H-3}" text-anchor="middle">${nf(v*100,0)}%</text>`);
  g.forEach((x,i)=>{ const y=i*rowH+6, cor=grupoCor(x.id);
    s+=`<text x="${ml-10}" y="${y+12}" text-anchor="end">${esc(grupoNome(x.id))}</text><rect x="${ml}" y="${y+3}" width="${Math.max(3,X(x.m)-ml)}" height="12" rx="4" fill="${cor}"/>`;
    if (Math.abs(x.p-x.m)>.0005) s+=`<circle cx="${X(x.p)}" cy="${y+9}" r="4.5" fill="var(--card-solid)" stroke="var(--label)" stroke-width="2"/>`;
    s+=`<text class="val" x="${W-mr+8}" y="${y+12.5}">${nf(x.m*100,1)}%${Math.abs(x.p-x.m)>.0005?` <tspan style="font-weight:400;fill:var(--label-2)">→ ${nf(x.p*100,1)}%</tspan>`:""}</text>`; });
  box.innerHTML=s+"</svg>";
}
function chartDumbbell(L){
  const its = L.slice().sort((a,b)=>proj(b).m-proj(a).m), box=$("dumbbell");
  if (!its.length){ box.innerHTML="<p class='muted'>Nenhuma viabilidade nos filtros atuais.</p>"; return; }
  const W=Math.max(320,box.clientWidth||900), rowH=24, ml=150, mr=110, mt=20, H=its.length*rowH+mt+6, iw=W-ml-mr;
  const lo=Math.min(.10, ...its.map(e=>Math.min(vig(e).margem,proj(e).m)-.01)), hi=Math.max(.30, ...its.map(e=>Math.max(vig(e).margem,proj(e).m)+.01));
  const X=v=>ml+iw*(v-lo)/(hi-lo);
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  for (let v=Math.ceil(lo*20)/20; v<=hi+1e-9; v+=.05) s+=`<line x1="${X(v)}" x2="${X(v)}" y1="${mt-4}" y2="${H}" stroke="var(--grid)"/><text x="${X(v)}" y="${mt-8}" text-anchor="middle">${nf(v*100,0)}%</text>`;
  its.forEach((e,i)=>{ const v=vig(e), p=proj(e), y=mt+i*rowH+rowH/2, cor=corDe(e), meta=metaM(anoLanc(e), e.incorporadora), sel=S.sel===e.nome;
    if (i%2===0) s+=`<rect x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" fill="var(--fill)" opacity=".35" rx="6"/>`;
    s+=`<text x="${ml-10}" y="${y+4}" text-anchor="end" ${sel?'style="fill:var(--label);font-weight:700"':""}>${esc(e.nome)}</text>`;
    if (meta) s+=`<rect x="${X(meta)-1}" y="${y-8}" width="2" height="16" rx="1" fill="var(--label)" opacity=".75"/>`;
    s+=`<line x1="${X(v.margem)}" x2="${X(p.m)}" y1="${y}" y2="${y}" stroke="${cor}" stroke-width="3" stroke-linecap="round" opacity=".45"/>`;
    s+=`<circle cx="${X(v.margem)}" cy="${y}" r="4" fill="var(--card-solid)" stroke="${cor}" stroke-width="2"/>`;
    if (p.aj) s+=`<circle cx="${X(p.m)}" cy="${y}" r="5.5" fill="${cor}" stroke="var(--card-solid)" stroke-width="1.5"/>`;
    s+=`<text class="val" x="${W-mr+10}" y="${y+4}">${nf(p.m*100,1)}%${p.aj?` <tspan style="font-weight:400;fill:var(--label-2)">(${p.aj>0?"+":"−"}${nf(Math.abs(p.aj*100),1)})</tspan>`:""}</text>`;
    s+=`<rect class="hit" data-i="${i}" x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/>`; });
  box.innerHTML=s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const e=its[r.dataset.i], v=vig(e), p=proj(e), meta=metaM(anoLanc(e), e.incorporadora);
    bindTip(r, `<b>${esc(e.nome)}</b> · ${v.versao} – ${VNOME[v.versao]}${v.obs?` <span class="muted">(${esc(v.obs)})</span>`:""}<table><tr><td>Margem vigente</td><td class="n">${pct(v.margem)}</td></tr><tr><td>Projetada no lançamento</td><td class="n">${pct(p.m)}${p.aj?` (${pp(p.aj)})`:""}</td></tr><tr><td>Meta ${anoLanc(e)??""}</td><td class="n">${meta?pct(meta,0):"sem meta"}</td></tr><tr><td>Lucro líquido</td><td class="n">${brl(v.lucro)}</td></tr><tr><td>Lançamento</td><td class="n">${lanc(e)?(lanc(e).ok?"lançado ":"previsto ")+my(lanc(e).data):"sem data"}</td></tr></table><div class="muted">${esc(p.motivo)} · clique para abrir no mapa</div>`);
    r.onclick=()=>{ hideTip(); abreNoMapa(e); }; });
}
function abreHow(){
  const bloco = inc => `<div class="box"><h4><span class="mac" style="--c:${coCor(inc)}"></span>${inc}</h4><div class="tbl-wrap"><table class="t" style="min-width:560px"><thead><tr><th>De → para</th><th class="n">Casos</th><th class="n">Ajuste (mediana)</th><th>Casos usados (margem V4 − margem da versão)</th></tr></thead><tbody>${VERS.slice(0,4).filter(v=>!(inc==="Gadens"&&v==="V1")).map(v=>{ const x=AJ[inc][v];
    return `<tr><td><b>${v} → V4</b></td><td class="n">${x.n}</td><td class="n">${x.n>=MIN_AMOSTRA?pp(x.med):"não aplicado"}</td><td class="w muted">${x.pares.map(p=>`${esc(p.nome)} ${pp(p.d)}`).join(" · ")||"nenhum empreendimento com as duas versões ainda"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  const L = filtrados().filter(e=>vig(e)&&vig(e).margem!=null&&!lanc(e)?.ok&&vig(e).versao!=="V4").sort((a,b)=>(anoLanc(a)||9999)-(anoLanc(b)||9999)||a.nome.localeCompare(b.nome,"pt-BR"));
  $("expT").textContent = "Margem projetada no lançamento";
  $("expBody").innerHTML = `
    <p>A margem projetada estima com que margem líquida cada empreendimento deve chegar à viabilidade de lançamento (V4), a partir da margem da versão vigente e de como a margem costuma variar entre as versões nos empreendimentos que já passaram por elas. O objetivo é saber com antecedência se os lançamentos de cada ano vão bater a meta.</p>
    <ol><li>Para cada versão (V0, V1, V2, V3), separamos os empreendimentos que já têm essa versão <b>e</b> a V4 na lista Controle de Viabilidades.</li>
      <li>Em cada um, medimos quanto a margem andou até o lançamento: <span class="formula">margem V4 − margem da versão</span></li>
      <li>O ajuste de cada versão é a <b>mediana</b> dessas variações: um caso fora da curva não puxa a previsão de todos.</li>
      <li>Margem projetada = <span class="formula">margem vigente + ajuste da versão vigente</span></li>
      <li>Make It e Gadens são calculadas separadamente.</li>
      <li>O ajuste só entra com pelo menos ${MIN_AMOSTRA} casos; antes disso, a projetada fica igual à vigente.</li>
      <li>Quem já tem V4, ou já lançou, entra com a própria margem da V4.</li></ol>
    <p>Por ano de lançamento, a projetada é a média ponderada pelo VGV líquido, comparada com a meta de margem de cada incorporadora: Make It 20% em 2026 e 2027, 21% em 2028 e 22% em 2029; Gadens 18% em todos os anos. No consolidado, a meta é a média das duas ponderada pela meta de VGV. O cálculo é refeito a cada atualização.</p>
    ${bloco("Make It")}${bloco("Gadens")}
    <div class="box"><h4>Empreendimentos a lançar</h4><div class="tbl-wrap"><table class="t" style="min-width:620px"><thead><tr><th>Empreendimento</th><th>Lançamento</th><th>Vigente</th><th class="n">Margem vigente</th><th class="n">Ajuste</th><th class="n">Projetada</th><th class="n">Meta</th></tr></thead><tbody>
    ${L.map(e=>{const v=vig(e),p=proj(e),m=metaM(anoLanc(e), e.incorporadora);return `<tr><td>${esc(e.nome)}</td><td>${lanc(e)?my(lanc(e).data):"sem data"}</td><td>${v.versao}</td><td class="n">${pct(v.margem)}</td><td class="n">${p.aj?pp(p.aj):"—"}</td><td class="n"><b>${pct(p.m)}</b></td><td class="n">${m?pct(m,0):"—"}</td></tr>`}).join("")}</tbody></table></div></div>`;
  abreFolha("expSheet");
}

/* ---------- Marcos alterados ---------- */
function renderMarcos(){
  const ok = new Set(filtrados().map(e=>e.sigla));
  const vs = D.variacoes.filter(v=>ok.has(v.sigla)).sort((a,b)=>Math.abs(b.dias)-Math.abs(a.dias));
  $("attnNote").textContent = `variações de 20 dias ou mais · ${D.fontes.variacoes.split(" → ").map(dmy).join(" → ")}`;
  $("attn").innerHTML = vs.length ? vs.map(v=>{ const e=D.empreendimentos.find(x=>x.sigla===v.sigla);
    return `<div class="ai"><span><span class="tagc" style="--c:${corDe(e)}">${esc(v.empreendimento)}</span> <b style="font-weight:600">${esc(v.marco)}</b></span><span class="d ${v.dias>0?"late":"early"}">${v.dias>0?"▲ +":"▼ "}${v.dias} dias</span><span class="x">${dmy(v.anterior)} → ${dmy(v.atual)}</span></div>`; }).join("") : "<p class='muted'>Nenhuma variação de 20 dias ou mais nos filtros atuais.</p>";
}

/* =========================================================
   BARRA SUPERIOR: navegação, filtros, incorporadora
   ========================================================= */
const SECOES = {
  mapa:[["cid:Curitiba","Curitiba"],["cid:Pinhais","Pinhais"],["cid:São José dos Pinhais","São José dos Pinhais"],["cid:Araucária","Araucária"],["cid:Almirante Tamandaré","Almirante Tamandaré"]],
  resumo:[["sec-kpis","Indicadores"],["sec-traj","Trajetória de lançamentos"],["sec-dist","Distribuição"],["sec-map","Mapa da carteira"],["sec-saude","Saúde financeira"],["sec-marcos","Marcos alterados"]],
  cronograma:[["sec-lanc","Próximos lançamentos"],[null,"Portfólio Macro (Gantt)"],[null,"Régua de lançamentos"],[null,"Agenda de 90 dias"]],
  analise:[["sec-reg","Registro de Desvios"],["sec-var","Marcos alterados"],[null,"Motivos de atraso"]],
  viabilidade:[["sec-viab-cmp","Comparativo entre fases"],["sec-viab-det","Detalhamento por fase"],["sec-viab-evo","Evolução por fase"],["sec-viab","Viabilidades vigentes"]],
  metas:[[null,"Metas de Incorporação"]],
};
function miniPrev(p){
  const L = filtrados(), Y=ANO(), W=360, H=96;
  let big="", lab="", svg="", foot="";
  if (p==="resumo"){
    const anos=[Y-2,Y-1,Y,Y+1,Y+2], incs=S.inc==="all"?["Make It","Gadens"]:[S.inc];
    const v = anos.map(a=>incs.map(i=>L.filter(e=>e.incorporadora===i&&anoLanc(e)===a).reduce((s,e)=>s+(vig(e)?.vgv_bruto||0),0)));
    const max=Math.max(...v.map(x=>x.reduce((a,b)=>a+b,0)),1), step=W/5, bw=34;
    svg = v.map((x,k)=>{ let y=H-14, out=""; x.forEach((val,j)=>{ const h=(H-28)*val/max; y-=h; out+=`<rect x="${k*step+(step-bw)/2}" y="${y}" width="${bw}" height="${Math.max(0,h-(j?1:0))}" rx="${j===x.length-1?4:0}" fill="${coCor(incs[j])}"/>`; });
      return out+`<text x="${k*step+step/2}" y="${H-2}" text-anchor="middle" ${anos[k]===Y?'style="font-weight:700;fill:var(--label)"':""}>${anos[k]}</text>`; }).join("");
    big=brl(L.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0)); lab="VGV da carteira"; foot=`<span>VGV por ano de lançamento</span><span>${L.length} empreendimentos</span>`;
  } else if (p==="cronograma"){
    const ref=new Date(D.gerado_em), meses=Array.from({length:12},(_,i)=>new Date(ref.getFullYear(),ref.getMonth()+i,1));
    const c=meses.map(m=>L.filter(e=>{ const l=lanc(e); if(!l||l.ok) return false; const d=new Date(l.data); return d.getFullYear()===m.getFullYear()&&d.getMonth()===m.getMonth(); }));
    const max=Math.max(...c.map(x=>x.length),1), step=W/12, bw=16;
    svg = c.map((x,i)=>`<rect x="${i*step+(step-bw)/2}" y="${H-14-(H-28)*x.length/max}" width="${bw}" height="${(H-28)*x.length/max}" rx="4" fill="var(--accent)"/><text x="${i*step+step/2}" y="${H-2}" text-anchor="middle">${MESES[meses[i].getMonth()][0].toUpperCase()}</text>`).join("");
    big=nf(c.reduce((a,x)=>a+x.length,0)); lab="lançamentos nos próximos 12 meses"; foot=`<span>por mês</span><span>${c.flat().map(e=>e.nome).slice(0,3).join(", ")}${c.flat().length>3?"…":""}</span>`;
  } else if (p==="analise"){
    const ok=new Set(filtrados().map(e=>e.sigla)), vs=D.variacoes.filter(v=>ok.has(v.sigla)).slice(0,16), max=Math.max(...vs.map(v=>Math.abs(v.dias)),1), step=W/Math.max(vs.length,1), mid=H/2;
    svg = `<line x1="0" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--grid)"/>`+vs.map((v,i)=>{ const h=(H/2-8)*Math.abs(v.dias)/max; return `<rect x="${i*step+step*.2}" y="${v.dias>0?mid-h:mid}" width="${step*.6}" height="${h}" rx="3" fill="${v.dias>0?"var(--red-ink)":"var(--green-ink)"}"/>`; }).join("");
    big=nf(vs.length); lab="marcos alterados na semana"; foot=`<span>▲ atraso · ▼ antecipação</span><span>${D.fontes.variacoes.split(" → ").map(dmy).join(" → ")}</span>`;
  } else if (p==="viabilidade"){
    const its=L.filter(e=>vig(e)&&vig(e).margem!=null), X=v=>W*(v-.10)/(.32-.10);
    svg = `<line x1="${X(.20)}" x2="${X(.20)}" y1="6" y2="${H-14}" stroke="var(--label)" stroke-dasharray="3 3"/><text x="${X(.20)}" y="${H-2}" text-anchor="middle">20%</text><text x="0" y="${H-2}">10%</text><text x="${W}" y="${H-2}" text-anchor="end">32%</text>`+its.map((e,i)=>`<circle cx="${X(vig(e).margem)}" cy="${14+(i%5)*14}" r="5" fill="${corDe(e)}" stroke="var(--card-solid)" stroke-width="1.5"/>`).join("");
    const d=dadosSaude(); big=pct(d.media,1); lab="margem líquida média"; foot=`<span>cada ponto é um empreendimento</span><span>${its.length} viabilidades</span>`;
  } else if (p==="mapa"){
    const cs=[...new Set(L.map(e=>e.cidade))].map(c=>({c,n:L.filter(e=>e.cidade===c).length})).sort((a,b)=>b.n-a.n), max=Math.max(...cs.map(x=>x.n),1), rh=H/Math.max(cs.length,1);
    svg = cs.map((x,i)=>`<text x="0" y="${i*rh+rh/2+3}">${esc(x.c)}</text><rect x="130" y="${i*rh+rh/2-5}" width="${(W-160)*x.n/max}" height="10" rx="5" fill="var(--accent)"/><text x="${136+(W-160)*x.n/max}" y="${i*rh+rh/2+3}" style="fill:var(--label);font-weight:600">${x.n}</text>`).join("");
    big=nf(L.filter(e=>e.pos).length); lab="empreendimentos no mapa"; foot=`<span>por cidade · clique numa cidade para ir até ela</span><span>visão 3D ao abrir um empreendimento</span>`;
  } else {
    const LA=filtrados().filter(e=>vig(e)&&vig(e).margem!=null&&lanc(e)), ks=[2027,2028,2029], step=W/3, bw=40, top=.3, Yv=v=>H-14-(H-28)*v/top;
    const m=k=>{ const its=LA.filter(e=>anoLanc(e)===k), w=its.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0); return w?its.reduce((a,e)=>a+proj(e).m*(vig(e).vgv_liquido||0),0)/w:null; };
    svg = ks.map((k,i)=>{ const v=m(k)||0, x=i*step+(step-bw)/2; return `<rect x="${x}" y="${Yv(v)}" width="${bw}" height="${H-14-Yv(v)}" rx="5" fill="var(--accent)"/><rect x="${x-6}" y="${Yv(metaM(k)||0)-1}" width="${bw+12}" height="2.4" rx="1.2" fill="var(--label)"/><text x="${i*step+step/2}" y="${H-2}" text-anchor="middle">${k}</text>`; }).join("");
    big=pct(m(2027),1); lab=`margem projetada 2027 (meta ${pct(metaM(2027),1)})`; foot=`<span>projetada × meta por ano</span><span>em construção</span>`;
  }
  return `<div class="pv"><div class="pv-h"><b>${big}</b><span>${lab}</span></div><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div><div class="foot">${foot}</div>`;
}
function renderNavPop(p){
  $("npList").innerHTML = `<div class="h">${esc(PNOME[p])}</div>` + SECOES[p].map(([id,t])=> id ? `<a href="#${p}" data-sec="${id}"><i style="--c:var(--accent)"></i>${esc(t)}</a>` : `<a class="soon"><i></i>${esc(t)}</a>`).join("");
  $("npPrev").innerHTML = miniPrev(p);
}
function renderFilterPop(){
  const base = D.empreendimentos.filter(porInc).filter(e=>!S.ativos || ativa(e));
  const fases = FASES.filter(f=>f.id!=="SEM");
  const temSem = base.some(e=>faseDe(e)==="SEM");
  const lista = (k, vals, set, cor, nome=v=>v) => {
    const sel = [...set], aberto = S.dd===k;
    const txt = sel.length ? `<b>${esc(sel.map(nome).join(", "))}</b>` : "Selecionar...";
    return `<div class="frow"><span>${({linhas:"Linha de produto",cidades:"Cidade",anos:"Ano de Lançamento"})[k]}</span>
      <button class="dd" data-dd="${k}" aria-expanded="${aberto}"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>${txt}</button>
      ${aberto?`<div class="ddl" data-set="${k}">${vals.map(v=>`<button aria-pressed="${set.has(v)}" data-v="${esc(v)}" style="${cor?`--c:${cor(v)}`:""}">${cor?"<i></i>":""}${esc(nome(v))}</button>`).join("")}</div>`:""}</div>`;
  };
  const seg = (id, val, ops) => `<div class="seg full" id="${id}">${ops.map(([v,t])=>`<button data-v="${v}" aria-checked="${val===v}">${t}</button>`).join("")}</div>`;
  const n = nFiltros() + (S.ativos?1:0);
  $("filterPop").innerHTML = `<div class="fp">
    <div><span class="lb">Colorir e agrupar por</span>${seg("grpSeg", S.group, [["fase","Fase do projeto"],["linha","Linha de produto"],["cidade","Cidade"]])}</div>
    <div><span class="lb">Ordenar por</span>${seg("ordSeg", S.ordem, [["alfa","Alfabético"],["lanc","Data Lançamento"]])}</div>
    <div><span class="lb">Fase</span><div class="ftiles${S.fases.size&&[...S.fases].some(f=>f!=="SEM")?" algum":""}">${fases.map(f=>`<button data-f="${f.id}" aria-pressed="${S.fases.has(f.id)}" style="--c:${faseCor(f.id)}" ${S.ativos&&f.id==="ETG"?'disabled title="Desligue “Somente empreendimentos ativos” para ver os entregues"':""}>${esc(f.curto)}</button>`).join("")}</div></div>
    ${temSem||S.fases.has("SEM")?`<button class="fsem" data-f="SEM" aria-pressed="${S.fases.has("SEM")}">Sem cronograma disponível</button>`:""}
    ${lista("linhas", LINHAS.map(l=>l.id).filter(id=>base.some(e=>linhaDe(e)===id)), S.linhas, linhaCor, id=>linhaInfo(id).curto)}
    ${lista("cidades", grupoOrdemCid(base), S.cidades, cidadeCor)}
    ${lista("anos", [...new Set(base.map(anoKey))].sort(), S.anos)}
    <div class="frow"><span>Somente empreendimentos ativos</span><button class="sw" id="swAtivos" role="switch" aria-checked="${S.ativos}" aria-label="Somente empreendimentos ativos"></button></div>
    <button class="fclear" id="clearF" ${n?"":"disabled"}>Limpar filtros</button>
    <div class="fcount">${filtrados().length} empreendimentos${S.ativos?" ativos":""}${nFiltros()?` · ${nFiltros()} ${nFiltros()===1?"filtro":"filtros"}`:""}</div></div>`;
  const P = $("filterPop");
  P.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>toggle(S.fases, b.dataset.f));
  P.querySelectorAll(".ddl button").forEach(b=>b.onclick=()=>toggle(S[b.closest(".ddl").dataset.set], b.dataset.v));
  P.querySelectorAll(".dd").forEach(b=>b.onclick=()=>{ S.dd = S.dd===b.dataset.dd ? null : b.dataset.dd; renderFilterPop(); });
  P.querySelectorAll("#grpSeg button").forEach(b=>b.onclick=()=>{ S.group=b.dataset.v; renderAll(); });
  P.querySelectorAll("#ordSeg button").forEach(b=>b.onclick=()=>{ S.ordem=b.dataset.v; renderAll(); });
  $("swAtivos").onclick=()=>{ S.ativos=!S.ativos; if (S.ativos) S.fases.delete("ETG"); S.sel=null; renderAll(); };
  $("clearF").onclick=()=>{ S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.linhas.clear(); S.ativos=false; S.dd=null; S.sel=null; renderAll(); };
  const fc=$("filterCount"); fc.hidden=!n; fc.textContent=n;
}
const grupoOrdemCid = base => { const cs=[...new Set(base.map(e=>e.cidade))]; return [...CIDADES.map(c=>c.id).filter(c=>cs.includes(c)), ...cs.filter(c=>!CIDADES.some(x=>x.id===c)).sort()]; };
const ICO_CO = {
  all:`<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="5.5" fill="#FF9100"/><circle cx="16" cy="12" r="5.5" fill="#0060AF" stroke="#45416d" stroke-width="1.2"/></svg>`,
  "Make It":`<svg viewBox="0 0 230.8 230.8"><path fill="#fff" d="M108.6 178.3H63.9V81.6h44.7zM167.9 178.3h-44.6V51.8h44.6z"/></svg>`,
  Gadens:`<svg viewBox="-14 -14 140.4 136.4"><path fill="#fff" d="M54.5 0v108.4C24.6 108.4.3 84.1.3 54.2S24.6 0 54.5 0z"/><path fill="#fff" d="M63.1 59.1h49.3v49.3z"/><path fill="#F0A06A" d="M112.4 0v50.3C84.6 50.3 62 27.8 62 0z"/></svg>`,
};
function renderCoPop(){
  $("coPop").innerHTML = INCS.map(([id,n])=>`<button class="co-opt" role="menuitemradio" aria-checked="${S.inc===id}" data-inc="${id}"><span class="ci" style="background:${id==="all"?"#45416d":id==="Gadens"?"#0060AF":"#FF9100"}">${ICO_CO[id]}</span>${n}<span class="ck">✓</span></button>`).join("");
  $("coPop").querySelectorAll(".co-opt").forEach(b=>b.onclick=()=>setInc(b.dataset.inc));
}
function setInc(inc){
  S.inc=inc; S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.linhas.clear(); S.sel=null;
  const pos = INCS.findIndex(x=>x[0]===inc), sw=$("coSwitch");
  sw.dataset.pos=pos; sw.setAttribute("aria-label","Incorporadora: "+INCS[pos][1]);
  renderAll();
}
/* abre ao passar o mouse; fecha com um pequeno atraso para dar tempo de entrar no bloco */
const pops = ["navPop","filterPop","coPop","linkPop"];
function fechaPops(exceto){ pops.forEach(id=>{ if (id!==exceto) $(id).hidden=true; }); document.querySelectorAll(".ni.hov").forEach(n=>n.classList.remove("hov")); }
function hoverPop(gatilhos, popId, aoAbrir){
  let t; const pop=$(popId);
  const abre = ev=>{ clearTimeout(t); fechaPops(popId); aoAbrir && aoAbrir(ev); pop.hidden=false; };
  const fecha = ()=>{ t=setTimeout(()=>{ pop.hidden=true; if (popId==="navPop") document.querySelectorAll(".ni.hov").forEach(n=>n.classList.remove("hov")); },200); };
  [...gatilhos, pop].forEach(n=>{ n.addEventListener("mouseenter", abre); n.addEventListener("mouseleave", fecha); });
  return {abre, fecha};
}

/* =========================================================
   BARRA INFERIOR E FOLHAS
   ========================================================= */
function pendencias(){
  const B = D.empreendimentos.filter(porInc), out = [];
  const add = (t, xs) => xs.length && out.push({t, xs});
  add("Sem cronograma com códigos no ClickUp", B.filter(e=>!e.legado&&!e.fase).map(e=>e.nome));
  add("Sem marco de Lançamento Comercial no cronograma", B.filter(e=>!e.legado&&e.fase&&!lanc(e)).map(e=>e.nome));
  add("Viabilidades aguardando valores", B.flatMap(e=>e.viabilidades.filter(v=>v.vgv_bruto==null).map(v=>`${e.nome} ${v.versao}`)));
  add("Sem viabilidade na lista", B.filter(e=>!e.legado&&!vig(e)).map(e=>e.nome));
  add("Linha de produto aguardando definição", B.filter(e=>!e.legado&&linhaDe(e)==="Aguardando Definição").map(e=>e.nome));
  add("Área privativa ou área do terreno não preenchidas na viabilidade vigente", B.filter(e=>vig(e)&&(vig(e).area_privativa==null||vig(e).area_terreno==null)).map(e=>e.nome));
  add("Cronogramas do ClickUp sem empreendimento no cadastro do dashboard", D.listas_sem_cadastro||[]);
  add("Endereço não preenchido no ClickUp (posição aproximada no mapa)", B.filter(e=>!e.legado&&e.pos_fonte!=="clickup").map(e=>e.nome));
  return out;
}
function renderSettings(){
  document.querySelectorAll("#setTabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.t===S.setTab)));
  const g = new Date(D.gerado_em), p = pendencias();
  if (S.setTab==="dados") $("setBody").innerHTML = `
    <div class="box"><h4><span class="mac" style="--c:#FF5F57"></span>Atualização</h4><p>Dados gerados em ${g.toLocaleDateString("pt-BR")} às ${g.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}. Cronogramas: ${esc(D.fontes.cronogramas.replace(/(\d{4})-(\d{2})-(\d{2})/,"$3/$2/$1"))}.</p></div>
    <div class="box"><h4><span class="mac" style="--c:#5E9EFF"></span>Alcance da base</h4><p>${(()=>{ const L=D.empreendimentos.filter(e=>lanc(e)).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data)); const o=L[0]; return o ? `A base só tem informações de lançamento a partir de <b>${o.marcos.inc002.data.slice(0,4)}</b> (o mais antigo é o ${esc(o.nome)}, lançado em ${my(o.marcos.inc002.data)}). Empreendimentos lançados antes disso, como La Vita e Tuo, não têm a data de lançamento no ClickUp e não aparecem na trajetória.` : "A base ainda não tem datas de lançamento."; })()}</p></div>
    <div class="box"><h4><span class="mac" style="--c:#FEBC2E"></span>Cronogramas e fases</h4><ul><li>Marcos lidos dos cronogramas do ClickUp pelo campo “Código tarefa” (listas privadas e “(cópia)” ficam de fora).</li><li>A fase de cada empreendimento sai do marco mais avançado concluído, não do nome da lista. “Entregue” é quem já passou da data de Entrega de Chaves.</li><li>Por padrão só aparecem os empreendimentos ativos; nos filtros dá para ver todos, inclusive os entregues.</li><li>A comparação semanal usa o histórico salvo toda segunda-feira.</li></ul></div>
    <div class="box"><h4><span class="mac" style="--c:#28C840"></span>Viabilidades, linha de produto e endereço</h4><ul><li>Lista Controle de Viabilidades do ClickUp, com os valores das DREs.</li><li>A vigente é a versão mais avançada cadastrada na lista, mesmo pendente de aprovação.</li><li>Linha de produto e endereço vêm dos campos “Linha Produto” e “📍 Endereço do empreendimento”.</li><li>Mapa: recorte próprio do OpenStreetMap de Curitiba e região, gerado por uma rotina do GitHub e guardado no site.</li><li>Margem projetada: veja “Como é calculada” na Saúde financeira.</li></ul></div>`;
  else if (S.setTab==="pend") $("setBody").innerHTML = p.length ? p.map((x,i)=>`<div class="box"><h4><span class="mac" style="--c:${["#FF5F57","#FEBC2E","#28C840","#5E9EFF","#BF5AF2","#8E8E93"][i%6]}"></span>${esc(x.t)}<span class="muted" style="margin-left:auto;font-weight:500">${x.xs.length}</span></h4><p class="muted">${esc(x.xs.join(", "))}</p></div>`).join("") : "<p class='muted'>Nenhuma pendência.</p>";
  else $("setBody").innerHTML = `<div class="log">${CHANGELOG.map(c=>`<div><div class="v">Versão ${c.v}<span>${dmy(c.d)}</span></div><ul>${c.itens.map(i=>`<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}
function abreFolha(id){ ["setSheet","expSheet"].forEach(s=>$(s).hidden = s!==id); $("scrim").hidden = !id; fechaPops(); hideTip(); }

/* =========================================================
   OUTRAS PÁGINAS (prévias)
   ========================================================= */
function renderLaunches(){
  const its = filtrados().filter(e=>lanc(e)&&!lanc(e).ok).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data));
  $("launchList").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Cidade</th><th>Fase</th><th>Registro de Incorporação</th><th>Orçamento V4</th><th>Lançamento previsto</th><th class="n">VGV bruto</th></tr></thead><tbody>${its.map(e=>`<tr><td><span class="tagc" style="--c:${corDe(e)}">${esc(e.nome)}</span></td><td>${esc(e.cidade)}</td><td>${esc(faseNome(e))}</td><td>${e.marcos.leg010?dmy(e.marcos.leg010.data):"—"}</td><td>${e.marcos.orcV4?dmy(e.marcos.orcV4.data):"—"}</td><td><b>${dmy(lanc(e).data)}</b></td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderVariacoes(){
  $("varNote").textContent = D.fontes.variacoes.split(" → ").map(dmy).join(" → ");
  const ok = new Set(filtrados().map(e=>e.sigla)), vs = D.variacoes.filter(v=>ok.has(v.sigla));
  $("varTable").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Marco</th><th>Data anterior</th><th>Data atual</th><th class="n">Variação</th></tr></thead><tbody>${vs.map(v=>`<tr><td>${esc(v.empreendimento)}</td><td>${esc(v.marco)}</td><td>${dmy(v.anterior)}</td><td>${dmy(v.atual)}</td><td class="n d ${v.dias>0?"late":"early"}" style="font-weight:700">${v.dias>0?"▲ +":"▼ "}${v.dias} dias</td></tr>`).join("")}</tbody></table></div>`;
}
/* =========================================================
   INDICADORES DE VIABILIDADE (estrutura validada em jul/2026)
   comparativo entre fases (segue a fase selecionada) → detalhamento por fase → evolução por fase
   ========================================================= */
const VCOR = {V0:["#A9A9AE","#8E8E93"],V1:["#78C2EA","#78C2EA"],V2:["#1F93CF","#3AA6E0"],V3:["#2C4580","#6F8BD6"],V4:["#21B162","#2BC46E"]};
const verCor = v => (VCOR[v]||["#8E8E93","#8E8E93"])[dark()?1:0];
const VNOME_C = {V0:"Compra",V1:"Due Diligence (projeto)",V2:"Due Diligence",V3:"Atualização",V4:"Lançamento"};
let vbBusca = "";
const temValor = v => v && (v.vgv_bruto!=null || v.margem!=null);
// versão: a mais recente (data-base) entre as cadastradas com valores
const versao = (e, ver) => { const xs=e.viabilidades.filter(v=>v.versao===ver && temValor(v)); return xs.length ? xs.reduce((a,b)=>(b.mes||"")>(a.mes||"")?b:a) : null; };
const idadeM = mes => { if (!mes) return null; const [a,m]=mes.split("-").map(Number), h=HOJE(); return (+h.slice(0,4)-a)*12 + (+h.slice(5,7)-m); };
const mesTxt = mes => mes ? mes.slice(5)+"/"+mes.slice(0,4) : "—";
const idadeTxt = mes => { const n=idadeM(mes); return n==null ? "" : n<=0 ? "este mês" : n===1 ? "1 mês" : n+" meses"; };
// etapas do pipeline: Gadens não tem V1; antes da vigente, as sem dado somem; depois dela, ficam como "aguardando"
function etapas(e){
  const vg = vig(e), iv = vg ? VERS.indexOf(vg.versao) : -1;
  return VERS.filter(v=>!(e.incorporadora==="Gadens" && v==="V1")).map((v,_)=>{ const d=versao(e,v), i=VERS.indexOf(v);
    return d ? {v, st:"ok", d} : i>iv ? {v, st:"wait"} : {v, st:"na"}; }).filter(x=>x.st!=="na");
}
const custoObra = d => d && d.custo_m2!=null && d.area_construida!=null ? d.custo_m2*d.area_construida : null;
const efic = d => d && d.area_privativa && d.area_construida ? d.area_privativa/d.area_construida : null;
function abreViab(e){ S.vbSel = e.sigla; S.vbVer = null; irPara("viabilidade"); }

function delta(x, tipo){
  if (x==null || isNaN(x)) return `<span class="dl flat">—</span>`;
  const c = x>1e-4?"up":x<-1e-4?"down":"flat", sy = x>1e-4?"▲":x<-1e-4?"▼":"–";
  return `<span class="dl ${c}">${sy} ${tipo==="pp" ? nf(Math.abs(x*100),2)+" p.p." : nf(Math.abs(x*100),1)+"%"}</span>`;
}
function cardCmp(e, de, para){
  const a=versao(e,de), b=versao(e,para), r=(x,y)=>x&&y?(y-x)/Math.abs(x):null;
  return `<div class="cmp"><div class="cmp-h"><b>${de}</b> <span>${VNOME_C[de]}</span><i>→</i><b>${para}</b> <span>${VNOME_C[para]}</span></div>
    <div class="cmp-g">
      <div><span class="k">VGV bruto</span><b>${brl(b.vgv_bruto)}</b>${delta(r(a.vgv_bruto,b.vgv_bruto))}<small>era ${brl(a.vgv_bruto)}</small></div>
      <div><span class="k">Margem líquida</span><b>${pct(b.margem)}</b>${delta(a.margem!=null&&b.margem!=null?b.margem-a.margem:null,"pp")}<small>era ${pct(a.margem)}</small></div>
      <div><span class="k">Lucro líquido</span><b>${brl(b.lucro)}</b>${delta(r(a.lucro,b.lucro))}<small>era ${brl(a.lucro)}</small></div>
    </div></div>`;
}
function chartEvo(e, box, PV={}){
  const et = etapas(e), cor = coCor(e.incorporadora), corM = dark()?"#30D158":"#1E9E48";
  const W=Math.max(320,box.clientWidth||700), H=240, ml=54, mr=54, mt=22, mb=30, iw=W-ml-mr, ih=H-mt-mb;
  const ok = et.filter(x=>x.st==="ok");
  if (!ok.length){ box.innerHTML="<p class='muted'>Sem viabilidades com valores.</p>"; return; }
  const vg = ok.map(x=>x.d.vgv_bruto||0), mg = [...ok.map(x=>x.d.margem).filter(v=>v!=null), ...Object.values(PV)];
  const vmax = Math.max(...vg)*1.12 || 1, vst = niceStep(vmax,3), vtop = Math.ceil(vmax/vst)*vst;
  // margem com escala variável: 1 p.p. precisa aparecer
  const mmin=Math.min(...mg), mmax=Math.max(...mg), pad=Math.max((mmax-mmin)*.45, .01), mlo=mmin-pad, mhi=mmax+pad;
  const X = i => ml + (et.length===1 ? iw/2 : iw*i/(et.length-1)), YV = v => mt+ih-ih*v/vtop, YM = v => mt+ih-ih*(v-mlo)/(mhi-mlo);
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  for (let v=0; v<=vtop+1; v+=vst) s+=`<line x1="${ml}" x2="${W-mr}" y1="${YV(v)}" y2="${YV(v)}" stroke="var(--grid)"/><text x="${ml-8}" y="${YV(v)+3.5}" text-anchor="end" style="fill:${cor}">${v?mi(v):"0"}</text>`;
  const mst = niceStep(mhi-mlo, 3)||.01; for (let v=Math.ceil(mlo/mst)*mst; v<=mhi; v+=mst) s+=`<text x="${W-mr+8}" y="${YM(v)+3.5}" style="fill:${corM}">${nf(v*100,1)}%</text>`;
  et.forEach((x,i)=>{ const sel=x.v===S.vbVer; s+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle" style="${sel?"fill:var(--label);font-weight:700":""}${x.st==="wait"?";opacity:.55":""}">${x.v} · ${VNOME_C[x.v].replace(" (projeto)","")}</text>`;
    if (sel) s+=`<rect x="${X(i)-30}" y="${mt-8}" width="60" height="${ih+12}" rx="10" fill="var(--fill)" opacity=".7"/>`; });
  const linha = (pts, c, dash) => { let d=""; pts.forEach((p,k)=>{ d+=(k?"L":"M")+p[0]+","+p[1]; }); return pts.length>1?`<path d="${d}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" ${dash?'stroke-dasharray="5 5"':""}/>`:""; };
  const pv = et.map((x,i)=>x.st==="ok"?[X(i),YV(x.d.vgv_bruto||0)]:null).filter(Boolean), pm = et.map((x,i)=>x.st==="ok"&&x.d.margem!=null?[X(i),YM(x.d.margem)]:null).filter(Boolean);
  s += linha(pv, cor) + linha(pm, corM);
  // tendência: da vigente até as versões futuras, pela margem projetada
  const iv = et.findIndex(x=>x.v===vig(e).versao), futuros = et.map((x,i)=>[x,i]).filter(([x,i])=>i>iv && PV[x.v]!=null);
  if (futuros.length && vig(e).margem!=null){ const pts=[[X(iv),YM(vig(e).margem)], ...futuros.map(([x,i])=>[X(i),YM(PV[x.v])])]; s += linha(pts, corM, true);
    futuros.forEach(([x,i])=>{ s+=`<circle cx="${X(i)}" cy="${YM(PV[x.v])}" r="4.5" fill="var(--card-solid)" stroke="${corM}" stroke-width="2" stroke-dasharray="2 2"/><text x="${X(i)}" y="${YM(PV[x.v])-10}" text-anchor="middle" style="fill:${corM};font-weight:600">${nf(PV[x.v]*100,1)}%</text>`; }); }
  et.forEach((x,i)=>{ if (x.st!=="ok") { s+=`<circle cx="${X(i)}" cy="${mt+ih}" r="4" fill="none" stroke="var(--label-3)" stroke-dasharray="2 2"/>`; return; }
    const yv=YV(x.d.vgv_bruto||0), ym=x.d.margem!=null?YM(x.d.margem):null, mAcima = ym!=null && ym<yv;  // o rótulo de quem está em cima vai para cima
    s+=`<circle cx="${X(i)}" cy="${yv}" r="5" fill="${cor}" stroke="var(--card-solid)" stroke-width="2"/><text class="val" x="${X(i)}" y="${mAcima?yv+18:yv-10}" text-anchor="middle" style="fill:${cor}">${mi(x.d.vgv_bruto||0)}</text>`;
    if (ym!=null) s+=`<circle cx="${X(i)}" cy="${ym}" r="5" fill="${corM}" stroke="var(--card-solid)" stroke-width="2"/><text class="val" x="${X(i)}" y="${mAcima?ym-10:ym+18}" text-anchor="middle" style="fill:${corM}">${nf(x.d.margem*100,2)}%</text>`;
    s+=`<rect class="hit" data-v="${x.v}" x="${X(i)-34}" y="0" width="68" height="${H}" fill="transparent"/>`; });
  box.innerHTML = s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const d=versao(e,r.dataset.v);
    bindTip(r, `<b>${r.dataset.v} – ${VNOME_C[r.dataset.v]}</b> · ${mesTxt(d.mes)}<table><tr><td>VGV bruto</td><td class="n">${brl(d.vgv_bruto)}</td></tr><tr><td>Margem líquida</td><td class="n">${pct(d.margem)}</td></tr><tr><td>Lucro líquido</td><td class="n">${brl(d.lucro)}</td></tr></table><div class="muted">clique para selecionar a fase</div>`);
    r.onclick = ()=>{ hideTip(); S.vbVer = r.dataset.v; renderViabPagina(); }; });
  $("evoLeg").innerHTML = `<span><i style="background:${cor}"></i>VGV bruto</span><span><i style="background:${corM}"></i>Margem líquida</span>${Object.keys(PV).length?`<span><svg width="18" height="8"><line x1="0" x2="18" y1="4" y2="4" stroke="${corM}" stroke-width="2" stroke-dasharray="4 3"/></svg>tendência da margem</span>`:""}`;
}
// projeção da margem nas versões que ainda não existem (mesmo algoritmo da margem projetada no lançamento)
function projVersoes(e){
  const vg=vig(e); if (!vg || vg.margem==null || vg.versao==="V4") return {};
  const A=AJ[e.incorporadora]||{}, base=A[vg.versao], out={};
  if (!base || base.n<MIN_AMOSTRA) return out;
  VERS.slice(VERS.indexOf(vg.versao)+1).forEach(v=>{ if (e.incorporadora==="Gadens" && v==="V1") return;
    if (v==="V4") out.V4 = vg.margem + base.med;
    else { const a=A[v]; if (a && a.n>=MIN_AMOSTRA) out[v] = vg.margem + base.med - a.med; } });
  return out;
}
function spark(vals, cor){ const pts=vals.filter(v=>v!=null); if (pts.length<2) return "";
  const W=90,H=26, lo=Math.min(...pts), hi=Math.max(...pts), X=i=>4+(W-8)*i/(vals.length-1), Y=v=>H-4-(H-8)*((v-lo)/((hi-lo)||1));
  let d="", n=0; vals.forEach((v,i)=>{ if (v==null) return; d+=(n++?"L":"M")+X(i)+","+Y(v); });
  return `<svg class="spk" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${vals.map((v,i)=>v==null?"":`<circle cx="${X(i)}" cy="${Y(v)}" r="2.4" fill="${cor}"/>`).join("")}</svg>`; }
function chipDelta(x, tipo){ if (x==null||isNaN(x)) return ""; const c=x>1e-4?"up":x<-1e-4?"down":"flat";
  return `<span class="dchip ${c}">${x>1e-4?"▲":x<-1e-4?"▼":"–"} ${tipo==="pp"?nf(Math.abs(x*100),2)+" p.p.":nf(Math.abs(x*100),1)+"%"}</span>`; }
function cascata(d, cor, box){
  if (!d || d.vgv_bruto==null || d.lucro==null){ box.innerHTML="<p class='muted'>Faltam valores nesta versão.</p>"; return; }
  const obra = d.custo_m2!=null&&d.area_construida!=null ? d.custo_m2*d.area_construida : null, perm=(d.vgv_bruto||0)-(d.vgv_liquido??d.vgv_bruto);
  const outros = (d.vgv_liquido??d.vgv_bruto) - (obra||0) - d.lucro;
  const passos = [["VGV bruto", d.vgv_bruto, "t"], ["Permutas", -perm, "n"], ["VGV líquido", d.vgv_liquido??d.vgv_bruto, "t"], ["Custo de obra", obra!=null?-obra:null, "n"], ["Demais custos", -outros, "n"], ["Lucro líquido", d.lucro, "f"]].filter(p=>p[1]!=null && !(p[2]==="n"&&Math.abs(p[1])<1));
  const W=Math.max(300, box.clientWidth||420), H=210, mt=22, mb=34, ih=H-mt-mb, max=d.vgv_bruto||1, step=W/passos.length, bw=Math.min(54, step*.62), Y=v=>mt+ih-ih*v/max;
  let s=`<svg viewBox="0 0 ${W} ${H}">`, nivel=0;
  passos.forEach(([n,v,t],i)=>{ const x=i*step+(step-bw)/2; let y1,y2;
    if (t!=="n"){ y1=Y(v); y2=Y(0); nivel=v; } else { y1=Y(nivel); y2=Y(nivel+v); nivel+=v; }
    const top=Math.min(y1,y2), h=Math.max(2,Math.abs(y2-y1)), fill = t==="f" ? cor : t==="t" ? `color-mix(in srgb, ${cor} 35%, var(--fill-2))` : "var(--red-ink)";
    s+=`<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="6" fill="${fill}" ${t==="n"?'opacity=".55"':""}/>`;
    s+=`<text class="val" x="${x+bw/2}" y="${top-6}" text-anchor="middle" style="font-size:10px">${t==="n"?"−":""}${mi(Math.abs(v))}</text><text x="${x+bw/2}" y="${H-18}" text-anchor="middle" style="font-size:10px">${n}</text>${t==="f"?`<text x="${x+bw/2}" y="${H-6}" text-anchor="middle" style="font-size:9.5px;fill:${cor};font-weight:700">${pct(d.margem,1)} do líquido</text>`:""}`;
    if (i<passos.length-1) s+=`<line x1="${x+bw}" x2="${x+step}" y1="${Y(nivel)}" y2="${Y(nivel)}" stroke="var(--label-3)" stroke-dasharray="2 3"/>`; });
  box.innerHTML = s+"</svg>";
}
function renderViabPagina(){
  const side=$("vbSide"), main=$("vbMain"); if (!side) return;
  const L = ordena(filtrados().filter(e=>vig(e)));
  if (!L.length){ side.innerHTML=""; main.innerHTML=`<article class="card"><p class="muted">Nenhuma viabilidade nos filtros atuais.</p></article>`; return; }
  let e = L.find(x=>x.sigla===S.vbSel) || D.empreendimentos.find(x=>x.sigla===S.vbSel&&vig(x)) || L[0];
  S.vbSel = e.sigla;
  const et = etapas(e), vg = vig(e), cor = corDe(e), coE = coCor(e.incorporadora);
  if (!S.vbVer || !et.some(x=>x.v===S.vbVer&&x.st==="ok")) S.vbVer = vg.versao;
  // lista lateral: agrupada e colorida pela viabilidade vigente (cores dos status da lista Controle de Viabilidades)
  const q = vbBusca.trim().toLowerCase(), its = L.filter(x=>!q || (x.nome+" "+(x.ex_nome||"")+" "+x.cidade).toLowerCase().includes(q));
  const grupos = VERS.slice().reverse().map(v=>({v, its:its.filter(x=>vig(x).versao===v)})).filter(g=>g.its.length);
  side.innerHTML = `<div class="vb-sh"><h3>Empreendimentos <span>${its.length}</span></h3>
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="vbBusca" type="search" placeholder="Buscar" value="${esc(vbBusca)}"></label></div>
    <div class="vb-sl">${grupos.map(g=>`<div class="vb-g"><i style="background:${verCor(g.v)}"></i>${g.v} – ${VNOME_C[g.v]}<span>${g.its.length}</span></div>${g.its.map(x=>`<button class="vb-r${x.sigla===e.sigla?" on":""}" data-s="${x.sigla}" style="--vc:${verCor(g.v)}">${MP.icone(x.incorporadora, verCor(g.v))}<b>${esc(x.nome)}</b><span>${brl(vig(x).vgv_bruto)} · ${pct(vig(x).margem,1)}</span></button>`).join("")}`).join("")}</div>`;
  const inp=$("vbBusca"); inp.oninput=()=>{ vbBusca=inp.value; const p=inp.selectionStart; renderViabPagina(); const n=$("vbBusca"); n.focus(); n.setSelectionRange(p,p); };
  side.querySelectorAll(".vb-r").forEach(b=>b.onclick=()=>{ S.vbSel=b.dataset.s; S.vbVer=null; history.replaceState(null,"","#viabilidade:"+b.dataset.s); renderViabPagina(); renderViab(); if (innerWidth<1100) $("vbMain").scrollIntoView({behavior:"smooth"}); });

  const oks = et.filter(x=>x.st==="ok"), sel = S.vbVer, d = versao(e, sel), iS = oks.findIndex(x=>x.v===sel), ant = iS>0 ? oks[iS-1].d : null, antV = iS>0 ? oks[iS-1].v : null;
  const v2 = sel==="V4" && antV && antV!=="V2" ? versao(e,"V2") : null;
  const rel = (a,b)=>a!=null&&b!=null&&a!==0?(b-a)/Math.abs(a):null;
  const p = proj(e), pv = projVersoes(e);
  const serie = k => et.map(x=>x.st==="ok"?x.d[k]:null);
  const kpi = (id, rot, val, dl, dlV2, sp, extra="") => `<article class="card vk" data-k="${id}"><span class="k">${rot}</span><b>${val}</b><div class="vk-d">${dl}${dlV2}</div>${sp}${extra}<button class="ib exp" aria-label="Ampliar ${rot}"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg></button></article>`;
  const vs = antV ? `<small>vs. ${antV}</small>` : `<small>primeira viabilidade</small>`, vs2 = v2 ? `<small> · vs. V2</small>` : "";
  const kpis = kpi("vgv","VGV bruto",brl(d.vgv_bruto), chipDelta(rel(ant?.vgv_bruto,d.vgv_bruto))+vs, v2?chipDelta(rel(v2.vgv_bruto,d.vgv_bruto))+vs2:"", spark(serie("vgv_bruto"), coE))
    + kpi("margem","Margem líquida",pct(d.margem), chipDelta(ant&&d.margem!=null&&ant.margem!=null?d.margem-ant.margem:null,"pp")+vs, v2?chipDelta(d.margem-v2.margem,"pp")+vs2:"", spark(serie("margem"), coE))
    + kpi("lucro","Lucro líquido",brl(d.lucro), chipDelta(rel(ant?.lucro,d.lucro))+vs, v2?chipDelta(rel(v2.lucro,d.lucro))+vs2:"", spark(serie("lucro"), coE))
    + `<article class="card vk proj"><span class="k">Margem projetada no lançamento</span><b>${p?pct(p.m):"—"}</b><div class="vk-d">${p&&p.aj?chipDelta(p.aj,"pp")+`<small>sobre a ${vg.versao} vigente</small>`:`<small>${p?esc(p.motivo):"sem margem"}</small>`}</div>
        <p class="cap">${p&&p.aj?`${esc(p.motivo)}.`:vg.versao==="V4"?"A V4 já é a viabilidade de lançamento.":"Ainda não há casos suficientes para projetar."}${metaM(anoLanc(e),e.incorporadora)?` Meta ${anoLanc(e)}: ${pct(metaM(anoLanc(e),e.incorporadora),0)}.`:""}</p>
        <button class="link" id="vbHow">Como é calculada</button></article>`;
  const ef = d.area_privativa&&d.area_construida ? d.area_privativa/d.area_construida : null;
  const steps = et.map(x=>{ const c=verCor(x.v), on=x.v===sel, vgt=x.v===vg.versao;
    return `<button class="st ${x.st}${on?" on":""}${vgt?" vig":""}" data-v="${x.v}" style="--c:${c}" ${x.st!=="ok"?"disabled":""}><span class="st-n">${x.v}</span><span class="st-t">${VNOME_C[x.v]}</span>${x.st==="ok"?`<span class="st-m">${pct(x.d.margem,1)}</span><span class="st-s">${mesTxt(x.d.mes)}</span>`:`<span class="st-s">${pv[x.v]!=null?"tendência "+pct(pv[x.v],1):"aguardando"}</span>`}${vgt?`<em>vigente</em>`:""}${x.d?.situacao&&x.d.situacao!=="Vigente"&&x.d.situacao!=="Substituída"?`<em class="sit">${esc(x.d.situacao)}</em>`:""}</button>`; }).join("");
  main.innerHTML = `
    <article class="card vb-hd">
      ${MP.icone(e.incorporadora, cor)}
      <div class="vb-t"><div class="vb-n"><h2>${esc(e.nome)}</h2><span class="tagc" style="--c:${faseCor(faseDe(e))}">${esc(faseNome(e))}</span></div>
        <div class="vb-s"><em style="color:${coE}">${esc(e.incorporadora)}</em> · ${local(e)}${e.ex_nome?" · ex-"+esc(e.ex_nome):""} · ${esc(linhaInfo(linhaDe(e)).curto)}</div>
        <div class="vb-acts"><button class="pillbtn" id="vbFicha"><svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>Ficha do empreendimento</button><button class="pillbtn" id="vbMapa"><svg viewBox="0 0 24 24"><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"/></svg>Ver no mapa</button></div></div>
      <div class="vb-vig" style="--c:${verCor(vg.versao)}"><span>Viabilidade vigente</span><b>${vg.versao}</b><strong>${VNOME_C[vg.versao]}</strong><small>elaborada em ${mesTxt(vg.mes)}${idadeM(vg.mes)!=null?" · "+idadeTxt(vg.mes):""}</small>${vg.situacao&&vg.situacao!=="Vigente"?`<i>${esc(vg.situacao)}</i>`:""}</div>
    </article>
    <article class="card vb-steps" id="sec-viab-cmp"><div class="ch"><div><h3>Versões da viabilidade</h3><p class="cap">clique numa versão para ver os números dela · os cartões abaixo comparam com a versão anterior</p></div></div><div class="stp">${steps}</div></article>
    <div class="grid vb-kpis">${kpis}</div>
    <div class="grid vb-2" id="sec-viab-det">
      <article class="card"><div class="ch"><div><h3>Do VGV ao lucro · ${sel}</h3><p class="cap">quanto do VGV vira lucro nesta versão</p></div></div><div class="chart" id="vbCasc"></div></article>
      <article class="card"><div class="ch"><div><h3>Produto · ${sel}</h3><p class="cap">eficiência, áreas e custo</p></div></div>
        <div class="vb-prod"><div class="vb-ef">${anel(ef, coE)}<div><b>${ef!=null?pct(ef,1):"—"}</b><span>eficiência</span></div></div>
          <div class="vb-pg">${[["Unidades",nf(d.unidades)+(d.permutas?` <small>(${nf(d.permutas)} permutadas)</small>`:"")],["Área construída",d.area_construida!=null?nf(d.area_construida)+" m²":"—"],["Área privativa",d.area_privativa!=null?nf(d.area_privativa)+" m²":"—"],["Área do terreno",d.area_terreno!=null?nf(d.area_terreno)+" m²":"—"],["Preço médio",d.preco_medio!=null?"R$ "+nf(d.preco_medio):"—"],["Custo / m²",d.custo_m2!=null?"R$ "+nf(d.custo_m2):"—"]].map(([k,x])=>`<div><span>${k}</span><b>${x}</b></div>`).join("")}</div></div></article>
    </div>
    <article class="card" id="sec-viab-evo"><div class="ch"><div><h3>Evolução por fase</h3><p class="cap">VGV bruto e margem líquida em cada versão · tracejado = tendência da margem nas versões que ainda não foram elaboradas</p></div><div class="leg" id="evoLeg" style="margin:0"></div></div><div class="chart" id="evoChart"></div></article>
    <article class="card vb-acc"><button class="sh-toggle" id="vbTudo" aria-expanded="${!!S.vbTudo}"><span class="st-ic"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg></span><span class="st-t"><b>Todos os números da ${sel}</b><span class="cap">${d.obs?esc(d.obs)+" · ":""}12 indicadores da DRE</span></span><span class="chev"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></span></button>
      ${S.vbTudo?`<div class="ph-full">${[["Nº de unidades (NUH)",nf(d.unidades)],["Unidades permutadas",nf(d.permutas)],["VGV bruto",brl(d.vgv_bruto)],["VGV líquido",brl(d.vgv_liquido)],["Área total construída",d.area_construida!=null?nf(d.area_construida)+" m²":"—"],["Área privativa total",d.area_privativa!=null?nf(d.area_privativa)+" m²":"—"],["Área do terreno",d.area_terreno!=null?nf(d.area_terreno)+" m²":"—"],["Valor de venda médio",d.preco_medio!=null?"R$ "+nf(d.preco_medio):"—"],["Custo de obra",brl(custoObra(d))],["Custo por m²",d.custo_m2!=null?"R$ "+nf(d.custo_m2):"—"],["Margem líquida",pct(d.margem)],["Lucro líquido",brl(d.lucro)],["Exposição máxima",brl(d.exposicao)],["Eficiência",ef!=null?pct(ef):"—"]].map(([k,x])=>`<div><span>${k}</span><b>${x}</b></div>`).join("")}</div>`:""}</article>`;
  main.querySelectorAll(".st[data-v]").forEach(b=>b.onclick=()=>{ S.vbVer=b.dataset.v; renderViabPagina(); });
  main.querySelectorAll(".vk[data-k] .exp").forEach(b=>b.onclick=()=>abreMetrica(e, b.closest(".vk").dataset.k));
  $("vbHow").onclick = abreHow; $("vbMapa").onclick = ()=>abreNoMapa(e); $("vbFicha").onclick = ()=>abreFicha(e);
  $("vbTudo").onclick = ()=>{ S.vbTudo=!S.vbTudo; renderViabPagina(); };
  cascata(d, coE, $("vbCasc"));
  chartEvo(e, $("evoChart"), pv);
}
function abreMetrica(e, k){
  const rot = {vgv:"VGV bruto", margem:"Margem líquida", lucro:"Lucro líquido"}[k], campo = {vgv:"vgv_bruto", margem:"margem", lucro:"lucro"}[k], f = k==="margem" ? x=>pct(x) : brl;
  const ok = etapas(e).filter(x=>x.st==="ok");
  $("expT").innerHTML = `${esc(e.nome)} · ${rot} <span class="muted" style="font-weight:500;font-size:.9rem">por versão</span>`;
  $("expBody").innerHTML = `<div class="tbl-wrap"><table class="t" style="min-width:0"><thead><tr><th>Versão</th><th>Data-base</th><th>Situação</th><th class="n">${rot}</th><th class="n">vs. anterior</th></tr></thead><tbody>${ok.map((x,i)=>{ const a=i?ok[i-1].d[campo]:null, b=x.d[campo];
    return `<tr><td><span class="tagc" style="--c:${verCor(x.v)}">${x.v} – ${VNOME_C[x.v]}</span></td><td>${mesTxt(x.d.mes)}</td><td class="muted">${esc(x.d.situacao||"")}</td><td class="n"><b>${f(b)}</b></td><td class="n">${a==null||b==null?"—":k==="margem"?chipDelta(b-a,"pp"):chipDelta((b-a)/Math.abs(a))}</td></tr>`; }).join("")}</tbody></table></div>`;
  abreFolha("expSheet");
}
function renderViab(){
  const card=$("sec-viab"); if (card){ card.classList.toggle("fechado", !S.vbTabela); const t=$("vbTabT"); if (t) t.setAttribute("aria-expanded", String(!!S.vbTabela)); }
  const its = ordena(filtrados().filter(e=>vig(e)));
  $("viabTable").innerHTML = `<table class="t"><thead><tr><th>Empreendimento</th><th>Linha</th><th>Fase</th><th>Vigente</th><th>Data-base</th><th class="n">Unidades</th><th class="n">VGV bruto</th><th class="n">VGV líquido</th><th class="n">Margem líq.</th><th class="n">Projetada lanç.</th><th class="n">Lucro líquido</th><th class="n">Exposição máx.</th><th>Observação</th></tr></thead><tbody>${its.map(e=>{const v=vig(e),p=proj(e);return `<tr class="lk${e.sigla===S.vbSel?" on":""}" data-s="${e.sigla}"><td><span class="tagc" style="--c:${corDe(e)}">${esc(e.nome)}</span></td><td>${esc(linhaInfo(linhaDe(e)).curto)}</td><td>${esc(faseNome(e))}</td><td><b>${v.versao}</b></td><td>${v.mes?v.mes.slice(5)+"/"+v.mes.slice(0,4):"—"}</td><td class="n">${nf(v.unidades)}</td><td class="n">${brl(v.vgv_bruto)}</td><td class="n">${brl(v.vgv_liquido)}</td><td class="n">${pct(v.margem)}</td><td class="n">${p?pct(p.m):"—"}</td><td class="n">${brl(v.lucro)}</td><td class="n">${brl(v.exposicao)}</td><td class="muted">${esc(v.obs||"")}</td></tr>`}).join("")}</tbody></table>`;
  $("viabTable").querySelectorAll("tr[data-s]").forEach(r=>r.onclick=()=>{ S.vbSel=r.dataset.s; S.vbVer=null; renderViabPagina(); renderViab(); window.scrollTo({top:0,behavior:"smooth"}); });
  renderViabPagina();
}

/* =========================================================
   NAVEGAÇÃO E MONTAGEM
   ========================================================= */
let paginaAtual = "resumo";
function route(){
  const h = location.hash.slice(1), [pg, sig] = h.split(":"), p = PAGES.includes(pg) ? pg : "resumo"; paginaAtual = p;
  if (p==="mapa" && sig){ S.mapSel = decodeURIComponent(sig); if (h.endsWith(":ficha")) S.fichaAberta = true; }
  if (p==="viabilidade" && sig){ S.vbSel = decodeURIComponent(sig); renderViab(); }
  document.querySelectorAll(".page").forEach(s=>s.hidden = s.dataset.page!==p);
  document.querySelectorAll("#nav .ni").forEach(a=>{ a.classList.toggle("on", a.dataset.p===p); a.toggleAttribute("aria-current", a.dataset.p===p); });
  document.documentElement.classList.toggle("no-scroll", p==="mapa");
  if (p==="mapa"){ setTimeout(()=>{ iniciaMapaPagina(); const e=D.empreendimentos.find(x=>x.sigla===S.mapSel); renderMapaPagina(); if (e && full.loaded()) MP.voa3d(full, e.pos, {padding:PADF()}); marca3d(); }, 30); }
  if (p==="resumo" && mini) setTimeout(()=>mini.resize(),60);
}
function irPara(p, sec){
  const alvo = p==="mapa" && S.mapSel ? "mapa:"+S.mapSel+(S.fichaAberta?":ficha":"") : p==="viabilidade" && S.vbSel ? "viabilidade:"+S.vbSel : p;
  if (location.hash.slice(1)!==alvo) location.hash = alvo; else route();
  fechaPops();
  if (sec && sec.startsWith("cid:")){ const c=sec.slice(4); S.mapSel=null; history.replaceState(null,"","#mapa"); setTimeout(()=>{ if (full) MP.enquadra(full, filtrados().filter(e=>e.pos&&e.cidade===c), PAD(), {animar:true, plano:true}); renderMapaPagina(); }, 120); return; }
  if (sec){ if (sec==="sec-saude" && !S.saudeOpen){ S.saudeOpen=true; renderSaude(); } setTimeout(()=>{ const el=$(sec); if (el) window.scrollTo({top:el.getBoundingClientRect().top+scrollY-84, behavior:"smooth"}); },80); }
  else if (p!=="mapa") window.scrollTo({top:0, behavior:"smooth"});
}
function renderAll(){
  document.documentElement.dataset.inc = S.inc;
  renderFilterPop(); renderCoPop();
  renderKpis(); renderTraj(); renderDonut(); renderMap(); renderSaude(); renderMarcos(); renderData();
  renderLaunches(); renderVariacoes(); renderViab();
  if (!$("setSheet").hidden) renderSettings();
}
function renderData(){
  $("pendDot").hidden = !pendencias().length;
  const g = new Date(D.gerado_em);
  $("stamp").dataset.tip = `Atualizado em ${g.toLocaleDateString("pt-BR")} às ${g.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
}

function init(){
  prepara();
  const nav = $("nav"), nis = [...nav.querySelectorAll(".ni")];
  hoverPop(nis, "navPop", ev=>{ const a = ev.currentTarget.closest ? ev.currentTarget.closest(".ni") : null; if (!a) return;
    nis.forEach(n=>n.classList.toggle("hov", n===a)); renderNavPop(a.dataset.p); });
  nis.forEach(a=>a.addEventListener("click", ev=>{ ev.preventDefault(); irPara(a.dataset.p); }));
  $("navPop").addEventListener("click", ev=>{ const a=ev.target.closest("a[data-sec]"); if (!a) return; ev.preventDefault(); irPara(a.getAttribute("href").slice(1), a.dataset.sec); });
  const touch = matchMedia("(hover: none)").matches;
  if (!touch){ hoverPop([$("filterBtn")], "filterPop"); hoverPop([$("coSwitch")], "coPop", renderCoPop); }
  $("filterBtn").onclick = ()=>{ const p=$("filterPop"); if (!p.hidden && touch){ p.hidden=true; return; } fechaPops("filterPop"); p.hidden=false; };
  $("coSwitch").onclick = ()=>{ const i=(INCS.findIndex(x=>x[0]===S.inc)+1)%3; setInc(INCS[i][0]); };
  // um clique dentro do painel recria o conteúdo: o alvo some do documento, e isso não pode fechar o painel
  document.addEventListener("click", ev=>{ if (!ev.target.isConnected || ev.target.closest(".top,#linkPop,#linkBtn")) return; fechaPops(); });
  $("linkBtn").onclick = ev=>{ const p=$("linkPop"), v=p.hidden; fechaPops(); p.hidden=!v; };
  const ZS=[.8,.9,1,1.1,1.2,1.3];
  const zoomUI = d=>{ const i=Math.max(0,Math.min(ZS.length-1, ZS.indexOf(UIZ())+d)), z=ZS[i<0?2:i]; document.documentElement.style.setProperty("--ui", z); try{ localStorage.setItem("dash-zoom", z); }catch(e){}
    $("uiPct").textContent=Math.round(z*100)+"%"; renderTraj(); renderSaude(); if (mini) mini.resize(); if (full){ full.resize(); if (!S.mapSel) voltaTodos(false); } };
  $("uiMenos").onclick=()=>zoomUI(-1); $("uiMais").onclick=()=>zoomUI(1); $("uiPct").textContent=Math.round(UIZ()*100)+"%";
  document.querySelector('#sec-marcos .pillbtn').addEventListener("click", ev=>{ ev.preventDefault(); irPara("analise","sec-var"); });
  $("saudeToggle").onclick = ()=>{ S.saudeOpen=!S.saudeOpen; renderSaude(); };
  $("vbTabT").onclick = ()=>{ S.vbTabela=!S.vbTabela; renderViab(); };
  $("setBtn").onclick = ()=>{ renderSettings(); abreFolha("setSheet"); };
  $("setTabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{ S.setTab=b.dataset.t; renderSettings(); });
  $("themeBtn").onclick = ()=>{ const t = dark()?"light":"dark"; document.documentElement.dataset.theme=t; try{ localStorage.setItem("dash-tema",t); }catch(e){} if (mini) MP.tema(mini, tema()); if (full) MP.tema(full, tema()); renderAll(); };
  $("scrim").onclick = ()=>abreFolha(null);
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>abreFolha(null));
  document.addEventListener("mouseover", ev=>{ const n=ev.target.closest("[data-tip]"); if (n){ n.onmousemove = e=>showTip(esc(n.dataset.tip), e); n.onmouseleave = hideTip; } });
  $("stamp").addEventListener("click", ev=>showTip(esc($("stamp").dataset.tip), ev));
  addEventListener("keydown", e=>{ if (e.key==="Escape"){ abreFolha(null); fechaPops(); } });
  addEventListener("hashchange", route);
  addEventListener("scroll", hideTip, {passive:true});
  let rt; addEventListener("resize", ()=>{ clearTimeout(rt); rt=setTimeout(()=>{ renderTraj(); renderSaude(); renderViabPagina(); }, 150); });
  route(); renderAll();
}

fetch("dados.json",{cache:"no-store"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d=>{ D=d; init(); })
  .catch(err=>{ $("main").innerHTML = `<div class="card" style="margin-top:24px"><h3>Não foi possível carregar os dados</h3><p class="muted">${esc(err.message)}</p></div>`; console.error(err); });
