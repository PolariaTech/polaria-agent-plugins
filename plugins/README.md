# Convencion para agregar un plugin nuevo

Cada plugin es una carpeta bajo `plugins/<nombre-del-plugin>/` con esta forma:

```
plugins/<nombre-del-plugin>/
├── .claude-plugin/
│   └── plugin.json       # manifiesto para Claude Code
├── .cursor-plugin/
│   └── plugin.json       # manifiesto para Cursor
├── skills/
│   └── <skill>/SKILL.md
├── agents/
│   └── *.md
├── commands/              # si aplica
└── hooks/                 # si aplica: hooks.json (Claude Code) y/o otro archivo declarado en .cursor-plugin/plugin.json (Cursor), + scripts
```

El contenido real (skills, agentes, comandos) se escribe **una sola vez** dentro de la
carpeta del plugin. Los dos `plugin.json` (uno por editor) son manifiestos livianos que
apuntan a esas mismas subcarpetas — nunca se duplica el contenido, solo el manifiesto.

Despues de crear la carpeta del plugin:

1. Agregar una entrada en `plugins` dentro de `../.claude-plugin/marketplace.json` con
   `"source": "./plugins/<nombre-del-plugin>"`.
2. Agregar la misma entrada (adaptada al esquema de Cursor) en
   `../.cursor-plugin/marketplace.json`.

Ver el `README.md` de la raiz del repo para el detalle de cada esquema y como se instala en
cada editor.
