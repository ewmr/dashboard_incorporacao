"use strict";
/* Mapa próprio do dashboard: Curitiba e região metropolitana.
   Dados: mapa/curitiba.pmtiles (recorte do OpenStreetMap gerado pela rotina .github/workflows/mapa.yml), servido pelo próprio site.
   Estilo próprio no padrão do Mapas da Apple (claro e escuro): ruas com nome, bairros, parques e referências; sem lojas.
   Satélite: imagens Esri World Imagery, com os nomes de ruas e lugares por cima.
   Regras dos alfinetes: o elemento entregue ao MapLibre não leva transform/transição (o MapLibre posiciona ele a cada quadro);
   todo o desenho e a animação ficam num filho. Pontos com a mesma coordenada são abertos em leque por deslocamento fixo. */

const MP = (() => {
  const REGIAO = {oeste:-49.62, sul:-25.78, leste:-48.95, norte:-25.22};
  const BASE = new URL("mapa/", location.href).href;
  let protocolo = false;

  // paletas próximas do Mapas da Apple
  const PALETA = {
    light:{land:"#F5F3EE", park:"#C9E6B4", grass:"#D9ECC8", wood:"#BFE0A8", water:"#9CCFF4", waterTxt:"#3577B5",
      hosp:"#F7E1E1", school:"#F3ECDD", cemit:"#D8E6CF", aero:"#E6E8EC", indus:"#EFECE6", pedes:"#EEEBE5",
      minor:"#FFFFFF", minorCase:"#E0DCD3", major:"#FFFFFF", majorCase:"#D3CDC1", hwy:"#FCD877", hwyCase:"#E9BA4C", path:"#DCD7CC", rail:"#C9C5BD",
      bld:"#EAE7E1", bldEdge:"#DCD8D0", bld3d:"#EFECE7", txt:"#55565B", halo:"#FFFFFF", place:"#1F1F22", hood:"#86868B", parkTxt:"#3D7A33"},
    dark:{land:"#2C3140", park:"#2B4636", grass:"#2C3D35", wood:"#294333", water:"#1C3554", waterTxt:"#7DB2E3",
      hosp:"#3D3240", school:"#353545", cemit:"#2D3D36", aero:"#333848", indus:"#30343F", pedes:"#333846",
      minor:"#4A5367", minorCase:"#2C3140", major:"#5A6580", majorCase:"#323848", hwy:"#6E7C9A", hwyCase:"#3A4256", path:"#3E4659", rail:"#4D556A",
      bld:"#363C4C", bldEdge:"#3D4455", bld3d:"#424A5D", txt:"#C6CBD6", halo:"#2C3140", place:"#F2F3F7", hood:"#9BA2B2", parkTxt:"#86CC94"},
  };
  const nome = ["coalesce", ["get","name:pt"], ["get","name"]];
  const z = (...p) => ["interpolate", ["exponential", 1.6], ["zoom"], ...p];
  const REF = ["park","garden","nature_reserve","protected_area","aerodrome","university","hospital","museum","zoo","stadium","golf_course","cemetery"];
  const SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  function estilo(tema, sat=false){
    const L = PALETA[tema] || PALETA.light, src = {source:"b"};
    const txt = sat ? "#FFFFFF" : L.txt, halo = sat ? "rgba(0,0,0,.75)" : L.halo;
    const roads = (id, kinds, w, cor, extra={}) => ({id, type:"line", ...src, "source-layer":"roads",
      filter:["all", ["in", ["get","kind"], ["literal", kinds]], ["!=", ["get","is_tunnel"], true]],
      layout:{"line-cap":"round","line-join":"round"}, paint:{"line-color":cor, "line-width":w, ...extra}});
    const S = {minor:[12,.4, 14,2, 16,8, 18,22], major:[10,.8, 13,2.5, 16,11, 18,28], hwy:[8,1, 12,3, 16,13, 18,30]};
    const larg = st => z(...st), borda = st => z(...st.map((v,i)=> i%2 ? v + (st[i-1]>=15 ? 2.4 : st[i-1]>=13 ? 1.4 : .6) : v));
    const wMinor=larg(S.minor), wMajor=larg(S.major), wHwy=larg(S.hwy);
    const base = sat ? [
        {id:"bg", type:"background", paint:{"background-color":"#1b1d1f"}},
        {id:"sat", type:"raster", source:"sat", paint:{"raster-fade-duration":200}},
        roads("maior", ["major_road"], z(10,.4, 14,1.2, 18,6), "rgba(255,255,255,.28)"),
        roads("rodovia", ["highway"], z(8,.6, 14,2, 18,8), "rgba(255,214,110,.55)"),
      ] : [
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
        roads("menor-borda", ["minor_road","other"], borda(S.minor), L.minorCase),
        roads("maior-borda", ["major_road"], borda(S.major), L.majorCase),
        roads("rodovia-borda", ["highway"], borda(S.hwy), L.hwyCase),
        roads("menor", ["minor_road","other"], wMinor, L.minor),
        roads("maior", ["major_road"], wMajor, L.major),
        roads("rodovia", ["highway"], wHwy, L.hwy),
      ];
    const sources = {b:{type:"vector", url:"pmtiles://"+BASE+"curitiba.pmtiles", attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> · Protomaps'}};
    if (sat) sources.sat = {type:"raster", tiles:[SAT], tileSize:256, maxzoom:19, attribution:"Imagens © Esri, Maxar, Earthstar Geographics"};
    return {
      version:8, name:"Incorporação", glyphs: BASE+"fonts/{fontstack}/{range}.pbf", sources,
      layers:[...base,
        {id:"predios-3d", type:"fill-extrusion", ...src, "source-layer":"buildings", minzoom:14, filter:["==",["get","kind"],"building"], layout:{visibility:"none"},
          paint:{"fill-extrusion-color":sat?"#D9D6D0":L.bld3d, "fill-extrusion-height":["coalesce",["get","height"],9], "fill-extrusion-base":["coalesce",["get","min_height"],0],
            "fill-extrusion-opacity":["interpolate",["linear"],["zoom"],14,0,15,sat?.55:.88], "fill-extrusion-vertical-gradient":true}},
        {id:"agua-nome", type:"symbol", ...src, "source-layer":"water", minzoom:12, filter:["all",["has","name"],["==",["geometry-type"],"LineString"]],
          layout:{"text-field":nome, "text-font":["Noto Sans Italic"], "text-size":11.5, "symbol-placement":"line", "text-letter-spacing":.04},
          paint:{"text-color":sat?"#BFE0FF":L.waterTxt, "text-halo-color":halo, "text-halo-width":1.2}},
        {id:"lago-nome", type:"symbol", ...src, "source-layer":"water", minzoom:12, filter:["all",["has","name"],["==",["geometry-type"],"Polygon"],["in",["get","kind"],["literal",["lake","water","basin"]]]],
          layout:{"text-field":nome, "text-font":["Noto Sans Italic"], "text-size":12, "text-max-width":7},
          paint:{"text-color":sat?"#BFE0FF":L.waterTxt, "text-halo-color":halo, "text-halo-width":1.2}},
        {id:"rua-nome", type:"symbol", ...src, "source-layer":"roads", filter:["all",["has","name"],["in",["get","kind"],["literal",["minor_road","major_road","highway","other"]]],
            [">=",["zoom"],["match",["get","kind"],"highway",11,"major_road",13,15]]],
          layout:{"symbol-placement":"line", "text-field":nome, "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],13,10,17,13.5], "text-max-angle":30, "symbol-spacing":320},
          paint:{"text-color":txt, "text-halo-color":halo, "text-halo-width":1.6}},
        {id:"ref-nome", type:"symbol", ...src, "source-layer":"pois", filter:["all",["in",["get","kind"],["literal",REF]],[">=",["zoom"],["coalesce",["get","min_zoom"],14]]],
          layout:{"text-field":nome, "text-font":["Noto Sans Medium"], "text-size":11.5, "text-max-width":8, "text-padding":6},
          paint:{"text-color":sat?"#FFFFFF":["match",["get","kind"],["park","garden","nature_reserve","protected_area","golf_course","cemetery","zoo"],L.parkTxt,L.txt], "text-halo-color":halo, "text-halo-width":1.6}},
        {id:"bairro", type:"symbol", ...src, "source-layer":"places", minzoom:12, maxzoom:16, filter:["==",["get","kind"],"neighbourhood"],
          layout:{"text-field":["upcase",nome], "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],12,9.5,15,12], "text-letter-spacing":.12, "text-max-width":7, "text-padding":8},
          paint:{"text-color":sat?"rgba(255,255,255,.85)":L.hood, "text-halo-color":halo, "text-halo-width":1.4}},
        {id:"cidade", type:"symbol", ...src, "source-layer":"places", maxzoom:13, filter:["==",["get","kind"],"locality"],
          layout:{"text-field":nome, "text-font":["Noto Sans Medium"], "text-size":["interpolate",["linear"],["zoom"],8,11,12,18], "text-max-width":8},
          paint:{"text-color":sat?"#FFFFFF":L.place, "text-halo-color":halo, "text-halo-width":2}},
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
    map._3d = false; map._sat = false; map._tema = tema; map._orb = false;
    map.on("style.load", ()=>aplica3d(map, map._3d, false));
    if (window.ResizeObserver) new ResizeObserver(()=>map.resize()).observe(container);
    map.getCanvas().addEventListener("wheel", ev=>{ if (ev.ctrlKey||ev.metaKey||container.dataset.wheel==="livre"){ ev.preventDefault(); map.scrollZoom.enable(); clearTimeout(map._zt); map._zt=setTimeout(()=>map.scrollZoom.disable(),500); } }, {passive:false});
    // órbita: gira devagar em volta do empreendimento até alguém mexer no mapa
    map.on("moveend", ()=>{ if (map._orb) gira(map); });
    ["mousedown","touchstart","wheel"].forEach(t=>container.addEventListener(t, ()=>{ if (map._orb) orbita(map,false); }, {passive:true, capture:true}));
    return map;
  }
  function tema(map, t){ map._tema = t; map.setStyle(estilo(t, map._sat)); }
  function satelite(map, on){ map._sat = on; map.setStyle(estilo(map._tema, on)); }
  function aplica3d(map, on, animar=true){
    map._3d = on;
    if (map.getLayer("predios-3d")) map.setLayoutProperty("predios-3d", "visibility", on?"visible":"none");
    if (animar) map.easeTo({pitch:on?58:0, bearing:on?map.getBearing()||-20:0, zoom:on?Math.max(map.getZoom(),15.4):map.getZoom(), duration:1100});
  }
  function gira(map){ map.rotateTo(map.getBearing()+120, {duration:36000, easing:t=>t}); }
  function orbita(map, on){
    map._orb = on;
    if (on) gira(map); else map.stop();
    map.fire("orbita", {on});
  }
  function voa3d(map, pos, {orbitar=true}={}){
    if (map._orb){ map._orb=false; map.stop(); }
    aplica3d(map, true, false);
    map.flyTo({center:[pos[1],pos[0]], zoom:17.2, pitch:60, bearing:-24, duration:1700, essential:true});
    if (orbitar) map.once("moveend", ()=>{ if (map._3d) orbita(map, true); });
  }

  // ícones: círculo na cor do grupo com o símbolo da incorporadora
  const GLIFO = {
    mk:`<svg viewBox="38 38 156 156" aria-hidden="true"><path d="M108.6 178.3H63.9V81.6h44.7zM167.9 178.3h-44.6V51.8h44.6z"/></svg>`,
    gd:`<svg viewBox="-24 -24 160 156" aria-hidden="true"><path d="M54.5 0v108.4C24.6 108.4.3 84.1.3 54.2S24.6 0 54.5 0zM63.1 59.1h49.3v49.3zM112.4 0v50.3C84.6 50.3 62 27.8 62 0z"/></svg>`,
  };
  const icone = (inc, cor, cls="") => `<span class="ico ${cls}" style="--c:${cor}">${inc==="Gadens"?GLIFO.gd:GLIFO.mk}</span>`;

  function alfinetes(map, lista, {cor, sel, aoClicar, dica}){
    (map._mk||[]).forEach(m=>m.remove()); map._mk=[];
    const grupos = {};
    lista.forEach(e=>{
      if (!dentro(e.pos)){ console.warn("Fora da região do mapa, não exibido:", e.nome, e.pos); return; }
      const k = e.pos[0].toFixed(5)+","+e.pos[1].toFixed(5); (grupos[k] ||= []).push(e);
    });
    Object.values(grupos).forEach(g=>g.forEach((e,i)=>{
      const n=g.length, s = sel===e.nome;
      const off = n>1 ? [Math.round(Math.cos(2*Math.PI*i/n-Math.PI/2)*18), Math.round(Math.sin(2*Math.PI*i/n-Math.PI/2)*14)] : [0,0];
      const raiz = document.createElement("div");
      raiz.innerHTML = s ? `<div class="pin sel" style="--c:${cor(e)}"><span class="bub">${icone(e.incorporadora,cor(e))}</span><span class="pt"></span></div>`
                         : `<div class="pin" style="--c:${cor(e)}">${icone(e.incorporadora,cor(e))}</div>`;
      raiz.addEventListener("mousemove", ev=>dica && dica(e, ev));
      raiz.addEventListener("mouseleave", ()=>dica && dica(null));
      raiz.addEventListener("click", ev=>{ ev.stopPropagation(); aoClicar && aoClicar(e); });
      const m = new maplibregl.Marker({element:raiz, anchor:s?"bottom":"center", offset:s?[off[0],off[1]+4]:off}).setLngLat([e.pos[1],e.pos[0]]).addTo(map);
      if (s) m.getElement().style.zIndex = 5;
      map._mk.push(m);
    }));
  }
  // enquadra os pontos; pad pode descontar barras que cobrem o mapa. Sempre termina em 2D com o norte para cima quando plano=true.
  function enquadra(map, lista, pad=50, {animar=false, plano=false}={}){
    const pts = lista.filter(e=>dentro(e.pos)); if (!pts.length) return;
    const b = new maplibregl.LngLatBounds(); pts.forEach(e=>b.extend([e.pos[1],e.pos[0]]));
    if (plano){
      if (map._orb){ map._orb=false; map.stop(); }
      aplica3d(map, false, false);
      const cur = {center:map.getCenter(), zoom:map.getZoom(), pitch:map.getPitch(), bearing:map.getBearing()};
      map.jumpTo({pitch:0, bearing:0});
      const cam = map.cameraForBounds(b, {padding:pad, maxZoom:14});
      map.jumpTo(cur);
      if (cam) map.flyTo({...cam, pitch:0, bearing:0, duration:animar?1300:0, essential:true});
      return;
    }
    map.fitBounds(b, {padding:pad, maxZoom:14, duration:animar?900:0});
  }
  return {estilo, novo, tema, satelite, aplica3d, voa3d, orbita, alfinetes, enquadra, dentro, icone, GLIFO, REGIAO};
})();
