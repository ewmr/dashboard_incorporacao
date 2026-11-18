/* =========================================================
   SUGESTÕES · bloco flutuante com o formulário do ClickUp
   Cada envio vira uma tarefa na lista "Sugestões do Painel de Controle"
   (espaço INC | Gestão de Projetos Inc.), atribuída ao Eduardo.
   O bloco fica aberto e arrastável enquanto a pessoa navega; ao recolher,
   o que já foi digitado continua no formulário.
   ========================================================= */
const SUG_FORM = "https://forms.clickup.com/9013344143/f/8cktdwf-109153/J890EC0SVZ4DAFBB6V";
const SUG_PAG = {resumo:"Resumo", mapa:"Mapa", cronograma:"Cronograma", analise:"Análise de Cronogramas", viabilidade:"Viabilidade", metas:"Indicadores e Metas"};
(function(){
  const box = document.getElementById("sug"), btn = document.getElementById("sugBtn");
  if (!box || !btn) return;
  const ifr = document.getElementById("sugIf"), head = document.getElementById("sugH");
  let pos = null; try { pos = JSON.parse(localStorage.getItem("dash-sug-pos")||"null"); } catch(e){}
  const coloca = () => {
    const w = box.offsetWidth, h = box.offsetHeight, W = innerWidth, H = innerHeight;
    let x = pos?.x ?? W - w - 24, y = pos?.y ?? H - h - 56;
    x = Math.max(8, Math.min(W - w - 8, x)); y = Math.max(8, Math.min(H - h - 44, y));
    box.style.left = x + "px"; box.style.top = y + "px";
  };
  const abre = () => {
    if (!ifr.getAttribute("src")){
      const pg = SUG_PAG[typeof paginaAtual!=="undefined" ? paginaAtual : ""] || "Geral / todo o painel";
      ifr.src = SUG_FORM + "?" + new URLSearchParams({"Página do painel": pg}).toString();
    }
    box.hidden = false; box.classList.remove("min"); btn.classList.add("on"); coloca();
  };
  const fecha = () => { box.hidden = true; btn.classList.remove("on"); };
  btn.addEventListener("click", () => box.hidden || box.classList.contains("min") ? abre() : fecha());
  document.getElementById("sugX").addEventListener("click", () => { fecha(); });
  document.getElementById("sugMin").addEventListener("click", () => { box.classList.toggle("min"); coloca(); });
  addEventListener("resize", () => { if (!box.hidden) coloca(); });
  // arrastar pelo cabeçalho
  head.addEventListener("pointerdown", ev => {
    if (ev.target.closest("button")) return;
    const r = box.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    head.setPointerCapture(ev.pointerId); box.classList.add("drag");
    const move = e => { pos = {x:e.clientX - dx, y:e.clientY - dy}; coloca(); };
    const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); box.classList.remove("drag");
      try { localStorage.setItem("dash-sug-pos", JSON.stringify(pos)); } catch(e){} };
    head.addEventListener("pointermove", move); head.addEventListener("pointerup", up);
  });
  head.addEventListener("dblclick", ev => { if (!ev.target.closest("button")){ box.classList.toggle("min"); coloca(); } });
})();
