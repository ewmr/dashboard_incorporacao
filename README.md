# Dashboard de Incorporação · Make It e Gadens

Painel de gestão de projetos de incorporação, publicado no GitHub Pages e embutido no ClickUp.

- `index.html`, `app.css`, `app.js`: o app (One Page Report, Cronograma, Análise de Cronogramas, Indicadores de Viabilidade, Indicadores e Metas).
- `dados.json`: base única lida pelo app. É substituída pela atualização diária a partir do ClickUp (cronogramas e lista Controle de Viabilidades).
- `vendor/leaflet`: biblioteca do mapa, incluída no repositório para não depender de CDN.
- `scripts/`: rotina que monta o `dados.json`.
