/* =========================================================
   ANÁLISE DE CRONOGRAMAS
   1. Etapas dos cronogramas: números, Etapas em andamento, todas as Etapas, marcos alterados
   2. Registro de desvios: gráficos dos registros, lista de registros e o app de registro
   (dados de registro/dados-*.json, lidos pela rotina diária)
   ========================================================= */
const AN = {arq:{}, carregando:null};
const AN_GR = [
  {k:"run",  t:"Em andamento",            c:"#007AFF"},
  {k:"warn", t:"Deveriam ter iniciado",    c:"#FFB300"},
  {k:"next", t:"Início até a próxima",     c:"var(--accent)"},
  {k:"fut",  t:"Demais em aberto",         c:"#8E8E93"},
  {k:"done", t:"Concluídas",               c:"#34C759"}];
const AN_SIT = [
  {k:"ok",   t:"Em progresso",          c:"#007AFF"},
  {k:"fora", t:"Fora do prazo",          c:"#FF9500"},
  {k:"atr",  t:"Em atraso",              c:"#FF3B30"},
  {k:"warn", t:"Deveriam ter iniciado",  c:"#FFCC00"}];
const AN_COR_CAUSA = {"aguardando projetista/consultor":"#32ADE6","aguardando orgao publico/concessionaria":"#007AFF","aguardando cef/agente financeiro":"#5856D6","pendencia de decisao interna":"#FF9500","dependencia de outra area":"#D46A00","prazo subestimado no planejamento":"#E6B800","falha de comunicacao/alinhamento":"#FF3B30","priorizacao de outras atividades":"#FF2D55","alteracao de escopo/projeto":"#00C7BE","retrabalho/revisao de entregavel":"#34C759","insumo/documentacao incompleta":"#A2845E","ausencia de reporte":"#8E8E93"};
const AN_COR_SETOR = {"inc - legalizacao":"#FF2D55","inc - credito imobiliario":"#AF52DE","inc - arquitetura":"#007AFF","inc - produto":"#30B0C7","inc - gestao de projetos de incorporacao":"#5856D6","inc - novos negocios":"#E6B800","eng - projetos complementares":"#FF6B00","eng - orcamentos":"#A2845E","eng - outros":"#B59B7A","mkt - marketing":"#34C759","csc - juridico":"#C0392B","csc - outros":"#A08A94","externo":"#8E8E93","diretoria":"#636366"};
const AN_COR_ORIG = {"interna controlavel":"#FF9500","externa - terceiro contratado":"#32ADE6","externa - orgao/agente publico":"#5856D6","replanejamento por decisao":"#AF52DE","atraso de predecessora":"#8E8E93"};
const anNorm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").replace(/\s*-\s*/g," - ").trim();
const anDias = (a,b) => (a&&b) ? Math.round((Date.parse(b)-Date.parse(a))/864e5) : null;
const anAdd = (iso,n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.toLocaleDateString("en-CA"); };
const anSeg = iso => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toLocaleDateString("en-CA"); };
const anBr = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(2,4) : "—";
const anSig = n => n==null ? "—" : (n>0?"+":n<0?"−":"")+Math.abs(n)+" d";
const anSetorCurto = n => (n||"").replace(/^(INC|ENG|MKT|CSC)\s*-\s*/i,"");
const anFila = () => { try { const j = JSON.parse(localStorage.getItem("rd-fila")||"[]"); return Array.isArray(j)?j:[]; } catch(e){ return []; } };
const anEmpBase = s => (s||"").replace(/\s*\(.*?\)\s*/g," ").replace(/\s+/g," ").trim();
const filtrosAtivos = () => !!(S.cidades?.size || S.fases?.size || S.linhas?.size || S.anos?.size || S.ativos);

function anCarrega(){
  if (AN.carregando) return AN.carregando;
  const t = Math.floor(Date.now()/60000);
  AN.carregando = Promise.all(["makeit","gadens"].map(k=>fetch(`registro/dados-${k}.json?t=${t}`).then(r=>r.ok?r.json():null).catch(()=>null)))
    .then(([m,g])=>{ AN.arq = {makeit:m, gadens:g}; return AN.arq; });
  return AN.carregando;
}
function anDados(){
  const hoje = HOJE(), seg = anSeg(hoje), fim = anAdd(seg,6), fila = anFila();
  const cos = S.inc==="all" ? ["makeit","gadens"] : [S.inc==="Gadens"?"gadens":"makeit"];
  const ok = new Set(filtrados().map(e=>e.sigla)), filtroAtivo = filtrosAtivos();
  const etapas = [], regs = [];
  cos.forEach(k=>{ const f = AN.arq[k]; if (!f) return;
    const inc = k==="gadens" ? "Gadens" : "Make It";
    const ondeEt = {}; (f.listas||[]).forEach(l=>l.etapas.forEach(e=>ondeEt[e.id]={l, e}));
    const ajusta = r => { const x = ondeEt[(r.t||[])[0]];
      return {...r, co:k, inc, sigla:x?.l.sigla, emp: x ? x.l.short : anEmpBase(r.emp), etapa: x ? (x.e.name||"").split("|").pop().trim() : (r.nome||""),
        delta:anDias(r.pre,r.pos), novo:!!r.causa, url:r.fila?null:"https://app.clickup.com/t/"+r.id}; };
    const doArq = (f.registros||[]).map(ajusta);
    const pend = fila.filter(x=>x.co===k).map(x=>ajusta({id:"fila-"+x.rid, t:[x.etapa], nome:x.nome, emp:x.emp, ...x.resumo, fila:true, autor:x.autor}));
    const todos = doArq.concat(pend).filter(r=>r.sigla ? ok.has(r.sigla) : !filtroAtivo);
    regs.push(...todos);
    const porEtapa = {}; todos.forEach(r=>(r.t||[]).forEach(id=>(porEtapa[id]=porEtapa[id]||[]).push(r)));
    (f.listas||[]).forEach(l=>{
      if (l.sigla && !ok.has(l.sigla)) return;
      if (!l.sigla && filtroAtivo) return;
      l.etapas.forEach(e=>{
        const rs = (porEtapa[e.id]||[]).sort((a,b)=>(b.semana||"").localeCompare(a.semana||""));
        const done = e.stType==="done" || e.stType==="closed";
        const g = done ? "done" : e.stType!=="open" ? "run" : (e.start && e.start<=hoje) ? "warn" : (e.start && e.start<=anAdd(hoje,7)) ? "next" : "fut";
        const st = anNorm(e.status), sit = g==="warn" ? "warn" : /atraso/.test(st) ? "atr" : (/fora do prazo/.test(st) || (e.pos && e.pos<hoje)) ? "fora" : "ok";
        const dSem = anDias(e.pre, e.pos), regSem = rs.filter(r=>r.semana>=seg && r.semana<=fim).length;
        etapas.push({...e, co:k, inc, emp:l.short, lista:l.id, tipo:l.tipo, sigla:l.sigla, short:(e.name||"").split("|").pop().trim(),
          g, sit, dSem, dLb:anDias(e.lb,e.pos), dur:anDias(e.start,e.pos), regs:rs, regSem,
          atras: !done && (/atraso/.test(st) || (e.pos && e.pos<hoje)),
          moved: dSem>0, needs: dSem>0 && (g==="run"||g==="done") && !regSem});
      });
    });
  });
  return {etapas, regs, seg, fim, hoje, cos};
}

function renderAnalise(){
  if (!$("anEtapas")) return;
  if (!AN.arq.makeit && !AN.arq.gadens){
    $("anEtapas").innerHTML = "<p class='muted'>Carregando as Etapas dos cronogramas…</p>";
    anCarrega().then(()=>{ if (paginaAtual==="analise") renderAnalise(); });
    return;
  }
  const d = anDados();
  anKpis(d); anEmAndamento(d); anTabela(d); anRegistros(d);
  $("regAbre").onclick = abreRegistro;
}
const anK = (rot,v,sub,cls="") => `<div class="an-k ${cls}"><span>${rot}</span><b>${v}</b><small>${sub}</small></div>`;
function anKpis(d){
  const ab = d.etapas.filter(e=>e.g!=="done"), mov = d.etapas.filter(e=>e.moved && e.g!=="done"), nReg = d.etapas.filter(e=>e.needs).length;
  $("anKpis").innerHTML =
      anK("Deslocadas na semana", nf(mov.length), `${nf(mov.reduce((a,e)=>a+e.dSem,0))} dias somados, frente à semana passada`)
    + anK("Em andamento", nf(d.etapas.filter(e=>e.g==="run").length), `${nf(d.etapas.filter(e=>e.g==="run"&&e.sit!=="ok").length)} fora do prazo ou em atraso`)
    + anK("Em atraso", nf(ab.filter(e=>e.atras).length), "status em atraso ou término já vencido", ab.some(e=>e.atras)?"warn":"")
    + anK("Deveriam ter iniciado", nf(d.etapas.filter(e=>e.g==="warn").length), "início previsto já passou e a Etapa segue em aberto");
  const ats = d.cos.map(c=>AN.arq[c]?.at).filter(Boolean).sort();
  $("anFonte").textContent = `${nf(d.etapas.length)} Etapas em ${new Set(d.etapas.map(e=>e.lista)).size} cronogramas · semana de ${anBr(d.seg)} a ${anBr(d.fim)} · lido do ClickUp em ${ats.length?dmy(ats[0].slice(0,10))+" às "+ats[0].slice(11,16):"—"}`;
}
function anBarras(rows, cor, un){
  if (!rows.length) return "<p class='muted'>Sem dados nesta seleção.</p>";
  const max = Math.max(...rows.map(r=>r.v),1);
  return `<div class="an-hb">${rows.map(r=>`<div class="an-hr" data-tip="${esc(r.tip||"")}"><span class="nm">${r.ico||""}${esc(r.rot)}</span><span class="tr"><i style="width:${Math.max(2,r.v/max*100)}%;background:${typeof cor==="function"?cor(r.k):cor}"></i></span><span class="v">${nf(r.v)}${un?` <small>${un}</small>`:""}</span></div>`).join("")}</div>`;
}
function anPilha(rows, cats){
  if (!rows.length) return "<p class='muted'>Nenhuma Etapa em andamento nesta seleção.</p>";
  const max = Math.max(...rows.map(r=>r.tot),1);
  return `<div class="an-hb">${rows.map(r=>`<div class="an-hr" data-tip="${esc(r.rot+": "+cats.filter(c=>r[c.k]).map(c=>r[c.k]+" "+c.t.toLowerCase()).join(", "))}"><span class="nm">${r.ico||""}${esc(r.rot)}</span><span class="tr"><span class="pl" style="width:${r.tot/max*100}%">${cats.map(c=>r[c.k]?`<b style="flex:${r[c.k]};background:${c.c}"></b>`:"").join("")}</span></span><span class="v">${nf(r.tot)}</span></div>`).join("")}</div>`;
}
function anEmAndamento(d){
  const at = d.etapas.filter(e=>e.g==="run"||e.g==="warn");
  const agrupa = fn => { const m = {}; at.forEach(e=>fn(e).forEach(k=>{ const x = m[k] = m[k]||{rot:k, tot:0, ok:0, fora:0, atr:0, warn:0, inc:e.inc}; x.tot++; x[e.sit]++; })); return Object.values(m).sort((a,b)=>b.tot-a.tot||(b.atr+b.fora)-(a.atr+a.fora)); };
  $("anE1").innerHTML = anPilha(agrupa(e=>[e.emp]).slice(0,12).map(r=>({...r, ico:icoSe(r.inc)})), AN_SIT);
  $("anE2").innerHTML = anPilha(agrupa(e=>(e.tags&&e.tags.length?e.tags:["sem setor"]).map(t=>anSetorCurto(t[0].toUpperCase()+t.slice(1)))).slice(0,12), AN_SIT);
  const run = d.etapas.filter(e=>e.g==="run" && e.pos);
  const fx = [["Vencidas",x=>x<0,"#FF3B30"],["Até 7 dias",x=>x>=0&&x<=7,"#FF9500"],["8 a 30 dias",x=>x>7&&x<=30,"#FFCC00"],["31 a 90 dias",x=>x>30&&x<=90,"#34C759"],["Mais de 90",x=>x>90,"#8E8E93"]];
  const cont = fx.map(([t,f,c])=>({t, c, n:run.filter(e=>f(anDias(d.hoje,e.pos))).length})), mx = Math.max(...cont.map(x=>x.n),1);
  $("anE3").innerHTML = `<div class="an-col">${cont.map(x=>`<div class="c" data-tip="${x.n} Etapa(s) em andamento · ${x.t.toLowerCase()}"><b>${x.n}</b><span class="bx"><i style="height:${Math.max(3,x.n/mx*100)}%;background:${x.c}"></i></span><span class="lb">${x.t}</span></div>`).join("")}</div>`;
  $("anLegE").innerHTML = AN_SIT.map(c=>`<span><i style="background:${c.c}"></i>${c.t}</span>`).join("");
}
function anTabela(d){
  const F = S.an || (S.an = {grupos:new Set(["run","warn","next"]), so:false, emp:"", setor:"", q:"", ord:{c:"pos", d:1}});
  const emps = [...new Set(d.etapas.map(e=>e.emp))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const setores = [...new Set(d.etapas.flatMap(e=>e.tags||[]))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const q = anNorm(F.q);
  const L = d.etapas.filter(e=>F.grupos.has(e.g) && (!F.so || e.moved) && (!F.emp || e.emp===F.emp) && (!F.setor || (e.tags||[]).includes(F.setor)) && (!q || anNorm(e.short+" "+e.emp).includes(q)));
  const val = (e,c) => ({emp:e.emp, nome:e.short, status:e.status, start:e.start, pos:e.pos, dur:e.dur, dSem:e.dSem, dLb:e.dLb, lb:e.lb, regs:e.regs.length})[c];
  L.sort((a,b)=>{ const x=val(a,F.ord.c), y=val(b,F.ord.c); if (x==null && y==null) return 0; if (x==null) return 1; if (y==null) return -1; return (typeof x==="number" ? x-y : String(x).localeCompare(String(y),"pt-BR"))*F.ord.d || a.emp.localeCompare(b.emp,"pt-BR"); });
  const cont = k => d.etapas.filter(e=>e.g===k).length;
  const th = (c,n,cls="") => `<th class="${cls}${F.ord.c===c?" on":""}" data-c="${c}">${n}<i>${F.ord.c===c?(F.ord.d>0?"▲":"▼"):""}</i></th>`;
  const dl = (n, mute) => n==null ? `<span class="an-dl mute">—</span>` : `<span class="an-dl ${n>0?"late":n<0?"ok":"mute"}${mute&&n<=0?" mute":""}">${anSig(n)}</span>`;
  const MAX = 600, vis = L.slice(0, MAX);
  $("anEtapas").innerHTML = `<div class="an-f">
      <div class="an-chips">${AN_GR.map(g=>`<button class="an-chip${F.grupos.has(g.k)?" on":""}" data-g="${g.k}" style="--c:${g.c}"><i></i>${g.t}<b>${cont(g.k)}</b></button>`).join("")}</div>
      <div class="an-ctl"><label class="fd-q"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input id="anQ" placeholder="Buscar Etapa ou empreendimento" value="${esc(F.q)}"></label>
        <select id="anEmp" class="an-sel"><option value="">Todos os empreendimentos</option>${emps.map(x=>`<option ${F.emp===x?"selected":""}>${esc(x)}</option>`).join("")}</select>
        <select id="anSet" class="an-sel"><option value="">Todos os setores</option>${setores.map(x=>`<option ${F.setor===x?"selected":""}>${esc(x)}</option>`).join("")}</select>
        <label class="an-tg"><input type="checkbox" id="anSo" ${F.so?"checked":""}><span></span>Só deslocadas na semana</label></div></div>
    <div class="fd an-fd"><table><thead><tr>${th("emp","Empreendimento","fn")}${th("nome","Etapa")}<th>Setor</th>${th("status","Status")}${th("start","Início","d")}${th("pos","Término","d")}${th("dur","Duração","d")}${th("dSem","Δ semana","d")}${th("dLb","Δ LB","d")}${th("lb","LB","d")}${th("regs","Registros","d")}<th></th></tr></thead><tbody>
    ${vis.map(e=>{ const r = e.regs[0];
      return `<tr class="${e.needs?"need":""}"><td class="fn"><span class="fd-n">${e.needs?`<i class="an-flag" title="precisa de registro de desvio nesta semana"></i>`:e.regSem?`<i class="an-flag ok" title="registrado nesta semana"></i>`:`<i class="an-flag none"></i>`}${icoSe(e.inc)}${esc(e.emp)}</span></td>
        <td class="an-nm" title="${esc(e.name)}${e.assignees?.length?"\nResponsáveis: "+esc(e.assignees.join(", ")):""}">${esc(e.short)}</td>
        <td class="an-tag">${esc((e.tags||[]).map(anSetorCurto).join(", ")||"—")}</td>
        <td><span class="an-st"><i style="background:${e.stColor||"#8E8E93"}"></i>${esc(e.status||"")}</span></td>
        <td class="d">${anBr(e.start)}</td><td class="d${e.pos&&e.pos<d.hoje&&e.g!=="done"?" late":""}">${anBr(e.pos)}</td><td class="d">${e.dur!=null?e.dur+" d":"—"}</td>
        <td class="d" title="${e.pre?"Semana passada: "+anBr(e.pre)+(e.preSrc?" ("+e.preSrc+")":""):"sem referência da semana passada"}">${e.pre?dl(e.dSem, e.g==="done"):`<span class="an-dl mute">—</span>`}</td>
        <td class="d">${dl(e.dLb, e.g==="done")}</td><td class="d">${anBr(e.lb)}</td>
        <td class="d an-rg" data-k="${e.id}">${e.regs.length?`${e.regs.length}${r?.causa?` <span style="color:${AN_COR_CAUSA[anNorm(r.causa)]||"inherit"}">●</span>`:""}`:"—"}</td>
        <td class="d"><a class="an-lk" href="${esc(e.url||"https://app.clickup.com/t/"+e.id)}" target="_blank" rel="noopener" title="Abrir a Etapa no ClickUp">↗</a></td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="cap" style="margin-top:8px">${nf(L.length)} Etapas${L.length>MAX?` · mostrando as ${MAX} primeiras; use a busca ou os filtros`:""} · <span style="color:var(--red-ink,#D70015)">●</span> precisa de registro nesta semana · <span style="color:#1E9E48">●</span> já registrado · passe o mouse em Registros para ver o histórico</p>`;
  const R = () => anTabela(anDados());
  $("anEtapas").querySelectorAll(".an-chip").forEach(b=>b.onclick=()=>{ const g=b.dataset.g; F.grupos.has(g)?F.grupos.delete(g):F.grupos.add(g); R(); });
  $("anEtapas").querySelectorAll("th[data-c]").forEach(t=>t.onclick=()=>{ const c=t.dataset.c; F.ord = {c, d: F.ord.c===c ? -F.ord.d : 1}; R(); });
  $("anEmp").onchange = ev=>{ F.emp = ev.target.value; R(); };
  $("anSet").onchange = ev=>{ F.setor = ev.target.value; R(); };
  $("anSo").onchange = ev=>{ F.so = ev.target.checked; R(); };
  const qi = $("anQ"); qi.oninput = ()=>{ F.q = qi.value; const p = qi.selectionStart; R(); const n = $("anQ"); n.focus(); n.setSelectionRange(p,p); };
  $("anEtapas").querySelectorAll(".an-rg").forEach(td=>{ const e = vis.find(x=>x.id===td.dataset.k); if (!e || !e.regs.length) return;
    bindTip(td, `<b>${esc(e.short)}</b> · ${esc(e.emp)}<table>${e.regs.slice(0,8).map(r=>`<tr><td>${anBr(r.semana)}${r.fila?" · a enviar":""}</td><td class="n">${anSig(r.delta)}</td><td>${esc(r.causa||r.tipo||r.motivo||"—")}${r.setor?` · <span class="muted">${esc(anSetorCurto(r.setor))}</span>`:""}</td></tr>`).join("")}</table>${e.regs.length>8?`<div class="muted">+${e.regs.length-8} registros anteriores</div>`:""}`); });
}

/* ---------- Registro de desvios ---------- */
function anRegistros(d){
  const antigos = !!S.anAntigos, ini = d.regs.filter(r=>r.novo).map(r=>r.semana).filter(Boolean).sort()[0];
  const R = d.regs.filter(r=>antigos || r.novo), semana = R.filter(r=>r.semana>=d.seg && r.semana<=d.fim), fila = anFila();
  const aReg = d.etapas.filter(e=>e.needs), dias = rs => rs.reduce((a,r)=>a+Math.max(0,r.delta||0),0);
  $("anAntigos").checked = antigos;
  $("anAntigos").onchange = ev=>{ S.anAntigos = ev.target.checked; anRegistros(anDados()); };
  $("anRegInfo").innerHTML = `${antigos?`Todos os registros, incluindo os anteriores ao formato com causa`:`Registros no formato com causa e setor${ini?`, desde ${anBr(ini)}`:""}`}${aReg.length?` · <b class="red">${aReg.length} ${aReg.length===1?"Etapa precisa":"Etapas precisam"} de registro nesta semana</b>`:""}${fila.length?` · <span class="red">${fila.length} guardado${fila.length>1?"s":""} neste navegador aguardando envio</span>`:""}`;
  const comOrig = R.filter(r=>r.origem), interna = comOrig.filter(r=>anNorm(r.origem).startsWith("interna")).length;
  const porEt = {}; R.forEach(r=>{ const k = (r.t&&r.t[0]) || (r.emp+"|"+r.etapa); (porEt[k]=porEt[k]||[]).push(r); });
  const reinc = Object.values(porEt).filter(x=>x.length>=3);
  $("anRKpis").innerHTML = anK("A registrar", nf(aReg.length), "Etapas ativas cujo término avançou e ainda sem registro na semana", aReg.length?"alert":"")
    + anK("Registros na semana", nf(semana.length), `${nf(dias(semana))} dias deslocados`)
    + anK("Registros no período", nf(R.length), `${nf(dias(R))} dias deslocados`)
    + anK("Origem interna", comOrig.length ? nf(Math.round(interna/comOrig.length*100))+"%" : "—", `entre ${nf(comOrig.length)} registros com origem preenchida`)
    + anK("Etapas reincidentes", nf(reinc.length), "três registros ou mais no período", reinc.length?"warn":"");
  // semanas
  const nSem = antigos || !ini ? 16 : Math.min(16, Math.max(8, Math.round(anDias(anSeg(ini), d.seg)/7)+3)), semanas = []; for (let k=nSem-1;k>=0;k--) semanas.push(anAdd(d.seg,-7*k));
  const ag = semanas.map(w=>{ const rs = R.filter(r=>r.semana && anSeg(r.semana)===w); return {w, n:rs.length, d:dias(rs), int:dias(rs.filter(r=>r.origem&&anNorm(r.origem).startsWith("interna"))), ext:dias(rs.filter(r=>r.origem&&anNorm(r.origem).startsWith("externa")))}; });
  const mw = Math.max(...ag.map(x=>x.d),1);
  $("anWkC").textContent = `últimas ${nSem} semanas · origem interna em laranja, externa em azul, demais em cinza`;
  $("anWk").innerHTML = `<div class="an-wk">${ag.map(x=>{ const out = x.d-x.int-x.ext; return `<div class="c${x.w===d.seg?" cur":""}" data-tip="${esc(`Semana de ${anBr(x.w)}: ${x.n} registro(s), ${x.d} dias${x.int?` · interna ${x.int}`:""}${x.ext?` · externa ${x.ext}`:""}`)}"><b>${x.d||""}</b><span class="bx"><span class="bar" style="height:${x.d/mw*100}%">${x.ext?`<i style="flex:${x.ext};background:#32ADE6"></i>`:""}${x.int?`<i style="flex:${x.int};background:#FF9500"></i>`:""}${out>0?`<i style="flex:${out};background:#AEAEB2"></i>`:""}</span></span><small>${x.w.slice(8,10)}/${x.w.slice(5,7)}</small></div>`; }).join("")}</div>`;
  // composições
  const agg = (rs, fn) => { const m = {}; rs.forEach(r=>{ const k = fn(r); if (!k) return; const x = m[k] = m[k]||{k, rot:k, v:0, n:0, inc:r.inc}; x.v += Math.max(0, r.delta||0); x.n++; }); return Object.values(m).sort((a,b)=>b.v-a.v||b.n-a.n); };
  const tipN = r => `${r.k}: ${r.n} registro(s), ${r.v} dias`;
  $("anR1").innerHTML = R.some(r=>r.causa) ? anBarras(agg(R, r=>r.causa).map(r=>({...r, tip:tipN(r)})), k=>AN_COR_CAUSA[anNorm(k)]||"#8E8E93", "d") : "<p class='muted'>Sem registros com causa no período.</p>";
  $("anR2").innerHTML = anBarras(agg(R, r=>r.setor).map(r=>({...r, rot:anSetorCurto(r.k), tip:tipN(r)})), k=>AN_COR_SETOR[anNorm(k)]||"#8E8E93", "d");
  $("anR3").innerHTML = anBarras(agg(R, r=>r.emp).slice(0,12).map(r=>({...r, ico:icoSe(r.inc), tip:tipN(r)})), "var(--accent)", "d");
  $("anR4").innerHTML = R.some(r=>r.origem||r.tipo) ? anBarras([...agg(R, r=>r.origem), ...agg(R.filter(r=>r.tipo && anNorm(r.tipo)!=="atraso"), r=>r.tipo)].map(r=>({...r, tip:tipN(r)})), k=>AN_COR_ORIG[anNorm(k)]||"#AF52DE", "d") : "<p class='muted'>Sem registros no formato novo no período.</p>";
  const pj = agg(R, r=>r.proj).slice(0,10); $("anR5c").hidden = !pj.length;
  $("anR5").innerHTML = anBarras(pj.map(r=>({...r, tip:tipN(r)})), "#32ADE6", "d");
  $("anR6").innerHTML = reinc.length ? anBarras(reinc.map(x=>({k:x[0].etapa, rot:`${x[0].emp} · ${x[0].etapa}`, v:x.length, ico:icoSe(x[0].inc), tip:`${x[0].etapa} (${x[0].emp}): ${x.length} registros, ${dias(x)} dias`})).sort((a,b)=>b.v-a.v).slice(0,10), "#FF3B30", "reg.") : "<p class='muted'>Nenhuma Etapa com três registros ou mais no período.</p>";
  anLista(R);
}
function anLista(R){
  const F = S.anR || (S.anR = {q:"", emp:"", causa:"", setor:"", ord:{c:"semana", d:-1}});
  const q = anNorm(F.q), cz = r => r.causa || (r.tipo && anNorm(r.tipo)!=="atraso" ? r.tipo : r.motivo);
  const L = R.filter(r=>(!F.emp || r.emp===F.emp) && (!F.causa || cz(r)===F.causa) && (!F.setor || r.setor===F.setor) && (!q || anNorm([r.emp,r.etapa,r.desc,r.proj,cz(r)].join(" ")).includes(q)));
  const val = (r,c) => ({semana:r.semana, emp:r.emp, etapa:r.etapa, delta:r.delta, causa:cz(r), setor:r.setor, origem:r.origem, proj:r.proj})[c];
  L.sort((a,b)=>{ const x=val(a,F.ord.c), y=val(b,F.ord.c); if (x==null && y==null) return 0; if (x==null) return 1; if (y==null) return -1; return (typeof x==="number" ? x-y : String(x).localeCompare(String(y),"pt-BR"))*F.ord.d || (b.semana||"").localeCompare(a.semana||""); });
  const opts = fn => [...new Set(R.map(fn).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const th = (c,n,cls="") => `<th class="${cls}${F.ord.c===c?" on":""}" data-c="${c}">${n}<i>${F.ord.c===c?(F.ord.d>0?"▲":"▼"):""}</i></th>`;
  const MAX = 400, vis = L.slice(0, MAX);
  $("anRlC").textContent = `${nf(L.length)} registros${L.length>MAX?` · mostrando os ${MAX} primeiros`:""} · clique no título da coluna para ordenar`;
  $("anRl").innerHTML = `<div class="an-ctl" style="margin-bottom:10px"><label class="fd-q"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input id="anRQ" placeholder="Buscar em Etapa, descrição, projetista" value="${esc(F.q)}"></label>
      <select id="anREmp" class="an-sel"><option value="">Todos os empreendimentos</option>${opts(r=>r.emp).map(x=>`<option ${F.emp===x?"selected":""}>${esc(x)}</option>`).join("")}</select>
      <select id="anRCau" class="an-sel"><option value="">Todas as causas</option>${opts(cz).map(x=>`<option ${F.causa===x?"selected":""}>${esc(x)}</option>`).join("")}</select>
      <select id="anRSet" class="an-sel"><option value="">Todos os setores</option>${opts(r=>r.setor).map(x=>`<option ${F.setor===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
    <div class="fd an-fd"><table><thead><tr>${th("emp","Empreendimento","fn")}${th("semana","Semana","d")}${th("etapa","Etapa")}${th("delta","Δ","d")}${th("causa","Causa")}${th("setor","Setor")}${th("origem","Origem")}${th("proj","Projetista")}<th>Descrição</th><th></th></tr></thead><tbody>
    ${vis.length ? vis.map(r=>`<tr${r.fila?' class="fila"':""}><td class="fn"><span class="fd-n">${icoSe(r.inc)}${esc(r.emp)}</span></td><td class="d">${anBr(r.semana)}</td><td class="an-nm" title="${esc(r.etapa)}">${esc(r.etapa)}</td>
      <td class="d"><span class="an-dl ${r.delta>0?"late":r.delta<0?"ok":"mute"}">${anSig(r.delta)}</span></td>
      <td>${r.causa?`<span class="an-st"><i style="background:${AN_COR_CAUSA[anNorm(r.causa)]||"#8E8E93"}"></i>${esc(r.causa)}</span>`:`<span class="muted">${esc(cz(r)||"—")}</span>`}</td>
      <td>${r.setor?`<span class="an-st"><i style="background:${AN_COR_SETOR[anNorm(r.setor)]||"#8E8E93"}"></i>${esc(anSetorCurto(r.setor))}</span>`:"—"}</td>
      <td class="an-tag">${esc(r.origem||"—")}</td><td class="an-tag">${esc(r.proj||"—")}</td>
      <td class="an-ds" title="${esc(r.desc||"")}">${esc(r.desc||"")}</td>
      <td class="d">${r.fila?`<span class="an-pend" title="guardado neste navegador, ainda não enviado ao ClickUp">a enviar</span>`:`<a class="an-lk" href="${esc(r.url)}" target="_blank" rel="noopener" title="Abrir o registro no ClickUp">↗</a>`}</td></tr>`).join("") : `<tr><td colspan="10" class="muted" style="text-align:center;padding:18px">Nenhum registro nesta seleção.</td></tr>`}
    </tbody></table></div>`;
  const RR = () => anLista(R);
  $("anRl").querySelectorAll("th[data-c]").forEach(t=>t.onclick=()=>{ const c=t.dataset.c; F.ord = {c, d: F.ord.c===c ? -F.ord.d : (c==="semana"||c==="delta"?-1:1)}; RR(); });
  $("anREmp").onchange = ev=>{ F.emp = ev.target.value; RR(); };
  $("anRCau").onchange = ev=>{ F.causa = ev.target.value; RR(); };
  $("anRSet").onchange = ev=>{ F.setor = ev.target.value; RR(); };
  const qi = $("anRQ"); qi.oninput = ()=>{ F.q = qi.value; const p = qi.selectionStart; RR(); const n = $("anRQ"); n.focus(); n.setSelectionRange(p,p); };
}
function abreRegistro(){
  const co = S.inc==="Gadens" ? "gadens" : "makeit";
  let ov = $("regOv");
  if (!ov){
    ov = document.createElement("div"); ov.id = "regOv"; ov.className = "reg-ov";
    ov.innerHTML = `<div class="reg-bar"><button class="pillbtn" id="regFecha"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>Voltar ao dashboard</button><span style="flex:1"></span><a class="pillbtn" id="regNova" target="_blank" rel="noopener">Abrir em outra aba ↗</a></div><iframe id="regIf" title="Registro de Desvios"></iframe>`;
    document.body.appendChild(ov);
    $("regFecha").onclick = fechaRegistro;
    addEventListener("keydown", ev=>{ if (ev.key==="Escape" && $("regOv") && !$("regOv").hidden) fechaRegistro(); });
  }
  const url = `registro.html?co=${co}`;
  $("regNova").href = url;
  if (!($("regIf").getAttribute("src")||"").endsWith(url)) $("regIf").src = url;
  ov.hidden = false; document.documentElement.classList.add("no-scroll");
}
function fechaRegistro(){ const ov = $("regOv"); if (!ov) return; ov.hidden = true; document.documentElement.classList.remove("no-scroll"); if (paginaAtual==="analise") renderAnalise(); }
