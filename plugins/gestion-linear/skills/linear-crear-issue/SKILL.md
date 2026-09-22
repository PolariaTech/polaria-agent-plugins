---
name: linear-crear-issue
description: "Crea issues en Linear con estructura 5W2H + estimación autónoma para cualquier proyecto de un equipo — trae los IDs (team, labels, estados) del equipo POLARIA como ejemplo/default en su sección \"Configuración rápida\", fáciles de reemplazar para adaptarla a otro equipo o workspace de Linear. Pregunta en qué proyecto trabajar y a quién asignar (en vez de asumir siempre el mismo proyecto activo y su lead) — todo lo demás (estimación, estructura 5W2H, preview antes de crear) funciona igual. Actívala cuando el usuario diga frases como \"crea un issue\", \"registra un requerimiento\", \"abre un ticket\", \"crea un bug\", \"reporta un problema en Linear\", \"agrega un feature\", o cualquier variación que implique crear un issue en Linear."
compatibility: "Requiere MCP de Linear conectado. Los nombres de herramienta varían por cliente — ver tabla de mapeo abajo."
---

# Skill: Crear Issue en Linear (genérica, adaptable a cualquier equipo)

## ⚙️ Configuración rápida — adaptar antes de usar en otro equipo/workspace

Todos los IDs de este documento son los del equipo **POLARIA** (Polaria Tech) — sirven como ejemplo real y como default si no se indica otro equipo. Para usar esta skill en otro equipo de Linear, resuelve estos mismos valores una vez (`list_teams` → `list_issue_statuses` → `list_issue_labels`) y reemplázalos aquí:

| Parámetro | Valor actual (equipo POLARIA) | Cómo resolverlo en otro equipo |
|---|---|---|
| Team ID | `a1ba209a-21ce-4ec1-88d4-1392b5771391` | `list_teams` |
| State ID "Backlog" | `d8b93b51-7dd9-41f3-92fb-d1234e035de2` | `list_issue_statuses` del team |
| Label "Bug" | `79a7a86a-a45b-4bf1-8b8f-2c99312d264d` | `list_issue_labels` del team |
| Label "Feature" | `20fb54a3-9df5-4125-8181-ad98d4019617` | ídem |
| Label "Improvement" | `14273071-4ba6-42bc-abb6-23f8483c0977` | ídem |
| Label "Question" | `8727bf1d-6aa8-4b62-9fdc-756fbf9205a5` | ídem |
| Label "personalization" | `ea5b1bff-0e2b-4879-9575-9d149eea9b9a` | ídem |
| Prefijo de identificador | `POL-` | Depende del "key" del team en Linear |

Una vez cacheados en la sección "Configuración de Linear" de `<NOMBRE>_DOC.md` (ver `doc-updater`), estos valores no se vuelven a resolver a mano cada sesión.

## Propósito

Crear issues en Linear con estructura 5W2H completa **más una estimación de esfuerzo**, extrayendo el contexto disponible del proyecto sobre el que se está trabajando. El usuario no describe el problema desde cero ni responde preguntas de estimación — tú tienes el contexto. Solo confirma antes de crear.

A diferencia de la versión original (atada siempre a "Mateo Support"), esta skill **pregunta el proyecto destino** si no es evidente por el contexto de la conversación — nunca lo asume salvo que haya un único proyecto obvio en el repo/sesión actual.

---

## Primer uso en esta sesión

1. **Identidad del operador:** `get_user({query: "me"})` — nunca se pregunta con una lista ni se cachea; el MCP ya sabe quién sos por tu propia conexión. Si esta llamada falla, es un problema de autenticación del MCP (hay que reconectar Linear), no de membresía del equipo.
2. **Team + mapa de estados:** revisar si `<NOMBRE>_DOC.md` ya tiene la sección "Configuración de Linear" (Team ID + mapa nombre→ID de estados). Si existe, usarla directamente. Si no existe, resolver una vez — `list_teams` (mostrar lista si hay más de uno) → `list_issue_statuses` de ese team — y guardarlo ahí (crear el DOC primero si no existe, ver `doc-updater` MODO INIT).
3. **Project:** nunca se cachea — se resuelve cada vez que hace falta, no solo al principio de la sesión. `list_projects` filtrado por el Team y por `status.type: started` (activos únicamente, nunca `completed`/`canceled`):
   - Si queda exactamente un proyecto → úsalo directo, confirmando en una línea (p. ej. "Usando el proyecto activo: X — ¿correcto?").
   - Si quedan varios → muestra la lista acotada para que el miembro seleccione cuál corresponde a este issue.
   - Si no queda ninguno → detente y pregunta — no asumas ni inventes un proyecto.

   Este filtro depende de que el equipo cierre formalmente cada proyecto terminado a tiempo (skill "Cerrar Proyecto en Linear", Regla 1 del Protocolo de Ciclo de Vida en Linear) — si esa disciplina se rompe, un proyecto ya terminado pero sin cerrar aparecería como "activo" aquí.

## Protocolo de ejecución

### Paso 1 — Configuración previa: asignado

El proyecto destino ya se resolvió en "Primer uso en esta sesión" (punto 3) — no se vuelve a preguntar aquí.

**¿A quién se asigna?** — por defecto, el lead del proyecto destino (resuelto vía `get_project`, nunca hardcodeado). Si el usuario indica explícitamente otra persona, usa esa. Si el proyecto no tiene lead, dilo explícitamente y deja el issue sin asignar — nunca asignes a alguien al azar.

No sigas al Paso 2 sin resolver esto.

---

### Paso 2 — Extraer contexto y construir el issue

Extrae el contexto del tema mencionado por el usuario, según el entorno:

- **En Claude Code (repo local):** busca en la documentación del proyecto (`Grep`/`Read`) — el archivo de documentación técnica, el changelog (clave para estimar por similitud), y el estado operativo del proyecto, si existen. Si el proyecto no tiene ninguna documentación local todavía, dilo y estima con lo que el usuario indique en la conversación, marcando confianza baja.
- **En Claude.ai (proyecto):** usa `project_knowledge_search("tema mencionado por el usuario")`.

Con el contexto recuperado, construye internamente:

- **Título:** Verbo + objeto + contexto. Máx 80 caracteres.
- **Tipo:** Bug / Feature / Improvement — inferido del contexto. Un issue lleva un único label de Tipo, salvo que resolverlo genuinamente requiera trabajo de otro tipo (p. ej. un Bug cuya solución real exige una Feature) — en ese caso, ambos labels, y dilo explícitamente en el preview.
- **Prioridad:** Urgent / High / Medium / Low — inferida del contexto, usando el árbol de decisión de Metodología de Trabajo v1.2 si está disponible.
- **Descripción 5W2H:** ver estructura obligatoria abajo.
- **Estimación:** motor de estimación (más abajo). No preguntes nada al usuario para estimar.

No preguntes nada de esto todavía. Construye primero.

---

### Paso 3 — Mostrar preview y pedir confirmación

```
📋 ISSUE A REGISTRAR

Título:     [título]
Tipo:       [Bug / Feature / Improvement (+ segundo tipo si aplica la excepción)]
Prioridad:  [Urgent / High / Medium / Low]
Proyecto:   [proyecto confirmado en el Paso 1]
Estado:     Backlog
Asignado a: [persona confirmada en el Paso 1]

─────────────────────────────────────
DESCRIPCIÓN (Markdown — así queda en el campo description de Linear)

> **Stakeholder:** [nombre] (reporta) · **Prioridad:** [label]

## 📋 Descripción (What)

[Párrafo técnico del requerimiento]

## 💡 Justificación de Negocio (Why)

[Impacto real a nivel de negocio]

## 🎯 Caso de Uso

- **Actor Principal:** [quién]
- **Ubicación:** [módulo o contexto]
- **Frecuencia:** [cuándo ocurre / desde cuándo]

## 🔧 Flujo Principal (How)

1. [paso]
2. [paso]
...

## ⚠️ Flujos Alternativos / Reglas de Negocio

[Consideraciones técnicas relevantes]

## 🚧 Restricciones

[Limitaciones de tiempo, dependencias, o "Ninguna"]

---

## ⏱️ Estimación

| Concepto | Valor |
|---|---|
| Tiempo estimado | [Xh o rango Xh–Yh] |
| Talla | [XS / S / M / L / XL / XXL] → [N] pts |
| Confianza | [alta / media / baja] |

**Desglose**
- Implementación (IA): [Xh]
- Investigación: [Xh o "no aplica"]
- Pruebas/validación: [Xh]
- Margen por riesgo: [Xh]

**Razones:** [por qué esa talla]
**Riesgos:** [dependencias externas, incertidumbre, o "ninguno relevante"] · **Recomendación:** [dividir issue: sí/no — motivo si aplica]

[Información faltante: solo si aplica]
─────────────────────────────────────

¿Confirmas? (sí / ajusta X cosa)
```

**Nunca crear el issue sin confirmación explícita.** El bloque bajo "DESCRIPCIÓN" es literal — se envía tal cual al parámetro `description`, con markdown real, no texto plano con etiquetas.

---

### Paso 4 — Crear el issue en Linear

Con confirmación recibida, crea el issue con los parámetros correctos, incluyendo `assignee` según lo resuelto en el Paso 1 (omitir si no hay lead — nunca usar "me" como comodín).

La estimación se registra en **dos lugares**: (1) dentro de la descripción como sección `## ⏱️ Estimación`, y (2) en el campo nativo `estimate` con los puntos correspondientes.

**Mapeo talla → puntos (escala T-shirt del equipo POLARIA):**

| Talla | Puntos (`estimate`) |
|---|---|
| XS | 1 |
| S | 2 |
| M | 3 |
| L | 5 |
| XL | 8 |
| XXL | 8 (máximo de la escala; siempre recomendar dividir) |

**Mapeo de labels de tipo:** UUIDs en la tabla de "Configuración rápida" al inicio de este documento (`personalization` es una categoría ortogonal al Tipo — marca trabajo planeado fuera de los proyectos principales, se combina libremente con cualquier label de Tipo, nunca cuenta como segundo Tipo; `Question` queda fuera de alcance del flujo estándar hasta que se defina).

**Mapeo de prioridades:** Urgent=1, High=2, Medium=3, Low=4 (estándar de Linear, no varía por equipo).

**ID de equipo y State ID de "Backlog":** ver tabla de "Configuración rápida" al inicio de este documento.

Después de crear, confirmar con:
```
✅ Issue creado: [IDENTIFIER] — [título]
🔗 [url del issue]
👤 Asignado a: [nombre] (o "Sin asignar — el proyecto no tiene lead")
⏱️ [talla] ([N] pts) · [tiempo estimado] · confianza [nivel]
```

---

## Estructura 5W2H — guía de redacción

Igual que la versión original: markdown real, headers `##` con emoji fijo, blockquote de metadatos al inicio, tabla de estimación al final. No cambies los emojis ni el orden entre issues.

### `> Stakeholder` (Who)
Por defecto, el operador identificado en "Primer uso" (o ya conocido de esta sesión) — quien está reportando el issue. Solo usa otro nombre si el usuario indica explícitamente que reporta en nombre de un tercero. Nunca "Equipo Polaria" genérico si hay una persona concreta.

### `## 📋 Descripción (What)` — párrafo técnico, sin jerga de usuario final.
### `## 💡 Justificación de Negocio (Why)` — impacto real, cuantificado si hay datos.
### `## 🎯 Caso de Uso` (Where/When) — Actor Principal / Ubicación / Frecuencia, en negrita.
### `## 🔧 Flujo Principal (How)` — lista numerada, nunca checklist.
### `## ⚠️ Flujos Alternativos / Reglas de Negocio` — casos borde, excepciones conocidas.
### `## 🚧 Restricciones` — dependencias bloqueantes, limitaciones, fechas.

Después de Restricciones va un `---` separando el cuerpo 5W2H de la estimación.

---

## Motor de estimación (autónomo, asistido por IA)

### Contexto base — SIEMPRE se desarrolla con IA como par de implementación
- La **implementación de código** se comprime fuerte.
- Lo que **no se comprime**: dirigir/revisar el output de la IA, decisiones de diseño, pruebas manuales, validación con datos reales, despliegue, coordinación con terceros.
- **Investigación** de conocimiento técnico general se acelera; la que depende de contexto de negocio, accesos o sistemas externos no se comprime.
- **Esperas externas** se cuentan aparte y nunca se comprimen.

### Estima sin preguntar
Infiere cada factor desde la documentación y el historial disponibles del proyecto:
- **Experiencia/similitud:** ¿ya se hizo algo parecido en este proyecto?
- **Claridad de la solución:** ¿ya está indicado el camino, o hay que descubrirlo?
- **Investigación:** ¿toca tecnología/integración nueva para el proyecto?
- **Complejidad:** ¿cuántas capas toca? ¿riesgo de romper algo cercano?
- **Dependencias:** ¿accesos, credenciales, validación de terceros?
- **Validación:** ¿pruebas manuales relevantes?

Si un factor no puede inferirse, usa un rango, baja la confianza, y anótalo en "Información faltante" — no inventes certeza. Solo pregunta si falta algo crítico que impida estimar.

### Cálculo
```
Tiempo = implementación (con IA) + investigación (si aplica) + pruebas/validación + margen por riesgo
```

### Escala (mínimo estimable: 1 hora)

| Talla | Rango | Puntos | Nota |
|---|---|---|---|
| XS | 1–2 h | 1 | |
| S | >2–4 h | 2 | |
| M | >4–8 h | 3 | |
| L | >8–16 h | 5 | |
| XL | >16–24 h | 8 | Recomendar dividir |
| XXL | >24 h | 8 | Dividir obligatorio |

**Verificación obligatoria antes de mostrar el preview:** la talla se deriva del rango de horas ya calculado, buscándolo en esta tabla — nunca al revés (nunca elegir la talla primero por sensación de tamaño y luego justificarla con un rango). Si el rango cruza dos filas, usa la fila de la cifra más alta. Antes de escribir la sección de estimación del preview, relee el rango contra esta tabla una vez más y confirma que la talla coincide exactamente.

### Confianza
Alta = precedente claro + solución definida. Media = parcialmente parecido o con punto abierto. Baja = nuevo/incierto/con dependencias externas → usa rango.

### Regla para dividir
Sugiere dividir si: la estimación cae en ≥XL, mezcla varias tareas distintas, combina investigación + implementación grande + validación amplia, depende de múltiples cambios en distintas capas, o no se puede explicar como una sola entrega verificable.

---

## Mapeo de la acción según el cliente

| Acción | Cliente MCP (Claude Code / Cursor / Claude.ai) | Ask Linear (agente nativo) |
|---|---|---|
| Ver proyecto/lead | `get_project` | "Muéstrame el proyecto X y su responsable" |
| Buscar contexto (Claude.ai) | `project_knowledge_search` | — |
| Crear el issue | `save_issue` | "Crea un issue en [proyecto] con estos datos: ..." |

---

## Reglas estrictas

- **Nunca preguntar** qué es el problema o cómo reproducirlo — eso está en el contexto disponible.
- **Siempre preguntar (o inferir y confirmar en una línea) el proyecto destino** — nunca asumir en silencio.
- **Nunca preguntar quién debe quedar asignado** salvo que el proyecto no tenga lead — por defecto, el lead resuelto vía `get_project`.
- **Nunca preguntar datos de estimación** — infiérelos del contexto; pregunta solo si falta algo crítico.
- **Nunca crear** sin mostrar el preview y recibir confirmación.
- **Un único label de Tipo, salvo la excepción documentada** (Bug que requiere Feature/Improvement genuinos) — dilo explícitamente cuando aplique.
- **Siempre llenar el campo nativo `estimate`** además de la sección de estimación en la descripción.
- Si el MCP de Linear no está conectado, avisar antes de intentar crear.