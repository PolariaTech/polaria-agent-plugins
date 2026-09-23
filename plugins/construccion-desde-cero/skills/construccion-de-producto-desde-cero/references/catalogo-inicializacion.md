# Catálogo de inicialización

Referencia del Paso 9 de la skill `construccion-de-producto-desde-cero`. Dice, según el medio declarado en el Paso 5, qué protocolos aplican, qué plugins se habilitan, qué documentación se prepara y qué estructura lleva la carpeta. El procedimiento que lo usa está en `inicializar-carpeta.md`.

**Mantenimiento:** este catálogo se actualiza cada vez que se publica o cambia un protocolo o plugin que aplica a proyectos nuevos (regla de `.claude/rules/entrega-protocolos.md` del repo de metodología). Última revisión: 23/09/2026.

## 1. Medios

| Medio | Cuándo |
|---|---|
| Software | Código propio: frontend, backend, librería, CLI. |
| n8n | Workflow n8n sin nodos de IA. |
| n8n con IA | Workflow n8n con componente de IA (nodos LLM o agentes). No es un tercer medio del protocolo: es n8n con componente de IA, y suma el Protocolo de Construcción de Agentes de IA en N8N. |

**Tamaño del workflow (solo n8n):** es **pequeño** si tiene un solo trigger, no usa sub-workflows y no tiene componente de IA. Si no, es **mediano o grande**. Lo usan los Pasos 11 y 12 del protocolo para decidir si `plan`, `tasks` y `analyze` son obligatorios. Si se omite `plan`, también se omiten `tasks` y `analyze` (`/speckit.tasks` necesita el plan), y las tareas se descomponen directamente desde la spec.

## 2. Protocolos que aplican

| Protocolo | Software | n8n | n8n con IA | Cómo se ejecuta en el proyecto |
|---|---|---|---|---|
| Construcción de Producto desde Cero v1.1 | Sí | Sí | Sí | Plugin `construccion-desde-cero`, instalado a nivel de usuario (ya está corriendo). |
| Estándares de Diseño de Workflows N8N v1.0 | — | Sí | Sí | Van dentro de la constitución de spec-kit (Paso 10). Documento en Drive: `00_PROTOCOLOS/07_AGENTES_IA_N8N/RECURSOS/`. |
| Construcción de Agentes de IA en N8N v1.0.0 | — | — | Sí | Sus fases de diseño van en el plan (Paso 11) y su checklist de producción antes de activar. Documento en Drive: `00_PROTOCOLOS/07_AGENTES_IA_N8N/`. |
| Gate de Calidad Técnica Pre-Merge v1.2 | Sí | Solo su excepción para n8n, mientras no exista el gate n8n | Ídem | Plugin `gate-calidad-tecnica`. |
| Gate de calidad para n8n | — | Pendiente (no existe todavía) | Pendiente | Mientras no exista, se usa la excepción para n8n del Gate de Calidad Técnica. |
| Validación de Formularios v1.1 | Solo si hay formularios que guardan datos | Solo si el workflow construye formularios propios que guardan datos | Ídem | Plugin `validacion-formularios`. |
| Auditoría Técnica de Software y Workflows v1.2 | Sí | Sí | Sí | Plugin `auditoria-tecnica` (requiere spec-kit con las extensiones `bug` y `assess`). |
| Versionamiento v1.1 | Sí | Sí | Sí | Skill `versionamiento-polaria`, todavía sin plugin: se anota en `AGENTS.md` como pendiente de instalar. |
| Flujo Linear — Ciclo de Vida | Sí | Sí | Sí | Plugin `gestion-linear`. |
| Guía de Documentación Extendida v2.0 | Sí | Sí | Sí | `docs/CHECKLIST_DOCUMENTACION.md` (sección 5) y la skill `doc-updater` del plugin `gestion-linear`. |

## 3. Plugins a habilitar

Marketplace: `polaria-agent-plugins` (`PolariaTech/polaria-agent-plugins` en GitHub).

| Plugin | Software | n8n / n8n con IA |
|---|---|---|
| `gate-calidad-tecnica` | Sí | Sí (por su excepción para n8n) |
| `auditoria-tecnica` | Sí | Sí |
| `gestion-linear` | Sí | Sí |
| `validacion-formularios` | Solo si hay formularios que guardan datos | Solo si el workflow construye formularios propios |

`construccion-desde-cero` no se habilita en el proyecto: ya está instalado a nivel de usuario.

## 4. spec-kit

Se instala **siempre**, sea software o n8n.

| Qué | Cómo |
|---|---|
| Inicializar | `specify init --here --force --non-interactive --integration <editor> --script <ps en Windows, sh en macOS/Linux>`. `<editor>` es `claude` o `cursor-agent`, según la herramienta declarada en el Paso 1. SIEMPRE pasa `--integration`: sin ella, en una sesión no interactiva spec-kit elige Copilot por defecto. Verificado con spec-kit 1.0.10 (23/09/2026); si falla, confirma las opciones con `specify init --help`. |
| Si Windows bloquea `specify.exe` | Pasa con Smart App Control, porque el `.exe` que genera `uv` no está firmado. Se ejecuta el mismo comando a través del Python de la herramienta: `& "$env:APPDATA\uv\tools\specify-cli\Scripts\python.exe" -c "import specify_cli; specify_cli.main()" <argumentos>`, con los mismos argumentos que `specify`. |
| Extensiones | `specify extension add bug` y `specify extension add assess` (las exige `auditoria-tecnica`). |
| Queda bien cuando | Existen `.specify/` y `.specify/extensions.yml` con `bug` y `assess`, y las skills o comandos `speckit-*` del editor. |

Fases por medio (Pasos 10 a 14 del protocolo):

| Fase | Software | n8n pequeño | n8n mediano o grande |
|---|---|---|---|
| `constitution` | Obligatoria | Obligatoria, con los Estándares N8N | Obligatoria, con los Estándares N8N (y Agentes IA, si aplica) |
| `specify` + `clarify` | Obligatoria | Obligatoria | Obligatoria |
| `plan` | Obligatoria | Opcional (si se omite, también `tasks` y `analyze`) | Obligatoria |
| `tasks` + `analyze` | Obligatoria | Opcional | Obligatoria |
| `converge` | Obligatoria | Piloto: solo si el workflow se escribe como código con el Workflow SDK de n8n | Ídem |

## 5. Documentación (Guía de Documentación Extendida v2.0)

Columna "Al inicializar": qué se crea en el Paso 9 con contenido real. Todo lo demás se marca en la checklist y se escribe cuando exista el contenido. NUNCA se crean documentos vacíos o con contenido inventado.

| # | Punto de la guía | Software | n8n | Al inicializar |
|---|---|---|---|---|
| 1 | README.md | Sí | Sí | Sí: nombre, descripción del Brief y enlaces a `docs/` |
| 2 | Diagrama de arquitectura | Sí | Sí | No: sale del plan (Paso 11) |
| 3 | Documentación de API | Si expone API | Si expone un webhook | No |
| 4 | Variables de entorno y configuración | Sí | Sí (credenciales que el workflow referencia por nombre) | No |
| 5 | Instalación y ejecución local | Sí | Sí (cómo importar y activar el workflow) | No |
| 6 | CONTRIBUTING.md | Sí | Sí | No |
| 7 | Glosario | Sí | Sí | Solo si el Brief o los recursos traen términos del negocio |
| 8 | Flujos de negocio end-to-end | Sí | Sí | No: sale de la spec (Paso 11) |
| 9 | ADRs | Sí | Sí | Sí: `docs/adr/0001-medio-de-construccion.md` con la decisión del Paso 5. El stack va en otro ADR al salir del plan (Paso 11) |
| 10 | Documentación de testing | Sí | Sí | No |
| 11 | Runbooks de operación y deployment | Sí | Sí | No |
| 12 | Onboarding | Sí | Sí | No |
| 13 | CHANGELOG.md | Sí | Sí | No: lo crea Versionamiento (Paso 15) |
| 14 | Seguridad y autenticación | Sí | Sí | No |
| 15 | Entornos (dev / staging / prod) | Sí | Sí | No |
| 16 | Observabilidad y monitoreo | Sí | Sí (ejecuciones y Error Workflow) | No |
| 17 | Versionado semántico | Sí | Sí | No |
| 18 | Notas de migración | Al primer cambio mayor | Al primer cambio mayor | No |
| 19 | Storybook o catálogo de UI | Si tiene UI | No aplica | No |
| 20 | Compliance | Según los datos que maneje | Según los datos que maneje | No |
| 21 | llms.txt | Sí | Sí | Sí: índice de los documentos que ya existen |

## 6. Estructura de la carpeta

Común a todos los proyectos:

```
<proyecto>/
├── AGENTS.md                      instrucciones del proyecto para cualquier editor
├── CLAUDE.md                      solo si el editor es Claude: una línea, @AGENTS.md
├── README.md
├── llms.txt
├── .gitignore
├── docs/
│   ├── brief.md                   el Brief de los Pasos 1 a 8
│   ├── CHECKLIST_DOCUMENTACION.md los 21 puntos de la sección 5
│   ├── glosario.md                solo si hay términos
│   └── adr/
│       └── 0001-medio-de-construccion.md
├── .specify/                      lo crea spec-kit
├── specs/                         lo crea spec-kit con /speckit.specify
└── .claude/                       solo si el editor es Claude
    ├── settings.json              marketplace y plugins de la sección 3
    └── skills/                    las speckit-* que instala spec-kit con --integration claude
```

Además, según el medio:

| Medio | Carpeta extra | Para qué |
|---|---|---|
| Software | Ninguna al inicializar | La estructura del código sale del plan (Paso 11). |
| n8n / n8n con IA | `workflows/` | Los workflows versionados en git: el JSON exportado, o el `.ts` del Workflow SDK si se usa el piloto. Así el Gate aplica con su flujo normal de `push`. |

Si el editor es Cursor: no se crea `.claude/`. Cursor lee `AGENTS.md`, y spec-kit con `--integration cursor-agent` crea sus comandos en la carpeta que usa para Cursor (no verificado todavía en un proyecto real: revisa qué creó con `git status`). Los plugins de la sección 3 se instalan desde la interfaz de Cursor con alcance de proyecto; no existe un archivo del repo que los declare, así que su lista queda en "Pendientes de instalación" de `AGENTS.md`.
