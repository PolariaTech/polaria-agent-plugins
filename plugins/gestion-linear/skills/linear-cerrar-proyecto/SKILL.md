---
name: linear-cerrar-proyecto
description: "Cierra formalmente un proyecto/épica en Linear en dos actos — publica un update de proyecto con el resumen de lo logrado y la referencia a TODOS los issues completados, y luego marca el proyecto como Completed. Es agnóstica de cliente: funciona vía MCP (Claude.ai, Claude Code, Cursor u otro con el Linear MCP conectado) o con Ask Linear (agente nativo de Linear), y también sirve como prompt si se copia y se pega tal cual. Actívala cuando el usuario diga frases como \"cierra el proyecto\", \"marca la épica como completada\", \"cerremos el proyecto X en Linear\", \"publica el resumen de cierre del proyecto\", \"damos por terminada la épica\", \"marca el proyecto como Completed\", o cualquier variación que implique cerrar un proyecto de Linear con su resumen de logros. No la actives para cerrar un issue individual (eso es transición de estado de issue, no cierre de proyecto)."
compatibility: "Requiere acceso a Linear — vía MCP (linear.app/mcp) o vía Ask Linear. Los nombres de herramienta varían por cliente; lo invariante son las dos operaciones descritas abajo."
---

# Skill: Cerrar un proyecto/épica en Linear

## Por qué existe esta skill

Cerrar un proyecto en Linear no es solo cambiar su estado: es dejar registrado, en el propio proyecto, qué se logró y con qué issues, para que quien lo revise después entienda el alcance sin reconstruirlo. Esta skill estandariza ese cierre en dos actos, en el orden correcto, para que cualquier IA (o cualquier persona copiando este texto como prompt) lo haga igual sin importar el cliente.

## Objetivo

Cerrar formalmente un proyecto en Linear en dos actos:
1. Publicar un **update de proyecto** con el resumen de lo logrado y la referencia a TODOS los issues completados.
2. Marcar el proyecto como **Completed**.

## Entradas (parámetros)

- `PROYECTO` = nombre o ID del proyecto a cerrar.
- (Opcional) `SALUD` = onTrack | atRisk | offTrack (por defecto: `onTrack` en un cierre exitoso).

## Primer uso en esta sesión

1. **Identidad del operador:** `get_user({query: "me"})` — nunca se pregunta ni se cachea. Si falla, es un problema de autenticación del MCP, no de membresía del equipo.
2. **Team + mapa de estados:** revisar `<NOMBRE>_DOC.md` → sección "Configuración de Linear". Si existe, usarla. Si no, resolver una vez (`list_teams` → `list_issue_statuses`) y guardarla ahí (crear el DOC primero si no existe, ver `doc-updater` MODO INIT).
3. **Project a cerrar:** viene indicado por el parámetro `PROYECTO` de esta skill (el usuario dice cuál) — si es ambiguo, usar `list_projects` filtrado por Team y `status.type: started` para confirmarlo, nunca adivinar cuál de varios proyectos activos se refiere.

## Precondición — verificar ANTES de cerrar

1. Lista los issues del proyecto y confirma que **todos** están en `Done`, `Canceled` o `Duplicate`.
2. Si hay algún issue abierto (Backlog / Todo / In Progress / In Review / Blocked), **DETENTE** y repórtalo. No cierres un proyecto con trabajo pendiente sin confirmación explícita del usuario — y si el usuario confirma cerrar igual, cada issue abierto debe resolverse individualmente primero (Cancelar con motivo, o mover a otro Project) antes de continuar, no quedar huérfano dentro del proyecto cerrado.

## Pasos (en este orden — el orden importa)

1. **Leer el proyecto:** obtén sus datos (ID, estado actual, lead) y la lista completa de issues con su estado.
2. **Construir el resumen:** agrupa los issues por frente/tema (infraestructura, datos, seguridad, features, deuda técnica, despliegue, etc.). Cada frente lista **todos** sus issues por su identificador (p. ej. `POL-46`). Añade al final una sección de "estado operativo al cierre" con cualquier pendiente externo (no de ingeniería) que quede registrado y su responsable.
3. **Publicar el UPDATE DE PROYECTO** (no un comentario de issue) con ese resumen y la salud `SALUD`.
4. **Marcar el proyecto como Completed** (cambiar su estado a `completed`).
5. **Confirmar:** verifica que el estado quedó `Completed` y que existe `completedAt`. Reporta el enlace del update y del proyecto.

> **Regla crítica de orden:** primero el update, después Completed — así el resumen queda registrado en el historial del proyecto antes de marcarlo cerrado.

## Distinción importante

- El **update de proyecto** vive en la pestaña Activity del proyecto y resume la épica completa. Es lo que se usa aquí.
- Un **comentario de issue** es distinto: pertenece a un issue individual. NO uses comentario de issue para el resumen del proyecto.

## Mapeo de la acción según el cliente

| Acción | Cliente MCP (Claude.ai / Claude Code / Cursor / otros con Linear MCP) | Ask Linear (agente nativo de Linear) |
|---|---|---|
| Verificar issues | `list_issues` (project = PROYECTO, filtrar por estado) | "Lista los issues abiertos del proyecto PROYECTO" |
| Leer proyecto | `get_project` (query = PROYECTO) | "Muéstrame el proyecto PROYECTO y su estado" |
| Publicar update | `save_status_update` con `type: project`, `project: PROYECTO`, `health: SALUD`, `body: <resumen>` | "Publica un project update en PROYECTO con este resumen: <resumen>, salud onTrack" |
| Marcar Completed | `save_project` con `id: <projectId>`, `state: completed` | "Marca el proyecto PROYECTO como Completed" |

> Los nombres de herramienta varían entre clientes; lo invariante son las **dos operaciones**: (a) project update, (b) project state → Completed. Si el cliente usa otros nombres, busca la herramienta cuya descripción sea "crear/actualizar un project status update" y la de "crear/actualizar proyecto (campo `state`)".

## Plantilla del resumen (body del update)

```markdown
## 🚀 Épica completada — <NOMBRE / VERSIÓN> (<FECHA>)

Los <N> issues del proyecto están cerrados. <Una línea con el logro principal.>

### Lo que se logró, por frente
**1. <Frente>** (<IDs de issues>)
<qué se logró>

**2. <Frente>** (<IDs de issues>)
<qué se logró>
... (repetir por cada frente) ...

### Estado operativo al cierre
- <Componente>: <estado / validación>.
- <Pendiente externo, si aplica>: <dependencia y responsable>.
```

## Notas

- Si el proyecto no tiene un estado "Completed" disponible en su equipo, usa el estado terminal equivalente (`type: completed`) y repórtalo.
- No inventes issues ni resultados: el resumen se construye desde la lista real de issues del proyecto.
- Si algún issue está `Canceled` o `Duplicate` (no `Done`), acláralo en el resumen (p. ej. tickets de prueba, o issues duplicados y su canónico).
- Pide confirmación al usuario antes de ejecutar las mutaciones (publicar el update y marcar Completed) si no te lo indicó explícitamente.
- Si el Paso 4 (marcar Completed) falla después de que el Paso 3 (publicar el update) ya se ejecutó con éxito, no reintentes el Paso 3 — el update ya quedó publicado. Repórtalo explícitamente y reintenta solo el Paso 4.