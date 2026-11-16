/* =========================================================
   ANÁLISE DE CRONOGRAMAS — todas as Etapas dos cronogramas,
   desvios da semana, causas registradas e o Registro de Desvios
   (dados de registro/dados-*.json, lidos pela rotina diária)
   ========================================================= */
const AN = {arq:{}, carregando:null};
const AN_GR = [
  {k:"run",  t:"Em andamento",            c:"#007AFF"},
  {k:"warn", t:"Deveriam ter iniciado",    c:"#FFB300"},
  {k:"next", t:"Início até a próxima",     c:"var(--accent)"},
  {k:"fut",  t:"Demais em aberto",         c:"#8E8E93"},
  {k:"done", t:"Concluídas",               c:"#34C759"}];
const AN_COR_CAUSA = {"aguardando projetista/consultor":"#32ADE6","aguardando orgao publico/concessionaria":"#007AFF","aguardando cef/agente financeiro":"#5856D6","pendencia de decisao interna":"#FF9500","dependencia de outra area":"#D46A00","prazo subestimado no planejamento":"#E6B800","falha de comunicacao/alinhamento":"#FF3B30","priorizacao de outras atividades":"#FF2D55","alteracao de escopo/projeto":"#00C7BE","retrabalho/revisao de entregavel":"#34C759","insumo/documentacao incompleta":"#A2845E","ausencia de reporte":"#8E8E93"};
const AN_COR_SETOR = {"inc - legalizacao":"#FF2D55","inc - credito imobiliario":"#AF52DE","inc - arquitetura":"#007AFF","inc - produto":"#30B0C7","inc - gestao de projetos de incorporacao":"#5856D6","inc - novos negocios":"#E6B800","eng - projetos complementares":"#FF6B00","eng - orcamentos":"#A2845E","eng - outros":"#B59B7A","mkt - marketing":"#34C759","csc - juridico":"#C0392B","csc - outros":"#A08A94","externo":"#8E8E93"};
const anNorm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").replace(/\s*-\s*/g," - ").trim();
const anDias = (a,b) => (a&&b) ? Math.round((Date.parse(b)-Date.parse(a))/864e5) : null;
const anAdd = (iso,n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.toLocaleDateString("en-CA"); };
const anSeg = iso => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toLocaleDateString("en-CA"); };
const anBr = iso => iso ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(2,4) : "—";
const anSig = n => n==null ? "—" : (n>0?"+":n<0?"−":"")+Math.abs(n)+" d";
const anSetorCurto = n => (n||"").replace(/^(INC|ENG|MKT|CSC)\s*-\s*/i,"");
const anFila = () => { try { const j = JSON.parse(localStorage.getItem("rd-fila")||"[]"); return Array.isArray(j)?j:[]; } catch(e){ return []; } };

function anCarrega(){
  if (AN.carregando) return AN.carregando;
  const t = Math.floor(Date.now()/60000);
  AN.carregando = Promise.all(["makeit","gadens"].map(k=>fetch(`registro/dados-${k}.json?t=${t}`).then(r=>r.ok?r.json():null).catch(()=>null)))
    .then(([m,g])=>{ AN.arq = {makeit:m, gadens:g}; return AN.arq; });
  return AN.carregando;
}
// todas as Etapas (com classificação igual à do Registro de Desvios) e os registros
function anDados(){
  const hoje = HOJE(), seg = anSeg(hoje), fim = anAdd(seg,6), fila = anFila();
  const cos = S.inc==="all" ? ["makeit","gadens"] : [S.inc==="Gadens"?"gadens":"makeit"];
  const ok = new Set(filtrados().map(e=>e.sigla)), filtroAtivo = filtrosAtivos();
  const etapas = [], regs = [];
  cos.forEach(k=>{ const f = AN.arq[k]; if (!f) return;
    const doArq = (f.registros||[]).map(r=>({...r, co:k}));
    const pend = fila.filter(x=>x.co===k).map(x=>({id:"fila-"+x.rid, t:[x.etapa], nome:x.nome, emp:x.emp, ...x.resumo, co:k, fila:true}));
    const todos = doArq.concat(pend); regs.push(...todos);
    const porEtapa = {}; todos.forEach(r=>(r.t||[]).forEach(id=>(porEtapa[id]=porEtapa[id]||[]).push(r)));
    (f.listas||[]).forEach(l=>{
      if (l.sigla && !ok.has(l.sigla)) return;
      if (!l.sigla && filtroAtivo) return;
      l.etapas.forEach(e=>{
        const rs = (porEtapa[e.id]||[]).sort((a,b)=>(b.semana||"").localeCompare(a.semana||""));
        const done = e.stType==="done" || e.stType==="closed";
        const g = done ? "done" : e.stType!=="open" ? "run" : (e.start && e.start<=hoje) ? "warn" : (e.start && e.start<=anAdd(hoje,7)) ? "next" : "fut";
        const dSem = anDias(e.pre, e.pos), regSem = rs.filter(r=>r.semana>=seg && r.semana<=fim).length;
        const atras = !done && ((/atraso/.test(anNorm(e.status))) || (e.pos && e.pos<hoje));
        etapas.push({...e, co:k, emp:l.short, lista:l.id, tipo:l.tipo, sigla:l.sigla, short:(e.name||"").split("|").pop().trim(),
          g, dSem, dLb:anDias(e.lb,e.pos), dur:anDias(e.start,e.pos), regs:rs, regSem, atras,
          moved: dSem>0, needs: dSem>0 && (g==="run"||g==="done") && !regSem});
      });
    });
  });
  return {etapas, regs, seg, fim, hoje, cos};
}
const filtrosAtivos = () => !!(S.cidades?.size || S.fases?.size || S.linhas?.size || S.anos?.size || S.ativos);

function renderAnalise(){
  if (!$("anEtapas")) return;
  if (!AN.arq.makeit && !AN.arq.gadens){
    $("anEtapas").innerHTML = "<p class='muted'>Carregando as Etapas dos cronogramas…</p>";
    anCarrega().then(()=>{ if (paginaAtual==="analise") renderAnalise(); });
    return;
  }
  const d = anDados();
  anKpis(d); anGraficos(d); anTabela(d); anRegCard(d);
}
function anKpis(d){
  const ab = d.etapas.filter(e=>e.g!=="done"), mov = d.etapas.filter(e=>e.moved && e.g!=="done"), sem = d.regs.filter(r=>r.semana>=d.seg && r.semana<=d.fim);
  const k = (rot,v,sub,cls="") => `<div class="an-k ${cls}"><span>${rot}</span><b>${v}</b><small>${sub}</small></div>`;
  $("anKpis").innerHTML =
      k("A registrar", nf(d.etapas.filter(e=>e.needs).length), "Etapas ativas cujo término avançou e sem registro na semana", d.etapas.some(e=>e.needs)?"alert":"")
    + k("Deslocadas na semana", nf(mov.length), `${nf(mov.reduce((a,e)=>a+e.dSem,0))} dias somados · vs semana passada`)
    + k("Em atraso", nf(ab.filter(e=>e.atras).length), "status em atraso ou término já vencido")
    + k("Em andamento", nf(d.etapas.filter(e=>e.g==="run").length), `${nf(d.etapas.filter(e=>e.g==="warn").length)} deveriam ter iniciado`)
    + k("Registros na semana", nf(sem.length), `${nf(sem.filter(r=>r.fila).length)} aguardando envio ao ClickUp`);
  const ats = d.cos.map(c=>AN.arq[c]?.at).filter(Boolean).sort();
  $("anFonte").textContent = `${nf(d.etapas.length)} Etapas de ${new Set(d.etapas.map(e=>e.lista)).size} cronogramas · semana de ${anBr(d.seg)} a ${anBr(d.fim)} · lido do ClickUp ${ats.length?dmy(ats[0].slice(0,10))+" às "+ats[0].slice(11,16):"—"}`;
}
function anBarras(rows, cor, un){
  if (!rows.length) return "<p class='muted'>Sem dados nesta seleção.</p>";
  const max = Math.max(...rows.map(r=>r.v),1);
  return `<div class="an-hb">${rows.map(r=>`<div class="an-hr" data-tip="${esc(r.tip||"")}"><span class="nm">${esc(r.rot)}</span><span class="tr"><i style="width:${Math.max(3,r.v/max*100)}%;background:${typeof cor==="function"?cor(r.k):cor}"></i></span><span class="v">${nf(r.v)}${un?` <small>${un}</small>`:""}</span></div>`).join("")}</div>`;
}
function anGraficos(d){
  // deslocamento da semana por empreendimento
  const porEmp = {}; d.etapas.filter(e=>e.moved && e.g!=="done").forEach(e=>{ const x = porEmp[e.emp] = porEmp[e.emp]||{k:e.emp, rot:e.emp, v:0, n:0}; x.v += e.dSem; x.n++; });
  const r1 = Object.values(porEmp).sort((a,b)=>b.v-a.v).slice(0,10).map(r=>({...r, tip:`${r.k}: ${r.n} Etapa(s) deslocada(s), ${r.v} dias somados`}));
  $("anG1").innerHTML = anBarras(r1, "var(--red-ink)", "d");
  // causas e setores nos últimos 90 dias (pelos dias deslocados)
  const lim = anAdd(d.hoje,-90), rec = d.regs.filter(r=>r.semana>=lim);
  const agg = (fn) => { const m = {}; rec.forEach(r=>{ const k = fn(r); if (!k) return; const x = m[k] = m[k]||{k, rot:k, v:0, n:0}; x.v += Math.max(0, anDias(r.pre,r.pos)||0); x.n++; }); return Object.values(m).sort((a,b)=>b.v-a.v||b.n-a.n); };
  const ca = agg(r=>r.causa).slice(0,8).map(r=>({...r, tip:`${r.k}: ${r.n} registro(s), ${r.v} dias`}));
  $("anG2").innerHTML = ca.length ? anBarras(ca, k=>AN_COR_CAUSA[anNorm(k)]||"#8E8E93", "d") : "<p class='muted'>Ainda não há registros com causa nos últimos 90 dias.</p>";
  const se = agg(r=>r.setor).slice(0,8).map(r=>({...r, rot:anSetorCurto(r.k), tip:`${r.k}: ${r.n} registro(s), ${r.v} dias`}));
  $("anG3").innerHTML = anBarras(se, k=>AN_COR_SETOR[anNorm(k)]||"#8E8E93", "d");
  $("anG2c").textContent = `${nf(rec.length)} registros nos últimos 90 dias · por dias deslocados`;
}
// tabela de todas as Etapas (estilo Finder)
function anTabela(d){
  const F = S.an || (S.an = {grupos:new Set(["run","warn","next"]), so:false, emp:"", setor:"", q:"", ord:{c:"pos", d:1}});
  const emps = [...new Set(d.etapas.map(e=>e.emp))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const setores = [...new Set(d.etapas.flatMap(e=>e.tags||[]))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const q = anNorm(F.q);
  let L = d.etapas.filter(e=>F.grupos.has(e.g) && (!F.so || e.moved) && (!F.emp || e.emp===F.emp) && (!F.setor || (e.tags||[]).includes(F.setor)) && (!q || anNorm(e.short+" "+e.emp).includes(q)));
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
      return `<tr class="${e.needs?"need":""}"><td class="fn"><span class="fd-n">${e.needs?`<i class="an-flag" title="precisa de registro de desvio nesta semana"></i>`:e.regSem?`<i class="an-flag ok" title="registrado nesta semana"></i>`:`<i class="an-flag none"></i>`}${esc(e.emp)}</span></td>
        <td class="an-nm" title="${esc(e.name)}${e.assignees?.length?"\nResponsáveis: "+esc(e.assignees.join(", ")):""}">${esc(e.short)}</td>
        <td class="an-tag">${esc((e.tags||[]).map(anSetorCurto).join(", ")||"—")}</td>
        <td><span class="an-st"><i style="background:${e.stColor||"#8E8E93"}"></i>${esc(e.status||"")}</span></td>
        <td class="d">${anBr(e.start)}</td><td class="d${e.pos&&e.pos<d.hoje&&e.g!=="done"?" late":""}">${anBr(e.pos)}</td><td class="d">${e.dur!=null?e.dur+" d":"—"}</td>
        <td class="d" title="${e.pre?"Semana passada: "+anBr(e.pre)+(e.preSrc?" ("+e.preSrc+")":""):"sem referência da semana passada"}">${e.pre?dl(e.dSem, e.g==="done"):`<span class="an-dl warn">s/ ref.</span>`}</td>
        <td class="d">${dl(e.dLb, e.g==="done")}</td><td class="d">${anBr(e.lb)}</td>
        <td class="d an-rg" data-k="${e.id}">${e.regs.length?`${e.regs.length}${r?.causa?` · <span style="color:${AN_COR_CAUSA[anNorm(r.causa)]||"inherit"}">●</span>`:""}`:"—"}</td>
        <td class="d"><a class="an-lk" href="${esc(e.url||"https://app.clickup.com/t/"+e.id)}" target="_blank" rel="noopener" title="Abrir a Etapa no ClickUp">↗</a></td></tr>`; }).join("")}
    </tbody></table></div>
    <p class="cap" style="margin-top:8px">${nf(L.length)} Etapas${L.length>MAX?` · mostrando as ${MAX} primeiras; use a busca ou os filtros`:""} · ● vermelho: precisa de registro nesta semana · ● verde: já registrado · passe o mouse em Registros para ver o histórico</p>`;
  const R = () => anTabela(anDados());
  $("anEtapas").querySelectorAll(".an-chip").forEach(b=>b.onclick=()=>{ const g=b.dataset.g; F.grupos.has(g)?F.grupos.delete(g):F.grupos.add(g); R(); });
  $("anEtapas").querySelectorAll("th[data-c]").forEach(t=>t.onclick=()=>{ const c=t.dataset.c; F.ord = {c, d: F.ord.c===c ? -F.ord.d : 1}; R(); });
  $("anEmp").onchange = ev=>{ F.emp = ev.target.value; R(); };
  $("anSet").onchange = ev=>{ F.setor = ev.target.value; R(); };
  $("anSo").onchange = ev=>{ F.so = ev.target.checked; R(); };
  const qi = $("anQ"); qi.oninput = ()=>{ F.q = qi.value; const p = qi.selectionStart; R(); const n = $("anQ"); n.focus(); n.setSelectionRange(p,p); };
  $("anEtapas").querySelectorAll(".an-rg").forEach(td=>{ const e = vis.find(x=>x.id===td.dataset.k); if (!e || !e.regs.length) return;
    bindTip(td, `<b>${esc(e.short)}</b> · ${esc(e.emp)}<table>${e.regs.slice(0,8).map(r=>`<tr><td>${anBr(r.semana)}${r.fila?" · a enviar":""}</td><td class="n">${anSig(anDias(r.pre,r.pos))}</td><td>${esc(r.causa||r.tipo||r.motivo||"—")}${r.setor?` · <span class="muted">${esc(anSetorCurto(r.setor))}</span>`:""}</td></tr>`).join("")}</table>${e.regs.length>8?`<div class="muted">+${e.regs.length-8} registros anteriores</div>`:""}`); });
}
// cartão do Registro de Desvios (no fim da página) e a janela com o app
function anRegCard(d){
  const fila = anFila(), aReg = d.etapas.filter(e=>e.needs);
  const porEmp = {}; aReg.forEach(e=>porEmp[e.emp]=(porEmp[e.emp]||0)+1);
  $("anRegInfo").innerHTML = `${aReg.length ? `<b class="red">${aReg.length} ${aReg.length===1?"Etapa precisa":"Etapas precisam"} de registro nesta semana</b> · ${Object.entries(porEmp).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${esc(k)} ${n}`).join(", ")}` : `<b>Nenhuma Etapa ativa deslocada sem registro nesta semana.</b>`}
    ${fila.length ? `<br><span class="red">${fila.length} ${fila.length===1?"registro guardado":"registros guardados"} neste navegador aguardando envio ao ClickUp.</span>` : ""}`;
}
function abreRegistro(){
  const co = S.inc==="Gadens" ? "gadens" : "makeit";
  let ov = $("regOv");
  if (!ov){
    ov = document.createElement("div"); ov.id = "regOv"; ov.className = "reg-ov";
    ov.innerHTML = `<div class="reg-bar"><b>Registro de Desvios</b><span class="muted">os registros ficam guardados neste navegador até você enviá-los ao ClickUp pelo botão A enviar</span><span style="flex:1"></span><a class="pillbtn" id="regNova" target="_blank" rel="noopener">Abrir em outra aba ↗</a><button class="pillbtn" id="regFecha">Fechar</button></div><iframe id="regIf" title="Registro de Desvios"></iframe>`;
    document.body.appendChild(ov);
    $("regFecha").onclick = fechaRegistro;
    addEventListener("keydown", ev=>{ if (ev.key==="Escape" && !$("regOv").hidden && document.activeElement?.id!=="regIf") fechaRegistro(); });
  }
  const url = `registro.html?co=${co}`;
  $("regNova").href = url;
  if (!$("regIf").src.includes("registro.html")) $("regIf").src = url;
  ov.hidden = false; document.documentElement.classList.add("no-scroll");
}
function fechaRegistro(){ const ov = $("regOv"); if (!ov) return; ov.hidden = true; document.documentElement.classList.remove("no-scroll"); AN.carregando = null; AN.arq = {}; if (paginaAtual==="analise") renderAnalise(); }
