"use strict";
/* Mapa próprio do dashboard: Curitiba e região metropolitana.
   Dados: mapa/curitiba.pmtiles (recorte do OpenStreetMap gerado pela rotina .github/workflows/mapa.yml), servido pelo próprio site.
   Estilo próprio no padrão do Mapas da Apple: ruas com nome, bairros, parques e referências; sem lojas.
   Regras dos alfinetes: o elemento entregue ao MapLibre não leva transform/transição (o MapLibre posiciona ele a cada quadro);
   todo o desenho e a animação ficam num filho. Pontos com a mesma coordenada são abertos em leque por deslocamento fixo. */

const MP = (() => {
  const REGIAO = {oeste:-49.62, sul:-25.78, leste:-48.95, norte:-25.22};
  const BASE = new URL("mapa/", location.href).href;
  let protocolo = false;

  const PALETA = {
    light:{land:"#F2F1ED", park:"#CDE7B6", grass:"#DCEBCB", wood:"#C4E0AE", water:"#A6D1F2", waterTxt:"#3E7DBA",
      hosp:"#F6E3E3", school:"#F1EADB", cemit:"#DCE6D1", aero:"#E4E6EA", indus:"#EBE8E2", pedes:"#ECEAE4",
      minor:"#FFFFFF", minorCase:"#DEDAD2", major:"#FFFFFF", majorCase:"#D2CDC3", hwy:"#FFDB85", hwyCase:"#E5B653", path:"#DFDAD0", rail:"#C4C0B8",
      bld:"#E6E3DD", bldEdge:"#D8D4CC", bld3d:"#ECE9E3", txt:"#5C5C61", halo:"#FFFFFF", place:"#2C2C2E", hood:"#8A8A8E", parkTxt:"#3F7D35"},
    dark:{land:"#1E1F22", park:"#22382B", grass:"#252F27", wood:"#213426", water:"#1D3A57", waterTxt:"#6FA8DC",
      hosp:"#3A2A2C", school:"#2E2A24", cemit:"#26302A", aero:"#2A2C30", indus:"#26262A", pedes:"#29292C",
      minor:"#3B3C40", minorCase:"#2A2B2E", major:"#4A4B50", majorCase:"#2E2F33", hwy:"#7A6431", hwyCase:"#4E4124", path:"#34353A", rail:"#48484C",
      bld:"#2A2B2F", bldEdge:"#323337", bld3d:"#33353A", txt:"#B8B8BE", halo:"#1E1F22", place:"#F2F2F7", hood:"#8E8E93", parkTxt:"#7FC48A"},
  };
  const nome = ["coalesce", ["get","name:pt"], ["get","name"]];
  const z = (...p) => ["interpolate", ["exponential", 1.6], ["zoom"], ...p];
  const REF = ["park","garden","nature_reserve","protected_area","aerodrome","university","hospital","museum","zoo","stadium","golf_course","cemetery"];

  function estilo(tema){
    const L = PALETA[tema] || PALETA.light, src = {source:"b"};
    const roads = (id, kinds, w, cor, extra={}) => ({id, type:"line", ...src, "source-layer":"roads",
      filter:["all", ["in", ["get","kind"], ["literal", kinds]], ["!=", ["get","is_tunnel"], true]],
      layout:{"line-cap":"round","line-join":"round"}, paint:{"line-color":cor, "line-width":w, ...extra}});
    // larguras por zoom; a borda é a mesma curva um pouco mais larga (zoom só pode entrar no interpolate de fora)
    const S = {minor:[12,.4, 14,2, 16,8, 18,22], major:[10,.8, 13,2.5, 16,11, 18,28], hwy:[8,1, 12,3, 16,13, 18,30]};
    const larg = st => z(...st), borda = st => z(...st.map((v,i)=> i%2 ? v + (st[i-1]>=15 ? 2.4 : st[i-1]>=13 ? 1.4 : .6) : v));
    const wMinor=larg(S.minor), wMajor=larg(S.major), wHwy=larg(S.hwy), casing = w => w===wMinor?borda(S.minor):w===wMajor?borda(S.major):borda(S.hwy);
    return {
      version:8, name:"Incorporação", glyphs: BASE+"fonts/{fontstack}/{range}.pbf",
      sources:{b:{type:"vector", url:"pmtiles://"+BASE+"curitiba.pmtiles", attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · Protomaps'}},
      layers:[
        {id:"bg", type:"background", paint:{"background-color":L.land}},
        {id:"earth", type:"fill", ...src, "source-layer":"earth", paint:{"fill-color":L.land}},
        {id:"landcover", type:"fill", ...src, "source-layer":"landcover", paint:{"fill-color":["match",["get","kind"],["forest","wood"],L.wood,["grassland","scrub"],L.grass,L.land], "fill-opacity":.8}},
        {id:"lu-verde", type:"fill", ...src, "source-layer":"landuse", filter:["in",["get","kind"],["literal",["park","garden","nature_reserve","village_green","recreation_ground","golf_course","grass","meadow","pitch","playground","forest","wood"]]],
          paint:{"fill-color":["match",["get","kind"],["forest","wood"],L.wood,["grass","meadow","pitch","playground"],L.grass,L.park]}},
        {id:"lu-outros", type:"fill", ...src, "source-layer":"landuse", filter:["in",["get","kind"],["literal",["hospital","school","university","college","kindergarten","cemetery","aerodrome","industrial","pedestrian"]]],
          paint:{"fill-color":["match",["get","kind"],"hospital",L.hosp,["school","university","college","kindergarten"],L.school,"cemetery",L.cemit,"aerodrome",L.aero,"pedestrian",L.pedes,L.indus]}},
        {id:"agua", type:"fill", ...src, "source-layer":"water", filter:["==",["geometry-type"],"Polygon"], paint:{"fill-color":L.water}},
        {id:"agua-linha", type:"line", ...src, "source-layer":"water", filter:["==",["geometry-type"],"LineString"], paint:{"line-color":L.water, "line-width":z(10,.5, 14,2, 17,6)}},
        {id:"predios", type:"fill", ...src, "source-layer":"buildings", minzoom:14, filter:["==",["get","kind"],"building"],
          paint:{"fill-color":L.bld, "fill-outline-color":L.bldEdge, "fill-opacity":["interpolate",["linear"],["zoom"],14,0,15.5,1]}},
        roads("trilho", ["rail"], z(12,.6, 16,2.4), L.rail, {"line-dasharray":[2,2]}),
        roads("caminho", ["path"], z(14,.6, 17,2.2), L.path, {"line-dasharray":[1.5,1.2]}),
        roads("menor-borda", ["minor_road","other"], casing(wMinor), L.minorCase),
        roads("maior-borda", ["major_road"], casing(wMajor), L.majorCase),
        roads("rodovia-borda", ["highway"], casing(wHwy), L.hwyCase),
        roads("menor", ["minor_road","other"], wMinor, L.minor),
        roads("maior", ["major_road"], wMajor, L.major),
        roads("rodovia", ["highway"], wHwy, L.hwy),
        {id:"predios-3d", type:"fill-extrusion", ...src, "source-layer":"buildings", minzoom:14, filter:["==",["get","kind"],"building"], layout:{visibility:"none"},
          paint:{"fill-extrusion-color":L.bld3d, "fill-extrusion-height":["coalesce",["get","height"],9], "fill-extrusion-base":["coalesce",["get","min_height"],0],
            "fill-extrusion-opacity":["interpolate",["linear"],["zoom"],14,0,15,.85], "fill-extrusion-vertical-gradient":true}},
        {id:"agua-nome", type:"symbol", ...src, "source-layer":"water", minzoom:12, filter:["all",["has","name"],["==",["geometry-type"],"LineString"]],
          layout:{"text-field":nome, "text-font":["Noto Sans Italic"], "text-size":11.5, "symbol-placement":"line", "text-letter-spacing":.04},
          paint:{"text-color":L.waterTxt, "text-halo-color":L.halo, "text-halo-width":1.2}},
        {id:"lago-nome", type:"symbol", ...src, "source-layer":"water", minzoom:12, filter:["all",["has","name"],["==",["geometry-type"],"Polygon"],["in",["get","kind"],["literal",["lake","water","basin"]]]],
          layout:{"text-field":nome, "text-font":["Noto Sans Italic"], "text-size":12, "text-max-width":7},
          paint:{"text-color":L.waterTxt, "text-halo-color":L.halo, "text-halo-width":1.2}},
        {id:"rua-nome", type:"symbol", ...src, "source-layer":"roads", filter:["all",["has","name"],["in",["get","kind"],["literal",["minor_road","major_road","highway","other"]]],
            [">=",["zoom"],["match",["get","kind"],"highway",11,"major_road",13,15]]],
          layout:{"symbol-placement":"line", "text-field":nome, "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],13,10,17,13.5], "text-max-angle":30, "symbol-spacing":320},
          paint:{"text-color":L.txt, "text-halo-color":L.halo, "text-halo-width":1.6}},
        {id:"ref-nome", type:"symbol", ...src, "source-layer":"pois", filter:["all",["in",["get","kind"],["literal",REF]],[">=",["zoom"],["coalesce",["get","min_zoom"],14]]],
          layout:{"text-field":nome, "text-font":["Noto Sans Medium"], "text-size":11.5, "text-max-width":8, "text-padding":6},
          paint:{"text-color":["match",["get","kind"],["park","garden","nature_reserve","protected_area","golf_course","cemetery","zoo"],L.parkTxt,L.txt], "text-halo-color":L.halo, "text-halo-width":1.6}},
        {id:"bairro", type:"symbol", ...src, "source-layer":"places", minzoom:12, maxzoom:16, filter:["==",["get","kind"],"neighbourhood"],
          layout:{"text-field":["upcase",nome], "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],12,9.5,15,12], "text-letter-spacing":.12, "text-max-width":7, "text-padding":8},
          paint:{"text-color":L.hood, "text-halo-color":L.halo, "text-halo-width":1.4}},
        {id:"cidade", type:"symbol", ...src, "source-layer":"places", maxzoom:13, filter:["==",["get","kind"],"locality"],
          layout:{"text-field":nome, "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],8,11,12,18], "text-max-width":8},
          paint:{"text-color":L.place, "text-halo-color":L.halo, "text-halo-width":2}},
      ],
    };
  }

  const dentro = p => p && p[0]>=REGIAO.sul && p[0]<=REGIAO.norte && p[1]>=REGIAO.oeste && p[1]<=REGIAO.leste;

  function novo(container, {tema="light", controles=false, interativo=true}={}){
    if (!protocolo && window.pmtiles){ const p=new pmtiles.Protocol(); maplibregl.addProtocol("pmtiles", p.tile); protocolo=true; }
    const map = new maplibregl.Map({container, style:estilo(tema), center:[-49.25,-25.46], zoom:10.6, minZoom:9, maxZoom:19,
      maxBounds:[[REGIAO.oeste-.15, REGIAO.sul-.12],[REGIAO.leste+.15, REGIAO.norte+.12]], attributionControl:{compact:true},
      interactive:interativo, dragRotate:controles, pitchWithRotate:controles, touchPitch:controles, maxPitch:70});
    map.scrollZoom.disable();
    map._3d = false;
    map.on("style.load", ()=>aplica3d(map, map._3d, false));
    if (window.ResizeObserver) new ResizeObserver(()=>map.resize()).observe(container);
    // ctrl/cmd + rolagem dá zoom sem prender a rolagem da página
    map.getCanvas().addEventListener("wheel", ev=>{ if (ev.ctrlKey||ev.metaKey||container.dataset.wheel==="livre"){ ev.preventDefault(); map.scrollZoom.enable(); clearTimeout(map._zt); map._zt=setTimeout(()=>map.scrollZoom.disable(),500); } }, {passive:false});
    return map;
  }
  function tema(map, t){ map.setStyle(estilo(t)); }
  function aplica3d(map, on, animar=true){
    map._3d = on;
    if (map.getLayer("predios-3d")) map.setLayoutProperty("predios-3d", "visibility", on?"visible":"none");
    if (animar) map.easeTo({pitch:on?58:0, bearing:on?-20:0, zoom:on?Math.max(map.getZoom(),15.4):map.getZoom(), duration:1100});
  }
  function voa3d(map, pos){
    aplica3d(map, true, false);
    map.flyTo({center:[pos[1],pos[0]], zoom:17.3, pitch:60, bearing:-24, duration:1700, essential:true});
  }

  // alfinetes: raiz sem estilo, desenho no filho; leque para coordenadas repetidas
  function alfinetes(map, lista, {cor, sel, aoClicar, dica}){
    (map._mk||[]).forEach(m=>m.remove()); map._mk=[];
    const grupos = {};
    lista.forEach(e=>{
      if (!dentro(e.pos)){ console.warn("Fora da região do mapa, não exibido:", e.nome, e.pos); return; }
      const k = e.pos[0].toFixed(5)+","+e.pos[1].toFixed(5); (grupos[k] ||= []).push(e);
    });
    Object.values(grupos).forEach(g=>g.forEach((e,i)=>{
      const n=g.length, off = n>1 ? [Math.round(Math.cos(2*Math.PI*i/n-Math.PI/2)*16), Math.round(Math.sin(2*Math.PI*i/n-Math.PI/2)*12)] : [0,0];
      const raiz = document.createElement("div");
      raiz.innerHTML = `<div class="pin${sel===e.nome?" sel":""}" style="--c:${cor(e)}"><span class="sh"></span><span class="nd"></span><span class="hd"></span></div>`;
      raiz.addEventListener("mousemove", ev=>dica && dica(e, ev));
      raiz.addEventListener("mouseleave", ()=>dica && dica(null));
      raiz.addEventListener("click", ev=>{ ev.stopPropagation(); aoClicar && aoClicar(e); });
      map._mk.push(new maplibregl.Marker({element:raiz, anchor:"bottom", offset:off}).setLngLat([e.pos[1],e.pos[0]]).addTo(map));
    }));
  }
  function enquadra(map, lista, pad=50){
    const pts = lista.filter(e=>dentro(e.pos)); if (!pts.length) return;
    const b = new maplibregl.LngLatBounds(); pts.forEach(e=>b.extend([e.pos[1],e.pos[0]]));
    map.fitBounds(b, {padding:pad, maxZoom:14, duration:0});
  }
  return {estilo, novo, tema, aplica3d, voa3d, alfinetes, enquadra, dentro, REGIAO};
})();
