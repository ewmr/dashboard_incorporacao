/* =========================================================
   CRONOGRAMA — régua de lançamentos (e simulação), portfólio
   macro, agenda de marcos, prontidão para lançamento,
   cronograma do empreendimento e tabela de marcos
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
const dIso = iso => new Date(iso+"T12:00:00");
const difDias = (a,b) => Math.round((dIso(b)-dIso(a))/864e5);
const difMeses = (a,b) => difDias(a,b)/30.4375;
const mesAno = iso => iso ? MESES[+iso.slice(5,7)-1]+"/"+iso.slice(2,4) : "—";
const dmyc = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(2,4) : "—";
const dataM = (e,c) => e.marcos[c]?.data || null;
const fmtMes = m => m==null ? "—" : nf(m, Math.abs(m)<10?1:0)+(Math.abs(m)>=1.5||Math.abs(m)<.5?" meses":" mês");
const irInd = sig => { S.crSel=sig; renderIndiv(); renderTabela(); $("sec-indiv").scrollIntoView({behavior:"smooth", block:"start"}); };

// prazo de financiamento: do lançamento comercial à entrega prevista em contrato
function financ(e){
  const l = dataM(e,"inc002"), c = dataM(e,"inc003"), k = dataM(e,"mar001");
  if (!l || !c) return null;
  return {lanc:l, contrato:c, chaves:k, meses:difMeses(l,c), folga: k ? difMeses(k,c) : null, lancOk: !!e.marcos.inc002?.ok};
}
// fases do Gantt; sem "Fim da Due", o prazo para lançamento começa no primeiro marco do cronograma
function segmentos(e){
  return CR_FASES.map(f=>{
    let a = dataM(e,f.de), est = false;
    if (!a && f.id==="DEV"){ const l = dataM(e,"inc002"); const ds = Object.entries(e.marcos).filter(([c,m])=>c!=="nov001" && l && m.data<l).map(([,m])=>m.data).sort(); if (ds.length){ a = ds[0]; est = true; } }
    return {...f, a, b:dataM(e,f.ate), est};
  }).filter(s=>s.a&&s.b&&s.b>s.a);
}
const comCrono = e => !e.legado && segmentos(e).length>0;
const marcosDe = e => Object.entries(e.marcos).filter(([c])=>D.marco_nome[c]).map(([c,m])=>({c, n:D.marco_nome[c], ...m})).sort((a,b)=>a.data.localeCompare(b.data));
function tipMarcos(e){
  const fi = financ(e), sg = segmentos(e);
  return `<b>${esc(e.nome)}</b> · ${esc(e.incorporadora)} · ${esc(e.cidade)}<table>${marcosDe(e).map(m=>`<tr><td>${m.ok?"✓":"○"} ${esc(m.n)}</td><td class="n${m.ok?" muted":""}">${dmy(m.data)}</td></tr>`).join("")}</table>${fi?`<div>Prazo de financiamento: <b>${fmtMes(fi.meses)}</b></div>`:""}${sg.some(s=>s.est)?`<div class="muted">sem Fim da Due Diligence no cronograma: o prazo para lançamento começa no primeiro marco</div>`:""}<div class="muted">clique para abrir o cronograma do empreendimento</div>`;
}
const icoCo = (inc, x, y, sz=16) => { const raw = ICO_CO[inc]; if (!raw) return ""; return `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" rx="${sz*.28}" fill="${coCor(inc)}"/>`+raw.replace("<svg ", `<svg x="${x+sz*.12}" y="${y+sz*.12}" width="${sz*.76}" height="${sz*.76}" `); };
const corta = (t, px, cw=7.3) => { const n = Math.max(3, Math.floor(px/cw)); return t.length>n ? t.slice(0,n-1).trimEnd()+"…" : t; };

/* ---------- Régua de lançamentos (desenho compartilhado com a simulação) ---------- */
const negociacao = e => faseDe(e)==="DUE";
function itemRegua(e){
  const v = vig(e), l = lanc(e);
  return {k:e.sigla, e, nome:e.nome, cidade:e.cidade, inc:e.incorporadora, data:l.data, vgv:v?.vgv_bruto||0, uh:v?.unidades||0, cor:corDe(e), neg:negociacao(e), feito:!!l.ok, ri:e.marcos.leg010||null, v4:e.marcos.orcV4||null};
}
function desenhaRegua(box, its, o={}){
  const A0 = ANO(), anosD = its.map(x=>+x.data.slice(0,4));
  const ultimo = Math.max(A0, ...anosD) + (o.sim ? 1 : 0);
  const anos = []; for (let y=A0; y<=ultimo; y++) if (o.sim || anosD.includes(y)) anos.push(y);
  if (!anos.length){ box.innerHTML="<p class='muted'>Nenhum lançamento previsto nesta seleção.</p>"; return null; }
  const marc = o.ri || o.v4, W = Math.max(760, box.clientWidth||1000), lw = W<860?170:214, iw = W-lw, cw = iw/12;
  const ch = marc ? 272 : 246, band = marc ? 46 : 16, gap = 16, base0 = ch-band, alt = ch-band-112;
  const top = Math.max(200, Math.ceil(Math.max(0,...its.map(x=>x.vgv/1e6))/50)*50), H = 22 + anos.length*(ch+gap);
  const incs = S.inc==="all" ? ["Make It","Gadens"] : [S.inc];
  const dh = dIso(HOJE()), sx = o.sim ? "S" : "";
  let s = `<svg viewBox="0 0 ${W} ${H}" class="regua${o.sim?" sim":""}"><defs><pattern id="hach${sx}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.6)" stroke-width="3"/></pattern></defs>`;
  MESES.forEach((m,i)=>{ s+=`<text x="${lw+i*cw+cw/2}" y="13" text-anchor="middle" class="rm">${m}</text>`; });
  const geo = {lw, cw, ch, gap, anos, top0:22};
  anos.forEach((Y,k)=>{ const y0 = 22 + k*(ch+gap), base = y0+base0, Yv = v => base - alt*v/top;
    const doAno = its.filter(x=>+x.data.slice(0,4)===Y), tot = doAno.reduce((a,x)=>a+x.vgv,0);
    // coluna do ano: total e meta (separada por empresa no consolidado)
    const bw = lw-34;
    s+=`<text x="12" y="${y0+40}" class="ry">${Y}</text><text x="12" y="${y0+66}" class="rv">${nf(tot/1e6,2)} MM VGV</text>`;
    if (o.baseTot){ const dl = tot-(o.baseTot[Y]||0); if (Math.abs(dl)>=5e4) s+=`<text x="12" y="${y0+82}" class="rdl" style="fill:${dl>0?"var(--green-ink,#1E9E48)":"var(--red-ink)"}">${dl>0?"▲ +":"▼ −"}${nf(Math.abs(dl)/1e6,2)} MM vs régua atual</text>`; }
    let yy = y0 + (o.baseTot ? 102 : 90);
    incs.forEach(inc=>{ const t = doAno.filter(x=>x.inc===inc).reduce((a,x)=>a+x.vgv,0), meta = metaV(Y, inc), cor = coCor(inc), dois = incs.length>1;
      const bmax = Math.max(t, meta||0)*1.08 || 1, ok = meta && t>=meta;
      s+=`<text x="12" y="${yy}" class="rmt">${dois?`<tspan style="fill:${cor};font-weight:700">${inc}</tspan> ${nf(t/1e6,1)} de `:""}${meta?`${dois?"":"Meta: "}${nf(meta/1e6,0)} MM · ${nf(t/meta*100,0)}%`:"sem meta definida"}</text>`;
      s+=`<rect x="12" y="${yy+5}" width="${bw}" height="7" rx="3.5" fill="var(--fill-2)"/><rect x="12" y="${yy+5}" width="${Math.max(3,bw*t/bmax)}" height="7" rx="3.5" fill="${dois?cor:"var(--green-ink,#1E9E48)"}" opacity="${ok?1:.72}"/>`;
      if (meta) s+=`<rect x="${12+bw*meta/bmax-1.5}" y="${yy+1}" width="3" height="15" rx="1.5" fill="${dois?"var(--label)":"var(--accent)"}"/>`;
      yy += 32; });
    s+=`<text x="12" y="${yy}" class="rmt">${doAno.length} ${doAno.length===1?"lançamento":"lançamentos"} · ${nf(doAno.reduce((a,x)=>a+x.uh,0))} UH</text>`;
    // painel: fundo, passado escurecido, faixa abaixo do zero
    s+=`<clipPath id="rp${sx}${k}"><rect x="${lw}" y="${y0}" width="${iw}" height="${ch}" rx="18"/></clipPath><rect x="${lw}" y="${y0}" width="${iw}" height="${ch}" rx="18" fill="var(--card-solid)" stroke="var(--sep)"/><g clip-path="url(#rp${sx}${k})">`;
    const xh = lw + (dh.getMonth() + (dh.getDate()-1)/31)*cw;
    if (Y<dh.getFullYear()) s+=`<rect x="${lw}" y="${y0}" width="${iw}" height="${ch}" fill="var(--label)" opacity=".05"/>`;
    else if (Y===dh.getFullYear()) s+=`<rect x="${lw}" y="${y0}" width="${xh-lw}" height="${ch}" fill="var(--label)" opacity=".05"/>`;
    s+=`<rect x="${lw}" y="${base}" width="${iw}" height="${band}" fill="var(--accent)" opacity=".09"/></g>`;
    for (let v=0; v<=top+100 && Yv(v)>=y0+10; v+=50) s+=`<line x1="${lw+4}" x2="${W-4}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="var(--grid)"/><text x="${lw+8}" y="${Yv(v)-3}" class="rg">${v}</text>`;
    for (let i=1;i<12;i++) s+=`<line x1="${lw+i*cw}" x2="${lw+i*cw}" y1="${y0}" y2="${y0+ch}" stroke="var(--sep)"/>`;
    if (Y===dh.getFullYear()) s+=`<line x1="${xh}" x2="${xh}" y1="${y0+4}" y2="${base}" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1.3"/><text x="${xh+4}" y="${base-5}" style="font-size:9px;font-weight:700;fill:var(--accent)">hoje</text>`;
    // posição original de quem foi arrastado
    if (o.sim) its.filter(x=>x.orig && +x.orig.slice(0,4)===Y).forEach(x=>{ const m=+x.orig.slice(5,7)-1, yb=Yv(x.vgv/1e6), bw2=cw*.6;
      s+=`<path d="${barra(lw+m*cw+cw/2-bw2/2, yb, bw2, base-yb)}" fill="none" stroke="var(--label-3)" stroke-dasharray="4 3" stroke-width="1.3"/><text x="${lw+m*cw+cw/2}" y="${base-6}" text-anchor="middle" style="font-size:8.5px;fill:var(--label-3)">${esc(corta(x.nome, cw*.9, 5.2))}</text>`; });
    // barras (lançamentos do mesmo mês lado a lado) e rótulos por cima de tudo
    let lab = "";
    for (let m=0;m<12;m++){ const ms = doAno.filter(x=>+x.data.slice(5,7)-1===m).sort((a,b)=>a.data.localeCompare(b.data)); if (!ms.length) continue;
      const n = ms.length, slot = cw/n, bwid = Math.min(cw*.72, slot*.86); let prevY = 1e9;
      ms.forEach((x,j)=>{ const v=x.vgv/1e6, cx = lw+m*cw+slot*j+slot/2, yb = Yv(v), fs = n>1?.86:1;
        let yl = yb-10; if (j>0 && slot<100) yl = Math.min(yl, prevY-44); prevY = yl;
        const d = barra(cx-bwid/2, yb, bwid, base-yb);
        s+=`<g class="rb${x.manual?" man":""}${x.orig?" mov":""}" data-k="${esc(x.k)}"><path d="${d}" fill="${x.cor}"/>${x.neg||x.manual?`<path d="${d}" fill="url(#hach${sx})"/>`:""}${x.manual||x.orig?`<path d="${d}" fill="none" stroke="var(--label)" stroke-width="1.6" stroke-dasharray="${x.manual?"4 3":"0"}"/>`:""}`;
        s+=`<text x="${cx}" y="${yb+17}" text-anchor="middle" class="rbv" style="font-size:${13*fs}px">${nf(v,2)}</text>`;
        lab+=`<text x="${cx}" y="${yl-28}" text-anchor="middle" class="rbn" style="font-size:${13.5*fs}px">${x.feito?"✓ ":""}${esc(x.nome)}</text><text x="${cx}" y="${yl-14}" text-anchor="middle" class="rbc" style="fill:${cidadeCor(x.cidade)};font-size:${10.5*fs}px">${esc(cidCurta(x.cidade))}</text><text x="${cx}" y="${yl-2}" text-anchor="middle" class="rbu">${x.orig?`de ${mesAno(x.orig)} →`:x.manual?"simulado":`${nf(x.uh)} UH`}</text>`;
        s+=`<rect class="rbh" x="${cx-slot/2}" y="${y0}" width="${slot}" height="${base0}" fill="transparent"/></g>`; }); }
    // marcos limitantes (RI e V4) na faixa de baixo
    if (marc){ const chips = [];
      its.forEach(x=>{ [["ri","RI",o.ri],["v4","V4",o.v4]].forEach(([c,rot,on])=>{ const mm = on && x[c]; if (!mm || +mm.data.slice(0,4)!==Y) return;
        chips.push({m:+mm.data.slice(5,7)-1, rot, x, mm, depois: mm.data.slice(0,7) > x.data.slice(0,7) && !mm.ok}); }); });
      const porMes = {}; chips.forEach(c=>{ (porMes[c.m]=porMes[c.m]||[]).push(c); });
      Object.entries(porMes).forEach(([m,cs])=>{ cs.sort((a,b)=>a.rot.localeCompare(b.rot)||a.x.nome.localeCompare(b.x.nome)); const per = Math.max(1, Math.floor((cw-6)/58));
        cs.forEach((c,i)=>{ const col = i%per, row = Math.floor(i/per); if (row>1) return; const w = Math.min(56, (cw-6)/per-3), x0 = lw+(+m)*cw+4+col*(w+3), yc = base+5+row*20;
          s+=`<g class="rchip" data-k="${esc(c.x.k)}" data-t="${c.rot}"><rect x="${x0}" y="${yc}" width="${w}" height="16" rx="8" fill="${c.depois?"var(--red-ink)":"var(--card-solid)"}" stroke="${c.depois?"var(--red-ink)":c.x.cor}" stroke-width="1.4"/><text x="${x0+w/2}" y="${yc+11.5}" text-anchor="middle" style="font-size:8.5px;font-weight:700;fill:${c.depois?"#fff":"var(--label)"}">${c.mm.ok?"✓":""}${c.rot} ${esc(corta(c.x.nome, w-22, 5))}</text></g>`; });
        if (cs.length > per*2) s+=`<text x="${lw+(+m+1)*cw-4}" y="${base+band-3}" text-anchor="end" style="font-size:8px;fill:var(--label-3)">+${cs.length-per*2}</text>`; });
    }
    s+=`<g style="pointer-events:none" class="rlab">${lab}</g>`;
  });
  box.innerHTML = s+"</svg>";
  geo.svg = box.querySelector("svg");
  box.querySelectorAll(".rb").forEach(g=>{ const x = its.find(i=>i.k===g.dataset.k); bindTip(g, ()=>tipRegua(x, o)); });
  box.querySelectorAll(".rchip").forEach(g=>{ const x = its.find(i=>i.k===g.dataset.k), c = g.dataset.t==="RI" ? x.ri : x.v4;
    bindTip(g, `<b>${g.dataset.t==="RI"?"Registro de Incorporação":"Orçamento V4"}</b> · ${esc(x.nome)}<div>${c.ok?"concluído em":"previsto para"} ${dmy(c.data)}</div><div>Lançamento ${o.sim?"na simulação":"previsto"}: ${mesAno(x.data)}</div>${c.data.slice(0,7)>x.data.slice(0,7)&&!c.ok?`<div style="color:var(--red-ink);font-weight:600">fica depois do lançamento</div>`:""}`); });
  return geo;
}
// barra com cantos arredondados só em cima (sensação de crescimento)
function barra(x, y, w, h){ const r = Math.max(0, Math.min(9, w/2, h)); return `M${x},${y+h} L${x},${y+r} Q${x},${y} ${x+r},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+h} Z`; }
function tipRegua(x, o){
  const e = x.e, v = e && vig(e), fi = e && financ(e);
  const lim = (c,rot) => x[c] ? `<tr><td>${rot}</td><td class="n">${x[c].ok?"✓ ":""}${dmy(x[c].data)}${!x[c].ok && x[c].data.slice(0,7)>x.data.slice(0,7)?` <span style="color:var(--red-ink)">· depois do lançamento</span>`:""}</td></tr>` : `<tr><td>${rot}</td><td class="n muted">—</td></tr>`;
  return `<b>${esc(x.nome)}</b> · ${esc(x.inc)} · ${esc(x.cidade)}${x.manual?" · adicionado na simulação":x.neg?" · em negociação":""}<table>
    <tr><td>Lançamento ${x.feito?"realizado":o.sim?"na simulação":"previsto"}</td><td class="n"><b>${x.feito?dmy(x.data):mesAno(x.data)}</b></td></tr>${x.orig?`<tr><td>Na régua atual</td><td class="n">${mesAno(x.orig)}</td></tr>`:""}
    ${x.manual?"":lim("v4","Orçamento V4")+lim("ri","Registro de Incorporação")}
    <tr><td>VGV bruto${v?" · "+v.versao:""}</td><td class="n">${brl(x.vgv)}</td></tr><tr><td>Unidades</td><td class="n">${nf(x.uh)}</td></tr>
    ${fi?`<tr><td>Prazo de financiamento</td><td class="n">${fmtMes(fi.meses)}</td></tr>`:""}</table><div class="muted">${o.sim?(x.manual?"arraste para mudar o mês · clique para editar":"arraste para mudar o mês de lançamento"):"clique para abrir o cronograma do empreendimento"}</div>`;
}
const legRegua = (its, extra="") => { const ord = grupoOrdem(), gs = [...new Set(its.map(x=>x.grp))].sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
  return gs.map(g=>`<span><i style="background:${grupoCor(g)}"></i>${esc(S.group==="cidade"?cidCurta(g):grupoNome(g))}</span>`).join("") + extra; };
function renderRegua(){
  const box = $("regua"); if (!box) return;
  const A0 = ANO(), L = filtrados("ano").filter(e=>!e.legado && lanc(e) && anoLanc(e)>=A0 && !negociacao(e));
  const its = L.map(e=>({...itemRegua(e), grp:grupoDe(e)}));
  desenhaRegua(box, its);
  box.querySelectorAll(".rb").forEach(g=>g.onclick=()=>irInd(g.dataset.k));
  $("reguaLeg").innerHTML = legRegua(its, `<span><b style="color:var(--label)">✓</b> já lançado</span><span class="muted">cores por ${grupoRotulo()} · troque em Filtros › Colorir e agrupar por</span>`);
}

/* ---------- Simulação de régua ---------- */
const SIM = (()=>{ try { const j = JSON.parse(localStorage.getItem("dash-sim")||"null"); if (j) return {datas:j.datas||{}, manuais:j.manuais||[], ri:!!j.ri, v4:!!j.v4}; } catch(e){} return {datas:{}, manuais:[], ri:false, v4:false}; })();
const salvaSim = () => { try { localStorage.setItem("dash-sim", JSON.stringify(SIM)); } catch(e){} };
const grpManual = m => S.group==="inc" ? m.inc : S.group==="cidade" ? m.cidade : S.group==="linha" ? "Aguardando Definição" : "DUE";
function itensSim(){
  const A0 = ANO();
  const reais = filtrados("ano").filter(e=>!e.legado && lanc(e))
    .map(e=>{ const x = {...itemRegua(e), grp:grupoDe(e)}, d = SIM.datas[e.sigla]; if (d && d.slice(0,7)!==x.data.slice(0,7)){ x.orig = x.data; x.data = d; } return x; })
    .filter(x=>+x.data.slice(0,4)>=A0);
  const man = SIM.manuais.filter(m=>S.inc==="all" || m.inc===S.inc).map(m=>({k:m.id, nome:m.nome, cidade:m.cidade, inc:m.inc, data:m.data, vgv:m.vgv, uh:m.uh||0, grp:grpManual(m), cor:grupoCor(grpManual(m)), neg:true, manual:true, feito:false}));
  return reais.concat(man);
}
function abreSim(){
  $("expT").innerHTML = `Simular régua de lançamentos <span class="muted" style="font-weight:500;font-size:.9rem">arraste para outro mês ou ano · nada é gravado no ClickUp</span>`;
  $("expBody").innerHTML = `<div class="sim-bar">
      <label class="sim-ck"><input type="checkbox" id="simRI" ${SIM.ri?"checked":""}><span></span>Registro de Incorporação (RI)</label>
      <label class="sim-ck"><input type="checkbox" id="simV4" ${SIM.v4?"checked":""}><span></span>Orçamento V4</label>
      <span class="sim-sp"></span>
      <button class="pillbtn" id="simAdd"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Adicionar empreendimento</button>
      <button class="pillbtn" id="simCopia"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Copiar resumo</span></button>
      <button class="pillbtn" id="simZera"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>Desfazer tudo</button>
    </div>
    <div id="simForm" hidden></div>
    <div class="chart" id="simRegua"></div>
    <div class="leg" id="simLeg" style="margin-top:8px"></div>
    <h4 class="fx-h">Alterações nesta simulação</h4><div id="simLista"></div>
    <p class="cap" style="margin-top:10px">A simulação fica guardada neste navegador até você desfazer. Empreendimentos ainda em Due Diligence aparecem aqui hachurados, mesmo fora da régua oficial.</p>`;
  abreFolha("expSheet"); $("expSheet").classList.add("xl");
  $("simRI").onchange = ev=>{ SIM.ri = ev.target.checked; salvaSim(); renderSim(); };
  $("simV4").onchange = ev=>{ SIM.v4 = ev.target.checked; salvaSim(); renderSim(); };
  $("simAdd").onclick = ()=>formManual(null);
  $("simZera").onclick = ()=>{ SIM.datas = {}; SIM.manuais = []; salvaSim(); $("simForm").hidden = true; renderSim(); };
  $("simCopia").onclick = copiaSim;
  requestAnimationFrame(renderSim);
}
function renderSim(){
  const box = $("simRegua"); if (!box) return;
  const its = itensSim(), A0 = ANO();
  const baseTot = {}; filtrados("ano").filter(e=>!e.legado && lanc(e) && anoLanc(e)>=A0 && !negociacao(e)).forEach(e=>{ const y=anoLanc(e); baseTot[y]=(baseTot[y]||0)+(vig(e)?.vgv_bruto||0); });
  const geo = desenhaRegua(box, its, {sim:true, ri:SIM.ri, v4:SIM.v4, baseTot});
  $("simLeg").innerHTML = legRegua(its, `<span><i class="hz"></i>em negociação ou adicionado</span><span><svg width="16" height="10"><rect x="1" y="1" width="14" height="8" rx="2" fill="none" stroke="var(--label-3)" stroke-dasharray="3 2"/></svg>posição na régua atual</span>${SIM.ri||SIM.v4?`<span><i style="background:var(--red-ink)"></i>RI ou V4 previsto depois do lançamento</span>`:""}<span class="muted">comparação "vs régua atual": régua oficial, só com Due finalizada</span>`);
  if (geo) arrastavel(box, geo, its);
  listaSim(its);
}
// arrastar uma barra para outro mês (ou outro ano)
function arrastavel(box, geo, its){
  const svg = geo.svg, pt = svg.createSVGPoint();
  const local = ev => { pt.x = ev.clientX; pt.y = ev.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const alvo = p => { const k = Math.floor((p.y-geo.top0)/(geo.ch+geo.gap)), m = Math.floor((p.x-geo.lw)/geo.cw); if (k<0 || k>=geo.anos.length || m<0 || m>11) return null; return {Y:geo.anos[k], m, k}; };
  box.querySelectorAll(".rb").forEach(g=>{
    g.addEventListener("pointerdown", ev=>{
      ev.preventDefault(); hideTip();
      const x = its.find(i=>i.k===g.dataset.k), p0 = local(ev); let mov = false, dest = null;
      const sombra = document.createElementNS("http://www.w3.org/2000/svg","rect"); sombra.setAttribute("class","sim-alvo"); sombra.setAttribute("rx","12"); sombra.style.display="none"; svg.insertBefore(sombra, svg.children[1]||null);
      g.parentNode.appendChild(g); g.setPointerCapture(ev.pointerId); g.classList.add("drag");
      const move = e2=>{ const p = local(e2); if (!mov && Math.hypot(p.x-p0.x, p.y-p0.y) < 4) return; mov = true; hideTip();
        g.setAttribute("transform", `translate(${p.x-p0.x},${p.y-p0.y})`); dest = alvo(p);
        if (dest){ sombra.style.display=""; sombra.setAttribute("x", geo.lw+dest.m*geo.cw+3); sombra.setAttribute("y", geo.top0+dest.k*(geo.ch+geo.gap)+3); sombra.setAttribute("width", geo.cw-6); sombra.setAttribute("height", geo.ch-6); }
        else sombra.style.display="none"; };
      const fim = ()=>{ g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", fim); g.removeEventListener("pointercancel", fim); sombra.remove(); g.classList.remove("drag");
        if (!mov){ g.removeAttribute("transform"); if (x.manual) formManual(x.k); return; }
        if (!dest){ renderSim(); return; }
        const nova = `${dest.Y}-${String(dest.m+1).padStart(2,"0")}-15`;
        if (x.manual){ const m = SIM.manuais.find(i=>i.id===x.k); if (m) m.data = nova; }
        else { const orig = x.orig || x.data; if (nova.slice(0,7)===orig.slice(0,7)) delete SIM.datas[x.k]; else SIM.datas[x.k] = nova; }
        salvaSim(); renderSim(); };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", fim); g.addEventListener("pointercancel", fim);
    });
  });
}
function listaSim(its){
  const box = $("simLista"), mov = its.filter(x=>x.orig), man = its.filter(x=>x.manual);
  if (!mov.length && !man.length){ box.innerHTML = "<p class='muted'>Nenhuma alteração ainda. Arraste uma barra para outro mês ou ano, ou adicione um empreendimento.</p>"; return; }
  const alerta = x => [["ri","RI"],["v4","V4"]].filter(([c])=>x[c] && !x[c].ok && x[c].data.slice(0,7)>x.data.slice(0,7)).map(([,r])=>`<span class="dchip down">${r} depois do lançamento</span>`).join(" ");
  box.innerHTML = `<div class="sim-l">${mov.map(x=>`<div class="sim-i"><span class="sim-dot" style="background:${x.cor}"></span><b>${esc(x.nome)}</b><span class="muted">${mesAno(x.orig)} → <b style="color:var(--label)">${mesAno(x.data)}</b></span>${x.orig.slice(0,4)!==x.data.slice(0,4)?`<span class="dchip flat">${nf(x.vgv/1e6,2)} MM saem de ${x.orig.slice(0,4)} para ${x.data.slice(0,4)}</span>`:""}${alerta(x)}<span class="sim-sp"></span><button class="ib" data-rev="${esc(x.k)}" title="voltar para a data da régua atual">↺</button></div>`).join("")}
    ${man.map(x=>`<div class="sim-i"><span class="sim-dot hz" style="background:${x.cor}"></span><b>${esc(x.nome)}</b><span class="muted">${esc(x.inc)} · ${esc(cidCurta(x.cidade))} · ${mesAno(x.data)} · ${nf(x.vgv/1e6,2)} MM${x.uh?` · ${nf(x.uh)} UH`:""}</span><span class="dchip flat">adicionado</span><span class="sim-sp"></span><button class="ib" data-ed="${esc(x.k)}" title="editar">✎</button><button class="ib" data-del="${esc(x.k)}" title="remover">✕</button></div>`).join("")}</div>`;
  box.querySelectorAll("[data-rev]").forEach(b=>b.onclick=()=>{ delete SIM.datas[b.dataset.rev]; salvaSim(); renderSim(); });
  box.querySelectorAll("[data-ed]").forEach(b=>b.onclick=()=>formManual(b.dataset.ed));
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ SIM.manuais = SIM.manuais.filter(m=>m.id!==b.dataset.del); salvaSim(); renderSim(); });
}
function formManual(id){
  const f = $("simForm"), m = id ? SIM.manuais.find(x=>x.id===id) : null, A0 = ANO();
  f.hidden = false;
  f.innerHTML = `<div class="sim-f"><b>${m?"Editar empreendimento simulado":"Adicionar empreendimento à simulação"}</b>
    <label>Nome<input id="mfN" value="${esc(m?.nome||"")}" placeholder="ex.: Terreno Batel"></label>
    <label>Empresa<select id="mfI">${["Make It","Gadens"].map(i=>`<option ${(m?.inc||(S.inc!=="all"?S.inc:"Make It"))===i?"selected":""}>${i}</option>`).join("")}</select></label>
    <label>Cidade<select id="mfC">${CIDADES.map(c=>`<option ${(m?.cidade||"Curitiba")===c.id?"selected":""}>${esc(c.id)}</option>`).join("")}</select></label>
    <label>Lançamento<input id="mfD" type="month" value="${(m?.data||`${A0+1}-06-15`).slice(0,7)}"></label>
    <label>VGV bruto (R$ milhões)<input id="mfV" inputmode="decimal" value="${m?nf(m.vgv/1e6,2):""}" placeholder="ex.: 85,50"></label>
    <label>Unidades<input id="mfU" inputmode="numeric" value="${m?.uh||""}" placeholder="opcional"></label>
    <div class="sim-fa"><button class="pillbtn" id="mfX">Cancelar</button><button class="pillbtn pri" id="mfOk">${m?"Salvar":"Adicionar"}</button></div></div>`;
  $("mfN").focus();
  $("mfX").onclick = ()=>{ f.hidden = true; };
  $("mfOk").onclick = ()=>{
    const nome = $("mfN").value.trim(), v = parseFloat($("mfV").value.replace(/\./g,"").replace(",",".")), d = $("mfD").value;
    if (!nome){ $("mfN").focus(); return; } if (!d){ $("mfD").focus(); return; } if (!(v>0)){ $("mfV").focus(); return; }
    const novo = {id: m?.id || "man-"+Date.now().toString(36), nome, inc:$("mfI").value, cidade:$("mfC").value, data:d+"-15", vgv:v*1e6, uh:parseInt($("mfU").value,10)||0};
    if (m) Object.assign(m, novo); else SIM.manuais.push(novo);
    salvaSim(); f.hidden = true; renderSim(); };
}
function copiaSim(){
  const its = itensSim(), anos = [...new Set(its.map(x=>+x.data.slice(0,4)))].sort();
  const t = ["Simulação da régua de lançamentos ("+dmy(HOJE())+")", ""];
  anos.forEach(Y=>{ const xs = its.filter(x=>+x.data.slice(0,4)===Y); t.push(`${Y}: ${nf(xs.reduce((a,x)=>a+x.vgv,0)/1e6,2)} MM de VGV em ${xs.length} lançamentos`);
    (S.inc==="all"?["Make It","Gadens"]:[S.inc]).forEach(inc=>{ const v = xs.filter(x=>x.inc===inc).reduce((a,x)=>a+x.vgv,0), mt = metaV(Y,inc); t.push(`  ${inc}: ${nf(v/1e6,2)} MM${mt?` (meta ${nf(mt/1e6,0)} MM, ${nf(v/mt*100,0)}%)`:""}`); }); });
  const mov = its.filter(x=>x.orig), man = its.filter(x=>x.manual);
  if (mov.length){ t.push("", "Datas alteradas:"); mov.forEach(x=>t.push(`  ${x.nome}: ${mesAno(x.orig)} → ${mesAno(x.data)}`)); }
  if (man.length){ t.push("", "Adicionados na simulação:"); man.forEach(x=>t.push(`  ${x.nome} (${x.inc}, ${x.cidade}): ${mesAno(x.data)}, ${nf(x.vgv/1e6,2)} MM`)); }
  const txt = t.join("\n"), lb = $("simCopia").querySelector("span");
  const ok = ()=>{ lb.textContent = "Copiado"; setTimeout(()=>{ lb.textContent = "Copiar resumo"; }, 1600); };
  try { navigator.clipboard.writeText(txt).then(ok, ()=>prompt("Copie o resumo:", txt)); } catch(e){ prompt("Copie o resumo:", txt); }
}

/* ---------- Portfólio macro (Gantt) ---------- */
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
  const W = Math.max(720, box.clientWidth||1000), lw = W<820?176:224, iw = W-lw-8, cw = iw/nM, rh = 34, top = 44, H = top + L.length*rh + 8;
  const X = iso => { const d=dIso(iso); return lw + ((d.getFullYear()-ini.getFullYear())*12 + d.getMonth()-ini.getMonth() + (d.getDate()-1)/new Date(d.getFullYear(), d.getMonth()+1, 0).getDate())*cw; };
  let s = `<svg viewBox="0 0 ${W} ${H}" class="gantt">`;
  for (let i=0;i<nM;i++){ const d=new Date(ini.getFullYear(), ini.getMonth()+i, 1), x=lw+i*cw, m=d.getMonth();
    s+=`<line x1="${x}" x2="${x}" y1="${m===0?6:24}" y2="${H-6}" stroke="${m===0?"var(--label-3)":"var(--grid)"}" ${m===0?'stroke-opacity=".55"':""}/>`;
    if (cw>=13 || m%3===0) s+=`<text x="${x+cw/2}" y="38" text-anchor="middle" class="gm">${m+1}</text>`;
    if (m===0 || i===0){ const meses = Math.min(12-m, nM-i); if (meses*cw>34) s+=`<text x="${x+meses*cw/2}" y="17" text-anchor="middle" class="ga">${d.getFullYear()}</text>`; } }
  s+=`<line x1="${lw}" x2="${W-8}" y1="26" y2="26" stroke="var(--grid)"/>`;
  L.forEach((e,r)=>{ const y = top + r*rh, cy = y+rh/2, sg = segmentos(e), x0 = Math.max(lw, X(sg[0].a)), x1 = Math.min(W-8, X(sg[sg.length-1].b)), cort = X(sg[0].a)<lw;
    const cid = cidCurta(e.cidade), wc = Math.min(cid.length*5.6, 84), livre = lw-14-wc-10-24-10;
    s+=`<g class="gr" data-s="${e.sigla}"><rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
    if (r%2===0) s+=`<rect x="4" y="${y+2}" width="${lw-12}" height="${rh-4}" rx="9" fill="var(--fill)" opacity=".55"/>`;
    s+=`<text x="14" y="${cy+4}" class="gc">${esc(cid)}</text><g class="gico" data-x="${lw-14}" data-y="${cy-8}" data-l="${livre}">${icoCo(e.incorporadora, 0, 0, 16)}</g><text x="${lw-14}" y="${cy+5}" text-anchor="end" class="gn">${esc(e.nome)}</text>`;
    s+=`<clipPath id="gc${r}"><rect x="${cort?x0-14:x0}" y="${cy-11}" width="${x1-(cort?x0-14:x0)}" height="22" rx="11"/></clipPath><g clip-path="url(#gc${r})">`;
    sg.forEach(g=>{ const a=Math.max(lw,X(g.a)), b=X(g.b); if (b>a) s+=`<rect x="${a}" y="${cy-11}" width="${b-a+.6}" height="22" fill="${faseCor(g.id)}"/>`; });
    s+=`</g>`;
    const pj = e.marcos.cef003, ct = e.marcos.inc003;
    if (ct && X(ct.data)>lw) s+=`<line x1="${X(ct.data)}" x2="${X(ct.data)}" y1="${cy-14}" y2="${cy+14}" stroke="var(--label)" stroke-width="2" stroke-linecap="round"/>`;
    if (pj && X(pj.data)>lw) { const px=X(pj.data); s+=`<path d="M${px},${cy-9} L${px+9},${cy} L${px},${cy+9} L${px-9},${cy} Z" fill="${PJ_COR}" stroke="#fff" stroke-width="2"/><path d="M${px},${cy-3.5} L${px+3.5},${cy} L${px},${cy+3.5} L${px-3.5},${cy} Z" fill="#fff" opacity="${pj.ok?1:0}"/>`; }
    s+=`</g>`; });
  const xh = X(hoje);
  s+=`<rect x="${lw+Math.floor((xh-lw)/cw)*cw}" y="24" width="${cw}" height="${H-30}" fill="var(--accent)" opacity=".07"/><line x1="${xh}" x2="${xh}" y1="22" y2="${H-6}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3"/><rect x="${xh-19}" y="28" width="38" height="14" rx="7" fill="var(--accent)"/><text x="${xh}" y="38.5" text-anchor="middle" style="font-size:8.5px;font-weight:700;fill:var(--accent-ink)">HOJE</text>`;
  box.innerHTML = s+"</svg>";
  // nome cortado com "…" quando não cabe; ícone da empresa encostado no nome (medido de verdade)
  box.querySelectorAll(".gr").forEach(g=>{ const t = g.querySelector(".gn"), ic = g.querySelector(".gico"), livre = +ic.dataset.l, cheio = t.textContent;
    let txt = cheio; while (t.getComputedTextLength() > livre && txt.length > 3){ txt = txt.slice(0,-1); t.textContent = txt.trimEnd()+"…"; }
    if (t.textContent !== cheio){ const ti = document.createElementNS("http://www.w3.org/2000/svg","title"); ti.textContent = cheio; t.appendChild(ti); }
    ic.setAttribute("transform", `translate(${+ic.dataset.x - t.getComputedTextLength() - 22},${ic.dataset.y})`); });
  box.querySelectorAll(".gr").forEach(g=>{ const e=D.empreendimentos.find(x=>x.sigla===g.dataset.s); bindTip(g, ()=>tipMarcos(e)); g.onclick = ()=>irInd(e.sigla); });
}

/* ---------- Agenda de marcos ---------- */
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
  box.querySelectorAll(".ag-i").forEach(el=>el.onclick=()=>irInd(el.dataset.s));
}

/* ---------- Prontidão para lançamento ---------- */
const PRONT = [["leg009","Alvará"],["leg010","Registro de Incorp."],["orcV4","Orçamento V4"]];
function renderPront(){
  const box = $("pront"); if (!box) return;
  const L = filtrados().filter(e=>!e.legado && lanc(e) && !lanc(e).ok && !negociacao(e)).sort((a,b)=>lanc(a).data.localeCompare(lanc(b).data));
  let risco = 0;
  const cel = (e,c) => { const m = e.marcos[c], l = lanc(e).data;
    if (!m) return `<span class="pr-c none" title="sem esse marco no cronograma">—</span>`;
    if (m.ok) return `<span class="pr-c ok" title="concluído em ${dmy(m.data)}">✓ ${mesAno(m.data)}</span>`;
    const dep = m.data.slice(0,7) > l.slice(0,7); if (dep) risco++;
    return `<span class="pr-c ${dep?"bad":m.data<HOJE()?"late":"pend"}" title="${dep?"previsto para depois do lançamento":m.data<HOJE()?"vencido sem conclusão":"previsto"} · ${dmy(m.data)}">${mesAno(m.data)}</span>`; };
  box.innerHTML = L.length ? `<div class="pr-h"><span>Lançamento previsto</span>${PRONT.map(([,n])=>`<span>${n}</span>`).join("")}</div>${L.map(e=>`<div class="pr-r" data-s="${e.sigla}"><span class="pr-n"><b>${esc(e.nome)}</b><small>${mesAno(lanc(e).data)} · ${esc(cidCurta(e.cidade))}</small></span>${PRONT.map(([c])=>cel(e,c)).join("")}</div>`).join("")}
    <p class="cap" style="margin-top:8px">✓ concluído · data em cinza: previsto antes do lançamento · vermelho: previsto para depois do lançamento ou vencido sem conclusão</p>` : "<p class='muted'>Nenhum lançamento previsto nesta seleção.</p>";
  $("prCap").textContent = L.length ? `os marcos que limitam cada lançamento previsto${risco?` · ${risco} ${risco===1?"previsto":"previstos"} para depois do lançamento`:""}` : "";
  box.querySelectorAll(".pr-r").forEach(el=>el.onclick=()=>irInd(el.dataset.s));
}

/* ---------- Cronograma do empreendimento (linha simplificada) ---------- */
const CHAVE = new Set(["inc001","leg010","orcV4","inc002","cef003","eng001","eng002","mar001","inc003"]);
function renderIndiv(){
  const box = $("indiv"); if (!box) return;
  const L = filtrados().filter(e=>comCrono(e)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  if (!L.length){ box.innerHTML="<p class='muted'>Nenhum empreendimento com cronograma nesta seleção.</p>"; $("indSel").innerHTML=""; return; }
  if (!S.crSel || !L.some(e=>e.sigla===S.crSel)) S.crSel = (L.find(e=>lanc(e)&&!lanc(e).ok) || L[0]).sigla;
  const e = L.find(x=>x.sigla===S.crSel), fi = financ(e), hoje = HOJE();
  $("indSel").innerHTML = `<select id="indSelS">${L.map(x=>`<option value="${x.sigla}" ${x.sigla===e.sigla?"selected":""}>${esc(x.nome)}</option>`).join("")}</select>
    <button class="pillbtn" id="indFicha"><svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>Ficha</button>
    ${e.lista_id?`<a class="pillbtn" href="https://app.clickup.com/9013344143/v/li/${e.lista_id}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>Cronograma no ClickUp</a>`:""}`;
  $("indSelS").onchange = ev=>{ S.crSel = ev.target.value; renderIndiv(); renderTabela(); };
  $("indFicha").onclick = ()=>abreFicha(e);
  const ms = marcosDe(e), sg = segmentos(e), ok = ms.filter(m=>m.ok).length, atr = ms.filter(m=>!m.ok && m.data<hoje), prox = ms.find(m=>!m.ok && m.data>=hoje);
  const st = (k,v,sub) => `<div><span>${k}</span><b>${v}</b><small>${sub}</small></div>`;
  let h = `<div class="fx-st">${st("Fase atual", esc(faseNome(e)), `${esc(e.incorporadora)} · ${esc(e.cidade)}`)}${st("Próximo marco", prox?esc(prox.n):"—", prox?`${dmy(prox.data)} · em ${difDias(hoje,prox.data)} dias`:"sem marcos pendentes")}${st("Marcos concluídos", `${ok} de ${ms.length}`, atr.length?`<span style="color:var(--red-ink)">${atr.length} vencido${atr.length>1?"s":""} sem conclusão</span>`:"nenhum vencido")}${st("Prazo de financiamento", fi?fmtMes(fi.meses):"—", fi?`lançamento ${mesAno(fi.lanc)} → contrato ${mesAno(fi.contrato)}`:"falta Lançamento ou Entrega em Contrato")}</div>`;
  // linha única: fases + marcos; só os principais ganham rótulo, alternando acima e abaixo
  const a = ms[0].data, b = ms[ms.length-1].data, d0 = dIso(a), d1 = dIso(b);
  const ini = new Date(d0.getFullYear(), d0.getMonth(), 1), fim = new Date(d1.getFullYear(), d1.getMonth()+1, 1);
  const W = Math.max(720, box.clientWidth||1000), ml = 16, mr = 16, iw = W-ml-mr, span = fim-ini;
  const X = iso => ml + iw*(dIso(iso)-ini)/span;
  const chave = ms.filter(m=>CHAVE.has(m.c)), lados = [[],[]];
  const pos = chave.map((m,i)=>{ const x = X(m.data), w = Math.max(m.n.length*6, 50)+8, fimD = x+w/2 > W-mr, iniE = x-w/2 < ml; const l = fimD ? x-w : iniE ? x : x-w/2, r = l+w;
    const cabe = (ld,v) => ((lados[ld][v] ?? -1e9) < l-6); let lado = i%2, lv = 0;
    while (!cabe(lado,lv) && !cabe(1-lado,lv)) lv++;
    if (!cabe(lado,lv)) lado = 1-lado;
    lados[lado][lv] = r; return {m, x, lado, lv, an: fimD?"end":iniE?"start":"middle"}; });
  const nUp = Math.max(1, lados[0].length), nDn = Math.max(1, lados[1].length), yb = 26 + nUp*28, H = yb + 18 + nDn*28 + 8;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="indiv">`;
  for (let y=ini.getFullYear(); y<=fim.getFullYear(); y++){ const xi = X(`${y}-01-01`); if (xi>=ml && xi<=W-mr) s+=`<line x1="${xi}" x2="${xi}" y1="4" y2="${H-4}" stroke="var(--grid)"/><text x="${xi+4}" y="14" class="ga">${y}</text>`; }
  if (ini.getMonth()!==0) s+=`<text x="${ml}" y="14" class="ga">${ini.getFullYear()}</text>`;
  s+=`<clipPath id="indc"><rect x="${X(sg[0].a)}" y="${yb-5}" width="${X(sg[sg.length-1].b)-X(sg[0].a)}" height="10" rx="5"/></clipPath><g clip-path="url(#indc)">`;
  sg.forEach(g=>{ s+=`<rect class="isg" data-f="${g.id}" x="${X(g.a)}" y="${yb-5}" width="${X(g.b)-X(g.a)+.6}" height="10" fill="${faseCor(g.id)}"/>`; });
  s+=`</g>`;
  if (hoje>=a && hoje<=b){ const xh=X(hoje); s+=`<line x1="${xh}" x2="${xh}" y1="18" y2="${H-4}" stroke="var(--accent)" stroke-dasharray="3 3" stroke-width="1.4"/><text x="${xh+4}" y="${H-6}" style="font-size:9px;font-weight:700;fill:var(--accent)">hoje</text>`; }
  ms.filter(m=>!CHAVE.has(m.c)).forEach(m=>{ const x=X(m.data); s+=`<g class="im" data-c="${m.c}"><circle cx="${x}" cy="${yb}" r="3" fill="${m.ok?"var(--label)":"var(--card-solid)"}" stroke="var(--label)" stroke-width="1.3"/><rect x="${x-6}" y="${yb-8}" width="12" height="16" fill="transparent"/></g>`; });
  pos.forEach(({m,x,lado,lv,an})=>{ const atrasado = !m.ok && m.data<hoje, cor = m.c==="cef003" ? PJ_COR : atrasado ? "var(--red-ink)" : "var(--label)";
    const yn = lado===0 ? yb-27-lv*28 : yb+22+lv*28, yd = yn+12;
    s+=`<g class="im" data-c="${m.c}"><line x1="${x}" x2="${x}" y1="${lado===0?yd+3:yb+6}" y2="${lado===0?yb-6:yn-10}" stroke="var(--label-3)"/>`;
    s+= m.ok ? `<circle cx="${x}" cy="${yb}" r="5.5" fill="${cor}" stroke="var(--card-solid)" stroke-width="2"/>` : `<circle cx="${x}" cy="${yb}" r="5" fill="var(--card-solid)" stroke="${cor}" stroke-width="2.2"/>`;
    s+=`<text x="${x}" y="${yn}" text-anchor="${an}" style="font-size:10.5px;font-weight:700;fill:${atrasado?"var(--red-ink)":"var(--label)"}">${esc(m.n)}</text><text x="${x}" y="${yd}" text-anchor="${an}" style="font-size:9.5px;fill:var(--label-3)">${mesAno(m.data)}</text></g>`; });
  s += "</svg>";
  h += `<div class="chart">${s}</div><div class="leg" style="margin-top:4px"><span><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--label)"/></svg>concluído</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--label)" stroke-width="1.6"/></svg>previsto</span><span><svg width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--red-ink)" stroke-width="1.6"/></svg>vencido sem conclusão</span><span class="muted">pontos pequenos: demais marcos (passe o mouse)</span></div>`;
  box.innerHTML = h;
  box.querySelectorAll(".im").forEach(g=>{ const m=ms.find(x=>x.c===g.dataset.c); bindTip(g, `<b>${esc(m.n)}</b> · ${m.ok?"concluído":m.data<hoje?"vencido sem conclusão":"previsto"}<div>${dmy(m.data)}${!m.ok?` · ${m.data<hoje?`${difDias(m.data,hoje)} dias de atraso`:`em ${difDias(hoje,m.data)} dias`}`:""}</div>`); });
  box.querySelectorAll(".isg").forEach(r=>{ const g=sg.find(x=>x.id===r.dataset.f); bindTip(r, `<b>${esc(g.nome)}</b><div>${dmy(g.a)} → ${dmy(g.b)} · ${fmtMes(difMeses(g.a,g.b))}</div>${g.est?`<div class="muted">início estimado: sem Fim da Due Diligence no cronograma</div>`:""}`); });
}

/* ---------- Tabela de marcos (estilo Finder) ---------- */
const TB_COLS = [["inc001","Fim da Due"],["nov002","Escritura"],["leg009","Alvará"],["leg010","Registro de Incorp."],["orcV4","Orçamento V4"],["inc002","Lançamento"],["cef003","Contrato PJ"],["eng001","Início de Obra"],["eng002","Término de Obra"],["mar001","Entrega de Chaves"],["inc003","Entrega em Contrato"]];
const icoMini = inc => ICO_CO[inc] ? `<span class="fd-i" style="background:${coCor(inc)}">${ICO_CO[inc]}</span>` : "";
function renderTabela(){
  const box = $("tabela"); if (!box) return;
  const o = S.crOrd || (S.crOrd = {c:"inc002", d:1}), q = (S.crBusca||"").trim().toLowerCase(), hoje = HOJE();
  const L = filtrados().filter(e=>!e.legado && Object.keys(e.marcos).length && (!q || e.nome.toLowerCase().includes(q) || (e.cidade||"").toLowerCase().includes(q)));
  const val = (e,c) => c==="nome" ? e.nome : c==="fase" ? FASES.findIndex(f=>f.id===faseDe(e)) : c==="fin" ? (financ(e)?.meses ?? null) : (e.marcos[c]?.data || null);
  L.sort((a,b)=>{ const x=val(a,o.c), y=val(b,o.c); if (x==null && y==null) return a.nome.localeCompare(b.nome,"pt-BR"); if (x==null) return 1; if (y==null) return -1; return (typeof x==="number" ? x-y : String(x).localeCompare(String(y),"pt-BR"))*o.d || a.nome.localeCompare(b.nome,"pt-BR"); });
  const th = (c,n,cls="") => `<th class="${cls}${o.c===c?" on":""}" data-c="${c}">${n}<i>${o.c===c?(o.d>0?"▲":"▼"):""}</i></th>`;
  const td = (e,c) => { const m = e.marcos[c]; if (!m) return `<td class="d none">—</td>`; const cls = m.ok ? "ok" : m.data<hoje ? "late" : "pend";
    return `<td class="d ${cls}" title="${D.marco_nome[c]||c} · ${m.ok?"concluído":m.data<hoje?"vencido sem conclusão":"previsto"}">${dmyc(m.data)}</td>`; };
  box.innerHTML = `<div class="fd-top"><label class="fd-q"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input id="tbQ" placeholder="Buscar" value="${esc(S.crBusca||"")}"></label><span class="muted">${L.length} empreendimentos · <b style="color:var(--label)">concluído</b> · <span style="color:var(--label-2)">previsto</span> · <span style="color:var(--red-ink)">vencido sem conclusão</span> · clique no título da coluna para ordenar</span></div>
  <div class="fd"><table><thead><tr>${th("nome","Nome","fn")}${th("fase","Fase")}${TB_COLS.map(([c,n])=>th(c,n,"d")).join("")}${th("fin","Prazo financ.","d")}</tr></thead><tbody>${L.map(e=>{ const fi = financ(e);
    return `<tr data-s="${e.sigla}" class="${e.sigla===S.crSel?"sel":""}"><td class="fn"><span class="fd-n">${icoMini(e.incorporadora)}${esc(e.nome)}</span></td><td><span class="fd-f"><i style="background:${faseCor(faseDe(e))}"></i>${esc(faseNome(e))}</span></td>${TB_COLS.map(([c])=>td(e,c)).join("")}<td class="d">${fi?nf(fi.meses,1)+" m":"—"}</td></tr>`; }).join("")}</tbody></table></div>`;
  box.querySelectorAll("th").forEach(t=>t.onclick=()=>{ const c=t.dataset.c; S.crOrd = {c, d: o.c===c ? -o.d : 1}; renderTabela(); });
  box.querySelectorAll("tbody tr").forEach(r=>{ r.onclick=()=>{ S.crSel = r.dataset.s; renderIndiv(); box.querySelectorAll("tbody tr").forEach(x=>x.classList.toggle("sel", x===r)); }; r.ondblclick=()=>irInd(r.dataset.s); });
  const qi = $("tbQ"); qi.oninput = ()=>{ S.crBusca = qi.value; const p = qi.selectionStart; renderTabela(); const n=$("tbQ"); n.focus(); n.setSelectionRange(p,p); };
}

function renderCrono(){
  if (!$("gantt")) return;
  renderRegua(); renderGantt(); renderAgenda(); renderPront(); renderIndiv(); renderTabela();
  $("ganttLeg").innerHTML = CR_FASES.map(f=>`<span><i style="background:${faseCor(f.id)}"></i>${f.nome}</span>`).join("") + `<span><svg width="12" height="12"><path d="M6,0.5 L11.5,6 L6,11.5 L0.5,6 Z" fill="${PJ_COR}"/></svg>Assinatura PJ</span><span><svg width="6" height="14"><line x1="3" x2="3" y1="1" y2="13" stroke="var(--label)" stroke-width="2" stroke-linecap="round"/></svg>Entrega em contrato</span>`;
  if (!$("expSheet").hidden && $("simRegua")) renderSim();
}
