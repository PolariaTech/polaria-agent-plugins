# polaria-agent-plugins

Repositorio privado de Polaria para distribuir plugins/skills/agentes reutilizables de
asistentes de codigo (Claude Code, Cursor) entre repos reales del equipo, en vez de copiar
carpetas a mano desde Drive.

## Instalar en Claude Code

```
/plugin marketplace add PolariaTech/polaria-agent-plugins
/plugin marketplace list PolariaTech/polaria-agent-plugins
/plugin install <nombre-del-plugin>@polaria-agent-plugins
```

Requiere acceso de lectura al repo (ya lo tienen todos los miembros de la org PolariaTech via
`gh auth`). Tambien se puede agregar desde la UI: Plugins -> "Add plugin from GitHub
repository" -> `PolariaTech/polaria-agent-plugins`.

## Instalar en Cursor

Requiere **Cursor 2.5 o superior** (funcion "Cursor Plugins", lanzada 17/feb/2026).

Dashboard de Cursor -> Plugins & MCPs -> Team Marketplaces -> Add Marketplace -> "Import from
Repo" -> pegar `https://github.com/PolariaTech/polaria-agent-plugins`. Con la Cursor GitHub
App instalada, el marketplace se refresca solo cuando cambia la rama.

Si algun colaborador tiene una version de Cursor anterior a 2.5, no hay forma nativa de
instalar el marketplace: la unica via es clonar este repo y copiar a mano las carpetas
`skills/`, `agents/`, `commands/` del plugin que necesite a `.cursor/skills/`,
`.cursor/rules/` o `.cursor/commands/` de su proyecto destino (los formatos de archivo,
`SKILL.md` y `.mdc`, son compatibles sin traduccion).

## Estructura del repo

```
polaria-agent-plugins/
├── .claude-plugin/marketplace.json   # entry point que lee Claude Code
├── .cursor-plugin/marketplace.json   # entry point que lee Cursor
└── plugins/
    └── <nombre-del-plugin>/
        ├── .claude-plugin/plugin.json
        ├── .cursor-plugin/plugin.json
        ├── skills/<skill>/SKILL.md
        ├── agents/*.md
        └── commands/ (si aplica)
```

Ver `plugins/README.md` para el detalle exacto de como agregar un plugin nuevo.

## Por que dos manifiestos por plugin y no uno

Claude Code y Cursor tienen formatos de marketplace/plugin analogos pero no identicos
(`.claude-plugin/` vs `.cursor-plugin/`, con pequenas diferencias de esquema). El contenido
real (skills, agentes, comandos) se escribe una sola vez dentro de la carpeta del plugin;
cada manifiesto es solo un puntero liviano a esas mismas carpetas, para que nada diverja entre
editores.

## Plugins actuales

Ninguno todavia — este repo se creo con la carpeta `plugins/` vacia. El primer candidato
pendiente es migrar aqui el paquete de Auditoria Tecnica y Tests que hoy vive en Drive
(`06_AUDITORIA_TECNICA_Y_TESTS/skill/` en el Drive compartido de Polaria), como plugin
`auditoria-tecnica`.
