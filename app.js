"use strict";
/* Dashboard de Incorporação · Make It e Gadens
   Lê dados.json (gerado a partir do ClickUp) e monta as páginas.
   Filtros (incorporadora, cidade, ano de lançamento, fase) valem para todos os painéis;
   cada gráfico que filtra por uma dimensão mostra todas as opções dela e destaca as escolhidas. */

const FASES = [
  {id:"DUE", nome:"Due Diligence", hex:"#6E56CF"},
  {id:"DEV", nome:"Desenvolvimento p/ Lançamento", hex:"#C2900A"},
  {id:"LIB", nome:"Liberação para Obra", hex:"#1F7FD1"},
  {id:"OBR", nome:"Desenvolvimento de Obra", hex:"#D9480F"},
  {id:"ENT", nome:"Entrega", hex:"#2B9A66"},
  {id:"SEM", nome:"Sem cronograma", hex:"#AEAEB2"},
];
const TATICA = {DUE:"Due Diligence",EP:"Estudo Preliminar",AP:"Anteprojeto",ALV:"Aprovação / Alvará",LAN:"Liberação p/ Lançamento",LIB:"Liberação para Obra",OBR:"Em obra",ENT:"Entrega"};
const estrategica = f => !f ? "SEM" : f==="DUE" ? "DUE" : ["EP","AP","ALV","LAN"].includes(f) ? "DEV" : f;
const faseInfo = id => FASES.find(x=>x.id===id);
const PAGES = ["resumo","cronograma","analise","viabilidade","metas"];
const VERS = ["V0","V1","V2","V3","V4"];
const VNOME = {V0:"Compra",V1:"Due Diligence (projeto)",V2:"Due Diligence",V3:"Atualização",V4:"Lançamento"};
const METAS = {2027:0.20, 2028:0.21, 2029:0.22};   // margem líquida da viabilidade dos lançamentos do ano
const MIN_AMOSTRA = 2;                             // pares mínimos para aplicar o ajuste de tendência

const S = {inc:"all", cidades:new Set(), anos:new Set(), fases:new Set(), kpiOpen:null, sel:null};
let D = null, map = null, mapLayer = null, AJ = null;

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
const pct = (v,d=2) => v==null ? "—" : nf(v*100,d)+"%";
const pp = v => v==null ? "—" : (v>0?"+":v<0?"−":"")+nf(Math.abs(v*100),2)+" p.p.";
const dmy = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const my = iso => iso ? iso.slice(5,7)+"/"+iso.slice(0,4) : "—";
const el = (tag, attrs={}, html="") => { const e=document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML=html; return e; };
const esc = s => String(s??"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const median = a => { const s=[...a].sort((x,y)=>x-y), n=s.length; return n ? (n%2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2) : null; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- dados derivados ---------- */
// Vigente = a versão mais avançada que está na lista Controle de Viabilidades (empate: data-base mais recente),
// mesmo que pendente de aprovação ou marcada como simulação.
const vig = e => e._vig;
const lanc = e => e.marcos.inc002 || null;
const anoLanc = e => lanc(e) ? +lanc(e).data.slice(0,4) : null;
const anoKey = e => String(anoLanc(e) ?? "Sem data");
const ativa = e => !e.legado;
const porInc = e => S.inc==="all" || e.incorporadora===S.inc;
function filtrados(ignora){
  return D.empreendimentos.filter(e => porInc(e) &&
    (ignora==="cidade" || !S.cidades.size || S.cidades.has(e.cidade)) &&
    (ignora==="ano" || !S.anos.size || S.anos.has(anoKey(e))) &&
    (ignora==="fase" || !S.fases.size || S.fases.has(estrategica(e.fase))));
}
const nFiltros = () => S.cidades.size+S.anos.size+S.fases.size;
const toggle = (set,v) => { set.has(v) ? set.delete(v) : set.add(v); S.sel=null; renderAll(); };

function prepara(){
  const ord = v => VERS.indexOf(v.versao);
  D.empreendimentos.forEach(e=>{
    const vs = e.viabilidades.filter(v=>v.vgv_bruto!=null || v.margem!=null);
    e._vig = vs.length ? vs.reduce((a,b)=> ord(b)>ord(a) || (ord(b)===ord(a) && (b.mes||"")>(a.mes||"")) ? b : a) : null;
  });
  AJ = calibra();
}

/* ---------- margem projetada no lançamento ----------
   Para cada incorporadora, separadamente, e para cada versão Vk (V0 a V3):
   olha os empreendimentos que já têm Vk e V4, calcula (margem V4 − margem Vk) e tira a mediana.
   Margem projetada = margem da versão vigente + essa mediana (se houver pelo menos MIN_AMOSTRA pares).
   Quem já está em V4 fica com a própria margem da V4. */
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
  if (v.versao==="V4") return {m:v.margem, aj:0, base:v.versao, ok:true, motivo:"já é a viabilidade de lançamento"};
  const a = AJ[e.incorporadora]?.[v.versao];
  if (!a || a.n < MIN_AMOSTRA) return {m:v.margem, aj:0, base:v.versao, ok:false, motivo:`sem histórico suficiente de ${v.versao} → V4 na ${e.incorporadora} (${a?a.n:0} ${a&&a.n===1?"caso":"casos"})`};
  return {m:v.margem+a.med, aj:a.med, base:v.versao, ok:true, motivo:`mediana de ${a.n} casos ${v.versao} → V4 na ${e.incorporadora}`};
}

/* ---------- tooltip ---------- */
const tip = document.getElementById("tip");
function showTip(html, ev){ tip.innerHTML=html; tip.hidden=false; moveTip(ev); }
function moveTip(ev){ const pad=14, w=tip.offsetWidth, h=tip.offsetHeight; let x=ev.clientX+pad, y=ev.clientY+pad; if (x+w>innerWidth-8) x=ev.clientX-w-pad; if (y+h>innerHeight-8) y=ev.clientY-h-pad; tip.style.left=Math.max(8,x)+"px"; tip.style.top=Math.max(8,y)+"px"; }
function hideTip(){ tip.hidden=true; }
function bindTip(node, html){ node.addEventListener("mousemove", ev=>showTip(typeof html==="function"?html():html, ev)); node.addEventListener("mouseleave", hideTip); }

/* ---------- Escala ---------- */
function renderKpis(){
  const L = filtrados().filter(ativa);
  const sum = f => L.reduce((a,e)=>a+(f(e)||0),0);
  const cards = [
    {id:"vgv", k:"VGV da carteira", v:brl(sum(e=>vig(e)?.vgv_bruto)), s:"bruto · viabilidade vigente", f:e=>vig(e)?.vgv_bruto, fmt:brl},
    {id:"uh", k:"Unidades", v:nf(sum(e=>vig(e)?.unidades)), s:"unidades habitacionais", f:e=>vig(e)?.unidades, fmt:v=>nf(v)},
    {id:"emp", k:"Empreendimentos", v:nf(L.length), s:"carteira ativa", f:()=>1, fmt:v=>nf(v)},
    {id:"area", k:"Área construída", v:nf(sum(e=>vig(e)?.area_construida))+" m²", s:"viabilidades vigentes", f:e=>vig(e)?.area_construida, fmt:v=>nf(v)+" m²"},
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
  html += `<div><h4><span>Entregues</span><span>${nf(entregues.length)}</span></h4><ul>${entregues.map(e=>`<li><span>${esc(e.nome)}</span><span>entregue</span></li>`).join("")||"<li><span class='muted'>Nenhum</span></li>"}</ul></div></div>`;
  det.innerHTML = html; det.hidden=false;
}

/* ---------- Trajetória de lançamentos ---------- */
function renderTraj(){
  const base = filtrados("ano");
  const L = base.filter(e=>lanc(e) && vig(e));
  const anos = {};
  L.forEach(e=>{ const a=anoLanc(e); (anos[a] ||= {lanc:0,prev:0,its:[]}); const v=vig(e).vgv_bruto||0; if (lanc(e).ok) anos[a].lanc+=v; else anos[a].prev+=v; anos[a].its.push(e); });
  const keys = Object.keys(anos).map(Number).sort();
  const box = document.getElementById("traj");
  const semData = base.filter(e=>!lanc(e) && !e.legado).map(e=>e.nome);
  document.getElementById("trajFoot").textContent = semData.length ? `Sem data de lançamento no cronograma: ${semData.join(", ")}.` : "";
  if (!keys.length){ box.innerHTML="<p class='muted'>Sem lançamentos para mostrar.</p>"; return; }
  const W=Math.max(300,box.clientWidth||560),H=230,ml=6,mr=6,mt=24,mb=24, iw=W-ml-mr, ih=H-mt-mb;
  const max = Math.max(...keys.map(k=>anos[k].lanc+anos[k].prev))*1.1;
  const step = iw/keys.length, bw = Math.min(60, step*0.6);
  const accent = css("--accent");
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="VGV lançado por ano"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${accent}" opacity=".2"/><line x1="0" y1="0" x2="0" y2="6" stroke="${accent}" stroke-width="2" opacity=".6"/></pattern></defs>`;
  s += `<line x1="${ml}" x2="${W-mr}" y1="${mt+ih}" y2="${mt+ih}" stroke="var(--hdr-sep)"/>`;
  keys.forEach((k,i)=>{
    const a=anos[k], x=ml+step*i+(step-bw)/2, dim = S.anos.size && !S.anos.has(String(k));
    const hL=ih*a.lanc/max, hP=ih*a.prev/max, yL=mt+ih-hL, yP=yL-hP-(a.lanc&&a.prev?2:0);
    s += `<g class="${dim?"dim":""}">`;
    if (a.lanc) s += `<path d="M${x},${mt+ih} V${yL+4} q0,-4 4,-4 h${bw-8} q4,0 4,4 V${mt+ih} Z" fill="${accent}"/>`;
    if (a.prev) s += `<path d="M${x},${yP+hP} V${yP+4} q0,-4 4,-4 h${bw-8} q4,0 4,4 V${yP+hP} Z" fill="url(#hatch)"/>`;
    const top = Math.min(a.lanc?yL:Infinity, a.prev?yP:Infinity);
    s += `<text class="val" x="${x+bw/2}" y="${top-6}" text-anchor="middle">${brl(a.lanc+a.prev).replace("R$ ","")}</text>`;
    s += `<text x="${x+bw/2}" y="${H-7}" text-anchor="middle" ${S.anos.has(String(k))?'style="fill:var(--label);font-weight:700"':""}>${k}</text></g>`;
    s += `<rect x="${ml+step*i}" y="0" width="${step}" height="${H}" fill="transparent" data-ano="${k}" class="hit"/>`;
  });
  box.innerHTML = s + `</svg>`;
  box.querySelectorAll(".hit").forEach(r=>{
    const a = anos[r.dataset.ano];
    const rows = a.its.slice().sort((x,y)=>(vig(y).vgv_bruto||0)-(vig(x).vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td>${lanc(e).ok?"lançado":"previsto "+my(lanc(e).data)}</td><td class="n">${brl(vig(e).vgv_bruto)}</td><td class="n">${nf(vig(e).unidades)} UH</td></tr>`).join("");
    bindTip(r, `<b>${r.dataset.ano}</b> · ${brl(a.lanc+a.prev)} · ${nf(a.its.reduce((t,e)=>t+(vig(e).unidades||0),0))} UH<table>${rows}</table><div class="muted">clique para ${S.anos.has(r.dataset.ano)?"tirar o filtro":"filtrar este ano"}</div>`);
    r.onclick = ()=>{ hideTip(); toggle(S.anos, r.dataset.ano); };
  });
}

/* ---------- Distribuição por fase ---------- */
function renderFunnel(){
  const L = filtrados("fase").filter(ativa);
  const g = FASES.filter(f=>f.id!=="ENT").map(f=>{ const its=L.filter(e=>estrategica(e.fase)===f.id); return {...f, its, vgv:its.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0)}; }).filter(f=>f.its.length);
  const max = Math.max(...g.map(f=>f.vgv),1);
  const box = document.getElementById("funnel"); box.innerHTML="";
  if (!g.length){ box.innerHTML="<p class='muted'>Nenhum empreendimento nos filtros atuais.</p>"; return; }
  g.forEach(f=>{
    const on = S.fases.has(f.id), dim = S.fases.size && !on;
    const b = el("button",{class:"fun-row"+(dim?" dim":""),"aria-pressed":String(on)},
      `<span class="nm"><i style="background:${f.hex}"></i>${f.nome}</span><span class="tr"><span style="width:${Math.max(2,f.vgv/max*100)}%;background:${f.hex}"></span></span><span class="v"><b>${f.its.length}</b> · ${brl(f.vgv)}</span>`);
    bindTip(b, ()=>`<b>${f.nome}</b><table>${f.its.slice().sort((a,b)=>(vig(b)?.vgv_bruto||0)-(vig(a)?.vgv_bruto||0)).map(e=>`<tr><td>${esc(e.nome)}</td><td class="muted">${esc(TATICA[e.fase]||"—")}</td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</table>`);
    b.onclick = ()=>{ hideTip(); toggle(S.fases, f.id); };
    box.appendChild(b);
  });
}

/* ---------- Saúde financeira ---------- */
function renderHealth(){
  const L = filtrados().filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null);
  const vl = L.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0), lu = L.reduce((a,e)=>a+(vig(e).lucro||0),0), ex = L.reduce((a,e)=>a+(vig(e).exposicao||0),0);
  const P = L.filter(e=>!lanc(e)?.ok && vig(e).versao!=="V4");
  const pv = P.reduce((a,e)=>a+(vig(e).vgv_liquido||0),0), pm = P.reduce((a,e)=>a+(proj(e).m*(vig(e).vgv_liquido||0)),0);
  const pm0 = P.reduce((a,e)=>a+(vig(e).margem*(vig(e).vgv_liquido||0)),0);
  document.getElementById("healthKpis").innerHTML =
    `<div class="hk"><span class="k">Margem líquida média</span><b>${pct(vl?lu/vl:null)}</b><div class="s">viabilidades vigentes · ponderada pelo VGV líquido</div></div>
     <div class="hk hl"><span class="k">Margem projetada no lançamento</span><b>${pct(pv?pm/pv:null)}</b><div class="s">${P.length} a lançar · ${pv?pp((pm-pm0)/pv)+" vs. a vigente":"—"}</div></div>
     <div class="hk"><span class="k">Lucro líquido projetado</span><b>${brl(lu)}</b><div class="s">soma das viabilidades vigentes</div></div>
     <div class="hk"><span class="k">Soma das exposições máximas</span><b>${brl(ex)}</b><div class="s">teto teórico: os picos não coincidem</div></div>`;

  // margem por empreendimento
  document.getElementById("marginLeg").innerHTML = FASES.filter(f=>L.some(e=>estrategica(e.fase)===f.id)).map(f=>`<span><i style="background:${f.hex}"></i>${f.nome}</span>`).join("")
    + `<span><i class="ring"></i>projetada no lançamento</span><span><i class="tick"></i>meta do ano de lançamento</span>`;
  const its = L.slice().sort((a,b)=>vig(b).margem-vig(a).margem);
  const box = document.getElementById("margins");
  if (!its.length){ box.innerHTML="<p class='muted'>Nenhuma viabilidade nos filtros atuais.</p>"; }
  else {
    const rowH=21, W=Math.max(320,box.clientWidth||620), ml=128, mr=100, H=its.length*rowH+8, iw=W-ml-mr;
    const max = Math.max(0.30, ...its.map(e=>Math.max(vig(e).margem, proj(e).m)))*1.04;
    const X = v => ml + iw*Math.max(0,v)/max;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Margem líquida por empreendimento">`;
    its.forEach((e,i)=>{
      const v=vig(e), p=proj(e), y=4+i*rowH, fi=faseInfo(estrategica(e.fase)), meta=METAS[anoLanc(e)];
      s += `<text x="${ml-8}" y="${y+12}" text-anchor="end" ${S.sel===e.nome?'style="fill:var(--label);font-weight:700"':""}>${esc(e.nome)}</text>`;
      s += `<rect x="${ml}" y="${y+3}" width="${Math.max(3,X(v.margem)-ml)}" height="12" rx="4" fill="${fi.hex}"/>`;
      if (meta) s += `<rect x="${X(meta)-1}" y="${y}" width="2" height="18" rx="1" fill="var(--label)"/>`;
      if (p.aj) s += `<circle cx="${X(p.m)}" cy="${y+9}" r="4.5" fill="var(--card)" stroke="var(--label)" stroke-width="2"/>`;
      s += `<text class="val" x="${W-mr+8}" y="${y+12.5}">${nf(v.margem*100,1)}%${p.aj?` <tspan style="font-weight:400;fill:var(--label-2)">→ ${nf(p.m*100,1)}%</tspan>`:""}</text>`;
      s += `<rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent" data-i="${i}"/>`;
    });
    box.innerHTML = s + `</svg>`;
    box.querySelectorAll(".hit").forEach(r=>{
      const e=its[r.dataset.i], v=vig(e), p=proj(e), meta=METAS[anoLanc(e)];
      bindTip(r, `<b>${esc(e.nome)}</b> · ${v.versao} – ${VNOME[v.versao]}${v.obs?` <span class="muted">(${esc(v.obs)})</span>`:""}<table>
        <tr><td>Margem líquida vigente</td><td class="n">${pct(v.margem)}</td></tr>
        <tr><td>Projetada no lançamento</td><td class="n">${pct(p.m)}${p.aj?` (${pp(p.aj)})`:""}</td></tr>
        <tr><td>Meta ${anoLanc(e)??""}</td><td class="n">${meta?pct(meta,0):"sem meta definida"}</td></tr>
        <tr><td>Lucro líquido</td><td class="n">${brl(v.lucro)}</td></tr><tr><td>VGV líquido</td><td class="n">${brl(v.vgv_liquido)}</td></tr>
        <tr><td>Lançamento</td><td class="n">${lanc(e)?(lanc(e).ok?"lançado ":"previsto ")+my(lanc(e).data):"sem data"}</td></tr></table><div class="muted">${esc(p.motivo)} · clique para ver no mapa</div>`);
      r.onclick = ()=>{ hideTip(); S.sel = S.sel===e.nome?null:e.nome; renderHealth(); renderMap(true); };
    });
  }

  // lançamentos por ano × meta
  const LA = filtrados("ano").filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null&&lanc(e));
  const anos = {};
  LA.forEach(e=>{ const a=anoLanc(e); (anos[a] ||= {v:0,m:0,its:[]}); const w=vig(e).vgv_liquido||0; anos[a].v+=w; anos[a].m+=proj(e).m*w; anos[a].its.push(e); });
  const ks = Object.keys(anos).map(Number).filter(k=>k>=new Date().getFullYear()-1).sort();
  const yb = document.getElementById("metaYears");
  if (!ks.length){ yb.innerHTML="<p class='muted'>Sem lançamentos nos filtros atuais.</p>"; return; }
  const W=Math.max(260,yb.clientWidth||380), H=190, mt=26, mb=24, ih=H-mt-mb, step=W/ks.length, bw=Math.min(46, step*.55), accent=css("--accent");
  const max = 0.32, Y = v => mt+ih-ih*Math.max(0,v)/max;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Margem projetada dos lançamentos por ano e meta"><line x1="0" x2="${W}" y1="${mt+ih}" y2="${mt+ih}" stroke="var(--hdr-sep)"/>`;
  ks.forEach((k,i)=>{
    const a=anos[k], m=a.v?a.m/a.v:null, x=step*i+(step-bw)/2, meta=METAS[k], dim=S.anos.size&&!S.anos.has(String(k));
    s += `<g class="${dim?"dim":""}"><path d="M${x},${mt+ih} V${Y(m)+4} q0,-4 4,-4 h${bw-8} q4,0 4,4 V${mt+ih} Z" fill="${accent}"/>`;
    if (meta) s += `<rect x="${x-6}" y="${Y(meta)-1}" width="${bw+12}" height="2" rx="1" fill="var(--label)"/>`;
    const top = Math.min(Y(m), meta?Y(meta):Infinity);
    const abaixo = meta && m < meta;
    s += `<text class="val" x="${x+bw/2}" y="${top-7}" text-anchor="middle">${nf(m*100,1)}%${abaixo?" ▼":""}</text>`;
    s += `<text x="${x+bw/2}" y="${H-7}" text-anchor="middle" ${S.anos.has(String(k))?'style="fill:var(--label);font-weight:700"':""}>${k}</text></g>`;
    s += `<rect class="hit" x="${step*i}" y="0" width="${step}" height="${H}" fill="transparent" data-ano="${k}"/>`;
  });
  yb.innerHTML = s + `</svg>`;
  yb.querySelectorAll(".hit").forEach(r=>{
    const k=+r.dataset.ano, a=anos[k], m=a.v?a.m/a.v:null, meta=METAS[k];
    bindTip(r, `<b>Lançamentos ${k}</b> · margem projetada ${pct(m)}${meta?` · meta ${pct(meta,0)} (${pp(m-meta)})`:" · sem meta definida"}<table>${a.its.slice().sort((x,y)=>proj(y).m-proj(x).m).map(e=>`<tr><td>${esc(e.nome)}</td><td class="muted">${vig(e).versao}</td><td class="n">${pct(proj(e).m,1)}</td><td class="n">${brl(vig(e).vgv_liquido)}</td></tr>`).join("")}</table><div class="muted">▼ = abaixo da meta · clique para filtrar o ano</div>`);
    r.onclick = ()=>{ hideTip(); toggle(S.anos, r.dataset.ano); };
  });
}

function renderHow(){
  const bloco = inc => {
    const a = AJ[inc];
    const linhas = VERS.slice(0,4).map(v=>{
      const x=a[v]; if (inc==="Gadens" && v==="V1") return "";
      return `<tr><td><b>${v} → V4</b></td><td class="n">${x.n}</td><td class="n">${x.n>=MIN_AMOSTRA?pp(x.med):"não aplicado"}</td><td class="w muted">${x.pares.map(p=>`${esc(p.nome)} ${pp(p.d)}`).join(" · ")||"nenhum empreendimento com as duas versões ainda"}</td></tr>`;
    }).join("");
    return `<div class="box"><h4>${inc}</h4><div class="tbl-wrap"><table class="t" style="min-width:560px"><thead><tr><th>De → para</th><th class="n">Casos</th><th class="n">Ajuste (mediana)</th><th>Casos usados (margem V4 − margem da versão)</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
  };
  const L = filtrados().filter(ativa).filter(e=>vig(e)&&vig(e).margem!=null&&!lanc(e)?.ok&&vig(e).versao!=="V4").sort((a,b)=>(anoLanc(a)||9999)-(anoLanc(b)||9999)||a.nome.localeCompare(b.nome,"pt-BR"));
  document.getElementById("howBody").innerHTML = `
    <p>A margem projetada estima com que margem líquida cada empreendimento deve chegar à viabilidade de lançamento (V4), a partir da margem da versão vigente e de como a margem costuma variar entre as versões nos empreendimentos que já passaram por elas. O objetivo é saber com antecedência se os lançamentos de cada ano vão bater a meta.</p>
    <ol>
      <li>Para cada versão (V0, V1, V2, V3), separamos os empreendimentos que já têm essa versão <b>e</b> a V4 na lista Controle de Viabilidades.</li>
      <li>Em cada um, medimos quanto a margem andou até o lançamento: <span class="formula">margem V4 − margem da versão</span></li>
      <li>O ajuste de cada versão é a <b>mediana</b> dessas variações. A mediana evita que um caso fora da curva puxe a previsão de todo mundo.</li>
      <li>Margem projetada = <span class="formula">margem da viabilidade vigente + ajuste da versão vigente</span></li>
      <li>Make It e Gadens são calculadas separadamente: uma não influencia a outra.</li>
      <li>O ajuste só é aplicado com pelo menos ${MIN_AMOSTRA} casos. Com menos que isso, a projetada fica igual à vigente, até o histórico crescer.</li>
      <li>Quem já tem V4, ou já lançou, entra com a própria margem da V4.</li>
    </ol>
    <p>Por ano de lançamento, a margem projetada é a média ponderada pelo VGV líquido e é comparada com a meta: 2027 20%, 2028 21%, 2029 22%. O cálculo é refeito a cada atualização: toda nova V4 cadastrada passa a fazer parte da base.</p>
    ${bloco("Make It")}${bloco("Gadens")}
    <div class="box"><h4>Empreendimentos a lançar ${nFiltros()||S.inc!=="all"?"(filtros atuais)":""}</h4><div class="tbl-wrap"><table class="t" style="min-width:620px"><thead><tr><th>Empreendimento</th><th>Lançamento</th><th>Vigente</th><th class="n">Margem vigente</th><th class="n">Ajuste</th><th class="n">Projetada</th><th class="n">Meta</th></tr></thead><tbody>
    ${L.map(e=>{const v=vig(e),p=proj(e),m=METAS[anoLanc(e)];return `<tr><td>${esc(e.nome)}</td><td>${lanc(e)?my(lanc(e).data):"sem data"}</td><td>${v.versao}</td><td class="n">${pct(v.margem)}</td><td class="n">${p.aj?pp(p.aj):"—"}</td><td class="n"><b>${pct(p.m)}</b></td><td class="n">${m?pct(m,0):"—"}</td></tr>`}).join("")}
    </tbody></table></div></div>`;
}

/* ---------- Mapa ---------- */
function renderMap(fly){
  if (typeof window.L === "undefined"){ document.getElementById("map").innerHTML="<p class='muted' style='padding:16px'>Não foi possível carregar o mapa.</p>"; return; }
  if (!map){
    map = window.L.map("map",{scrollWheelZoom:false,attributionControl:true,zoomControl:true}).setView([-25.47,-49.25],11);
    const carto = window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{maxZoom:19,subdomains:"abcd",attribution:"© OpenStreetMap · © CARTO"}).addTo(map);
    let falhou=false;   // se o CARTO estiver bloqueado na rede, volta para o OpenStreetMap padrão
    carto.on("tileerror",()=>{ if (falhou) return; falhou=true; carto.remove(); window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map); });
  }
  if (mapLayer) mapLayer.remove();
  mapLayer = window.L.layerGroup().addTo(map);
  const Ls = filtrados().filter(e=>e.pos);
  const maxV = Math.max(...D.empreendimentos.map(e=>vig(e)?.vgv_bruto||0),1);
  const pts = [];
  Ls.forEach(e=>{
    const fi = faseInfo(estrategica(e.fase)), sel = S.sel===e.nome;
    const r = 6+Math.sqrt((vig(e)?.vgv_bruto||0)/maxV)*14;
    const c = window.L.circleMarker(e.pos,{radius:sel?r+3:r,color:sel?"#1c1c1e":"#fff",weight:sel?3:2,fillColor:fi.hex,fillOpacity:.92}).addTo(mapLayer);
    c.bindTooltip(`${esc(e.nome)} · ${esc(TATICA[e.fase]||"Sem cronograma")}`,{direction:"top",offset:[0,-r]});
    c.on("click",()=>{ S.sel=e.nome; renderHealth(); renderMap(); });
    pts.push(e.pos);
  });
  const card = document.getElementById("mapCard");
  const e = S.sel && Ls.find(x=>x.nome===S.sel);
  if (e){
    const v=vig(e), fi=faseInfo(estrategica(e.fase)), p=proj(e);
    card.innerHTML = `<button class="btn icon x" id="mcClose" aria-label="Fechar">✕</button><span class="pill" style="background:${fi.hex}">${esc(TATICA[e.fase]||"Sem cronograma")}</span>
      <h4>${esc(e.nome)}</h4><div class="addr">${e.endereco?esc(e.endereco):esc(e.cidade)}${e.ex_nome?" · ex-"+esc(e.ex_nome):""} · ${esc(e.incorporadora)}</div>
      ${e.pos_fonte!=="clickup"?`<div class="approx">Posição aproximada: endereço ainda não preenchido no ClickUp</div>`:""}
      <dl><dt>VGV bruto</dt><dd>${brl(v?.vgv_bruto)}</dd><dt>Unidades</dt><dd>${nf(v?.unidades)}</dd><dt>Margem líquida</dt><dd>${pct(v?.margem)}</dd>
      ${p&&p.aj?`<dt>Projetada no lançamento</dt><dd>${pct(p.m)}</dd>`:""}
      <dt>Viabilidade</dt><dd>${v?v.versao+" – "+VNOME[v.versao]:"—"}</dd><dt>Lançamento</dt><dd>${lanc(e)?(lanc(e).ok?"lançado ":"previsto ")+my(lanc(e).data):"—"}</dd>
      <dt>Entrega</dt><dd>${e.marcos.mar001?my(e.marcos.mar001.data):"—"}</dd></dl>
      <button class="btn" id="mcCity">${S.cidades.has(e.cidade)?"Tirar filtro de "+esc(e.cidade):"Filtrar "+esc(e.cidade)}</button>`;
    card.hidden=false;
    document.getElementById("mcClose").onclick=()=>{ S.sel=null; renderHealth(); renderMap(); };
    document.getElementById("mcCity").onclick=()=>toggle(S.cidades, e.cidade);
    if (fly) map.flyTo(e.pos, Math.max(map.getZoom(),13), {duration:.6});
  } else card.hidden=true;
  document.getElementById("mapLegend").innerHTML = FASES.filter(f=>Ls.some(e=>estrategica(e.fase)===f.id)).map(f=>`<span><i style="background:${f.hex}"></i>${f.nome}</span>`).join("");
  setTimeout(()=>{ map.invalidateSize(); if (!fly && !e && pts.length) map.fitBounds(pts,{padding:[30,30],maxZoom:14}); },60);
}

/* ---------- Marcos que mudaram ---------- */
function renderAttn(){
  const ok = new Set(filtrados().map(e=>e.sigla));
  const vs = D.variacoes.filter(v=>ok.has(v.sigla)).sort((a,b)=>Math.abs(b.dias)-Math.abs(a.dias));
  document.getElementById("attnNote").textContent = `±20 dias ou mais · ${D.fontes.variacoes.split(" → ").map(dmy).join(" → ")}`;
  document.getElementById("attn").innerHTML = vs.length ? vs.map(v=>`<div class="ai"><span><b>${esc(v.marco)}</b> · ${esc(v.empreendimento)}</span><span class="d ${v.dias>0?"late":"early"}">${v.dias>0?"▲ +":"▼ "}${v.dias} dias</span><span class="x">${dmy(v.anterior)} → ${dmy(v.atual)}</span></div>`).join("") : "<p class='muted'>Nenhuma variação de 20 dias ou mais nos filtros atuais.</p>";
}

/* ---------- Sobre os dados / pendências ---------- */
function pendencias(){
  const B = D.empreendimentos.filter(porInc), out = [];
  const add = (t, xs) => xs.length && out.push({t, xs});
  add("Sem cronograma com códigos no ClickUp", B.filter(e=>!e.legado&&!e.fase).map(e=>e.nome));
  add("Sem marco de Lançamento Comercial no cronograma", B.filter(e=>!e.legado&&e.fase&&!lanc(e)).map(e=>e.nome));
  add("Viabilidades aguardando valores", B.flatMap(e=>e.viabilidades.filter(v=>v.vgv_bruto==null).map(v=>`${e.nome} ${v.versao}`)));
  add("Sem viabilidade na lista", B.filter(e=>!e.legado&&!vig(e)).map(e=>e.nome));
  add("Endereço não preenchido no ClickUp (posição aproximada no mapa)", B.filter(e=>!e.legado&&e.pos_fonte!=="clickup").map(e=>e.nome));
  return out;
}
function renderData(){
  const p = pendencias();
  document.getElementById("pendDot").hidden = !p.length;
  const g = new Date(D.gerado_em);
  document.getElementById("stamp").textContent = `Atualizado em ${g.toLocaleDateString("pt-BR")} às ${g.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
  document.getElementById("dataBody").innerHTML = `
    <div class="box"><h4>Fontes</h4><ul>
      <li>Cronogramas: ${esc(D.fontes.cronogramas.replace(/(\d{4})-(\d{2})-(\d{2})/,"$3/$2/$1"))}</li>
      <li>Viabilidades: ${esc(D.fontes.viabilidades)}. A vigente é sempre a versão mais avançada cadastrada na lista, mesmo pendente de aprovação.</li>
      <li>Endereços: campo “📍 Endereço do empreendimento” da lista Controle de Viabilidades.</li></ul></div>
    <div class="box"><h4>Pendências de dados ${S.inc!=="all"?"· "+esc(S.inc):""}</h4>${p.length?`<ul>${p.map(x=>`<li><b>${esc(x.t)}:</b> ${esc(x.xs.join(", "))}.</li>`).join("")}</ul>`:"<p class='muted'>Nenhuma pendência.</p>"}</div>`;
}

/* ---------- outras páginas (prévias) ---------- */
function renderLaunches(){
  const its = filtrados().filter(e=>lanc(e)&&!lanc(e).ok).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data));
  document.getElementById("launchList").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Cidade</th><th>Fase</th><th>Registro de Incorporação</th><th>Orçamento V4</th><th>Lançamento previsto</th><th class="n">VGV bruto</th></tr></thead><tbody>${its.map(e=>`<tr><td>${esc(e.nome)}</td><td>${esc(e.cidade)}</td><td>${esc(TATICA[e.fase]||"—")}</td><td>${e.marcos.leg010?dmy(e.marcos.leg010.data):"—"}</td><td>${e.marcos.orcV4?dmy(e.marcos.orcV4.data):"—"}</td><td><b>${dmy(lanc(e).data)}</b></td><td class="n">${brl(vig(e)?.vgv_bruto)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderVariacoes(){
  document.getElementById("varNote").textContent = D.fontes.variacoes.split(" → ").map(dmy).join(" → ");
  const ok = new Set(filtrados().map(e=>e.sigla));
  const vs = D.variacoes.filter(v=>ok.has(v.sigla));
  document.getElementById("varTable").innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Empreendimento</th><th>Marco</th><th>Data anterior</th><th>Data atual</th><th class="n">Variação</th></tr></thead><tbody>${vs.map(v=>`<tr><td>${esc(v.empreendimento)}</td><td>${esc(v.marco)}</td><td>${dmy(v.anterior)}</td><td>${dmy(v.atual)}</td><td class="n d ${v.dias>0?"late":"early"}" style="font-weight:700">${v.dias>0?"▲ +":"▼ "}${v.dias} dias</td></tr>`).join("")}</tbody></table></div>`;
}
function renderViab(){
  const its = filtrados().filter(e=>vig(e)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  document.getElementById("viabTable").innerHTML = `<table class="t"><thead><tr><th>Empreendimento</th><th>Incorporadora</th><th>Vigente</th><th>Data-base</th><th class="n">Unidades</th><th class="n">VGV bruto</th><th class="n">VGV líquido</th><th class="n">Margem líq.</th><th class="n">Projetada lanç.</th><th class="n">Lucro líquido</th><th class="n">Exposição máx.</th><th>Observação</th></tr></thead><tbody>${its.map(e=>{const v=vig(e),p=proj(e);return `<tr><td>${esc(e.nome)}</td><td>${esc(e.incorporadora)}</td><td><b>${v.versao}</b></td><td>${v.mes?v.mes.slice(5)+"/"+v.mes.slice(0,4):"—"}</td><td class="n">${nf(v.unidades)}</td><td class="n">${brl(v.vgv_bruto)}</td><td class="n">${brl(v.vgv_liquido)}</td><td class="n">${pct(v.margem)}</td><td class="n">${p?pct(p.m):"—"}</td><td class="n">${brl(v.lucro)}</td><td class="n">${brl(v.exposicao)}</td><td class="muted">${esc(v.obs||"")}</td></tr>`}).join("")}</tbody></table>`;
}

/* ---------- filtros ---------- */
function chipset(id, values, set, label=v=>v){
  const box=document.getElementById(id); box.innerHTML="";
  values.forEach(v=>{ const b=el("button",{"aria-pressed":String(set.has(v))},esc(label(v))); b.onclick=()=>toggle(set,v); box.appendChild(b); });
}
function renderFilters(){
  const base = D.empreendimentos.filter(porInc);
  chipset("fCidade", [...new Set(base.map(e=>e.cidade))].sort(), S.cidades);
  chipset("fAno", [...new Set(base.map(anoKey))].sort(), S.anos);
  chipset("fFase", FASES.map(f=>f.id).filter(id=>base.some(e=>estrategica(e.fase)===id)), S.fases, id=>faseInfo(id).nome);
  const n = nFiltros();
  const fc=document.getElementById("filterCount"); fc.hidden=!n; fc.textContent=n;
  const ch=document.getElementById("activeChips"); ch.innerHTML="";
  const add=(t,fn,cls="chip")=>{ const b=el("button",{class:cls},esc(t)); b.onclick=()=>{fn();S.sel=null;renderAll();}; ch.appendChild(b); };
  S.cidades.forEach(v=>add(v,()=>S.cidades.delete(v)));
  S.anos.forEach(v=>add(v==="Sem data"?"Sem data de lançamento":"Lançamento "+v,()=>S.anos.delete(v)));
  S.fases.forEach(v=>add(faseInfo(v).nome,()=>S.fases.delete(v)));
  if (n>1) add("Limpar tudo",()=>{S.cidades.clear();S.anos.clear();S.fases.clear();},"chip clear");
  ch.hidden=!n;
}

/* ---------- folhas ---------- */
const sheets = ["drawer","dataSheet","howSheet"];
function openSheet(id){ sheets.forEach(s=>document.getElementById(s).hidden = s!==id); document.getElementById("scrim").hidden=!id; }

/* ---------- navegação ---------- */
function route(){
  const h = location.hash.slice(1), p = PAGES.includes(h) ? h : h==="one-page" ? "resumo" : "resumo";
  document.querySelectorAll(".page").forEach(s=>s.hidden = s.dataset.page!==p);
  document.querySelectorAll("#tabbar a").forEach(a=>{ a.classList.toggle("on", a.dataset.p===p); a.toggleAttribute("aria-current", a.dataset.p===p); });
  if (p==="resumo" && map) setTimeout(()=>map.invalidateSize(),60);
  window.scrollTo({top:0});
}

function renderAll(){
  document.documentElement.dataset.inc = S.inc;
  document.getElementById("coName").textContent = S.inc==="all" ? "Make It + Gadens" : S.inc;
  renderFilters(); renderKpis(); renderTraj(); renderFunnel(); renderHealth(); renderMap(); renderAttn(); renderData();
  renderLaunches(); renderVariacoes(); renderViab();
  if (!document.getElementById("howSheet").hidden) renderHow();
}

function init(){
  prepara();
  document.querySelectorAll("#incSeg button").forEach(b=>b.onclick=()=>{
    S.inc=b.dataset.inc; S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.sel=null;
    document.querySelectorAll("#incSeg button").forEach(x=>x.setAttribute("aria-checked",String(x===b)));
    renderAll();
  });
  document.getElementById("filterBtn").onclick=()=>openSheet("drawer");
  document.getElementById("dataBtn").onclick=()=>openSheet("dataSheet");
  document.getElementById("howBtn").onclick=()=>{ renderHow(); openSheet("howSheet"); };
  document.getElementById("scrim").onclick=()=>openSheet(null);
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>openSheet(null));
  document.getElementById("clearFilters").onclick=()=>{ S.cidades.clear(); S.anos.clear(); S.fases.clear(); S.sel=null; renderAll(); };
  addEventListener("hashchange", route);
  addEventListener("keydown", e=>{ if (e.key==="Escape") openSheet(null); });
  addEventListener("scroll", hideTip, {passive:true});
  let rt; addEventListener("resize", ()=>{ clearTimeout(rt); rt=setTimeout(()=>{ renderTraj(); renderHealth(); }, 150); });
  route(); renderAll();
}

fetch("dados.json",{cache:"no-store"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d=>{ D=d; init(); })
  .catch(err=>{ document.getElementById("main").innerHTML = `<div class="card" style="margin-top:24px"><h3>Não foi possível carregar os dados</h3><p class="muted">${esc(err.message)}</p></div>`; console.error(err); });
