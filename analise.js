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
const filtrosAtivos = () => !!(S.emps?.size || S.cidades?.size || S.fases?.size || S.linhas?.size || S.anos?.size || S.ativos);

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
    const ondeEt = {}, subN = {}; (f.listas||[]).forEach(l=>l.etapas.forEach(e=>{ ondeEt[e.id]={l, e}; (e.subs||[]).forEach(x=>subN[x.id]=x.n); }));
    const ajusta = r => { const x = ondeEt[(r.t||[])[0]];
      return {...r, co:k, inc, sigla:x?.l.sigla, emp: x ? x.l.short : anEmpBase(r.emp), etapa: x ? (x.e.name||"").split("|").pop().trim() : (r.nome||""),
        delta:anDias(r.pre,r.pos), novo:!!r.causa, subsN:(r.subs||[]).map(x=>typeof x==="string"?(subN[x]||null):x.n).filter(Boolean), url:r.fila?null:"https://app.clickup.com/t/"+r.id}; };
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

/* ---------- Registro de desvios (no padrão do relatório mensal do comitê) ---------- */
const AN_ORIG = [
  {k:"int",  t:"Interna controlável",              c:"#FF9100"},
  {k:"ter",  t:"Externa – terceiro contratado",     c:"#2B4380"},
  {k:"org",  t:"Externa – órgão/agente público",    c:"#1F95D3"},
  {k:"sem",  t:"Sem classificação",                c:"#C7C7CC"}];
const AN_OC = Object.fromEntries(AN_ORIG.map(o=>[o.k,o]));
const anOK = r => { const o = anNorm(r.origem); return o.startsWith("interna") ? "int" : o.includes("terceiro") ? "ter" : (o.includes("orgao")||o.includes("publico")) ? "org" : "sem"; };
const anCausa = r => r.causa || (r.tipo && anNorm(r.tipo)!=="atraso" ? r.tipo+" (sem causa)" : r.motivo) || "Sem causa";
const anPct = (n,t) => t ? Math.round(n/t*100) : 0;
// barra empilhada por origem (contagem), com rótulos dentro quando cabem
function anOBar(cont, max, rot=false){
  const tot = AN_ORIG.reduce((a,o)=>a+(cont[o.k]||0),0);
  return `<span class="an-ob" style="width:${max?tot/max*100:100}%">${AN_ORIG.filter(o=>cont[o.k]).map(o=>`<b style="flex:${cont[o.k]};background:${o.c}" data-tip="${esc(`${o.t}: ${cont[o.k]} registro(s) · ${anPct(cont[o.k],tot)}%`)}">${rot&&cont[o.k]/tot>=.06?`<em>${cont[o.k]} · ${anPct(cont[o.k],tot)}%</em>`:""}</b>`).join("")}</span>`;
}
const anConta = rs => { const c = {int:0,ter:0,org:0,sem:0}; rs.forEach(r=>c[anOK(r)]++); return c; };

function anRegistros(d){
  const antigos = !!S.anAntigos, ini = d.regs.filter(r=>r.causa).map(r=>r.semana).filter(Boolean).sort()[0];
  const R = d.regs.filter(r=>antigos || r.causa || (ini && r.semana>=ini)), semana = R.filter(r=>r.semana>=d.seg && r.semana<=d.fim), fila = anFila();
  const aReg = d.etapas.filter(e=>e.needs), dias = rs => rs.reduce((a,r)=>a+Math.max(0,r.delta||0),0);
  const reunioes = [...new Set(R.map(r=>r.semana).filter(Boolean))].sort();
  $("anAntigos").checked = antigos;
  $("anAntigos").onchange = ev=>{ S.anAntigos = ev.target.checked; anRegistros(anDados()); };
  $("anRegInfo").innerHTML = `${antigos?`Todos os registros, incluindo os anteriores ao formulário com causa`:`Registros do formulário com causa e origem${ini?`, desde a reunião de ${anBr(ini)}`:""}`}${fila.length?` · <span class="red">${fila.length} guardado${fila.length>1?"s":""} neste navegador aguardando envio</span>`:""}`;
  document.querySelectorAll(".an-oleg").forEach(l=>l.innerHTML = AN_ORIG.map(o=>`<span><i style="background:${o.c}"></i>${o.t.replace("Externa – ","")}</span>`).join(""));
  // números
  const cR = anConta(R);
  const porEt = {}; R.forEach(r=>{ const k = (r.t&&r.t[0]) || (r.emp+"|"+r.etapa); (porEt[k]=porEt[k]||[]).push(r); });
  const reinc = Object.values(porEt).map(x=>({x, sem:new Set(x.map(r=>r.semana)).size, d:dias(x)})).filter(y=>y.sem>=2).sort((a,b)=>b.sem-a.sem||b.d-a.d);
  $("anRKpis").innerHTML = anK("A registrar", nf(aReg.length), "Etapas ativas cujo término avançou e ainda sem registro nesta semana", aReg.length?"alert":"")
    + anK("Registros", nf(R.length), `em ${reunioes.length} ${reunioes.length===1?"reunião semanal":"reuniões semanais"} · ${nf(semana.length)} nesta semana`)
    + anK("Dias por registro", R.length ? (dias(R)/R.length).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}) : "—", "deslocamento médio de cada registro")
    + anK("Causa interna", R.length ? anPct(cR.int, R.length)+"%" : "—", "dos registros com causa interna controlável", "acc")
    + anK("Etapas reincidentes", nf(reinc.length), "registradas em mais de uma semana", reinc.length?"warn":"");
  // origem por reunião
  const ult = reunioes.slice(-8), linhas = ult.map(w=>({rot:`Reunião ${w.slice(8,10)}/${w.slice(5,7)}`, rs:R.filter(r=>r.semana===w)}));
  if (reunioes.length>1) linhas.push({rot:reunioes.length>ult.length?`Total (${reunioes.length} reuniões)`:"Total", rs:R, tot:true});
  $("anOrig").innerHTML = R.length ? `<div class="an-or">${linhas.map(l=>`<div class="r${l.tot?" tot":""}"><span class="nm">${l.rot}</span>${anOBar(anConta(l.rs), 0, true)}<span class="v">${l.rs.length} reg.<small>${nf(dias(l.rs))} d</small></span></div>`).join("")}</div>` : "<p class='muted'>Sem registros nesta seleção.</p>";
  anAbc(R);
  // por empreendimento
  const porEmp = {}; R.forEach(r=>{ const x = porEmp[r.emp] = porEmp[r.emp]||{rot:r.emp, inc:r.inc, rs:[]}; x.rs.push(r); });
  const emps = Object.values(porEmp).sort((a,b)=>b.rs.length-a.rs.length||dias(b.rs)-dias(a.rs)), mE = Math.max(1,...emps.map(e=>e.rs.length)), dTop = emps.map(e=>dias(e.rs)).sort((a,b)=>b-a)[2]||0;
  $("anPEmp").innerHTML = emps.length ? `<div class="an-pe"><div class="h"><span></span><span></span><span>Dias</span></div>${emps.map(e=>{ const dd = dias(e.rs); return `<div class="r"><span class="nm">${icoSe(e.inc)}${esc(e.rot)}</span><span class="tr">${anOBar(anConta(e.rs), mE)}<i>${e.rs.length}</i></span><span class="dz${dd>=dTop&&dd>0?" hi":""}">${nf(dd)} d</span></div>`; }).join("")}</div>` : "<p class='muted'>Sem registros nesta seleção.</p>";
  // por setor
  const porSet = {}; R.forEach(r=>{ const k = r.setor || "Sem setor"; (porSet[k]=porSet[k]||[]).push(r); });
  const sets = Object.entries(porSet).sort((a,b)=>b[1].length-a[1].length), mS = Math.max(1,...sets.map(x=>x[1].length));
  $("anPSet").innerHTML = sets.length ? `<div class="an-ps">${sets.map(([k,rs])=>`<div class="r"><span class="nm" title="${esc(k)}">${esc(k.replace(/\s+-\s+/," – "))}</span><span class="tr">${anOBar(anConta(rs), mS)}<i>${rs.length}</i></span></div>`).join("")}</div>` : "<p class='muted'>Sem registros nesta seleção.</p>";
  // terceiros citados
  const ter = R.filter(r=>anOK(r)==="ter"), porPj = {}; R.filter(r=>r.proj).forEach(r=>(porPj[r.proj]=porPj[r.proj]||[]).push(r));
  const pjs = Object.entries(porPj).sort((a,b)=>b[1].length-a[1].length||dias(b[1])-dias(a[1])), mP = Math.max(1,...pjs.map(x=>x[1].length));
  $("anPPrjC").hidden = !pjs.length;
  $("anPPrjCap").textContent = `projetistas e consultores${ter.length?` nos ${ter.length} registros de origem terceiro`:""}`;
  $("anPPrj").innerHTML = `<div class="an-ps">${pjs.slice(0,12).map(([k,rs])=>`<div class="r" data-tip="${esc(`${k}: ${rs.length} registro(s), ${dias(rs)} dias`)}"><span class="nm">${esc(k)}</span><span class="tr"><span class="an-ob" style="width:${rs.length/mP*100}%"><b style="flex:1;background:${AN_OC.ter.c}"></b></span><i>${rs.length}</i></span></div>`).join("")}</div>`;
  // etapas reincidentes
  const maxSem = Math.max(3, ...reinc.map(y=>y.sem)), MOS = 10;
  const resumoCausas = x => { const m = {}; x.forEach(r=>{ let c = anCausa(r).replace(/\/.*$/,"").replace(/^Aguardando\s+/,"").replace(/\s*\(sem causa\)$/,""); c = c[0].toUpperCase()+c.slice(1); m[c]=(m[c]||0)+1; }); return Object.entries(m).map(([c,n])=>n>1?`${c} (${n}x)`:c).join("; "); };
  $("anReinc").innerHTML = reinc.length ? `<div class="fd an-fd an-re"><table><thead><tr><th class="fn">Empreendimento</th><th>Etapa</th><th>Semanas</th><th class="d">Dias</th><th>Causas registradas</th></tr></thead><tbody>${reinc.slice(0,MOS).map(y=>{ const r0 = y.x[0]; return `<tr><td class="fn"><span class="fd-n">${icoSe(r0.inc)}${esc(r0.emp)}</span></td><td class="an-nm" title="${esc(r0.etapa)}">${esc(r0.etapa)}</td><td><span class="an-dots">${Array.from({length:Math.min(maxSem,8)},(_,i)=>`<i class="${i<y.sem?"on":""}"></i>`).join("")}</span></td><td class="d">${nf(y.d)} d</td><td class="an-ds" title="${esc(resumoCausas(y.x))}">${esc(resumoCausas(y.x))}</td></tr>`; }).join("")}</tbody></table></div>${reinc.length>MOS?`<p class="cap" style="margin-top:8px">Outras ${reinc.length-MOS} Etapas registradas em mais de uma semana, com menor deslocamento somado.</p>`:""}` : "<p class='muted'>Nenhuma Etapa registrada em mais de uma semana neste período.</p>";
  anLista(R);
}
// curva ABC: barras por causa (cor = origem predominante), linha = % acumulado, faixas A (até 80%), B (até 95%) e C
function anAbc(R){
  if (!R.length){ $("anAbc").innerHTML = "<p class='muted'>Sem registros nesta seleção.</p>"; return; }
  const m = {}; R.forEach(r=>{ const k = anCausa(r); const x = m[k] = m[k]||{k, n:0, d:0, o:{}}; x.n++; x.d += Math.max(0,r.delta||0); const o = anOK(r); x.o[o]=(x.o[o]||0)+1; });
  let cs = Object.values(m).sort((a,b)=>b.n-a.n||b.d-a.d);
  if (cs.length>14){ const resto = cs.slice(13); cs = cs.slice(0,13).concat([{k:`Outras ${resto.length} causas`, n:resto.reduce((a,x)=>a+x.n,0), d:resto.reduce((a,x)=>a+x.d,0), o:{sem:1}}]); }
  const tot = R.length; let ac = 0;
  cs.forEach(c=>{ ac += c.n; c.ac = ac/tot*100; c.or = Object.entries(c.o).sort((a,b)=>b[1]-a[1])[0][0]; });
  let fA = cs.findIndex(c=>c.ac>=80); if (fA<0) fA = cs.length-1;
  let fB = cs.findIndex((c,i)=>i>fA && c.ac>=95); if (fB<0) fB = cs.length-1;
  const W = 1200, H = 430, L = 44, Rr = 56, T = 80, B = 82, n = cs.length, sw = (W-L-Rr)/n, ph = H-T-B;
  const mx = Math.max(...cs.map(c=>c.n)), passo = mx<=10?2:mx<=25?5:mx<=60?10:20, top = Math.ceil(mx/passo)*passo;
  const y = v => T+ph-(v/top)*ph, yp = p => T+ph-(p/100)*ph, xc = i => L+sw*i+sw/2;
  const faixa = (i0,i1,cor,let_) => { if (i0>i1) return ""; const sel = cs.slice(i0,i1+1), nn = sel.reduce((a,c)=>a+c.n,0);
    return `<rect x="${L+sw*i0}" y="${T-74}" width="${sw*(i1-i0+1)}" height="${ph+74}" fill="${cor}"/><text x="${L+sw*(i0+i1+1)/2}" y="${T-52}" text-anchor="middle" class="zl">${let_}</text><text x="${L+sw*(i0+i1+1)/2}" y="${T-37}" text-anchor="middle" class="zs">${sel.length} ${sel.length===1?"causa":"causas"} · ${nn} reg. (${anPct(nn,tot)}%)</text>`; };
  const quebra = (t, max=16) => { const ps = t.split(/(?<=\/)|\s+/).filter(Boolean), ls = [""]; ps.forEach(p=>{ const cur = ls[ls.length-1], sep = cur && !cur.endsWith("/") ? " " : ""; if ((cur+sep+p).length>max && cur) ls.push(p); else ls[ls.length-1] = cur+sep+p; }); return ls.slice(0,3); };
  const grade = []; for (let v=0; v<=top; v+=passo) grade.push(v);
  const pts = cs.map((c,i)=>`${xc(i)},${yp(c.ac)}`).join(" ");
  $("anAbc").innerHTML = `<svg class="an-abc" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    ${faixa(0,fA,"color-mix(in srgb,#FF9100 9%,transparent)","A")}${faixa(fA+1,fB,"color-mix(in srgb,var(--label) 5%,transparent)","B")}${faixa(fB+1,n-1,"transparent","C")}
    ${grade.map(v=>`<line x1="${L}" x2="${W-Rr}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" class="ax">${v}</text>`).join("")}
    ${[0,25,50,75,100].map(p=>`<text x="${W-Rr+8}" y="${yp(p)+4}" class="ax">${p}%</text>`).join("")}
    <line x1="${L}" x2="${W-Rr}" y1="${yp(80)}" y2="${yp(80)}" class="l80"/><text x="${W-Rr-4}" y="${yp(80)-5}" text-anchor="end" class="t80">80%</text>
    ${cs.map((c,i)=>{ const bw = Math.min(56, sw*.62), h = Math.max(2, ph*c.n/top);
      return `<g data-tip="${esc(`${c.k}: ${c.n} registro(s) · ${c.d} dias · ${Math.round(c.ac)}% acumulado`)}"><rect x="${xc(i)-sw/2}" y="${T}" width="${sw}" height="${ph}" fill="transparent"/><rect x="${xc(i)-bw/2}" y="${y(c.n)}" width="${bw}" height="${h}" rx="4" fill="${AN_OC[c.or].c}"/><text x="${xc(i)}" y="${y(c.n)-7}" text-anchor="middle" class="bv">${c.n}</text>
        ${quebra(c.k).map((t,j)=>`<text x="${xc(i)}" y="${H-B+18+j*14}" text-anchor="middle" class="cl">${esc(t)}</text>`).join("")}</g>`; }).join("")}
    <polyline points="${pts}" class="ln"/>
    ${cs.map((c,i)=>`<circle cx="${xc(i)}" cy="${yp(c.ac)}" r="4.5" class="pt"/><g class="pl"><rect x="${xc(i)-19}" y="${yp(c.ac)-25}" width="38" height="16" rx="5"/><text x="${xc(i)}" y="${yp(c.ac)-13}" text-anchor="middle">${Math.round(c.ac)}%</text></g>`).join("")}
  </svg>`;
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
    <div class="fd an-fd"><table><thead><tr>${th("emp","Empreendimento","fn")}${th("semana","Semana","d")}${th("etapa","Etapa")}${th("delta","Δ","d")}${th("causa","Causa")}${th("setor","Setor")}${th("origem","Origem")}${th("proj","Projetista")}<th>Subtarefas</th><th>Descrição</th><th></th></tr></thead><tbody>
    ${vis.length ? vis.map(r=>`<tr${r.fila?' class="fila"':""}><td class="fn"><span class="fd-n">${icoSe(r.inc)}${esc(r.emp)}</span></td><td class="d">${anBr(r.semana)}</td><td class="an-nm" title="${esc(r.etapa)}">${esc(r.etapa)}</td>
      <td class="d"><span class="an-dl ${r.delta>0?"late":r.delta<0?"ok":"mute"}">${anSig(r.delta)}</span></td>
      <td>${r.causa?`<span class="an-st"><i style="background:${AN_COR_CAUSA[anNorm(r.causa)]||"#8E8E93"}"></i>${esc(r.causa)}</span>`:`<span class="muted">${esc(cz(r)||"—")}</span>`}</td>
      <td>${r.setor?`<span class="an-st"><i style="background:${AN_COR_SETOR[anNorm(r.setor)]||"#8E8E93"}"></i>${esc(anSetorCurto(r.setor))}</span>`:"—"}</td>
      <td class="an-tag">${esc(r.origem||"—")}</td><td class="an-tag">${esc(r.proj||"—")}</td>
      <td class="an-ds" title="${esc((r.subsN||[]).join("\n"))}">${r.subsN?.length?esc(r.subsN[0])+(r.subsN.length>1?` <span class="muted">+${r.subsN.length-1}</span>`:""):"—"}</td>
      <td class="an-ds" title="${esc(r.desc||"")}">${esc(r.desc||"")}</td>
      <td class="d">${r.fila?`<span class="an-pend" title="guardado neste navegador, ainda não enviado ao ClickUp">a enviar</span>`:`<a class="an-lk" href="${esc(r.url)}" target="_blank" rel="noopener" title="Abrir o registro no ClickUp">↗</a>`}</td></tr>`).join("") : `<tr><td colspan="11" class="muted" style="text-align:center;padding:18px">Nenhum registro nesta seleção.</td></tr>`}
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
