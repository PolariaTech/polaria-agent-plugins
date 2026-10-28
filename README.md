# polaria-agent-plugins

Repositorio publico de Polaria para distribuir plugins/skills/agentes reutilizables de
asistentes de codigo (Claude Code, Cursor) entre repos reales del equipo, en vez de copiar
carpetas a mano desde Drive.

## Instalar en Claude Code

```
/plugin marketplace add PolariaTech/polaria-agent-plugins
/plugin marketplace list PolariaTech/polaria-agent-plugins
/plugin install <nombre-del-plugin>@polaria-agent-plugins
```

El repo es publico: no hace falta cuenta de GitHub ni `gh auth` para instalar. Si falla con
`git@github.com`, ver "Si falla con Failed to resolve git ref". Tambien se puede agregar desde la UI: Plugins -> "Add plugin from GitHub
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

## Si falla con "Failed to resolve git ref" (Cursor)

Sintoma: el plugin muestra "Error loading plugin: Failed to resolve git ref "main" for
git@github.com:PolariaTech/polaria-agent-plugins.git" y ninguno de los plugins del marketplace
carga. Causa: Cursor guarda el marketplace con la URL SSH y la maquina no tiene una llave SSH
registrada en GitHub; SSH la exige aunque el repo sea publico. Arreglo (verificado 28/10/2026):

1. En la terminal: `git config --global url."https://github.com/".insteadOf "git@github.com:"`
2. Comprobar: `git -c credential.interactive=false ls-remote git@github.com:PolariaTech/polaria-agent-plugins.git main`
   debe devolver un hash y `refs/heads/main`.
3. Cerrar Cursor por completo (Cmd+Q en Mac) y abrirlo de nuevo.
4. Customize -> abrir el plugin; si el aviso sigue, desinstalarlo e instalarlo otra vez.

Volver a agregar el marketplace con la URL HTTPS no resolvio el error en el caso observado.

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

## Pruebas y CI

Todo plugin se prueba antes de publicarse, en cuatro niveles. Los dos primeros corren solos en cada PR (GitHub Actions, Linux y Windows, `.github/workflows/plugins.yml`) y se ejecutan igual en local:

```
node scripts/validar-plugins.js          # nivel 0: manifiestos, versiones, source, hooks, skills, sintaxis
node scripts/correr-pruebas.js           # nivel 1: pruebas de scripts y hooks (todas)
node scripts/correr-pruebas.js <plugin>  # nivel 1: solo las de un plugin
```

- **Nivel 0** (`scripts/validar-plugins.js`): validación estática de todos los plugins. Falla si un `source` lleva `./plugins/` (Cursor duplica el segmento), si las versiones no coinciden entre `plugin.json` y marketplaces, si un hook apunta a un script que no existe, si una skill no tiene `name`/`description` o pasa de 500 líneas. Su propia prueba (`tests/validar-plugins.test.js`) rompe cada una de esas cosas a propósito.
- **Nivel 1** (`plugins/<nombre>/tests/*.test.js`, `node:test`, sin dependencias): scripts y hooks con repos git reales en carpetas temporales y eventos JSON como los mandan Claude Code y Cursor, incluidos los comportamientos de Cursor que ya nos fallaron (BOM, `cwd` vacío). Un plugin con scripts o hooks DEBE traer su carpeta `tests/`.
- **Niveles 2 y 3** (carga real en Claude Code y Cursor; Linear y remotos reales) viven en el repo `PolariaTech/polaria-laboratorio-plugins`. Su evidencia va en la descripción del PR.

Para exigirlo antes de mergear: Settings → Rules → Require status checks → `validar y probar`.

## Plugins actuales

| Plugin | Que hace | Requiere |
|---|---|---|
| `auditoria-tecnica` | Orquesta el Protocolo de Auditoria Tecnica de Software y Workflows v1.2 de Polaria (skill `auditoria-tecnica-polaria` + agentes especialistas por dominio) | spec-kit instalado por separado en el repo auditado (`specify extension add bug` + `specify extension add assess`) |
| `gestion-linear` | Skills para el ciclo de vida de proyectos e issues de Linear del equipo Polaria (crear/cerrar proyecto, crear issue, transicionar estado, actualizar documentacion asociada). `doc-updater` ademas escribe `CONTINUIDAD.md` (fuera de git) al cerrar cada sesion y sugiere cerrar el hilo al terminar una tarea | Trae el conector MCP de Linear (autenticar la primera vez: `/mcp` en Claude Code, Settings -> MCP en Cursor). Si ya tienes el conector de Linear de claude.ai, puedes desactivar el del plugin para no tener las herramientas duplicadas |
| `gate-calidad-tecnica` | Ejecuta el Gate de Calidad Tecnica Pre-Merge v1.2 de Polaria antes de cada push de codigo (los workflows n8n van por `gate-calidad-n8n`): skill `gate-calidad-tecnica-pre-merge-polaria` + subagente aislado y de solo lectura `revisor-tecnico-pre-merge` (8 criterios, incluye build de despliegue) + hook que bloquea `git push` sin veredicto (en la IA y, via un `pre-push` de git que el plugin instala al abrir sesion, tambien desde la terminal o el panel de Git). Solo actua en repos de software: los que tienen un manifiesto de proyecto (`package.json`, `pyproject.toml`, `go.mod`, etc.) en la raiz o en una carpeta de primer nivel; en cualquier otro repo no instala nada y borra una instalacion anterior | Node.js en la maquina del dev (para el hook y el build). Trae el MCP de Vercel (temporal, se reemplazara por AWS): cada dev inicia sesion en Vercel la primera vez y debe ser miembro del equipo de Vercel para que el criterio 8 lea el comando de build real; sin eso usa `vercel.json`/`package.json`. Opcional: MCP de Linear y GitHub (o `gh`) para leer el tipo de issue y publicar el reporte |
| `validacion-formularios` | Ejecuta el Protocolo de Validacion de Formularios v1.1 de Polaria: skill `validacion-formularios-polaria` (entrevista del schema de campos, 5 niveles con el stack que ya usa el repo, pruebas y checklist de prueba manual) + hook que avisa si un `schemas/schema_*.md` queda con texto de plantilla | Node.js en la maquina del dev (para el hook). Recomendado: `gate-calidad-tecnica` instalado (su criterio 7 verifica este protocolo antes del push). Opcional: MCP de Linear para publicar la evidencia |
| `construccion-desde-cero` | Ejecuta el Protocolo de Construccion de Producto desde Cero v1.1: de la idea a Versionamiento, incluida la inicializacion de la carpeta del proyecto (git, spec-kit con `bug` y `assess`, `.claude/settings.json` con los plugins de Polaria, `AGENTS.md`, `docs/` con la checklist de la Guia de Documentacion) para software o n8n | Instalar a **nivel de usuario** (corre antes de que exista la carpeta del proyecto). spec-kit (`specify`) en la maquina del dev |
| `gate-calidad-n8n` | Ejecuta el Gate de Calidad N8N v1.0 de Polaria antes de publicar un workflow: skill `gate-calidad-n8n-polaria` + script `revisar-workflow.js` (criterios mecanicos de los Estandares N8N sobre el JSON descargado) + subagente aislado `revisor-workflow-n8n` (criterios de juicio) + hook que bloquea `publish_workflow` del MCP de n8n sin veredicto de las ultimas 24 horas | Node.js en la maquina del dev. Trae el conector MCP de n8n de Polaria (autenticar la primera vez: `/mcp` en Claude Code, Settings -> MCP en Cursor), con "Available in MCP" activo en la copia DEV y en el workflow de produccion. Opcional: MCP de Linear para publicar el reporte |
| `nomenclatura-credenciales` | Aplica el Protocolo de Nomenclatura de Credenciales v1.0 de Polaria: skill `nomenclatura-credenciales-polaria` (identifica el tipo de credencial, confirma el slug, arma el nombre, lo hace confirmar antes de crear y dice donde registrarla; nunca escribe el valor de un secreto fuera de su plataforma) | Nada obligatorio. Opcional: MCP de Google Drive para leer el Registro de slugs |
| `trabajo-en-paralelo` | Evita que dos devs (o sus asistentes de IA) toquen lo mismo con cambios en local: skill `trabajo-en-paralelo-polaria` (estima solo las zonas del ticket con % de confianza, las reclama como `CLAIM.md` en la raíz de la rama, crea la rama en un worktree aislado y libera el reclamo al terminar) + límite de escritura: el asistente no puede escribir fuera de las zonas del `CLAIM.md` (hook de edición, hook de terminal y un `pre-commit` de git que el plugin instala al abrir sesión); solo el usuario las amplía, con `paralelo.js autorizar` en su terminal, y solo si no chocan con otra rama + hooks que avisan de zonas de otras ramas y de solapes antes de `git push` (`POLARIA_PARALELO_MODO=bloquear` los vuelve bloqueantes). Un reclamo con más de 5 días sin commits en su rama deja de contar | Node.js ≥18 y Git ≥2.38 en la maquina del dev. El ticket puede estar en Linear (`gestion-linear` instalado, trae el MCP de Linear) o en el Sheet de requerimientos (conector de Google Sheets, solo lectura); la skill dice cómo instalar el que falte. El primer push de la rama, que hace `paralelo.js reclamar`, es lo que hace visible el reclamo para los demás |

Fuente de verdad de este contenido: `PROTOCOLOS_NUEVOS/AUDITORIA/` del repo de metodologia
(`METODOLOGIA`) para `auditoria-tecnica`, `PROTOCOLOS_EXISTENTES/GATE_DE_CALIDAD_TECNICA_PRE_MERGE/skill/`
para `gate-calidad-tecnica`, `PROTOCOLOS_EXISTENTES/PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS/skill/` (mas el protocolo y `SCHEMAS_FORMULARIOS/PLANTILLA_SCHEMA_DE_CAMPOS_v1.1.md` copiados a `references/`) para `validacion-formularios`, `PROTOCOLOS_NUEVOS/PROTOCOLO_DE_CONSTRUCCION_DE_PRODUCTO_DESDE_CERO/skill/` (mas el protocolo copiado a `references/`) para `construccion-desde-cero`, `PROTOCOLOS_NUEVOS/GATE_DE_CALIDAD_N8N/skill/` (mas el protocolo y los Estandares N8N copiados a `references/`) para `gate-calidad-n8n`, `PROTOCOLOS_APROBADOS/PROTOCOLO_NOMENCLATURA_CREDENCIALES/skill/` (mas el protocolo copiado a `references/`) para `nomenclatura-credenciales`, y este mismo repo para `gestion-linear` (nacio de
`~/.cursor/skills/`, revisadas y generalizadas el 17/09/2026, pero desde 1.1.1 se edita
directo en `plugins/gestion-linear/` y esa copia local quedo desactualizada; historial en
`plugins/gestion-linear/CHANGELOG.md`). Para el resto de plugins, cualquier cambio se hace en
la fuente y se vuelve a publicar aqui — este repo es el destino de distribucion, nunca donde
se edita el contenido primero.
