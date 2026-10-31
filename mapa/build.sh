#!/usr/bin/env bash
# Gera o mapa-base próprio do dashboard: recorte de Curitiba e região metropolitana
# a partir do build diário do Protomaps (dados do OpenStreetMap), em um único arquivo PMTiles.
set -euo pipefail
cd "$(dirname "$0")"
BBOX="-49.62,-25.78,-48.95,-25.22"   # oeste,sul,leste,norte (Campo Largo/Araucária até Piraquara/Colombo)
MAXZOOM=15

# 1) ferramenta pmtiles (go-pmtiles)
VER=$(curl -fsSL https://api.github.com/repos/protomaps/go-pmtiles/releases/latest | jq -r .tag_name)
curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/${VER}/go-pmtiles_${VER#v}_Linux_x86_64.tar.gz" | tar xz pmtiles

# 2) build mais recente do mapa-mundi do Protomaps e recorte da região (baixa só os pedaços necessários)
KEY=$(curl -fsSL https://build-metadata.protomaps.dev/builds.json | jq -r 'sort_by(.key) | last | .key')
echo "Build Protomaps: $KEY"
./pmtiles extract "https://build.protomaps.com/${KEY}" curitiba.pmtiles --bbox="$BBOX" --maxzoom=$MAXZOOM
rm -f pmtiles

# 3) fontes dos rótulos (só as usadas no estilo)
rm -rf fonts tmp-assets && git clone --depth 1 https://github.com/protomaps/basemaps-assets tmp-assets
mkdir -p fonts
for f in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do cp -r "tmp-assets/fonts/$f" fonts/; done
rm -rf tmp-assets

SIZE=$(du -m curitiba.pmtiles | cut -f1)
printf '{"fonte":"Protomaps %s (OpenStreetMap)","bbox":"%s","maxzoom":%s,"tamanho_mb":%s,"gerado_em":"%s"}\n' "$KEY" "$BBOX" "$MAXZOOM" "$SIZE" "$(date -u +%FT%TZ)" > info.json
cat info.json
