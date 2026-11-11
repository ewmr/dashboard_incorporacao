/* =========================================================
   CRONOGRAMA — portfólio macro, régua de lançamentos,
   agenda de marcos, prazo de financiamento e régua individual
   (usa os utilitários e o estado definidos em app.js)
   ========================================================= */
const CR_FASES = [
  {id:"DUE", nome:"Due Diligence",          de:"nov001", ate:"inc001"},
  {id:"DEV", nome:"Prazo para Lançamento",   de:"inc001", ate:"inc002"},
  {id:"LIB", nome:"Preparação para Obra",    de:"inc002", ate:"eng001"},
  {id:"OBR", nome:"Desenvolvimento de Obra", de:"eng001", ate:"eng002"},
  {id:"ENT", nome:"Prazo para Entrega",      de:"eng002", ate:"mar001"},
];
const PJ_COR = "#8B5CF6";
const CR_CID = {"Almirante Tamandaré":"Alm. Tamandaré","São José dos Pinhais":"São José"};
const cidCurta = c => CR_CID[c] || c || "";
const md = c => (e => e.marcos[c] || null);
const dIso = iso => new Date(iso+"T12:00:00");
const difDias = (a,b) => Math.round((dIso(b)-dIso(a))/864e5);
const difMeses = (a,b) => difDias(a,b)/30.4375;
const mesAno = iso => iso ? MESES[+iso.slice(5,7)-1]+"/"+iso.slice(2,4) : "—";
const ddmm = iso => iso ? iso.slice(8,10)+" "+MESES[+iso.slice(5,7)-1] : "—";
const dataM = (e,c) => e.marcos[c]?.data || null;
const fmtMes = m => m==null ? "—" : nf(m, Math.abs(m)<10?1:0)+(Math.abs(m)>=1.5||Math.abs(m)<.5?" meses":" mês");

// prazo de financiamento: do lançamento comercial à entrega prevista em contrato
function financ(e){
  const l = dataM(e,"inc002"), c = dataM(e,"inc003"), k = dataM(e,"mar001");
  if (!l || !c) return null;
  return {lanc:l, contrato:c, chaves:k, meses:difMeses(l,c), folga: k ? difMeses(k,c) : null, lancOk: !!e.marcos.inc002?.ok};
}
const segmentos = e => CR_FASES.map(f=>({...f, a:dataM(e,f.de), b:dataM(e,f.ate)})).filter(s=>s.a&&s.b&&s.b>s.a);
const comCrono = e => !e.legado && segmentos(e).length>0;
function tipMarcos(e){
  const fi = financ(e), ms = Object.entries(e.marcos).filter(([c])=>D.marco_nome[c]).map(([c,m])=>({c, n:D.marco_nome[c], ...m})).sort((a,b)=>a.data.localeCompare(b.data));
  return `<b>${esc(e.nome)}</b> · ${esc(e.cidade)}<table>${ms.map(m=>`<tr><td>${m.ok?"✓":"○"} ${esc(m.n)}</td><td class="n${m.ok?" muted":""}">${dmy(m.data)}</td></tr>`).join("")}</table>${fi?`<div>Prazo de financiamento: <b>${fmtMes(fi.meses)}</b></div>`:""}<div class="muted">clique para abrir o cronograma do empreendimento</div>`;
}

/* ---------- 1. Portfólio macro (Gantt) ---------- */
function renderGantt(){
  const box = $("gantt"); if (!box) return;
  const L = filtrados().filter(e=>ativa(e) && comCrono(e))
    .sort((a,b)=>(dataM(a,"eng001")||dataM(a,"inc002")||"9").localeCompare(dataM(b,"eng001")||dataM(b,"inc002")||"9") || a.nome.localeCompare(b.nome,"pt-BR"));
  $("ganttN").textContent = L.length ? `${L.length} empreendimentos` : "";
  if (!L.length){ box.innerHTML = "<p class='muted'>Nenhum empreendimento ativo com cronograma nesta seleção.</p>"; return; }
  const hoje = HOJE(), h = dIso(hoje);
  const ini = new Date(h.getFullYear(), h.getMonth()-1, 1);
  let fimIso = hoje; L.forEach(e=>Object.values(e.marcos).forEach(m=>{ if (m.data>fimIso) fimIso=m.data; }));
  const f = dIso(fimIso), fim = new Date(f.getFullYear(), f.getMonth()+2, 1);
  const nM = (fim.getFullYear()-ini.getFullYear())*12 + fim.getMonth()-ini.getMonth();
  const W = Math.max(720, box.clientWidth||1000), lw = W<820?150:196, iw = W-lw-8, cw = iw/nM, rh = 34, top = 44, H = top + L.length*rh + 8;
  const X = iso => { const d=dIso(iso); return lw + ((d.getFullYear()-ini.getFullYear())*12 + d.getMonth()-ini.getMonth() + (d.getDate()-1)/new Date(d.getFullYear(), d.getMonth()+1, 0).getDate())*cw; };
  let s = `<svg viewBox="0 0 ${W} ${H}" class="gantt">`;
  // grade e cabeçalho
  for (let i=0;i<nM;i++){ const d=new Date(ini.getFullYear(), ini.getMonth()+i, 1), x=lw+i*cw, m=d.getMonth();
    s+=`<line x1="${x}" x2="${x}" y1="${m===0?6:24}" y2="${H-6}" stroke="${m===0?"var(--label-3)":"var(--grid)"}" ${m===0?'stroke-opacity=".55"':""}/>`;
    if (cw>=13 || m%3===0) s+=`<text x="${x+cw/2}" y="38" text-anchor="middle" class="gm">${m+1}</text>`;
    if (m===0 || i===0){ const meses = Math.min(12-m, nM-i); if (meses*cw>34) s+=`<text x="${x+meses*cw/2}" y="17" text-anchor="middle" class="ga">${d.getFullYear()}</text>`; } }
  s+=`<line x1="${lw}" x2="${W-8}" y1="26" y2="26" stroke="var(--grid)"/>`;
  // linhas
  L.forEach((e,r)=>{ const y = top + r*rh, cy = y+rh/2, sg = segmentos(e), x0 = Math.max(lw, X(sg[0].a)), x1 = Math.min(W-8, X(sg[sg.length-1].b)), cort = X(sg[0].a)<lw;
    s+=`<g class="gr" data-s="${e.sigla}"><rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
    if (r%2===0) s+=`<rect x="4" y="${y+2}" width="${lw-12}" height="${rh-4}" rx="9" fill="var(--fill)" opacity=".55"/>`;
    s+=`<text x="14" y="${cy+4}" class="gc">${esc(cidCurta(e.cidade))}</text><text x="${lw-14}" y="${cy+5}" text-anchor="end" class="gn">${esc(e.nome)}</text>`;
    s+=`<clipPath id="gc${r}"><rect x="${cort?x0-14:x0}" y="${cy-11}" width="${x1-(cort?x0-14:x0)}" height="22" rx="11"/></clipPath><g clip-path="url(#gc${r})">`;
    sg.forEach(g=>{ const a=Math.max(lw,X(g.a)), b=X(g.b); if (b>a) s+=`<rect x="${a}" y="${cy-11}" width="${b-a+.6}" height="22" fill="${faseCor(g.id)}"/>`; });
    s+=`</g>`;
    const pj = e.marcos.cef003, ct = e.marcos.inc003;
    if (ct && X(ct.data)>lw) s+=`<g class="gct"><line x1="${X(ct.data)}" x2="${X(ct.data)}" y1="${cy-14}" y2="${cy+14}" stroke="var(--label)" stroke-width="2" stroke-linecap="round"/></g>`;
    if (pj && X(pj.data)>lw) { const px=X(pj.data); s+=`<path d="M${px},${cy-9} L${px+9},${cy} L${px},${cy+9} L${px-9},${cy} Z" fill="${PJ_COR}" stroke="#fff" stroke-width="2"/><path d="M${px},${cy-3.5} L${px+3.5},${cy} L${px},${cy+3.5} L${px-3.5},${cy} Z" fill="#fff" opacity="${pj.ok?1:0}"/>`; }
    s+=`</g>`; });
  // hoje
  const xh = X(hoje);
  s+=`<rect x="${lw+Math.floor((xh-lw)/cw)*cw}" y="24" width="${cw}" height="${H-30}" fill="var(--accent)" opacity=".07"/><line x1="${xh}" x2="${xh}" y1="22" y2="${H-6}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3"/><rect x="${xh-19}" y="28" width="38" height="14" rx="7" fill="var(--accent)"/><text x="${xh}" y="38.5" text-anchor="middle" style="font-size:8.5px;font-weight:700;fill:var(--accent-ink)">HOJE</text>`;
  box.innerHTML = s+"</svg>";
  box.querySelectorAll(".gr").forEach(g=>{ const e=D.empreendimentos.find(x=>x.sigla===g.dataset.s);
    bindTip(g, ()=>tipMarcos(e)); g.onclick = ()=>{ S.crSel=e.sigla; renderIndiv(); $("sec-indiv").scrollIntoView({behavior:"smooth", block:"start"}); }; });
}

/* ---------- 2. Régua de lançamentos ---------- */
const negociacao = e => faseDe(e)==="DUE";
function renderRegua(){
  const box = $("regua"); if (!box) return;
  const A0 = ANO(), L = filtrados("ano").filter(e=>!e.legado && lanc(e) && anoLanc(e)>=A0);
  const anos = [...new Set(L.map(anoLanc))].sort();
  if (!anos.length){ box.innerHTML="<p class='muted'>Nenhum lançamento previsto nesta seleção.</p>"; return; }
  const W = Math.max(720, box.clientWidth||1000), lw = W<820?150:200, iw = W-lw, cw = iw/12, ch = 236, gap = 16;
  const vmax = Math.max(200, ...L.map(e=>vig(e)?.vgv_bruto||0).map(v=>v/1e6));
  const top = Math.ceil(vmax/50)*50, H = 22 + anos.length*(ch+gap);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="regua"><defs><pattern id="hach" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="transparent"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.55)" stroke-width="3"/></pattern></defs>`;
  MESES.forEach((m,i)=>{ s+=`<text x="${lw+i*cw+cw/2}" y="13" text-anchor="middle" class="rm">${m}</text>`; });
  anos.forEach((Y,k)=>{ const y0 = 22 + k*(ch+gap), base = y0+ch-14, alt = ch-102, Yv = v => base - alt*v/top;
    const its = L.filter(e=>anoLanc(e)===Y), tot = its.reduce((a,e)=>a+(vig(e)?.vgv_bruto||0),0), meta = metaV(Y);
    // coluna do ano
    const bmax = Math.max(tot, meta||0)*1.08 || 1, bw = lw-34;
    s+=`<text x="12" y="${y0+44}" class="ry">${Y}</text>`;
    s+=`<rect x="12" y="${y0+60}" width="${bw}" height="9" rx="4.5" fill="var(--fill-2)"/><rect x="12" y="${y0+60}" width="${Math.max(4,bw*tot/bmax)}" height="9" rx="4.5" fill="${meta&&tot>=meta?"var(--green-ink,#1E9E48)":"var(--green-ink,#1E9E48)"}" opacity="${meta&&tot>=meta?1:.75}"/>`;
    if (meta) s+=`<rect x="${12+bw*meta/bmax-1.5}" y="${y0+56}" width="3" height="17" rx="1.5" fill="var(--accent)"/>`;
    s+=`<text x="12" y="${y0+96}" class="rv">${nf(tot/1e6,2)} MM VGV</text>`;
    s+=`<text x="12" y="${y0+114}" class="rmt">${meta?`Meta: ${nf(meta/1e6,0)} MM · ${nf(tot/meta*100,0)}%`:"sem meta definida"}</text>`;
    s+=`<text x="12" y="${y0+130}" class="rmt">${its.length} ${its.length===1?"lançamento":"lançamentos"} · ${nf(its.reduce((a,e)=>a+(vig(e)?.unidades||0),0))} UH</text>`;
    // painel dos meses
    s+=`<rect x="${lw}" y="${y0}" width="${iw}" height="${ch}" rx="18" fill="var(--card-solid)" stroke="var(--sep)"/>`;
    for (let v=0; v<=top; v+=50) s+=`<line x1="${lw+4}" x2="${W-4}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="var(--grid)"/><text x="${lw+8}" y="${Yv(v)-3}" class="rg">${v}</text>`;
    for (let i=1;i<12;i++) s+=`<line x1="${lw+i*cw}" x2="${lw+i*cw}" y1="${y0}" y2="${y0+ch}" stroke="var(--sep)"/>`;
    if (Y===A0){ const xh = lw + (dIso(HOJE()).getMonth() + (dIso(HOJE()).getDate()-1)/31)*cw; s+=`<line x1="${xh}" x2="${xh}" y1="${y0+4}" y2="${y0+ch-4}" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1.3"/><text x="${xh+4}" y="${y0+ch-18}" style="font-size:9px;font-weight:700;fill:var(--accent)">hoje</text>`; }
    // barras: lançamentos do mesmo mês lado a lado (rótulos por cima de todas as barras)
    let lab = "";
    for (let m=0;m<12;m++){ const ms = its.filter(e=>+lanc(e).data.slice(5,7)-1===m).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data)); if (!ms.length) continue;
      const n = ms.length, slot = cw/n, bwid = Math.min(cw*.72, slot*.86); let prevY = 1e9;
      ms.forEach((e,j)=>{ const v=(vig(e)?.vgv_bruto||0)/1e6, cx = lw+m*cw+slot*j+slot/2, yb = Yv(v), cor = cidadeCor(e.cidade), neg = negociacao(e), feito = !!lanc(e).ok;
        const fs = n>1?.86:1; let yl = yb-10; if (j>0 && slot<100) yl = Math.min(yl, prevY-44); prevY = yl;
        s+=`<g class="rb" data-s="${e.sigla}"><rect x="${cx-bwid/2}" y="${yb}" width="${bwid}" height="${base-yb}" rx="9" fill="${cor}"/>${neg?`<rect x="${cx-bwid/2}" y="${yb}" width="${bwid}" height="${base-yb}" rx="9" fill="url(#hach)"/>`:""}`;
        s+=`<text x="${cx}" y="${yb+17}" text-anchor="middle" class="rbv" style="font-size:${13*fs}px">${nf(v,2)}</text>`;
        lab+=`<text x="${cx}" y="${yl-28}" text-anchor="middle" class="rbn" style="font-size:${13.5*fs}px">${feito?"✓ ":""}${esc(e.nome)}</text><text x="${cx}" y="${yl-14}" text-anchor="middle" class="rbc" style="fill:${cor};font-size:${10.5*fs}px">${esc(cidCurta(e.cidade))}</text><text x="${cx}" y="${yl-2}" text-anchor="middle" class="rbu">${nf(vig(e)?.unidades)} UH</text>`;
        s+=`<rect x="${cx-slot/2}" y="${y0}" width="${slot}" height="${ch}" fill="transparent"/></g>`; }); }
    s+=`<g style="pointer-events:none" class="rlab">${lab}</g>`;
  });
  box.innerHTML = s+"</svg>";
  box.querySelectorAll(".rb").forEach(g=>{ const e=D.empreendimentos.find(x=>x.sigla===g.dataset.s), v=vig(e), fi=financ(e), l=lanc(e), ri=e.marcos.leg010, o4=e.marcos.orcV4, v4=(e.viabilidades||[]).find(x=>x.versao==="V4");
    bindTip(g, ()=>`<b>${esc(e.nome)}</b> · ${esc(e.cidade)}${negociacao(e)?" · em negociação":""}<table>
      <tr><td>Lançamento ${l.ok?"realizado":"previsto"}</td><td class="n"><b>${dmy(l.data)}</b></td></tr>
      <tr><td>Viabilidade de lançamento (V4)</td><td class="n">${v4?.mes?`elaborada ${mesTxt(v4.mes)}`:o4?`${o4.ok?"✓ ":""}${dmy(o4.data)}`:"—"}</td></tr>
      <tr><td>Registro de Incorporação</td><td class="n">${ri?`${ri.ok?"✓ ":""}${dmy(ri.data)}`:"—"}</td></tr>
      <tr><td>VGV bruto · ${v?.versao||""}</td><td class="n">${brl(v?.vgv_bruto)}</td></tr><tr><td>Unidades</td><td class="n">${nf(v?.unidades)}</td></tr>
      ${fi?`<tr><td>Prazo de financiamento</td><td class="n">${fmtMes(fi.meses)}</td></tr>`:""}</table><div class="muted">clique para abrir o cronograma do empreendimento</div>`);
    g.onclick = ()=>{ S.crSel=e.sigla; renderIndiv(); $("sec-indiv").scrollIntoView({behavior:"smooth", block:"start"}); }; });
  $("reguaLeg").innerHTML = [...new Set(L.map(e=>e.cidade))].map(c=>`<span><i style="background:${cidadeCor(c)}"></i>${esc(cidCurta(c))}</span>`).join("") + `<span><i class="hz"></i>Em negociação</span><span><b style="color:var(--label)">✓</b> já lançado</span>`;
}

/* ---------- 3. Agenda de marcos ---------- */
function renderAgenda(){
  const box = $("agenda"); if (!box) return;
  const hoje = HOJE(), lim = new Date(dIso(hoje).getTime()+90*864e5).toISOString().slice(0,10);
  const its = [];
  filtrados().filter(e=>!e.legado && ativa(e)).forEach(e=>Object.entries(e.marcos).forEach(([c,m])=>{
    if (!D.marco_nome[c] || m.ok) return;
    if (m.data<=lim) its.push({e, c, n:D.marco_nome[c], data:m.data, atras:m.data<hoje}); }));
  its.sort((a,b)=>a.data.localeCompare(b.data));
  const atr = its.filter(x=>x.atras), prox = its.filter(x=>!x.atras);
  $("agN").textContent = `${prox.length} nos próximos 90 dias${atr.length?` · ${atr.length} vencidos sem conclusão`:""}`;
  const linha = x => { const d = difDias(hoje, x.data);
    return `<div class="ag-i${x.atras?" atr":""}" data-s="${x.e.sigla}"><div class="ag-d"><b>${x.data.slice(8,10)}</b><span>${MESES[+x.data.slice(5,7)-1]}</span></div><span class="ag-dot" style="background:${faseCor(faseDe(x.e))}"></span><div class="ag-t"><b>${esc(x.n)}</b><span>${esc(x.e.nome)} · ${esc(cidCurta(x.e.cidade))}</span></div><div class="ag-r">${x.atras?`${-d} ${-d===1?"dia":"dias"} de atraso`:d===0?"hoje":`em ${d} ${d===1?"dia":"dias"}`}</div></div>`; };
  let h = "";
  if (atr.length) h += `<div class="ag-g"><h4 class="red">Vencidos e ainda não concluídos</h4>${atr.map(linha).join("")}</div>`;
  const grupos = {}; prox.forEach(x=>{ (grupos[x.data.slice(0,7)] = grupos[x.data.slice(0,7)]||[]).push(x); });
  Object.entries(grupos).forEach(([m,xs])=>{ h += `<div class="ag-g"><h4>${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][+m.slice(5)-1]} de ${m.slice(0,4)}</h4>${xs.map(linha).join("")}</div>`; });
  box.innerHTML = h || "<p class='muted'>Nenhum marco previsto para os próximos 90 dias.</p>";
  box.querySelectorAll(".ag-i").forEach(el=>el.onclick=()=>{ S.crSel=el.dataset.s; renderIndiv(); $("sec-indiv").scrollIntoView({behavior:"smooth", block:"start"}); });
}

/* ---------- 4. Prazo de financiamento ---------- */
function renderFinanc(){
  const box = $("financ"); if (!box) return;
  const base = filtrados().filter(e=>!e.legado && ativa(e) && lanc(e));
  const L = base.map(e=>({e, f:financ(e)})).filter(x=>x.f).sort((a,b)=>a.f.lanc.localeCompare(b.f.lanc));
  const sem = base.filter(e=>!financ(e) && e.marcos.inc002 && !e.marcos.inc003);
  const mx = Math.max(36, ...L.map(x=>x.f.meses)), med = L.length ? L.reduce((a,x)=>a+x.f.meses,0)/L.length : null;
  $("finCap").textContent = L.length ? `do lançamento comercial à entrega em contrato · média ${fmtMes(med)}` : "do lançamento comercial à entrega em contrato";
  box.innerHTML = (L.length ? `<div class="fi-h"><span>Empreendimento</span><span>meses entre lançamento e contrato</span><span class="n">Prazo</span><span class="n">Folga das chaves</span></div>` + L.map(({e,f})=>{
    const w = f.meses/mx*100, k = f.chaves ? difMeses(f.lanc, f.chaves)/mx*100 : null, fo = f.folga, cls = fo==null?"":fo<0?"down":fo<1?"flat":"up";
    return `<div class="fi-r" data-s="${e.sigla}"><span class="fi-n">${esc(e.nome)}<small>${f.lancOk?"lançado":"lança"} ${mesAno(f.lanc)}</small></span>
      <span class="fi-b"><i style="width:${w}%"></i>${k!=null?`<em style="left:${Math.min(100,k)}%" title="entrega de chaves prevista"></em>`:""}</span>
      <b class="n">${nf(f.meses,1)}</b><span class="n">${fo==null?"—":`<span class="dchip ${cls}">${fo>=0?"+":"−"}${nf(Math.abs(fo),1)} m</span>`}</span></div>`; }).join("")
    : "<p class='muted'>Nenhum empreendimento com Lançamento Comercial e Entrega em Contrato no cronograma.</p>")
    + (sem.length ? `<p class="cap" style="margin-top:10px">Sem Entrega em Contrato (inc003) no cronograma: ${sem.map(e=>esc(e.nome)).join(", ")}</p>` : "")
    + `<p class="cap" style="margin-top:6px">A marca na barra é a entrega de chaves prevista. Folga = quanto antes do prazo de contrato as chaves estão previstas; negativa indica entrega prevista depois do contrato.</p>`;
  box.querySelectorAll(".fi-r").forEach(el=>{ const e=D.empreendimentos.find(x=>x.sigla===el.dataset.s), f=financ(e);
    bindTip(el, `<b>${esc(e.nome)}</b><table><tr><td>Lançamento comercial</td><td class="n">${f.lancOk?"✓ ":""}${dmy(f.lanc)}</td></tr><tr><td>Entrega de chaves prevista</td><td class="n">${dmy(f.chaves)}</td></tr><tr><td>Entrega em contrato</td><td class="n">${dmy(f.contrato)}</td></tr><tr><td><b>Prazo de financiamento</b></td><td class="n"><b>${fmtMes(f.meses)}</b></td></tr></table>`);
    el.onclick = ()=>{ S.crSel=e.sigla; renderIndiv(); $("sec-indiv").scrollIntoView({behavior:"smooth", block:"start"}); }; });
}

/* ---------- 5. Cronograma do empreendimento (régua individual) ---------- */
function renderIndiv(){
  const box = $("indiv"); if (!box) return;
  const L = filtrados().filter(e=>comCrono(e)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  if (!L.length){ box.innerHTML="<p class='muted'>Nenhum empreendimento com cronograma nesta seleção.</p>"; $("indSel").innerHTML=""; return; }
  if (!S.crSel || !L.some(e=>e.sigla===S.crSel)) S.crSel = (L.find(e=>lanc(e)&&!lanc(e).ok) || L[0]).sigla;
  const e = L.find(x=>x.sigla===S.crSel), fi = financ(e), hoje = HOJE();
  $("indSel").innerHTML = `<select id="indSelS">${L.map(x=>`<option value="${x.sigla}" ${x.sigla===e.sigla?"selected":""}>${esc(x.nome)}</option>`).join("")}</select>
    <button class="pillbtn" id="indFicha"><svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>Ficha</button>
    ${e.lista_id?`<a class="pillbtn" href="https://app.clickup.com/9013344143/v/li/${e.lista_id}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>Cronograma no ClickUp</a>`:""}`;
  $("indSelS").onchange = ev=>{ S.crSel = ev.target.value; renderIndiv(); };
  $("indFicha").onclick = ()=>abreFicha(e);
  const ms = Object.entries(e.marcos).filter(([c])=>D.marco_nome[c]).map(([c,m])=>({c, n:D.marco_nome[c], ...m})).sort((a,b)=>a.data.localeCompare(b.data));
  const sg = segmentos(e), ok = ms.filter(m=>m.ok).length, atr = ms.filter(m=>!m.ok && m.data<hoje), prox = ms.find(m=>!m.ok && m.data>=hoje);
  const st = (k,v,sub) => `<div><span>${k}</span><b>${v}</b><small>${sub}</small></div>`;
  let h = `<div class="fx-st">${st("Fase atual", esc(faseNome(e)), esc(e.cidade))}${st("Próximo marco", prox?esc(prox.n):"—", prox?`${dmy(prox.data)} · em ${difDias(hoje,prox.data)} dias`:"sem marcos pendentes")}${st("Marcos concluídos", `${ok} de ${ms.length}`, atr.length?`<span style="color:var(--red-ink)">${atr.length} vencido${atr.length>1?"s":""} sem conclusão</span>`:"nenhum vencido")}${st("Prazo de financiamento", fi?fmtMes(fi.meses):"—", fi?`lançamento ${mesAno(fi.lanc)} → contrato ${mesAno(fi.contrato)}`:"falta Lançamento ou Entrega em Contrato")}</div>`;
  // régua em escala de tempo
  const a = ms[0].data, b = ms[ms.length-1].data, d0 = dIso(a), d1 = dIso(b);
  const ini = new Date(d0.getFullYear(), d0.getMonth(), 1), fim = new Date(d1.getFullYear(), d1.getMonth()+1, 1);
  const W = Math.max(720, box.clientWidth||1000), ml = 16, mr = 16, iw = W-ml-mr, span = fim-ini;
  const X = iso => ml + iw*(dIso(iso)-ini)/span, yb = 46;
  // rótulos em níveis para não encavalar
  const niveis = [], pos = ms.map(m=>{ const x=X(m.data), w=Math.max(m.n.length*6.1, 54)+10, fim = x+w > W-mr, l = fim ? x-w : x, r = fim ? x : x+w; let lv=0; while ((niveis[lv]??-1e9) > l-6) lv++; niveis[lv] = r; return {m, x, lv, fim}; });
  const nl = Math.max(1, niveis.length), H = yb + 40 + nl*30 + 10;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="indiv">`;
  for (let y=ini.getFullYear(); y<=fim.getFullYear(); y++){ const xi = X(`${y}-01-01`); if (xi>=ml && xi<=W-mr) s+=`<line x1="${xi}" x2="${xi}" y1="10" y2="${H-6}" stroke="var(--grid)"/><text x="${xi+4}" y="20" class="ga">${y}</text>`; }
  if (ini.getMonth()!==0) s+=`<text x="${ml}" y="20" class="ga">${ini.getFullYear()}</text>`;
  s+=`<clipPath id="indc"><rect x="${X(sg[0].a)}" y="${yb-9}" width="${X(sg[sg.length-1].b)-X(sg[0].a)}" height="18" rx="9"/></clipPath><g clip-path="url(#indc)">`;
  sg.forEach(g=>{ s+=`<rect class="isg" data-f="${g.id}" x="${X(g.a)}" y="${yb-9}" width="${X(g.b)-X(g.a)+.6}" height="18" fill="${faseCor(g.id)}"/>`; });
  s+=`</g>`;
  sg.forEach(g=>{ const w=X(g.b)-X(g.a); if (w>90) s+=`<text x="${X(g.a)+w/2}" y="${yb+4}" text-anchor="middle" style="font-size:9.5px;font-weight:700;fill:#fff;pointer-events:none">${esc(g.nome)}</text>`; });
  if (hoje>=a && hoje<=b){ const xh=X(hoje); s+=`<line x1="${xh}" x2="${xh}" y1="${yb-22}" y2="${H-6}" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1.4"/><rect x="${xh-19}" y="${yb-32}" width="38" height="15" rx="7.5" fill="var(--accent)"/><text x="${xh}" y="${yb-21}" text-anchor="middle" style="font-size:9px;font-weight:700;fill:var(--accent-ink)">HOJE</text>`; }
  pos.forEach(({m,x,lv,fim})=>{ const y = yb+34+lv*30, atrasado = !m.ok && m.data<hoje, cor = m.c==="cef003" ? PJ_COR : atrasado ? "var(--red-ink)" : "var(--label)";
    s+=`<g class="im" data-c="${m.c}"><line x1="${x}" x2="${x}" y1="${yb+10}" y2="${y-9}" stroke="var(--label-3)" stroke-dasharray="2 2"/>`;
    s+= m.ok ? `<circle cx="${x}" cy="${y-4}" r="4.5" fill="${cor}"/>` : `<circle cx="${x}" cy="${y-4}" r="4" fill="var(--card-solid)" stroke="${cor}" stroke-width="2"/>`;
    const tx = fim ? x-8 : x+8, an = fim ? ' text-anchor="end"' : "";
    s+=`<text x="${tx}" y="${y-1}"${an} style="font-size:10.5px;font-weight:${m.c==="inc002"||m.c==="inc003"?700:600};fill:${atrasado?"var(--red-ink)":"var(--label)"}">${esc(m.n)}</text><text x="${tx}" y="${y+11}"${an} style="font-size:9.5px;fill:var(--label-3)">${mesAno(m.data)}</text></g>`; });
  s += "</svg>";
  h += `<div class="chart">${s}</div><div class="leg" style="margin-top:6px"><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--label)"/></svg>concluído</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--label)" stroke-width="1.6"/></svg>previsto</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--red-ink)" stroke-width="1.6"/></svg>vencido sem conclusão</span></div>`;
  box.innerHTML = h;
  box.querySelectorAll(".im").forEach(g=>{ const m=ms.find(x=>x.c===g.dataset.c); bindTip(g, `<b>${esc(m.n)}</b> · ${m.ok?"concluído":m.data<hoje?"vencido sem conclusão":"previsto"}<div>${dmy(m.data)}${!m.ok?` · ${m.data<hoje?`${difDias(m.data,hoje)} dias de atraso`:`em ${difDias(hoje,m.data)} dias`}`:""}</div>`); });
  box.querySelectorAll(".isg").forEach(r=>{ const g=sg.find(x=>x.id===r.dataset.f); bindTip(r, `<b>${esc(g.nome)}</b><div>${dmy(g.a)} → ${dmy(g.b)} · ${fmtMes(difMeses(g.a,g.b))}</div>`); });
}

function renderCrono(){
  if (!$("gantt")) return;
  renderGantt(); renderRegua(); renderAgenda(); renderFinanc(); renderIndiv();
  $("ganttLeg").innerHTML = CR_FASES.map(f=>`<span><i style="background:${faseCor(f.id)}"></i>${f.nome}</span>`).join("") + `<span><svg width="12" height="12"><path d="M6,0.5 L11.5,6 L6,11.5 L0.5,6 Z" fill="${PJ_COR}"/></svg>Assinatura PJ</span><span><svg width="6" height="14"><line x1="3" x2="3" y1="1" y2="13" stroke="var(--label)" stroke-width="2" stroke-linecap="round"/></svg>Entrega em contrato</span>`;
}
