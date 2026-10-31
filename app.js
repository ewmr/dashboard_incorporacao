"use strict";
/* Dashboard de Incorporação · Make It e Gadens
   Lê dados.json (gerado diariamente a partir do ClickUp) e monta as páginas. */

const FASES = [
  {id:"DUE", nome:"Due Diligence", cor:"var(--f-due)", hex:"#6E56CF"},
  {id:"DEV", nome:"Desenvolvimento p/ Lançamento", cor:"var(--f-dev)", hex:"#C2900A"},
  {id:"LIB", nome:"Liberação para Obra", cor:"var(--f-lib)", hex:"#1F7FD1"},
  {id:"OBR", nome:"Desenvolvimento de Obra", cor:"var(--f-obr)", hex:"#D9480F"},
  {id:"ENT", nome:"Entrega", cor:"var(--f-ent)", hex:"#2B9A66"},
  {id:"SEM", nome:"Sem cronograma", cor:"var(--f-none)", hex:"#AEAEB2"},
];
const TATICA = {DUE:"Due Diligence",EP:"Estudo Preliminar",AP:"Anteprojeto",ALV:"Aprovação / Alvará",LAN:"Liberação p/ Lançamento",LIB:"Liberação para Obra",OBR:"Em obra",ENT:"Entrega"};
const estrategica = f => !f ? "SEM" : f==="DUE" ? "DUE" : ["EP","AP","ALV","LAN"].includes(f) ? "DEV" : f;
const faseInfo = id => FASES.find(x=>x.id===id);
const PAGES = {"one-page":"One Page Report","cronograma":"Cronograma","analise":"Análise de Cronogramas","viabilidade":"Indicadores de Viabilidade","metas":"Indicadores e Metas"};

const S = {inc:"all", cidades:new Set(), anos:new Set(), fases:new Set(), cross:null, kpiOpen:null};
let D = null, map = null, mapLayer = null;

/* ---------- formatação ---------- */
const nf = (v,d=0) => v==null||isNaN(v) ? "—" : v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const brl = v => {
  if (v==null) return "—";
  const a=Math.abs(v);
  if (a>=1e9) return "R$ "+nf(v/1e9,2)+" bi";
  if (a>=1e6) return "R$ "+nf(v/1e6,1)+" mi";
  if (a>=1e3) return "R$ "+nf(v/1e3,0)+" mil";
  return "R$ "+nf(v);
};
const pct = v => v==null ? "—" : nf(v*100,2)+"%";
const dmy = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const my = iso => iso ? iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const el = (tag, attrs={}, html="") => { const e=document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML=html; return e; };
const esc = s => String(s??"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- dados derivados ---------- */
const vig = e => e.viabilidades.find(v=>v.situacao==="Vigente") || null;
const lanc = e => e.marcos.inc002 || null;
const anoLanc = e => lanc(e) ? +lanc(e).data.slice(0,4) : null;
const ativa = e => !e.legado;
const porInc = e => S.inc==="all" || e.incorporadora===S.inc;
function filtrados({ignoreFilters=false}={}) {
  return D.empreendimentos.filter(e => porInc(e) && (ignoreFilters || (
    (!S.cidades.size || S.cidades.has(e.cidade)) &&
    (!S.anos.size || S.anos.has(String(anoLanc(e)??"Sem data"))) &&
    (!S.fases.size || S.fases.has(estrategica(e.fase))) &&
    (!S.cross || estrategica(e.fase)===S.cross)
  )));
}
const temFiltro = () => S.cidades.size||S.anos.size||S.fases.size||S.cross;

/* ---------- tooltip ---------- */
const tip = document.getElementById("tip");
function showTip(html, ev){ tip.innerHTML=html; tip.hidden=false; moveTip(ev); }
function moveTip(ev){ const pad=14, w=tip.offsetWidth, h=tip.offsetHeight; let x=ev.clientX+pad, y=ev.clientY+pad; if (x+w>innerWidth-8) x=ev.clientX-w-pad; if (y+h>innerHeight-8) y=ev.clientY-h-pad; tip.style.left=x+"px"; tip.style.top=y+"px"; }
function hideTip(){ tip.hidden=true; }

/* ---------- PAINEL 1 · Escala ---------- */
function renderKpis(){
  const L = filtrados().filter(ativa);
  const sum = f => L.reduce((a,e)=>a+(f(e)||0),0);
  const cards = [
    {id:"vgv", k:"VGV da carteira", v:brl(sum(e=>vig(e)?.vgv_bruto)), s:"bruto · viabilidade vigente", f:e=>vig(e)?.vgv_bruto, fmt:brl},
    {id:"uh", k:"Unidades", v:nf(sum(e=>vig(e)?.unidades)), s:"unidades habitacionais", f:e=>vig(e)?.unidades, fmt:v=>nf(v)},
    {id:"emp", k:"Empreendimentos", v:nf(L.length), s:"carteira ativa", f:()=>1, fmt:v=>nf(v)},
    {id:"area", k:"Área construída", v:nf(sum(e=>vig(e)?.area_construida))+" m²", s:"soma das viabilidades vigentes", f:e=>vig(e)?.area_construida, fmt:v=>nf(v)+" m²"},
  ];
  const box = document.getElementById("kpis"); box.innerHTML="";
  cards.forEach(c=>{
    const b = el("button",{class:"kpi","aria-expanded":String(S.kpiOpen===c.id)},`<span class="k">${c.k}</span><b>${c.v}</b><span class="s">${c.s}</span>`);
    b.onclick = ()=>{ S.kpiOpen = S.kpiOpen===c.id?null:c.id; renderKpis(); };
    box.appendChild(b);
  });
  const det = document.getElementById("kpiDetail");
  const c = cards.find(x=>x.id===S.kpiOpen);
  if (!c){ det.hidden=true; return; }
  const grupos = [
    {t:"Em desenvolvimento", f:e=>["DUE","DEV","SEM"].includes(estrategica(e.fase))},
    {t:"Lançados", f:e=>["LIB","OBR"].includes(estrategica(e.fase))},
  ];
  const entregues = filtrados().filter(e=>e.legado);
  let html = `<div class="comp">`;
  grupos.forEach(g=>{
    const its = L.filter(g.f).sort((a,b)=>(c.f(b)||0)-(c.f(a)||0));
    const tot = its.reduce((a,e)=>a+(c.f(e)||0),0);
    html += `<div><h4><span>${g.t}</span><span>${c.fmt(tot)}</span></h4><ul>${its.map(e=>`<li><span>${esc(e.nome)}</span><span>${c.id==="emp"?esc(TATICA[e.fase]||"Sem cronograma"):c.fmt(c.f(e))}</span></li>`).join("")||"<li><span class='muted'>Nenhum</span></li>"}</ul></div>`;
  });
  html += `<div><h4><span>Entregues</span><span>${nf(entregues.length)}</span></h4><ul>${entregues.map(e=>`<li><span>${esc(e.nome)}</span><span>${c.id==="vgv"||c.id==="uh"||c.id==="area"?(vig(e)?c.fmt(c.f(e)):"sem viabilidade"):"entregue"}</span></li>`).join("")||"<li><span class='muted'>Nenhum</span></li>"}</ul></div></div>`;
  det.innerHTML = html; det.hidden=false;
}

/* ---------- PAINEL 2 · Trajetória ---------- */
function renderTraj(){
  const L = filtrados({ignoreFilters:true}).filter(e=>lanc(e) && vig(e));
  const anos = {};
  L.forEach(e=>{ const a=anoLanc(e); (anos[a] ||= {lanc:0,prev:0,its:[]}); const v=vig(e).vgv_bruto||0; if (lanc(e).ok) anos[a].lanc+=v; else anos[a].prev+=v; anos[a].its.push(e); });
  const keys = Object.keys(anos).map(Number).sort();
  const box = document.getElementById("traj");
  const semData = filtrados({ignoreFilters:true}).filter(e=>!lanc(e) && !e.legado).map(e=>e.nome);
  document.getElementById("trajFoot").textContent = semData.length ? `Sem data de lançamento no cronograma (fora do gráfico): ${semData.join(", ")}.` : "";
  if (!keys.length){ box.innerHTML="<p class='muted'>Sem lançamentos para mostrar.</p>"; return; }
  const W=560,H=240,ml=8,mr=8,mt=26,mb=26, iw=W-ml-mr, ih=H-mt-mb;
  const max = Math.max(...keys.map(k=>anos[k].lanc+anos[k].prev))*1.08;
  const bw = Math.min(64, iw/keys.length*0.56), step = iw/keys.length;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="VGV lançado por ano"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${accent}" opacity=".22"/><line x1="0" y1="0" x2="0" y2="6" stroke="${accent}" stroke-width="2" opacity=".55"/></pattern></defs>`;
  s += `<line x1="${ml}" x2="${W-mr}" y1="${mt+ih}" y2="${mt+ih}" stroke="var(--hdr-sep)"/>`;
  keys.forEach((k,i)=>{
    const a=anos[k], x=ml+step*i+(step-bw)/2;
    const hL=ih*a.lanc/max, hP=ih*a.prev/max, yL=mt+ih-hL, yP=yL-hP-(a.lanc&&a.prev?2:0);
    if (a.lanc) s += `<path d="M${x},${mt+ih} V${yL+4} q0,-4 4,-4 h${bw-8} q4,0 4,4 V${mt+ih} Z" fill="${accent}"/>`;
    if (a.prev) s += `<path d="M${x},${yP+hP} V${yP+4} q0,-4 4,-4 h${bw-8} q4,0 4,4 V${yP+hP} Z" fill="url(#hatch)"/>`;
    const top = Math.min(a.lanc?yL:Infinity, a.prev?yP:Infinity);
    s += `<text class="val" x="${x+bw/2}" y="${top-6}" text-anchor="middle">${brl(a.lanc+a.prev).replace("R$ ","")}</text>`;
    s += `<text x="${x+bw/2}" y="${H-8}" text-anchor="middle">${k}</text>`;
    s += `<rect x="${ml+step*i}" y="${mt}" width="${step}" height="${ih}" fill="transparent" data-ano="${k}" class="hit"/>`;
  });
  s += `</svg>`;
  box.innerHTML = s;
  box.querySelectorAll(".hit").forEach(r=>{
    const a = anos[r.dataset.ano];
    const rows = a.its.sort((x,y)=>(vig(y).vgv_bruto||0)-(vig(x).vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td>${lanc(e).ok?"lançado":"previsto "+my(lanc(e).data)}</td><td class="n">${brl(vig(e).vgv_bruto)}</td><td class="n">${nf(vig(e).unidades)} UH</td></tr>`).join("");
    const html = `<b>${r.dataset.ano}</b> · ${brl(a.lanc+a.prev)} · ${nf(a.its.reduce((t,e)=>t+(vig(e).unidades||0),0))} UH<table>${rows}</table>`;
    r.addEventListener("mousemove", ev=>showTip(html,ev)); r.addEventListener("mouseleave", hideTip);
  });
}

/* ---------- PAINEL 3 · Funil por fase ---------- */
function renderFunnel(){
  const L = filtrados({ignoreFilters:true}).filter(ativa);
  const g = FASES.filter(f=>f.id!=="ENT").map(f=>{ const its=L.filter(e=>estrategica(e.fase)===f.id); return {...f, its, vgv:its.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0)}; }).filter(f=>f.its.length);
  const max = Math.max(...g.map(f=>f.vgv),1);
  const box = document.getElementById("funnel"); box.innerHTML="";
  g.forEach(f=>{
    const b = el("button",{class:"fun-row","aria-pressed":String(S.cross===f.id)},
      `<span class="nm"><i style="background:${f.cor}"></i>${f.nome}</span><span class="tr"><span style="width:${Math.max(2,f.vgv/max*100)}%;background:${f.cor}"></span></span><span class="v"><b>${f.its.length}</b> · ${brl(f.vgv)}</span>`);
    b.onclick = ()=>{ S.cross = S.cross===f.id?null:f.id; renderAll(); };
    box.appendChild(b);
  });
  const lb = document.getElementById("funnelList");
  if (S.cross){
    const f = g.find(x=>x.id===S.cross) || {its:[]};
    lb.innerHTML = `<div class="list"><table>${f.its.sort((a,b)=>(vig(b)?.vgv_bruto||0)-(vig(a)?.vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td class="muted">${esc(TATICA[e.fase]||"—")}</td><td class="muted">${esc(e.cidade)}</td><td class="n">${nf(vig(e)?.unidades)} UH</td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</table></div>`;
  } else lb.innerHTML="";
}

/* ---------- PAINEL 4 · Saúde financeira ---------- */
function renderHealth(){
  const L = filtrados({ignoreFilters:true}).filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null);
  const vl = L.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0), lu = L.reduce((a,e)=>a+(vig(e).lucro||0),0), ex = L.reduce((a,e)=>a+(vig(e).exposicao||0),0);
  document.getElementById("healthKpis").innerHTML =
    `<div class="hk"><span class="k">Margem líquida média</span><b>${pct(vl?lu/vl:null)}</b><div class="s">ponderada pelo VGV líquido de cada empreendimento</div></div>
     <div class="hk"><span class="k">Lucro líquido projetado</span><b>${brl(lu)}</b><div class="s">soma das viabilidades vigentes</div></div>
     <div class="hk"><span class="k">Soma das exposições máximas</span><b>${brl(ex)}</b><div class="s">teto teórico: os picos não acontecem ao mesmo tempo</div></div>`;
  const its = L.slice().sort((a,b)=>vig(b).margem-vig(a).margem);
  const box = document.getElementById("margins");
  const rowH=22, W=560, ml=150, mr=56, H=its.length*rowH+30, iw=W-ml-mr;
  const max = Math.max(0.32, ...its.map(e=>vig(e).margem));
  const meta = 0.20, xm = ml+iw*meta/max;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Margem líquida por empreendimento">`;
  its.forEach((e,i)=>{
    const v=vig(e), y=8+i*rowH, w=Math.max(3,iw*v.margem/max), fi=faseInfo(estrategica(e.fase));
    s += `<text x="${ml-10}" y="${y+12}" text-anchor="end">${esc(e.nome)}</text>`;
    s += `<rect x="${ml}" y="${y+3}" width="${w}" height="12" rx="4" fill="${fi.hex}" opacity=".9"/>`;
    s += `<text class="val" x="${ml+w+6}" y="${y+12.5}">${nf(v.margem*100,1)}%</text>`;
    s += `<rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent" data-i="${i}"/>`;
  });
  s += `<line x1="${xm}" x2="${xm}" y1="2" y2="${H-22}" stroke="var(--label)" stroke-dasharray="3 3" stroke-width="1.2"/><text x="${xm}" y="${H-8}" text-anchor="middle">meta 2027 · 20%</text></svg>`;
  box.innerHTML = s;
  box.querySelectorAll(".hit").forEach(r=>{
    const e=its[r.dataset.i], v=vig(e);
    const html=`<b>${esc(e.nome)}</b> · ${v.versao} vigente<table><tr><td>Margem líquida</td><td class="n">${pct(v.margem)}</td></tr><tr><td>Lucro líquido</td><td class="n">${brl(v.lucro)}</td></tr><tr><td>VGV líquido</td><td class="n">${brl(v.vgv_liquido)}</td></tr><tr><td>Exposição máxima</td><td class="n">${brl(v.exposicao)}</td></tr><tr><td>Fase</td><td class="n">${esc(TATICA[e.fase]||"Sem cronograma")}</td></tr></table>`;
    r.addEventListener("mousemove", ev=>showTip(html,ev)); r.addEventListener("mouseleave", hideTip);
  });
}

/* ---------- PAINEL 5 · Mapa ---------- */
function renderMap(){
  if (typeof L === "undefined"){ document.getElementById("map").innerHTML="<p class='muted' style='padding:16px'>Não foi possível carregar o mapa.</p>"; return; }
  if (!map){
    map = window.L.map("map",{scrollWheelZoom:false,attributionControl:true}).setView([-25.47,-49.27],11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
  }
  if (mapLayer) mapLayer.remove();
  mapLayer = window.L.layerGroup().addTo(map);
  const Ls = filtrados();
  const maxV = Math.max(...D.empreendimentos.map(e=>vig(e)?.vgv_bruto||0),1);
  Ls.forEach(e=>{
    const fi = faseInfo(estrategica(e.fase));
    const r = 7+Math.sqrt((vig(e)?.vgv_bruto||0)/maxV)*16;
    const c = window.L.circleMarker(e.pos,{radius:r,color:"#fff",weight:2,fillColor:fi.hex,fillOpacity:.9}).addTo(mapLayer);
    c.bindTooltip(`${esc(e.nome)} · ${esc(TATICA[e.fase]||"Sem cronograma")}`);
    c.on("click",()=>{
      const v=vig(e);
      document.getElementById("mapSide").innerHTML = `<span class="pill" style="background:${fi.hex};color:#fff">${esc(TATICA[e.fase]||"Sem cronograma")}</span>
        <h4 style="margin-top:8px">${esc(e.nome)}</h4><div class="muted" style="font-size:.8rem">${esc(e.cidade)}${e.ex_nome?" · ex-"+esc(e.ex_nome):""} · ${esc(e.incorporadora)}</div>
        <dl><dt>VGV bruto</dt><dd>${brl(v?.vgv_bruto)}</dd><dt>Unidades</dt><dd>${nf(v?.unidades)}</dd><dt>Margem líquida</dt><dd>${pct(v?.margem)}</dd>
        <dt>Viabilidade</dt><dd>${v?v.versao:"—"}</dd><dt>Lançamento</dt><dd>${lanc(e)?(lanc(e).ok?"lançado ":"previsto ")+my(lanc(e).data):"—"}</dd>
        <dt>Entrega</dt><dd>${e.marcos.mar001?my(e.marcos.mar001.data):"—"}</dd></dl>`;
    });
  });
  document.getElementById("mapLegend").innerHTML = FASES.map(f=>`<span><i style="background:${f.cor}"></i>${f.nome}</span>`).join("");
  setTimeout(()=>map.invalidateSize(),50);
}

/* ---------- PAINEL 6 · Atenção ---------- */
function renderAttn(){
  const vs = D.variacoes.filter(v=>{ const e=D.empreendimentos.find(x=>x.sigla===v.sigla); return e && porInc(e); }).sort((a,b)=>Math.abs(b.dias)-Math.abs(a.dias));
  document.getElementById("attnNote").textContent = `marcos-chave que variaram 20 dias ou mais · ${D.fontes.variacoes.split(" → ").map(dmy).join(" → ")}`;
  const pend = [];
  const sem = D.empreendimentos.filter(e=>porInc(e)&&!e.legado&&!e.fase).map(e=>e.nome);
  if (sem.length) pend.push(`Sem cronograma com códigos no ClickUp: ${sem.join(", ")}.`);
  const semLanc = D.empreendimentos.filter(e=>porInc(e)&&!e.legado&&e.fase&&!lanc(e)).map(e=>e.nome);
  if (semLanc.length) pend.push(`Sem marco de Lançamento Comercial no cronograma: ${semLanc.join(", ")}.`);
  const semVal = D.empreendimentos.filter(porInc).flatMap(e=>e.viabilidades.filter(v=>v.vgv_bruto==null).map(v=>`${e.nome} ${v.versao}`));
  if (semVal.length) pend.push(`Viabilidades aguardando valores: ${semVal.join(", ")}.`);
  const semViab = D.empreendimentos.filter(e=>porInc(e)&&!e.legado&&!vig(e)).map(e=>e.nome);
  if (semViab.length) pend.push(`Sem viabilidade vigente: ${semViab.join(", ")}.`);
  document.getElementById("attn").innerHTML =
    `<div class="box"><h4>Variações de marcos na semana</h4>${vs.length?vs.map(v=>`<div class="ai"><span><b>${esc(v.marco)}</b> · ${esc(v.empreendimento)}</span><span class="d ${v.dias>0?"late":"early"}">${v.dias>0?"+":""}${v.dias} dias</span><span class="x">${dmy(v.anterior)} → ${dmy(v.atual)}</span></div>`).join(""):"<p class='muted'>Nenhuma variação de 20 dias ou mais.</p>"}</div>
     <div class="box"><h4>Pendências de dados</h4>${pend.length?`<ul class="pend">${pend.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`:"<p class='muted'>Nenhuma pendência.</p>"}</div>`;
}

function renderNav(){
  const items = [["cronograma","Cronograma","Gantt do portfólio, lançamentos e agenda de marcos"],["analise","Análise de Cronogramas","Desvios semanais e Registro de Desvios"],["viabilidade","Indicadores de Viabilidade","Versões V0 a V4 e evolução da margem"],["metas","Indicadores e Metas","Metas de Incorporação"]];
  document.getElementById("navcards").innerHTML = items.map(([h,t,s])=>`<a href="#${h}"><b>${t} →</b><span>${s}</span></a>`).join("");
}

/* ---------- outras páginas (prévias) ---------- */
function renderLaunches(){
  const its = D.empreendimentos.filter(e=>porInc(e)&&lanc(e)&&!lanc(e).ok).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data));
  document.getElementById("launchList").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Cidade</th><th>Fase</th><th>Registro de Incorporação</th><th>Orçamento V4</th><th>Lançamento previsto</th><th class="n">VGV bruto</th></tr></thead><tbody>${its.map(e=>`<tr><td>${esc(e.nome)}</td><td>${esc(e.cidade)}</td><td>${esc(TATICA[e.fase]||"—")}</td><td>${e.marcos.leg010?dmy(e.marcos.leg010.data):"—"}</td><td>${e.marcos.orcV4?dmy(e.marcos.orcV4.data):"—"}</td><td><b>${dmy(lanc(e).data)}</b></td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderVariacoes(){
  document.getElementById("varNote").textContent = D.fontes.variacoes.split(" → ").map(dmy).join(" → ");
  const vs = D.variacoes.filter(v=>porInc(D.empreendimentos.find(x=>x.sigla===v.sigla)));
  document.getElementById("varTable").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Marco</th><th>Data anterior</th><th>Data atual</th><th class="n">Variação</th></tr></thead><tbody>${vs.map(v=>`<tr><td>${esc(v.empreendimento)}</td><td>${esc(v.marco)}</td><td>${dmy(v.anterior)}</td><td>${dmy(v.atual)}</td><td class="n" style="color:${v.dias>0?"var(--red-ink)":"var(--green-ink)"};font-weight:700">${v.dias>0?"+":""}${v.dias} dias</td></tr>`).join("")}</tbody></table></div>`;
}
function renderViab(){
  const its = D.empreendimentos.filter(e=>porInc(e)&&vig(e)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  document.getElementById("viabTable").innerHTML = `<table class="t"><thead><tr><th>Empreendimento</th><th>Incorporadora</th><th>Vigente</th><th>Data-base</th><th class="n">Unidades</th><th class="n">VGV bruto</th><th class="n">VGV líquido</th><th class="n">Margem líq.</th><th class="n">Lucro líquido</th><th class="n">Exposição máx.</th><th>Outras versões</th></tr></thead><tbody>${its.map(e=>{const v=vig(e);return `<tr><td>${esc(e.nome)}</td><td>${esc(e.incorporadora)}</td><td><b>${v.versao}</b></td><td>${v.mes?v.mes.slice(5)+"/"+v.mes.slice(0,4):"—"}</td><td class="n">${nf(v.unidades)}</td><td class="n">${brl(v.vgv_bruto)}</td><td class="n">${brl(v.vgv_liquido)}</td><td class="n">${pct(v.margem)}</td><td class="n">${brl(v.lucro)}</td><td class="n">${brl(v.exposicao)}</td><td class="muted">${e.viabilidades.filter(x=>x!==v).map(x=>x.versao+(x.situacao!=="Substituída"?" ("+x.situacao.toLowerCase()+")":"")).join(", ")}</td></tr>`}).join("")}</tbody></table>`;
}

/* ---------- filtros ---------- */
function chipset(id, values, set, label=v=>v){
  const box=document.getElementById(id); box.innerHTML="";
  values.forEach(v=>{ const b=el("button",{"aria-pressed":String(set.has(v))},esc(label(v))); b.onclick=()=>{ set.has(v)?set.delete(v):set.add(v); renderAll(); }; box.appendChild(b); });
}
function renderFilters(){
  const base = D.empreendimentos.filter(porInc);
  chipset("fCidade", [...new Set(base.map(e=>e.cidade))].sort(), S.cidades);
  chipset("fAno", [...new Set(base.map(e=>String(anoLanc(e)??"Sem data")))].sort(), S.anos);
  chipset("fFase", FASES.map(f=>f.id), S.fases, id=>faseInfo(id).nome);
  const n = S.cidades.size+S.anos.size+S.fases.size+(S.cross?1:0);
  const fc=document.getElementById("filterCount"); fc.hidden=!n; fc.textContent=n;
  const ch=document.getElementById("activeChips"); ch.innerHTML="";
  const add=(t,fn)=>{ const b=el("button",{class:"chip"},esc(t)); b.onclick=()=>{fn();renderAll();}; ch.appendChild(b); };
  S.cidades.forEach(v=>add(v,()=>S.cidades.delete(v)));
  S.anos.forEach(v=>add("Lançamento "+v,()=>S.anos.delete(v)));
  S.fases.forEach(v=>add(faseInfo(v).nome,()=>S.fases.delete(v)));
  if (S.cross) add("Fase: "+faseInfo(S.cross).nome,()=>S.cross=null);
  ch.hidden=!n;
  document.querySelectorAll(".immune").forEach(x=>x.hidden=!temFiltro());
}

/* ---------- navegação ---------- */
function route(){
  const p = PAGES[location.hash.slice(1)] ? location.hash.slice(1) : "one-page";
  document.querySelectorAll(".page").forEach(s=>s.hidden = s.dataset.page!==p);
  document.querySelectorAll("#nav a").forEach(a=>a.classList.toggle("on", a.dataset.p===p));
  document.getElementById("pageTitle").textContent = PAGES[p];
  document.getElementById("side").classList.remove("open");
  if (p==="one-page" && map) setTimeout(()=>map.invalidateSize(),50);
  window.scrollTo({top:0});
}

function renderAll(){
  document.documentElement.dataset.inc = S.inc;
  document.getElementById("brandCo").textContent = S.inc==="all" ? "Make It + Gadens" : S.inc;
  renderFilters(); renderKpis(); renderTraj(); renderFunnel(); renderHealth(); renderMap(); renderAttn(); renderNav();
  renderLaunches(); renderVariacoes(); renderViab();
}

function init(){
  document.querySelectorAll("#incSeg button").forEach(b=>b.onclick=()=>{
    S.inc=b.dataset.inc; S.cidades.clear(); S.anos.clear(); S.cross=null;
    document.querySelectorAll("#incSeg button").forEach(x=>x.setAttribute("aria-checked",String(x===b)));
    renderAll();
  });
  const open = v=>{ document.getElementById("drawer").hidden=!v; document.getElementById("drawerBg").hidden=!v; };
  document.getElementById("filterBtn").onclick=()=>open(true);
  document.getElementById("drawerClose").onclick=()=>open(false);
  document.getElementById("drawerBg").onclick=()=>open(false);
  document.getElementById("clearFilters").onclick=()=>{ S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.cross=null; renderAll(); };
  document.getElementById("menuBtn").onclick=()=>document.getElementById("side").classList.toggle("open");
  addEventListener("hashchange", route);
  addEventListener("keydown", e=>{ if (e.key==="Escape") open(false); });
  addEventListener("scroll", hideTip, {passive:true});
  const g = new Date(D.gerado_em);
  document.getElementById("stamp").innerHTML = `Atualizado em <b>${g.toLocaleDateString("pt-BR")} às ${g.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</b><br>Cronogramas: ${esc(D.fontes.cronogramas.replace(/(\d{4})-(\d{2})-(\d{2})/,"$3/$2/$1"))}<br>Viabilidades: ${esc(D.fontes.viabilidades)}`;
  route(); renderAll();
}

fetch("dados.json",{cache:"no-store"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d=>{ D=d; init(); })
  .catch(err=>{ document.querySelector("main").innerHTML = `<div class="panel" style="margin-top:24px"><h3>Não foi possível carregar os dados</h3><p class="muted">${esc(err.message)}</p></div>`; });
