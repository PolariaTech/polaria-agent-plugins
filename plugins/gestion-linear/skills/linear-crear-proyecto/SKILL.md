---
name: linear-crear-proyecto
description: "Crea un Project en Linear a partir de una épica ya aprobada (por defecto sigue el Protocolo Épica Planning de Polaria si el equipo lo usa; si no, basta con que la épica esté aprobada por quien corresponda) — nunca antes de esa aprobación. Puebla los campos siguiendo el patrón real de los proyectos existentes del equipo (name/description con 5W2H+KPIs/summary/lead/startDate/targetDate/priority/teams/initiative); el equipo POLARIA es el ejemplo/default, fácil de reemplazar por otro equipo (ver \"Configuración rápida\"). Pregunta configuración previa (proyecto destino de la épica, responsable) en vez de asumir un equipo o lead fijo. Actívala cuando el usuario diga frases como \"crea el project de la épica X\", \"registra esta épica en Linear\", \"arma el proyecto para [nombre]\", o cualquier variación que implique convertir una épica ya aprobada en un Project real de Linear."
compatibility: "Requiere MCP de Linear conectado. Los nombres de herramienta varían por cliente (Claude Code / Cursor / Claude.ai) — ver tabla de mapeo abajo."
---

# Skill: Crear Proyecto en Linear (genérica, adaptable a cualquier equipo)

## ⚙️ Configuración rápida — adaptar antes de usar en otro equipo

| Parámetro | Valor actual (ejemplo/default) | Ajusta si... |
|---|---|---|
| Equipo (`teams`) | `POLARIA` | El proyecto vive en otro equipo de Linear — resuélvelo con `list_teams` |
| Ceremonia de aprobación de épicas | Protocolo Épica Planning de Polaria | El equipo destino no usa ese protocolo — basta con "épica aprobada por quien corresponda en ese equipo" |
| Convención de `initiative` | `"ÉPICAS <MES>-<MES> <AÑO>"` | El equipo agrupa proyectos de otra forma o no usa iniciativas |

## Por qué existe esta skill

El Protocolo Épica Planning ya define cómo y cuándo se aprueba una épica (ceremonia mensual, plantilla, gate del Responsable) — pero convertir esa épica aprobada en un Project real de Linear, con los campos correctos y consistentes con el resto del equipo, es mecánica pura que no debería depender de recordar cada campo a mano. Esta skill toma la épica ya aprobada y construye el Project.

## Precondición — verificar ANTES de crear

La épica debe estar **ya aprobada** (documento de planning aprobado por el Responsable, según Protocolo Épica Planning). Si el usuario pide crear el Project sin que la épica esté aprobada todavía, **detente** y dilo — no crear proyectos especulativos.

## Primer uso en esta sesión

1. **Identidad del operador:** `get_user({query: "me"})` — nunca se pregunta con una lista ni se cachea. Si falla, es un problema de autenticación del MCP, no de membresía del equipo.
2. **Team + mapa de estados:** revisar si `<NOMBRE>_DOC.md` ya tiene la sección "Configuración de Linear" (Team ID + mapa nombre→ID de estados) — esto puede existir ya de un Project o issue anterior del mismo equipo, aunque la épica que se va a registrar ahora sea nueva. Si existe, usarla directamente. Si no existe (caso típico: primera vez que se usa cualquier skill de Linear en este equipo), resolver una vez — `list_teams` (POLARIA por defecto si es el único) → `list_issue_statuses` de ese equipo — y guardarlo en la sección "Configuración de Linear" de `<NOMBRE>_DOC.md` **después** de crear el Project (Paso 4), creando ese archivo por primera vez si hace falta (ver `doc-updater`, MODO INIT) — así las otras 4 skills ya lo encuentran cacheado desde su primer uso sobre este Project.

## Paso 1 — Configuración previa (preguntar, no asumir)

A diferencia de las skills previas de Mateo Support (que asumían siempre el mismo proyecto), esta pregunta siempre:

1. **¿Cuál es la épica?** — nombre y, si está disponible, el documento/bloque aprobado en el planning (para extraer 5W2H, KPIs, criterio de éxito).
2. **¿Quién es el responsable (lead)?** — si el usuario no lo dice y la épica ya lo indica (p. ej. "Frente: Mateo Support · Miembro: Daniel Galvis"), confírmalo en una línea en vez de volver a preguntar.

No sigas al Paso 2 sin estas dos respuestas.

## Paso 2 — Construir los campos del Project

Sigue el patrón real observado en los proyectos existentes del equipo POLARIA (verificado vía `get_project` sobre proyectos reales — nunca inventes un campo que el equipo no usa):

| Campo | Cómo se llena |
|---|---|
| `name` | Nombre oficial de la épica (igual que en el documento de planning aprobado) |
| `description` | 5W2H + KPIs + criterio de éxito, tomados literalmente del documento de planning aprobado — no resumir ni reinterpretar |
| `summary` | Una línea: el objetivo de la épica |
| `lead` | El responsable confirmado en el Paso 1 |
| `startDate` / `targetDate` | Según lo acordado en Épica Planning para ese mes |
| `priority` | Solo si el equipo la definió explícitamente para esta épica — si no, no inventes un valor por defecto; pregúntalo |
| `teams` | `POLARIA` |
| `initiative` | La agrupación mensual vigente (p. ej. "ÉPICAS <MES>-<MES> <AÑO>") — si no existe todavía la iniciativa del mes, pregunta antes de crear una nueva |
| `labels` / `milestones` | Se dejan vacíos — el equipo POLARIA no los usa a nivel de Project (confirmado: 0 de los proyectos reales inspeccionados los usan, pese a estar soportados) |

## Paso 3 — Mostrar preview y pedir confirmación

Igual que con la creación de issues: nunca crear sin mostrar exactamente qué se va a registrar y recibir confirmación explícita.

```
📋 PROJECT A REGISTRAR

Nombre:      [name]
Responsable: [lead]
Equipo:      POLARIA
Iniciativa:  [initiative]
Fechas:      [startDate] → [targetDate]
Prioridad:   [priority o "sin definir — preguntar"]

─────────────────────────────────────
DESCRIPCIÓN (así queda en el campo description)

[5W2H + KPIs + criterio de éxito, tal como está en el documento aprobado]
─────────────────────────────────────

¿Confirmas? (sí / ajusta X cosa)
```

## Paso 4 — Crear el Project

Con confirmación recibida, ejecuta la creación. Después de crear, confirma con:

```
✅ Project creado: [nombre]
🔗 [url del proyecto]
👤 Responsable: [lead]
```

## Mapeo de la acción según el cliente

| Acción | Cliente MCP (Claude Code / Cursor / Claude.ai) | Ask Linear (agente nativo) |
|---|---|---|
| Ver iniciativas existentes | `list_projects` o herramienta de iniciativas, filtrando por equipo | "Muéstrame las iniciativas del equipo POLARIA" |
| Crear el Project | `save_project` (sin `id` → crea nuevo) con los campos del Paso 2 | "Crea un proyecto en POLARIA con estos datos: ..." |

## Reglas estrictas

- Nunca crear un Project sin que la épica esté aprobada (Precondición).
- Nunca asumir proyecto/responsable — siempre confirmar en el Paso 1 (Excepción: si la resolución automática de un dato falla o es ambigua, detente y pregúntalo — no adivines, ver Protocolo de Ciclo de Vida en Linear, Excepción 1).
- Nunca inventar `priority` ni `initiative` si no están definidas explícitamente — preguntar.
- `labels`/`milestones` de Project quedan vacíos salvo que el usuario pida explícitamente lo contrario.
- Nunca crear sin preview + confirmación explícita.