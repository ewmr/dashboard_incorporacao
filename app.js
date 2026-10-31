"use strict";
/* Dashboard de Incorporação · Make It e Gadens
   Lê dados.json (gerado a partir do ClickUp) e monta as páginas.
   Filtros (incorporadora, cidade, ano de lançamento, fase, linha de produto) valem para todos os painéis.
   As cores dos empreendimentos seguem o agrupamento escolhido: fase do projeto ou linha de produto. */

/* ---------- dicionários ---------- */
const FASES = [
  {id:"DUE", nome:"Due Diligence", v:"--f-due"},
  {id:"DEV", nome:"Desenvolvimento p/ Lançamento", v:"--f-dev"},
  {id:"LIB", nome:"Liberação para Obra", v:"--f-lib"},
  {id:"OBR", nome:"Desenvolvimento de Obra", v:"--f-obr"},
  {id:"ENT", nome:"Entrega", v:"--f-ent"},
  {id:"SEM", nome:"Sem cronograma", v:"--f-none"},
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
const METAS = {2027:0.20, 2028:0.21, 2029:0.22};
const MIN_AMOSTRA = 2;
const INCS = [["all","Consolidado"],["Make It","Make It"],["Gadens","Gadens"]];

const CHANGELOG = [
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

const S = {mapSel:null, inc:"all", cidades:new Set(), anos:new Set(), fases:new Set(), linhas:new Set(), group:"fase", sel:null, saudeOpen:false, setTab:"dados"};
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
const grupoDe = e => S.group==="fase" ? estrategica(e.fase) : linhaDe(e);
const grupoNome = id => S.group==="fase" ? (FASES.find(f=>f.id===id)?.nome||id) : linhaInfo(id).curto;
const grupoCor = id => S.group==="fase" ? faseCor(id) : linhaCor(id);
const grupoOrdem = () => S.group==="fase" ? FASES.map(f=>f.id) : LINHAS.map(l=>l.id);
const corDe = e => grupoCor(grupoDe(e));

/* ---------- dados derivados ---------- */
const vig = e => e._vig;
const lanc = e => e.marcos.inc002 || null;
const anoLanc = e => lanc(e) ? +lanc(e).data.slice(0,4) : null;
const anoKey = e => String(anoLanc(e) ?? "Sem data");
const ativa = e => !e.legado;
const porInc = e => S.inc==="all" || e.incorporadora===S.inc;
const ANO = () => +(D.gerado_em||"").slice(0,4) || new Date().getFullYear();
function filtrados(ignora){
  return D.empreendimentos.filter(e => porInc(e) &&
    (ignora==="cidade" || !S.cidades.size || S.cidades.has(e.cidade)) &&
    (ignora==="ano" || !S.anos.size || S.anos.has(anoKey(e))) &&
    (ignora==="fase" || !S.fases.size || S.fases.has(estrategica(e.fase))) &&
    (ignora==="linha" || !S.linhas.size || S.linhas.has(linhaDe(e))));
}
const nFiltros = () => S.cidades.size+S.anos.size+S.fases.size+S.linhas.size;
const toggle = (set,v) => { set.has(v) ? set.delete(v) : set.add(v); S.sel=null; renderAll(); };
const grupoSet = () => S.group==="fase" ? S.fases : S.linhas;
const grupoDim = () => S.group==="fase" ? "fase" : "linha";

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
  const L = filtrados().filter(ativa);
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
     ins:`${ic.hammer}<b>${nf(L.filter(e=>estrategica(e.fase)==="OBR").reduce((a,e)=>a+(vig(e)?.unidades||0),0))}</b> UH em obra`},
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
  const L = filtrados().filter(ativa);
  const grupos = grupoOrdem().map(id=>({id, its:L.filter(e=>grupoDe(e)===id).sort((a,b)=>(c.f(b)||0)-(c.f(a)||0))})).filter(g=>g.its.length);
  const tot = L.reduce((a,e)=>a+(c.f(e)||0),0)||1;
  const ent = filtrados().filter(e=>e.legado);
  $("expT").innerHTML = `${c.k} <span class="muted" style="font-weight:500;font-size:.9rem">${c.v}</span>`;
  $("expBody").innerHTML = `<p class="muted small">Agrupado por ${S.group==="fase"?"fase do projeto":"linha de produto"} · viabilidade vigente de cada empreendimento${nFiltros()||S.inc!=="all"?" · com os filtros atuais":""}.</p>
    <div class="grp">${grupos.map(g=>{ const gt=g.its.reduce((a,e)=>a+(c.f(e)||0),0); const cor=grupoCor(g.id);
      return `<div class="box"><h4><span class="mac" style="--c:${cor}"></span>${esc(grupoNome(g.id))}<span class="muted" style="margin-left:auto;font-weight:500">${c.id==="emp"?nf(g.its.length):c.fmt(gt)} · ${nf(gt/tot*100,0)}%</span></h4>
      ${g.its.map(e=>`<div class="row" style="--c:${cor}"><span>${esc(e.nome)} <span class="muted small">· ${esc(TATICA[e.fase]||"Sem cronograma")}</span></span><span class="v">${c.id==="emp"?esc(e.cidade):c.fmt(c.f(e))}</span>${c.id==="emp"?"":`<span class="br"><i style="width:${(c.f(e)||0)/Math.max(...g.its.map(x=>c.f(x)||0),1)*100}%"></i></span>`}</div>`).join("")}</div>`; }).join("")}
    ${ent.length?`<div class="box"><h4><span class="mac" style="--c:${faseCor("ENT")}"></span>Entregues<span class="muted" style="margin-left:auto;font-weight:500">${ent.length}</span></h4>${ent.map(e=>`<div class="row"><span>${esc(e.nome)}</span><span class="v muted">entregue</span></div>`).join("")}</div>`:""}</div>`;
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
  $("trajBigS").textContent = `em ${anoSel}${tOk&&tPr?` · ${brl(tOk)} lançado e ${brl(tPr)} previsto`:tOk?" · lançado":tPr?" · previsto":""}`;
  const incs = S.inc==="all" ? ["Make It","Gadens"] : [S.inc];
  $("trajLeg").innerHTML = incs.map(i=>`<span><i style="background:${coCor(i)}"></i>${i}</span>`).join("") + `<span><i class="lt" style="background:${coCor(incs[0])}"></i>claro = previsto</span>`;
  const box = $("traj");
  const W = Math.max(320, box.clientWidth||600), H = W<560 ? 220 : 290, ml = 4, mr = 46, mt = 10, mb = 26, iw = W-ml-mr, ih = H-mt-mb;
  const tot = c => c.mk[0]+c.mk[1]+c.gd[0]+c.gd[1];
  const maxV = Math.max(...cel.map(tot), 1), st = niceStep(maxV, 3), top = Math.ceil(maxV/st)*st, Yp = v => mt+ih-ih*v/top;
  const step = iw/60, bw = Math.max(3, Math.min(10, step*.58));
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
  const L = filtrados(grupoDim()).filter(ativa);
  $("distTitle").textContent = S.group==="fase" ? "Distribuição por fase" : "Distribuição por linha de produto";
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
    bindTip(p, `<b>${esc(grupoNome(x.id))}</b> · ${x.n} ${x.n===1?"empreendimento":"empreendimentos"} · ${brl(x.vgv)}<table>${x.its.slice().sort((a,b)=>(vig(b)?.vgv_bruto||0)-(vig(a)?.vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td class="muted">${esc(S.group==="fase"?TATICA[e.fase]||"—":(FASES.find(f=>f.id===estrategica(e.fase))||{}).nome)}</td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</table><div class="muted">clique para filtrar</div>`);
    p.onclick = ()=>{ hideTip(); toggle(set, x.id); };
  });
  const lg = $("donutLeg"); lg.innerHTML="";
  g.forEach(x=>{ const b=document.createElement("button"); b.style.setProperty("--c",grupoCor(x.id)); b.setAttribute("aria-pressed",String(set.has(x.id))); if (set.size&&!set.has(x.id)) b.className="dim";
    b.innerHTML=`<i style="background:${grupoCor(x.id)}"></i>${esc(grupoNome(x.id))} <b>${x.n}</b>`; b.onclick=()=>toggle(set,x.id); lg.appendChild(b); });
}

/* ---------- Mapa (mapa próprio: mapa.js) ---------- */
let mini = null, full = null, mapBusca = "";
const tema = () => dark()?"dark":"light";
const dicaPino = (e, ev) => { if (!e) return hideTip(); showTip(`<b>${esc(e.nome)}</b> · ${esc(grupoNome(grupoDe(e)))}<div class="muted">${esc(e.endereco||e.cidade)}</div>`, ev); };
function renderMap(){
  if (typeof maplibregl === "undefined" || typeof MP === "undefined"){ $("map").innerHTML="<p class='muted' style='padding:16px'>Não foi possível carregar o mapa.</p>"; return; }
  const Ls = filtrados().filter(e=>e.pos);
  if (!mini){
    mini = MP.novo($("map"), {tema:tema()});
    mini.on("click", ()=>irPara("mapa"));
    mini.once("load", ()=>MP.enquadra(mini, filtrados().filter(e=>e.pos), 60));
  }
  MP.alfinetes(mini, Ls, {cor:corDe, dica:dicaPino, aoClicar:e=>{ hideTip(); abreNoMapa(e); }});
  if (mini.loaded()) MP.enquadra(mini, Ls, 60);
  if (full) renderMapaPagina();
}
function abreNoMapa(e){ S.mapSel = e ? e.sigla : null; irPara("mapa"); }
function selMapa(e, voar=true){
  S.mapSel = e ? e.sigla : null;
  history.replaceState(null, "", "#mapa"+(e?":"+e.sigla:""));
  if (e && voar && full){ MP.voa3d(full, e.pos); $("b3d").setAttribute("aria-pressed","true"); }
  renderMapaPagina();
}
function iniciaMapaPagina(){
  if (full) { full.resize(); return; }
  const el = $("mapaFull"); el.dataset.wheel = "livre";
  full = MP.novo(el, {tema:tema(), controles:true});
  full.scrollZoom.enable();
  full.once("load", ()=>{ const e = D.empreendimentos.find(x=>x.sigla===S.mapSel); if (e) MP.voa3d(full, e.pos); else MP.enquadra(full, filtrados().filter(x=>x.pos), {top:90,bottom:70,left:400,right:80}); });
  $("b3d").onclick = ()=>{ MP.aplica3d(full, !full._3d); $("b3d").setAttribute("aria-pressed", String(full._3d)); renderMapaPagina(); };
  $("bZin").onclick = ()=>full.zoomIn(); $("bZout").onclick = ()=>full.zoomOut();
  $("bNorte").onclick = ()=>{ full.easeTo({bearing:0, pitch:0, duration:700}); MP.aplica3d(full, false, false); $("b3d").setAttribute("aria-pressed","false"); };
  $("bTodos").onclick = ()=>{ selMapa(null,false); MP.aplica3d(full,false,false); $("b3d").setAttribute("aria-pressed","false"); full.easeTo({pitch:0,bearing:0,duration:0}); MP.enquadra(full, filtrados().filter(x=>x.pos), {top:90,bottom:70,left:400,right:80}); };
  full.on("pitchend", ()=>$("b3d").setAttribute("aria-pressed", String(full._3d)));
  renderMapaPagina();
}
const bairroDe = e => { const m=(e.endereco||"").match(/-\s*([^,]+),\s*[^,]+-\s*PR/) || (e.endereco||"").match(/,\s*\d+\s*[-,]\s*([^,]+),/); return m ? m[1].trim() : ""; };
function renderMapaPagina(){
  if (!full) return;
  const Ls = filtrados().filter(e=>e.pos), sel = D.empreendimentos.find(x=>x.sigla===S.mapSel);
  MP.alfinetes(full, Ls, {cor:corDe, sel:sel?.nome, dica:dicaPino, aoClicar:e=>{ hideTip(); selMapa(e); }});
  const side = $("mside");
  if (sel){
    const v=vig(sel), p=proj(sel), cor=corDe(sel), q=encodeURIComponent(sel.nome+" "+(sel.endereco||""));
    const marcos = Object.entries(sel.marcos).map(([c,m])=>({c, n:D.marco_nome[c]||c, ...m})).sort((a,b)=>a.data.localeCompare(b.data));
    side.innerHTML = `<div class="ficha">
      <button class="f-back" id="fBack"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>Empreendimentos</button>
      <div><span class="tagc" style="--c:${cor}">${esc(grupoNome(grupoDe(sel)))}</span></div>
      <h2>${esc(sel.nome)}</h2>
      <div class="f-end"><svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg><span>${esc(sel.endereco||sel.cidade)}${sel.pos_fonte!=="clickup"?" · posição aproximada":""}</span></div>
      <div class="f-acts">
        <button id="fVista" class="${full._3d?"on":""}"><svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>${full._3d?"Visão 3D":"Ver em 3D"}</button>
        <a href="https://maps.apple.com/?ll=${sel.pos[0]},${sel.pos[1]}&q=${encodeURIComponent(sel.nome)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"/></svg>Mapas</a>
        <a href="https://www.google.com/maps/search/?api=1&query=${sel.pos[0]},${sel.pos[1]}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/></svg>Google</a>
        <button id="fCopia"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="12" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>Copiar</button>
      </div>
      <div class="f-kpi"><div><span>VGV bruto</span><b>${brl(v?.vgv_bruto)}</b></div><div><span>Unidades</span><b>${nf(v?.unidades)}</b></div>
        <div><span>Margem líquida</span><b>${pct(v?.margem,1)}</b></div><div><span>Projetada no lançamento</span><b>${p?pct(p.m,1):"—"}</b></div></div>
      <dl class="f-dl"><div><dt>Incorporadora</dt><dd>${esc(sel.incorporadora)}</dd></div><div><dt>Linha de produto</dt><dd>${esc(linhaInfo(linhaDe(sel)).curto)}</dd></div>
        <div><dt>Fase</dt><dd>${esc(TATICA[sel.fase]||"Sem cronograma")}</dd></div><div><dt>Cidade</dt><dd>${esc(sel.cidade)}${bairroDe(sel)?" · "+esc(bairroDe(sel)):""}</dd></div>
        <div><dt>Viabilidade vigente</dt><dd>${v?v.versao+" – "+VNOME[v.versao]+(v.mes?" · "+v.mes.slice(5)+"/"+v.mes.slice(0,4):""):"—"}</dd></div>
        ${sel.ex_nome?`<div><dt>Nome antigo</dt><dd>${esc(sel.ex_nome)}</dd></div>`:""}</dl>
      ${marcos.length?`<div class="f-h">Marcos do cronograma</div><ul class="f-tl">${marcos.map(m=>`<li class="${m.ok?"ok":""}"><i></i><span>${esc(m.n)}</span><span>${dmy(m.data)}</span></li>`).join("")}</ul>`:""}
    </div>`;
    $("fBack").onclick = ()=>{ selMapa(null,false); MP.aplica3d(full,false); $("b3d").setAttribute("aria-pressed","false"); MP.enquadra(full, Ls, {top:90,bottom:70,left:400,right:80}); };
    $("fVista").onclick = ()=>{ if (full._3d){ MP.aplica3d(full,false); } else MP.voa3d(full, sel.pos); $("b3d").setAttribute("aria-pressed", String(full._3d)); renderMapaPagina(); };
    $("fCopia").onclick = ()=>{ try{ navigator.clipboard.writeText(sel.endereco||""); $("fCopia").lastChild.textContent="Copiado"; }catch(e){} };
    return;
  }
  const q = mapBusca.trim().toLowerCase();
  const its = Ls.filter(e=>!q || (e.nome+" "+(e.endereco||"")+" "+e.cidade+" "+(e.ex_nome||"")).toLowerCase().includes(q));
  const grupos = grupoOrdem().map(id=>({id, its:its.filter(e=>grupoDe(e)===id).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"))})).filter(g=>g.its.length);
  side.innerHTML = `<div class="ms-h"><h2>Empreendimentos <span>${its.length}</span></h2>
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="mBusca" type="search" placeholder="Buscar por nome, rua ou bairro" value="${esc(mapBusca)}"></label></div>
    <div class="ms-b">${grupos.map(g=>`<div class="ms-g"><span class="mac" style="--c:${grupoCor(g.id)}"></span>${esc(grupoNome(g.id))} · ${g.its.length}</div>${g.its.map(e=>`<button class="ms-r" data-s="${e.sigla}" style="--c:${corDe(e)}"><span class="dot"></span><b>${esc(e.nome)}</b><span class="v">${brl(vig(e)?.vgv_bruto)}</span><span class="s">${esc(bairroDe(e)||e.cidade)} · ${esc(TATICA[e.fase]||"Sem cronograma")}</span></button>`).join("")}`).join("") || "<p class='muted' style='padding:12px'>Nenhum empreendimento encontrado.</p>"}</div>`;
  const inp = $("mBusca"); inp.oninput = ()=>{ mapBusca = inp.value; const pos=inp.selectionStart; renderMapaPagina(); const n=$("mBusca"); n.focus(); n.setSelectionRange(pos,pos); };
  side.querySelectorAll(".ms-r").forEach(b=>{ const e=D.empreendimentos.find(x=>x.sigla===b.dataset.s);
    b.onclick = ()=>selMapa(e); });
}

/* ---------- Saúde financeira (seção recolhível) ---------- */
function dadosSaude(){
  const L = filtrados().filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null);
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
    <div class="tile"><span class="k">Lucro líquido projetado</span><b>${brl(d.lucro)}</b><span class="s">soma das viabilidades vigentes</span></div>
    <div class="tile"><span class="k">Soma das exposições máximas</span><b>${brl(d.expo)}</b><span class="s">teto teórico: os picos não coincidem</span></div>
    <div class="tile w2"><div class="th"><h4>Margem projetada dos lançamentos × meta</h4><button class="link" id="howBtn">Como é calculada</button></div><p class="cap">média ponderada pelo VGV líquido · clique num ano para filtrar</p><div class="chart" id="metaYears"></div></div>
    <div class="tile w2"><div class="th"><h4>Margem média por ${S.group==="fase"?"fase":"linha de produto"}</h4></div><p class="cap">vigente → projetada no lançamento</p><div class="chart" id="margGrp"></div></div>
    <div class="tile w4"><div class="th"><h4>Margem por empreendimento</h4><div class="leg" style="margin:0"><span><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>vigente</span><span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="currentColor"/></svg>projetada no lançamento</span><span><svg width="4" height="12"><rect width="2" height="12" fill="currentColor"/></svg>meta do ano de lançamento</span></div></div><div class="chart" id="dumbbell"></div></div>`;
  $("howBtn").onclick = abreHow;
  chartAnos(); chartGrupo(d.L); chartDumbbell(d.L);
}
function chartAnos(){
  const LA = filtrados("ano").filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null&&lanc(e));
  const anos = {}; LA.forEach(e=>{ const a=anoLanc(e); (anos[a] ||= {v:0,m:0,its:[]}); const w=vig(e).vgv_liquido||0; anos[a].v+=w; anos[a].m+=proj(e).m*w; anos[a].its.push(e); });
  const ks = Object.keys(anos).map(Number).filter(k=>k>=ANO()-1).sort();
  const box = $("metaYears"); if (!ks.length){ box.innerHTML="<p class='muted'>Sem lançamentos nos filtros atuais.</p>"; return; }
  const W=Math.max(280,box.clientWidth||420), H=200, mt=22, mb=22, mr=36, iw=W-mr, ih=H-mt-mb, step=iw/ks.length, bw=Math.min(40,step*.46), top=.30, Y=v=>mt+ih-ih*Math.max(0,v)/top;
  let s=`<svg viewBox="0 0 ${W} ${H}">`;
  [0,.1,.2,.3].forEach(v=> s+=`<line x1="0" x2="${iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${iw+6}" y="${Y(v)+3.5}">${nf(v*100,0)}%</text>`);
  ks.forEach((k,i)=>{ const a=anos[k], m=a.v?a.m/a.v:0, x=step*i+(step-bw)/2, meta=METAS[k], dim=S.anos.size&&!S.anos.has(String(k)), abaixo=meta&&m<meta;
    s+=`<g class="${dim?"dim":""}"><path d="${barTop(x,Y(m),bw,mt+ih-Y(m),5)}" fill="var(--accent)"/>`;
    if (meta) s+=`<rect x="${x-6}" y="${Y(meta)-1}" width="${bw+12}" height="2.4" rx="1.2" fill="var(--label)"/>`;
    s+=`<text class="val" x="${x+bw/2}" y="${Math.min(Y(m),meta?Y(meta):1e9)-7}" text-anchor="middle">${nf(m*100,1)}%${abaixo?" ▼":""}</text><text x="${x+bw/2}" y="${H-6}" text-anchor="middle" ${S.anos.has(String(k))?'style="fill:var(--label);font-weight:700"':""}>${k}</text></g>`;
    s+=`<rect class="hit" data-k="${k}" x="${step*i}" y="0" width="${step}" height="${H}" fill="transparent"/>`; });
  box.innerHTML = s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const k=+r.dataset.k, a=anos[k], m=a.v?a.m/a.v:null, meta=METAS[k];
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
  its.forEach((e,i)=>{ const v=vig(e), p=proj(e), y=mt+i*rowH+rowH/2, cor=corDe(e), meta=METAS[anoLanc(e)], sel=S.sel===e.nome;
    if (i%2===0) s+=`<rect x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" fill="var(--fill)" opacity=".35" rx="6"/>`;
    s+=`<text x="${ml-10}" y="${y+4}" text-anchor="end" ${sel?'style="fill:var(--label);font-weight:700"':""}>${esc(e.nome)}</text>`;
    if (meta) s+=`<rect x="${X(meta)-1}" y="${y-8}" width="2" height="16" rx="1" fill="var(--label)" opacity=".75"/>`;
    s+=`<line x1="${X(v.margem)}" x2="${X(p.m)}" y1="${y}" y2="${y}" stroke="${cor}" stroke-width="3" stroke-linecap="round" opacity=".45"/>`;
    s+=`<circle cx="${X(v.margem)}" cy="${y}" r="4" fill="var(--card-solid)" stroke="${cor}" stroke-width="2"/>`;
    if (p.aj) s+=`<circle cx="${X(p.m)}" cy="${y}" r="5.5" fill="${cor}" stroke="var(--card-solid)" stroke-width="1.5"/>`;
    s+=`<text class="val" x="${W-mr+10}" y="${y+4}">${nf(p.m*100,1)}%${p.aj?` <tspan style="font-weight:400;fill:var(--label-2)">(${p.aj>0?"+":"−"}${nf(Math.abs(p.aj*100),1)})</tspan>`:""}</text>`;
    s+=`<rect class="hit" data-i="${i}" x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/>`; });
  box.innerHTML=s+"</svg>";
  box.querySelectorAll(".hit").forEach(r=>{ const e=its[r.dataset.i], v=vig(e), p=proj(e), meta=METAS[anoLanc(e)];
    bindTip(r, `<b>${esc(e.nome)}</b> · ${v.versao} – ${VNOME[v.versao]}${v.obs?` <span class="muted">(${esc(v.obs)})</span>`:""}<table><tr><td>Margem vigente</td><td class="n">${pct(v.margem)}</td></tr><tr><td>Projetada no lançamento</td><td class="n">${pct(p.m)}${p.aj?` (${pp(p.aj)})`:""}</td></tr><tr><td>Meta ${anoLanc(e)??""}</td><td class="n">${meta?pct(meta,0):"sem meta"}</td></tr><tr><td>Lucro líquido</td><td class="n">${brl(v.lucro)}</td></tr><tr><td>Lançamento</td><td class="n">${lanc(e)?(lanc(e).ok?"lançado ":"previsto ")+my(lanc(e).data):"sem data"}</td></tr></table><div class="muted">${esc(p.motivo)} · clique para abrir no mapa</div>`);
    r.onclick=()=>{ hideTip(); abreNoMapa(e); }; });
}
function abreHow(){
  const bloco = inc => `<div class="box"><h4><span class="mac" style="--c:${coCor(inc)}"></span>${inc}</h4><div class="tbl-wrap"><table class="t" style="min-width:560px"><thead><tr><th>De → para</th><th class="n">Casos</th><th class="n">Ajuste (mediana)</th><th>Casos usados (margem V4 − margem da versão)</th></tr></thead><tbody>${VERS.slice(0,4).filter(v=>!(inc==="Gadens"&&v==="V1")).map(v=>{ const x=AJ[inc][v];
    return `<tr><td><b>${v} → V4</b></td><td class="n">${x.n}</td><td class="n">${x.n>=MIN_AMOSTRA?pp(x.med):"não aplicado"}</td><td class="w muted">${x.pares.map(p=>`${esc(p.nome)} ${pp(p.d)}`).join(" · ")||"nenhum empreendimento com as duas versões ainda"}</td></tr>`; }).join("")}</tbody></table></div></div>`;
  const L = filtrados().filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null&&!lanc(e)?.ok&&vig(e).versao!=="V4").sort((a,b)=>(anoLanc(a)||9999)-(anoLanc(b)||9999)||a.nome.localeCompare(b.nome,"pt-BR"));
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
    <p>Por ano de lançamento, a projetada é a média ponderada pelo VGV líquido, comparada com a meta: 2027 20%, 2028 21%, 2029 22%. O cálculo é refeito a cada atualização.</p>
    ${bloco("Make It")}${bloco("Gadens")}
    <div class="box"><h4>Empreendimentos a lançar</h4><div class="tbl-wrap"><table class="t" style="min-width:620px"><thead><tr><th>Empreendimento</th><th>Lançamento</th><th>Vigente</th><th class="n">Margem vigente</th><th class="n">Ajuste</th><th class="n">Projetada</th><th class="n">Meta</th></tr></thead><tbody>
    ${L.map(e=>{const v=vig(e),p=proj(e),m=METAS[anoLanc(e)];return `<tr><td>${esc(e.nome)}</td><td>${lanc(e)?my(lanc(e).data):"sem data"}</td><td>${v.versao}</td><td class="n">${pct(v.margem)}</td><td class="n">${p.aj?pp(p.aj):"—"}</td><td class="n"><b>${pct(p.m)}</b></td><td class="n">${m?pct(m,0):"—"}</td></tr>`}).join("")}</tbody></table></div></div>`;
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
  viabilidade:[["sec-viab","Viabilidades vigentes"],[null,"Evolução por versão"]],
  metas:[[null,"Metas de Incorporação"]],
};
function miniPrev(p){
  const L = filtrados().filter(ativa), Y=ANO(), W=360, H=96;
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
    const LA=filtrados().filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null&&lanc(e)), ks=[2027,2028,2029], step=W/3, bw=40, top=.3, Yv=v=>H-14-(H-28)*v/top;
    const m=k=>{ const its=LA.filter(e=>anoLanc(e)===k), w=its.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0); return w?its.reduce((a,e)=>a+proj(e).m*(vig(e).vgv_liquido||0),0)/w:null; };
    svg = ks.map((k,i)=>{ const v=m(k)||0, x=i*step+(step-bw)/2; return `<rect x="${x}" y="${Yv(v)}" width="${bw}" height="${H-14-Yv(v)}" rx="5" fill="var(--accent)"/><rect x="${x-6}" y="${Yv(METAS[k])-1}" width="${bw+12}" height="2.4" rx="1.2" fill="var(--label)"/><text x="${i*step+step/2}" y="${H-2}" text-anchor="middle">${k}</text>`; }).join("");
    big=pct(m(2027),1); lab="margem projetada 2027 (meta 20%)"; foot=`<span>projetada × meta por ano</span><span>em construção</span>`;
  }
  return `<div class="pv"><div class="pv-h"><b>${big}</b><span>${lab}</span></div><svg viewBox="0 0 ${W} ${H}">${svg}</svg></div><div class="foot">${foot}</div>`;
}
function renderNavPop(p){
  $("npList").innerHTML = `<div class="h">${esc(PNOME[p])}</div>` + SECOES[p].map(([id,t])=> id ? `<a href="#${p}" data-sec="${id}"><i style="--c:var(--accent)"></i>${esc(t)}</a>` : `<a class="soon"><i></i>${esc(t)}</a>`).join("");
  $("npPrev").innerHTML = miniPrev(p);
}
function renderFilterPop(){
  const base = D.empreendimentos.filter(porInc);
  const chips = (vals, set, cor, nome=v=>v) => `<div class="chips">${vals.map(v=>`<button aria-pressed="${set.has(v)}" data-v="${esc(v)}" style="--c:${cor?cor(v):"var(--label-3)"}">${cor?"<i></i>":""}${esc(nome(v))}</button>`).join("")}</div>`;
  const fases = FASES.map(f=>f.id).filter(id=>base.some(e=>estrategica(e.fase)===id));
  const linhas = LINHAS.map(l=>l.id).filter(id=>base.some(e=>linhaDe(e)===id));
  $("filterPop").innerHTML = `
    <div class="fg"><span class="lb">Colorir e agrupar por</span><div class="seg" id="grpSeg"><button data-g="fase" aria-checked="${S.group==="fase"}">Fase do projeto</button><button data-g="linha" aria-checked="${S.group==="linha"}">Linha de produto</button></div></div>
    <div class="fg" data-set="fases"><span class="lb">Fase</span>${chips(fases,S.fases,faseCor,id=>FASES.find(f=>f.id===id).nome)}</div>
    <div class="fg" data-set="linhas"><span class="lb">Linha de produto</span>${chips(linhas,S.linhas,linhaCor,id=>linhaInfo(id).curto)}</div>
    <div class="fg" data-set="cidades"><span class="lb">Cidade</span>${chips([...new Set(base.map(e=>e.cidade))].sort(),S.cidades)}</div>
    <div class="fg" data-set="anos"><span class="lb">Ano de lançamento</span>${chips([...new Set(base.map(anoKey))].sort(),S.anos)}</div>
    <div class="f-foot"><span class="cap">${nFiltros()?`${nFiltros()} ${nFiltros()===1?"filtro ativo":"filtros ativos"} · ${filtrados().filter(ativa).length} empreendimentos`:"Sem filtros · valem para todos os painéis"}</span><button class="pillbtn" id="clearF">Limpar</button></div>`;
  $("filterPop").querySelectorAll(".fg[data-set] .chips button").forEach(b=>b.onclick=()=>toggle(S[b.closest(".fg").dataset.set], b.dataset.v));
  $("filterPop").querySelectorAll("#grpSeg button").forEach(b=>b.onclick=()=>{ S.group=b.dataset.g; renderAll(); });
  $("clearF").onclick=()=>{ S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.linhas.clear(); S.sel=null; renderAll(); };
  const n=nFiltros(), fc=$("filterCount"); fc.hidden=!n; fc.textContent=n;
}
const ICO_CO = {
  all:`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2.4" fill="#FF9100"/><rect x="13" y="13" width="8" height="8" rx="2.4" fill="#2C86DC"/><rect x="13" y="3" width="8" height="8" rx="2.4" fill="currentColor" opacity=".28"/><rect x="3" y="13" width="8" height="8" rx="2.4" fill="currentColor" opacity=".28"/></svg>`,
  "Make It":`<svg viewBox="0 0 230.8 230.8"><path fill="#fff" d="M108.6 178.3H63.9V81.6h44.7zM167.9 178.3h-44.6V51.8h44.6z"/></svg>`,
  Gadens:`<svg viewBox="-14 -14 140.4 136.4"><path fill="#fff" d="M54.5 0v108.4C24.6 108.4.3 84.1.3 54.2S24.6 0 54.5 0z"/><path fill="#fff" d="M63.1 59.1h49.3v49.3z"/><path fill="#F0A06A" d="M112.4 0v50.3C84.6 50.3 62 27.8 62 0z"/></svg>`,
};
function renderCoPop(){
  $("coPop").innerHTML = INCS.map(([id,n])=>`<button class="co-opt" role="menuitemradio" aria-checked="${S.inc===id}" data-inc="${id}"><span class="ci" style="background:${id==="all"?"var(--fill)":coCor(id)}">${ICO_CO[id]}</span>${n}<span class="ck">✓</span></button>`).join("");
  $("coPop").querySelectorAll(".co-opt").forEach(b=>b.onclick=()=>setInc(b.dataset.inc));
}
function setInc(inc){
  S.inc=inc; S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.linhas.clear(); S.sel=null;
  const pos = INCS.findIndex(x=>x[0]===inc), sw=$("coSwitch");
  sw.dataset.pos=pos; sw.setAttribute("aria-label","Incorporadora: "+INCS[pos][1]);
  renderAll();
}
/* abre ao passar o mouse; fecha com um pequeno atraso para dar tempo de entrar no bloco */
const pops = ["navPop","filterPop","coPop"];
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
  add("Endereço não preenchido no ClickUp (posição aproximada no mapa)", B.filter(e=>!e.legado&&e.pos_fonte!=="clickup").map(e=>e.nome));
  return out;
}
function renderSettings(){
  document.querySelectorAll("#setTabs button").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.t===S.setTab)));
  const g = new Date(D.gerado_em), p = pendencias();
  if (S.setTab==="dados") $("setBody").innerHTML = `
    <div class="box"><h4><span class="mac" style="--c:#FF5F57"></span>Atualização</h4><p>Dados gerados em ${g.toLocaleDateString("pt-BR")} às ${g.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}. Cronogramas: ${esc(D.fontes.cronogramas.replace(/(\d{4})-(\d{2})-(\d{2})/,"$3/$2/$1"))}.</p></div>
    <div class="box"><h4><span class="mac" style="--c:#FEBC2E"></span>Cronogramas e fases</h4><ul><li>Marcos lidos dos cronogramas do ClickUp pelo campo “Código tarefa” (listas privadas e “(cópia)” ficam de fora).</li><li>A fase de cada empreendimento sai do marco mais avançado concluído, não do nome da lista.</li><li>A comparação semanal usa o histórico salvo toda segunda-feira.</li></ul></div>
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
  $("launchList").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Cidade</th><th>Fase</th><th>Registro de Incorporação</th><th>Orçamento V4</th><th>Lançamento previsto</th><th class="n">VGV bruto</th></tr></thead><tbody>${its.map(e=>`<tr><td><span class="tagc" style="--c:${corDe(e)}">${esc(e.nome)}</span></td><td>${esc(e.cidade)}</td><td>${esc(TATICA[e.fase]||"—")}</td><td>${e.marcos.leg010?dmy(e.marcos.leg010.data):"—"}</td><td>${e.marcos.orcV4?dmy(e.marcos.orcV4.data):"—"}</td><td><b>${dmy(lanc(e).data)}</b></td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderVariacoes(){
  $("varNote").textContent = D.fontes.variacoes.split(" → ").map(dmy).join(" → ");
  const ok = new Set(filtrados().map(e=>e.sigla)), vs = D.variacoes.filter(v=>ok.has(v.sigla));
  $("varTable").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Marco</th><th>Data anterior</th><th>Data atual</th><th class="n">Variação</th></tr></thead><tbody>${vs.map(v=>`<tr><td>${esc(v.empreendimento)}</td><td>${esc(v.marco)}</td><td>${dmy(v.anterior)}</td><td>${dmy(v.atual)}</td><td class="n d ${v.dias>0?"late":"early"}" style="font-weight:700">${v.dias>0?"▲ +":"▼ "}${v.dias} dias</td></tr>`).join("")}</tbody></table></div>`;
}
function renderViab(){
  const its = filtrados().filter(e=>vig(e)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  $("viabTable").innerHTML = `<table class="t"><thead><tr><th>Empreendimento</th><th>Linha</th><th>Vigente</th><th>Data-base</th><th class="n">Unidades</th><th class="n">VGV bruto</th><th class="n">VGV líquido</th><th class="n">Margem líq.</th><th class="n">Projetada lanç.</th><th class="n">Lucro líquido</th><th class="n">Exposição máx.</th><th>Observação</th></tr></thead><tbody>${its.map(e=>{const v=vig(e),p=proj(e);return `<tr><td>${esc(e.nome)}</td><td><span class="tagc" style="--c:${linhaCor(linhaDe(e))}">${esc(linhaInfo(linhaDe(e)).curto)}</span></td><td><b>${v.versao}</b></td><td>${v.mes?v.mes.slice(5)+"/"+v.mes.slice(0,4):"—"}</td><td class="n">${nf(v.unidades)}</td><td class="n">${brl(v.vgv_bruto)}</td><td class="n">${brl(v.vgv_liquido)}</td><td class="n">${pct(v.margem)}</td><td class="n">${p?pct(p.m):"—"}</td><td class="n">${brl(v.lucro)}</td><td class="n">${brl(v.exposicao)}</td><td class="muted">${esc(v.obs||"")}</td></tr>`}).join("")}</tbody></table>`;
}

/* =========================================================
   NAVEGAÇÃO E MONTAGEM
   ========================================================= */
let paginaAtual = "resumo";
function route(){
  const h = location.hash.slice(1), [pg, sig] = h.split(":"), p = PAGES.includes(pg) ? pg : "resumo"; paginaAtual = p;
  if (p==="mapa" && sig) S.mapSel = decodeURIComponent(sig);
  document.querySelectorAll(".page").forEach(s=>s.hidden = s.dataset.page!==p);
  document.querySelectorAll("#nav .ni").forEach(a=>{ a.classList.toggle("on", a.dataset.p===p); a.toggleAttribute("aria-current", a.dataset.p===p); });
  document.documentElement.classList.toggle("no-scroll", p==="mapa");
  if (p==="mapa"){ setTimeout(()=>{ iniciaMapaPagina(); const e=D.empreendimentos.find(x=>x.sigla===S.mapSel); renderMapaPagina(); if (e && full.loaded()) MP.voa3d(full, e.pos); }, 30); }
  if (p==="resumo" && mini) setTimeout(()=>mini.resize(),60);
}
function irPara(p, sec){
  const alvo = p==="mapa" && S.mapSel ? "mapa:"+S.mapSel : p;
  if (location.hash.slice(1)!==alvo) location.hash = alvo; else route();
  fechaPops();
  if (sec && sec.startsWith("cid:")){ const c=sec.slice(4); S.mapSel=null; setTimeout(()=>{ if (full) MP.enquadra(full, D.empreendimentos.filter(e=>e.pos&&e.cidade===c&&porInc(e)), {top:90,bottom:70,left:400,right:80}); renderMapaPagina(); }, 120); return; }
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
  $("filterBtn").onclick = ()=>{ const p=$("filterPop"); const v=p.hidden; fechaPops(); p.hidden=!v; };
  $("coSwitch").onclick = ()=>{ const i=(INCS.findIndex(x=>x[0]===S.inc)+1)%3; setInc(INCS[i][0]); };
  document.addEventListener("click", ev=>{ if (!ev.target.closest(".top")) fechaPops(); });
  document.querySelector('#sec-marcos .pillbtn').addEventListener("click", ev=>{ ev.preventDefault(); irPara("analise","sec-var"); });
  $("saudeToggle").onclick = ()=>{ S.saudeOpen=!S.saudeOpen; renderSaude(); };
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
  let rt; addEventListener("resize", ()=>{ clearTimeout(rt); rt=setTimeout(()=>{ renderTraj(); renderSaude(); }, 150); });
  route(); renderAll();
}

fetch("dados.json",{cache:"no-store"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d=>{ D=d; init(); })
  .catch(err=>{ $("main").innerHTML = `<div class="card" style="margin-top:24px"><h3>Não foi possível carregar os dados</h3><p class="muted">${esc(err.message)}</p></div>`; console.error(err); });
