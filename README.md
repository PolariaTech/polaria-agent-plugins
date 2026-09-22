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
├── plugins/
│   └── <nombre-del-plugin>/
│       ├── .claude-plugin/plugin.json
│       ├── .cursor-plugin/plugin.json
│       ├── skills/<skill>/SKILL.md
│       ├── agents/*.md
│       └── commands/ (si aplica)
└── skills/
    └── <nombre-variante>/SKILL.md    # variantes repo-especificas, no distribuidas via plugin
```

Ver `plugins/README.md` para el detalle exacto de como agregar un plugin nuevo, y
`skills/README.md` para la diferencia con las variantes repo-especificas de `skills/` (no se
instalan via marketplace, se copian a mano al repo destino).

## Por que dos manifiestos por plugin y no uno

Claude Code y Cursor tienen formatos de marketplace/plugin analogos pero no identicos
(`.claude-plugin/` vs `.cursor-plugin/`, con pequenas diferencias de esquema). El contenido
real (skills, agentes, comandos) se escribe una sola vez dentro de la carpeta del plugin;
cada manifiesto es solo un puntero liviano a esas mismas carpetas, para que nada diverja entre
editores.

## Plugins actuales

| Plugin | Que hace | Requiere |
|---|---|---|
| `auditoria-tecnica` | Orquesta el Protocolo de Auditoria Tecnica de Software y Workflows v1.2 de Polaria (skill `auditoria-tecnica-polaria` + agentes especialistas por dominio) | spec-kit instalado por separado en el repo auditado (`specify extension add bug` + `specify extension add assess`) |
| `gestion-linear` | Skills para el ciclo de vida de proyectos e issues de Linear del equipo Polaria (crear/cerrar proyecto, crear issue, transicionar estado, actualizar documentacion asociada) | Acceso al workspace de Linear de Polaria via MCP/API |
| `gate-calidad-tecnica` | Ejecuta el Gate de Calidad Tecnica Pre-Merge v1.2 de Polaria antes de cada push: skill `gate-calidad-tecnica-pre-merge-polaria` + subagente aislado `revisor-tecnico-pre-merge` + hook que bloquea `git push` sin veredicto | Node.js en la maquina del dev (para el hook). Opcional: MCP de Linear y GitHub (o `gh`) para leer el tipo de issue y publicar el reporte |

Fuente de verdad de este contenido: `PROTOCOLOS_NUEVOS/AUDITORIA/` del repo de metodologia
(`METODOLOGIA`) para `auditoria-tecnica`, `PROTOCOLOS_EXISTENTES/GATE_DE_CALIDAD_TECNICA_PRE_MERGE/skill/`
para `gate-calidad-tecnica`, y `~/.cursor/skills/` (revisadas y generalizadas el
17/09/2026) para `gestion-linear`. Cualquier cambio se hace en la fuente y se vuelve a
publicar aqui — este repo es el destino de distribucion, nunca donde se edita el contenido
primero.
