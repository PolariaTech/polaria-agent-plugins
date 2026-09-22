---
name: linear-transicionar-estado
description: "Gestiona el estado de issues de Linear a lo largo del ciclo de vida real del trabajo, para cualquier proyecto de un equipo — el equipo POLARIA (prefijo POL-) es el ejemplo/default, fácil de reemplazar por otro equipo (ver \"Configuración rápida\"). Actívala en estos momentos, sin esperar a que el usuario lo pida explícitamente salvo el primero: (1) el usuario dice \"vamos a trabajar en POL-X\" / \"sigamos con POL-X\" / \"retomemos POL-X\" → mueve a In Progress si no lo está; (2) el trabajo sobre un issue en curso llega al punto de probar/validar → In Review; (3) aparece algo que impide seguir → Blocked, comenta la causa y enlaza blockedBy; (4) se decide que el issue quedó resuelto → comenta cómo se resolvió y qué pruebas pasó, y solo después mueve a Done; (5) el issue es duplicado de otro → Duplicate, vinculado al original; (6) se pausa un issue en curso por falta de capacidad → regresa a Backlog con motivo. Actívala también cuando el usuario mencione un identificador de issue junto con verbos como \"trabajar\", \"seguir\", \"retomar\", \"probar\", \"validar\", \"bloqueado por\", \"cerrar\", \"duplicado\", o \"marcar como listo\"."
compatibility: "Requiere MCP de Linear conectado. Los nombres de herramienta varían por cliente — ver tabla abajo."
---

# Skill: Transiciones de Estado en Linear (genérica, adaptable a cualquier equipo)

## ⚙️ Configuración rápida — adaptar antes de usar en otro equipo

| Parámetro | Valor actual (ejemplo/default) | Ajusta si... |
|---|---|---|
| Team ID | `a1ba209a-21ce-4ec1-88d4-1392b5771391` (equipo POLARIA) | Se usa en otro equipo — resuélvelo con `list_teams` |
| Prefijo de identificador | `POL-` (en los ejemplos de este documento) | El equipo destino tiene otro "key" en Linear — reemplaza `POL-X` por el prefijo real en tus confirmaciones |
| Referencias a "Metodología de Trabajo v1.2" / "Protocolo de Ciclo de Vida en Linear" | Documentos internos de Polaria | Si el equipo destino no tiene estos protocolos, aplica el principio general que describen (validación de 4 ojos antes de Done, ventana de confirmación del cliente) sin depender del documento específico |

## Por qué existe esta skill

El estado de un issue en Linear debería reflejar en todo momento qué está pasando realmente en el trabajo. Pedirle al usuario que recuerde mover el issue en cada paso es fricción innecesaria: si la conversación ya deja claro que se empezó, se está probando, algo lo bloqueó, o se resolvió, la skill debe reflejarlo sola.

Aplica a issues de **cualquier** Project dentro del equipo configurado arriba — no asume un proyecto fijo.

---

## Primer uso en esta sesión

1. **Identidad del operador:** `get_user({query: "me"})` — nunca se pregunta ni se cachea. Si falla, es un problema de autenticación del MCP, no de membresía del equipo.
2. **Team + mapa de estados:** revisar `<NOMBRE>_DOC.md` → sección "Configuración de Linear". Si existe, usarla. Si no, resolver una vez (`list_teams` → `list_issue_statuses`) y guardarla ahí (crear el DOC primero si no existe, ver `doc-updater` MODO INIT).
3. **Project (el issue ya trae el suyo vía `get_issue`)** — no hace falta resolverlo por separado en esta skill; basta con `get_issue` para saber a qué proyecto pertenece el issue que se va a transicionar.

## Antes de cualquier transición

Los nombres de los estados pueden variar entre equipos de Linear. No los des por sentado: verifica con `list_issue_statuses` antes de intentar mover un issue si tienes cualquier duda sobre si un estado existe (si ya se resolvió al inicio de esta sesión — ver "Primer uso" arriba — no hace falta repetirlo por cada transición).

| Acción | Herramienta |
|---|---|
| Ver estado actual de un issue | `get_issue` |
| Ver los estados disponibles del equipo | `list_issue_statuses` |
| Cambiar estado / relación `blockedBy` / `duplicateOf` | `save_issue` |
| Dejar comentario | `save_comment` |

---

## MODO INICIO

**Cuándo:** "vamos a trabajar en POL-X", "sigamos con POL-X", "retomemos POL-X".

1. Extraer el identificador del issue.
2. `get_issue` para ver el estado actual.
3. Si el estado no es `In Progress`: `save_issue` con `state: "In Progress"`.
4. Si ya estaba en `In Progress`: no hacer nada.
5. Confirmar en una línea: `POL-X → In Progress` (omitir si ya estaba ahí).
6. Antes de proponer nada, leer la fuente de verdad del proyecto — no proponer un plan a ciegas apoyado solo en la descripción del issue. Esta skill se instala en repos distintos con documentación distinta, así que no asume nombres de archivo fijos:
   - Leer la descripción y comentarios completos del issue (ya disponibles por `get_issue`).
   - Revisar el `CLAUDE.md` del repo (o `README.md` si no hay `CLAUDE.md`) para identificar cuáles son los documentos de fuente de verdad de arquitectura/estándares de ese proyecto — normalmente listados ahí en una sección de layout o "cómo fluye el trabajo".
   - Leer esos documentos relevantes al área que toca el issue.
   - Si el repo no tiene `CLAUDE.md` ni `README.md` que lo indiquen, preguntar al usuario antes de proponer el plan en vez de adivinar.
7. Proponer un plan breve de implementación — qué se va a cambiar, en qué archivos/módulos, y por qué, fundamentado en lo leído en el paso 6 — y esperar autorización explícita del usuario antes de empezar a implementar. No escribas ni modifiques nada todavía; este paso es de alcance, no de ejecución.

---

## MODO BACKLOG → TODO (opcional)

**Cuándo:** se marca un issue como "siguiente a trabajar" (p. ej. resultado de un Sprint Planning) sin empezarlo todavía. Este estado es opcional — no es obligatorio pasar por él antes de In Progress.

1. `get_issue` para confirmar que está en Backlog.
2. `save_issue` con `state: "Todo"`.
3. Confirmar: `POL-X → Todo`.

---

## MODO PRUEBAS

**Cuándo:** el trabajo sobre un issue en curso llega al punto de validar o probar lo implementado.

1. `get_issue` para confirmar el estado actual — evita mover algo que ya esté en `In Review`, `Blocked` o `Done`.
2. `save_issue` con `state: "In Review"`.
3. Confirmar: `POL-X → In Review`.
4. Escribir las pruebas correspondientes a lo implementado (o extender las existentes si ya hay batería de pruebas para ese módulo) y ejecutarlas.
5. Reportar el resultado de forma concreta: qué se probó, qué pasó y qué falló — nunca "todo funcionó" sin mostrar la evidencia (casos ejecutados y su resultado real).
6. Si todas las pruebas pasaron: sugerir pasar a MODO CIERRE. No mover el issue a `Done` automáticamente — la decisión final de cerrar es del usuario.
7. Si alguna prueba falló o reveló un impedimento real: no sugerir el cierre. Señalarlo explícitamente y, si el impedimento detiene el trabajo, aplicar MODO BLOQUEO en su lugar.

---

## MODO BLOQUEO

**Cuándo:** aparece algo que impide seguir — otro bug que hay que resolver primero, una dependencia externa, un hallazgo que cambia el alcance.

1. `get_issue` para confirmar el estado actual.
2. `save_issue` con `state: "Blocked"` y `blockedBy: ["POL-Y"]` — idealmente en la misma llamada.
3. `save_comment` explicando la causa en prosa: qué se estaba haciendo, qué se encontró, por qué bloquea. La relación `blockedBy` no reemplaza la explicación en prosa, ni viceversa — **siempre ambos**.
4. Confirmar: `POL-X → Blocked (bloqueado por POL-Y)`.

**Cuando el bloqueador se resuelve:** al cerrar el issue bloqueante vía MODO CIERRE, revisar si el issue bloqueado puede volver a `In Progress` — si aplica, aplicar MODO INICIO sobre él.

---

## MODO PAUSA → BACKLOG

**Cuándo:** un issue en curso se pausa por falta de capacidad o reasignación de prioridad — no por un impedimento externo (eso es MODO BLOQUEO).

1. `get_issue` para confirmar el estado actual (`In Progress`).
2. `save_comment` explicando el motivo de la pausa.
3. `save_issue` con `state: "Backlog"`.
4. Confirmar: `POL-X → Backlog (pausado: [motivo breve])`.

---

## MODO DUPLICADO

**Cuándo:** el issue describe el mismo problema/solicitud que otro ya existente.

1. `get_issue` sobre ambos issues para confirmar que efectivamente se trata del mismo caso.
2. `save_issue` sobre el issue duplicado con `state: "Duplicate"` y la relación estructurada hacia el issue canónico (`duplicateOf` o equivalente del cliente).
3. `save_comment` señalando explícitamente cuál es el issue canónico.
4. Confirmar: `POL-X → Duplicate (de POL-Y)`.

No se continúa trabajando en un issue marcado Duplicate.

---

## MODO CANCELADO

**Cuándo:** se decide no continuar con un issue sin que esté resuelto ni sea duplicado de otro — p. ej. quedó obsoleto, se descartó el alcance, o es parte de la resolución de issues abiertos al cerrar un proyecto (`linear-cerrar-proyecto`, Precondición).

1. `get_issue` para confirmar el estado actual.
2. `save_comment` explicando el motivo de la cancelación — nunca cancelar en silencio.
3. `save_issue` con `state: "Canceled"`.
4. Confirmar: `POL-X → Canceled (motivo: [motivo breve])`.

No se continúa trabajando en un issue marcado Canceled.

---

## MODO CIERRE

**Cuándo:** se decide que un issue quedó resuelto.

1. `save_comment` documentando **primero**, antes de tocar el estado: cómo se resolvió (qué cambió, dónde) y qué pruebas pasó.
2. Solo después: `save_issue` con `state: "Done"`.
3. Confirmar: `POL-X → Done` (mencionar que el comentario de resolución ya quedó publicado).

Si el estado actual permite validación de 4 ojos (Metodología de Trabajo v1.2 §7 — alguien distinto al dev valida en In Review) y hay un segundo miembro disponible, confirma que esa validación ya ocurrió antes de mover a Done. Si hoy no hay un segundo humano disponible en el proyecto, el mismo Responsable puede autovalidarse — pero debe dejarlo explícito en el comentario de resolución (p. ej. "Autovalidado — no hay un segundo miembro disponible en este proyecto").

**Issues reportados por un cliente externo (Ruta cliente):** además de mover a Done, el ciclo real de cierre no termina ahí — sigue una ventana de 24h hábiles de confirmación del cliente (ver Protocolo de Ciclo de Vida en Linear, Paso 8 y Regla de Ruta cliente). Esta skill mueve el estado; el envío de la notificación y el manejo de la ventana de confirmación son responsabilidad del canal de comunicación con el cliente (Mateo u otro), no de esta skill.

---

## Reglas generales

- Ninguno de los modos pide autorización previa al usuario para el *cambio de estado en Linear* — son transiciones esperadas del flujo normal de trabajo. Esto no aplica al *trabajo de implementación en sí*: MODO INICIO sí exige leer la documentación del proyecto y autorización explícita del plan antes de empezar a implementar (ver pasos 6-7).
- Si `get_issue` muestra que el issue ya está en el estado destino, no repitas la transición.
- MODO PRUEBAS nunca sugiere el cierre sin haber escrito y ejecutado pruebas primero, ni reporta "todo funcionó" sin evidencia concreta de los casos ejecutados.
- MODO BLOQUEO siempre lleva comentario **y** relación `blockedBy` — nunca uno sin el otro.
- MODO CIERRE siempre comenta antes de mover a Done — nunca al revés.
- MODO DUPLICADO siempre lleva la relación estructurada **y** un comentario señalando el issue canónico.
- MODO PAUSA → BACKLOG siempre lleva un comentario con el motivo — nunca una regresión silenciosa.
- MODO CANCELADO siempre lleva un comentario con el motivo — nunca una cancelación silenciosa.
- Todo issue lleva un único label de Tipo, salvo la excepción documentada (Bug que requiere Feature/Improvement genuinos) — esta skill no cambia labels de Tipo por su cuenta; eso ocurre en la creación (`linear-crear-issue`).
- Si el MCP de Linear no está conectado, avisa antes de intentar cualquier transición.

---

## Mapeo de la acción según el cliente

| Acción | Cliente MCP (Claude Code / Cursor / Claude.ai) | Ask Linear (agente nativo) |
|---|---|---|
| Ver estado / relaciones | `get_issue` | "Muéstrame el estado de POL-X" |
| Ver estados del equipo | `list_issue_statuses` | "¿Qué estados tiene el equipo POLARIA?" |
| Cambiar estado / blockedBy / duplicateOf | `save_issue` | "Mueve POL-X a [estado]" |
| Comentar | `save_comment` | "Comenta en POL-X: ..." |
