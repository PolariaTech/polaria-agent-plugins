---
name: doc-updater
description: "Mantiene sincronizados los artefactos de documentación técnica (README, CHANGELOG, ADRs, glosario, y el resto de los 21 puntos de GUIA_DOCUMENTACION_EXTENDIDA/RESUMIDA de Polaria) de CUALQUIER proyecto con su estado real, y publica el Project Update correspondiente en Linear vía MCP — versión generalizada de la skill `doc-updater` original (que solo cubría Mateo Support/RAG Pipeline). Orquesta hacia la Guía como fuente de verdad de la estructura de cada artefacto — no reimplementa sus plantillas. El avance operativo (issue activo, próximos pasos, bloqueos) ya no vive en un archivo de estado local — vive en el propio feed de Project Updates de Linear. Si el proyecto no tiene ningún artefacto de documentación todavía, los crea empezando por los de prioridad Alta en vez de fallar. Se activa en tres momentos — MODO A (frase exacta \"Documenta el cambio aprobado\"), MODO B (cierre de hilo o fin de una sesión de trabajo sobre el proyecto — siempre publica el Project Update en Linear), y MODO INIT (cuando el proyecto no tiene ningún artefacto de documentación y hay que crear los relevantes desde cero antes de poder actualizarlos). Opera de forma quirúrgica sobre archivos existentes — nunca reescribe un archivo completo salvo que lo esté creando por primera vez."
compatibility: "Requiere acceso de archivos (Read/Edit/Write) al repo del proyecto, y MCP de Linear conectado para publicar el Project Update."
---

# Doc Updater — genérico (cualquier proyecto de Polaria)

Mantiene sincronizados los artefactos de documentación técnica de un proyecto con su estado real, y cierra el círculo con Linear publicando el Project Update correspondiente (Paso 3 del Protocolo de Ciclo de Vida en Linear). A diferencia de la versión original (atada a los dos grupos fijos de Mateo Support/RAG Pipeline, con un solo archivo `DOC.md` genérico y un archivo de estado local separado), esta pregunta qué proyecto y qué documentación le corresponde, orquesta hacia los 21 artefactos reales de `GUIA_DOCUMENTACION_EXTENDIDA.md` (o `GUIA_DOCUMENTACION_RESUMIDA.md` si el equipo prefiere la versión corta) en vez de inventar su propia estructura, los crea si todavía no existen, y no mantiene ningún archivo de estado/bitácora — ese rol lo cumple directamente el feed de Project Updates de Linear.

**Principio de orquestación:** esta skill decide **qué** artefacto(s) toca un cambio y **dónde** vive cada uno (ver "Mapa de los 21 artefactos" abajo) — la estructura interna de cada artefacto (qué campos lleva un ADR, qué secciones lleva el README, el formato del CHANGELOG) la define la Guía, no esta skill. Si tienes duda de cómo estructurar algo, consulta la sección correspondiente de la Guía antes de improvisar — nunca inventes una estructura propia cuando la Guía ya la define.

---

## Mapa de los 21 artefactos (Guía de Documentación de Software v2.0)

| # | Artefacto | Prioridad | Ubicación convencional | Sección de la Guía |
|---|---|---|---|---|
| 1 | README.md | Alta | raíz del repo | Punto 1 |
| 2 | Diagrama de arquitectura | Alta | `/docs/architecture/` (archivo fuente, ej. `.mermaid`/`.drawio`) | Punto 2 |
| 3 | Documentación de API (OpenAPI/Swagger) | Alta | según stack del proyecto — **solo si el proyecto expone una API** | Punto 3 |
| 4 | Variables de entorno | Alta | `.env.example` (raíz, sí se commitea) + `.env.local` (gitignored) | Punto 4 |
| 5 | Guía de instalación | Alta | sección "Instalación" del README; si crece mucho, `INSTALL.md` aparte | Punto 5 |
| 6 | CONTRIBUTING.md | Alta | raíz del repo | Punto 6 |
| 7 | Glosario de negocio | Alta | `/docs/glosario.md` | Punto 7 |
| 8 | Flujos de negocio end-to-end | Alta | `/docs/flujos-negocio.md` (o `/docs/flujos/` si hay varios extensos) | Punto 8 |
| 9 | ADRs | Media | `/docs/adr/NNNN-titulo-en-kebab-case.md` — un archivo por decisión, inmutable | Punto 9 |
| 10 | Documentación de testing | Media | sección del README, o `TESTING.md` aparte si crece | Punto 10 |
| 11 | Runbooks | Media | `/docs/runbooks/` | Punto 11 |
| 12 | Onboarding | Media | `/docs/onboarding.md` | Punto 12 |
| 13 | CHANGELOG.md | Media | raíz del repo, formato Keep a Changelog | Punto 13 |
| 14 | Seguridad y autenticación | Media | `/docs/security.md` | Punto 14 |
| 15 | Definición de entornos | Media | `/docs/entornos.md`, o sección del README si el proyecto es simple | Punto 15 |
| 16 | Observabilidad y monitoreo | Baja | `/docs/observability.md` | Punto 16 |
| 17 | Política de SemVer | Baja | documentada en `CONTRIBUTING.md`, o `/docs/versionado.md` | Punto 17 |
| 18 | Notas de migración | Baja | `/docs/migrations/` | Punto 18 |
| 19 | Storybook | Baja | configuración del propio proyecto — solo si tiene frontend con componentes UI | Punto 19 |
| 20 | Compliance | Baja | `/docs/compliance.md` | Punto 20 |
| 21 | `llms.txt` | Baja | raíz del repo (o `/docs/` si el proyecto separa docs ahí) | Punto 21 |

**No todos los 21 aplican a todos los proyectos** — el punto 3 (API) solo aplica si el proyecto expone endpoints; el punto 19 (Storybook) solo si hay frontend con componentes UI aislables. Si un punto no aplica, no lo fuerces — dilo explícitamente al confirmar con el usuario y sigue con el resto.

**Aparte de los 21 — plumbing interno de Polaria, no de la Guía:** la sección **"Configuración de Linear"** (Team ID + mapa de estados) vive en `<NOMBRE>_DOC.md`, un archivo propio de este flujo de trabajo que las 5 skills de Linear leen y actualizan — no es uno de los 21 artefactos de la Guía y no debe confundirse con documentación técnica real del proyecto.

---

## Primer uso en esta sesión — coordinación con las otras 4 skills

1. **Identidad del operador:** `get_user({query: "me"})` — nunca se pregunta ni se cachea; el MCP ya sabe quién sos por tu propia conexión.
2. **Team + mapa de estados:** esta skill es la dueña de la sección **"Configuración de Linear"** dentro de `<NOMBRE>_DOC.md` — ahí quedan Team ID y el mapa nombre→ID de cada estado, resueltos una sola vez (`list_teams` → `list_issue_statuses`) y reutilizados por las otras 4 skills en las siguientes sesiones, sin volver a preguntar. Si el DOC no existe todavía, se crea junto con esta sección (MODO INIT).
3. **Project:** nunca se cachea — cambia con cada épica. Se resuelve cada vez vía `list_projects` filtrado por Team y `status.type: started` (esto depende de que los proyectos terminados se cierren a tiempo — Regla 1 del Protocolo de Ciclo de Vida en Linear).

## Triggers

**MODO INIT — el proyecto no tiene ningún artefacto de documentación todavía:** se activa cuando, en cualquiera de los otros dos modos, no se encuentra ninguno de los artefactos relevantes del Mapa de los 21 para el proyecto indicado.

**MODO A — Cambio aprobado:** frase exacta `"Documenta el cambio aprobado"`. Sin esa frase, no se activa aunque haya cambios discutidos o probados en la conversación.

**MODO B — Cierre de hilo / fin de sesión de trabajo:** frases como "cerremos el hilo", "abrimos otro chat", "cierro aquí", "nuevo hilo", o el equivalente de fin de sesión de trabajo sobre el proyecto (Paso 3 del Protocolo de Ciclo de Vida en Linear) — este modo, a diferencia del original, **siempre** intenta publicar el Project Update en Linear al final, no solo actualizar archivos locales.

---

## Paso 0 — Determinar el proyecto y qué artefactos ya existen (silencioso, salvo MODO INIT)

1. Identificar sobre qué proyecto de Linear/repo se está trabajando. Si no es evidente por el contexto de la conversación o del directorio actual, preguntar — no asumir.
2. Resolver dónde vive la documentación general del proyecto, en este orden (dos estilos válidos, cada persona usa el suyo de forma consistente):
   - **Estilo local:** los artefactos del Mapa de los 21 viven en la raíz y en `docs/` (o equivalente) del repo del proyecto — el estilo por defecto.
   - **Estilo repo central:** si no aparece nada ahí, un repo aparte dedicado a documentación (ej. un repo de "flujos"), clonado localmente en esta máquina. Si no sabes si existe uno, pregunta: "¿la documentación de este proyecto vive en este mismo repo, o en un repo central aparte? Si es aparte, ¿cuál es la ruta local de ese repo clonado?" — no asumas un estilo sobre otro.
3. Buscar, en la ubicación resuelta, cuáles artefactos del Mapa de los 21 ya existen (README.md y CONTRIBUTING.md en la raíz, `docs/adr/`, `docs/glosario.md`, etc. — no hace falta verificar los 21 cada vez, solo los relevantes al cambio que disparó esta skill, ver MODO A Paso 3).
4. Si no existe **ningún** artefacto todavía → pasar a **MODO INIT**.
5. Si existen algunos pero no el(los) que este cambio necesita → no es MODO INIT; crear solo el artefacto faltante como parte de MODO A/B, en la ubicación convencional del Mapa.

No mencionar este paso al usuario salvo que dispare MODO INIT.

---

## MODO INIT — crear los artefactos relevantes desde cero

Cuando el proyecto no tiene ningún artefacto de documentación todavía:

1. Confirmar con el usuario la ubicación (raíz + `docs/` del repo del proyecto, o el repo central que el usuario indique) antes de crear nada.
2. Mostrar el Mapa de los 21 artefactos y proponer crear primero los de **prioridad Alta (puntos 1-8)** que apliquen a este proyecto — señalar explícitamente cuáles de los 8 no aplican (ej. punto 3 si el proyecto no expone API) en vez de crearlos vacíos. Confirmar con el usuario la lista final antes de crear nada. No crear de entrada los de prioridad Media/Baja — se van creando cuando un cambio real los necesite (ver MODO A Paso 3), siguiendo el principio de aplicación progresiva de la propia Guía.
3. Para cada artefacto a crear, seguir la estructura exacta de la sección correspondiente en `GUIA_DOCUMENTACION_EXTENDIDA.md` (o `GUIA_DOCUMENTACION_RESUMIDA.md` si el equipo pidió la versión corta) — nunca inventar una estructura propia. Si el artefacto tiene contenido que aún no se conoce, marcarlo explícitamente como `_Pendiente — sin información todavía._`, nunca dejarlo vacío sin explicación.
4. Crear además `<NOMBRE>_DOC.md` con solo la sección **"Configuración de Linear"** (Team ID + mapa de estados, ver "Primer uso" arriba) — esto es aparte de los 21 artefactos, es plumbing interno de Polaria que las 5 skills de Linear necesitan, no documentación técnica del proyecto.

   No se crea ningún archivo de estado/bitácora aparte — el avance operativo (issue activo, próximos pasos, bloqueos) vive directamente en el feed de Project Updates de Linear (ver MODO B, Paso B4), no en un archivo local. El Project ID tampoco se guarda aquí — cambia con cada épica, se resuelve fresco cada vez (ver "Primer uso").

5. Confirmar con el usuario los artefactos creados y su ubicación antes de continuar con el cambio que disparó la creación.
6. Después de crear lo necesario, continuar con MODO A o MODO B según corresponda, ya con los artefactos existentes.

---

## Herramientas (Claude Code / Cursor)

| Acción | Herramienta | Nota |
|---|---|---|
| Leer archivo o sección | `Read` | Obligatorio leer un archivo antes de editarlo |
| Reemplazo quirúrgico | `Edit` | `old_string` debe ser único en el archivo; si no, incluir líneas de contexto |
| Buscar una sección/fragmento | `Grep` | Útil para localizar el bloque exacto a reemplazar |
| Crear archivo nuevo (solo MODO INIT) | `Write` | Solo para archivos que no existen todavía — nunca para sobrescribir uno existente |

---

## Protocolo de ejecución — MODO A

### Paso 1 — Leer el contexto del cambio aprobado

Revisar la conversación para identificar con precisión: qué componente/nodo/archivo/prompt fue modificado, cuál era el valor anterior, cuál es el valor nuevo aprobado, y si es un bug corregido, una mejora, o una nueva funcionalidad. No preguntar si el contexto ya está en la conversación; si hay ambigüedad genuina, una sola pregunta antes de continuar.

### Paso 2 — Determinar tipo de versión (SemVer)

**Es MAJOR si cualquiera es SÍ:**
- ¿El cambio rompe compatibilidad con la DB o APIs externas?
- ¿Se rediseña la arquitectura del componente?
- ¿Se elimina o reemplaza un componente principal?
- ¿El usuario o integrador necesita adaptar su forma de usar el sistema?

**Es MINOR si cualquiera es SÍ:**
- ¿El usuario puede hacer algo nuevo que antes no podía?
- ¿Se agrega una integración, módulo o agente nuevo?
- ¿Se expone una nueva capacidad sin romper las existentes?

**Es PATCH si cualquiera es SÍ:**
- ¿Es una corrección de un error reportado o detectado?
- ¿Es un ajuste interno sin cambio de comportamiento visible?
- ¿Es una mejora de prompt, refactor o actualización de configuración?

Incremento: PATCH x.x.X→x.x.(X+1) · MINOR x.X.x→x.(X+1).0 · MAJOR X.x.x→(X+1).0.0

**Orden de evaluación:** si el cambio cumple criterios de más de un nivel a la vez, evalúa de arriba hacia abajo — primero MAJOR, si ninguna aplica MINOR, si ninguna aplica PATCH. Gana el primer bloque que tenga al menos un SÍ, nunca el último.

**Justificación obligatoria:** todo cambio de versión debe venir acompañado de qué pregunta del checklist respondió SÍ y por qué — nunca solo el número resultante.

### Paso 3 — Identificar qué artefactos del Mapa de los 21 toca este cambio

Mapeo completo antes de proponer cualquier cambio, usando el Mapa de los 21 artefactos para decidir cuáles se tocan. Ejemplos: una variable de entorno nueva → `.env.example` + sección Variables del README (punto 4/1); una decisión de arquitectura → un ADR nuevo en `docs/adr/` (punto 9), nunca editar un ADR existente; un endpoint nuevo o modificado → la documentación de API (punto 3); un cambio en cómo se instala o corre el proyecto → README/INSTALL (punto 5); un flujo de negocio nuevo o alterado → `docs/flujos-negocio.md` (punto 8). El CHANGELOG (punto 13) se toca casi siempre — la excepción es la lista explícita de la Guía (refactors internos sin cambio de comportamiento, cambios de documentación, actualización de dependencias sin cambio de comportamiento no van al CHANGELOG). Si un artefacto relevante todavía no existe, crearlo seguido de la sección correspondiente de la Guía (mismo criterio que MODO INIT Paso 3), no como excepción aparte. El estado operativo (issue activo, próximos pasos) no se edita aquí — se publica como Project Update en Linear (MODO B, Paso B4).

### Paso 4 — Presentar autorizaciones una por una

```
¿Me autorizas a reemplazar esto:

[bloque de texto actual — copiado exacto del archivo]

por esto:

[bloque de texto nuevo — el cambio aprobado]

en la sección **[nombre de la sección]** de [nombre del archivo]?
```

Una autorización por cambio. El bloque "actual" debe ser texto copiado exactamente del archivo. Esperar respuesta explícita antes de seguir. Si se rechaza, registrar y continuar con el siguiente. Si se pide modificar, ajustar y volver a presentar esa misma autorización.

### Paso 5 — Ejecutar Edit por cada autorización aprobada

1. `Edit` con `old_string` exacto y `new_string` nuevo.
2. Confirmar: `✓ Actualizado en [archivo] — sección [nombre]`.
3. Siguiente autorización pendiente.

Si `old_string` no es único, incluir más contexto o usar `replace_all` solo si el reemplazo debe aplicarse a todas las ocurrencias intencionalmente.

### Paso 6 — Verificación final

Mostrar el conteo por archivo tocado. Los cambios ya quedaron en disco — no releer solo para verificar, salvo error o pedido explícito del usuario.

---

## Protocolo de ejecución — MODO B (cierre de hilo / fin de sesión)

### Paso B1 — Leer los artefactos existentes del proyecto relevantes al hilo (silenciosamente, o crear vía MODO INIT si no existe ninguno)

### Paso B2 — Comparar contra lo trabajado en el hilo

Usando el Mapa de los 21 artefactos (mismo criterio que MODO A Paso 3), determinar cuáles cambiaron durante el hilo y no están reflejados todavía:

```
[NOMBRE PROYECTO]
  [Artefacto 1, ej. README]: [sin cambios / N cambios detectados]
  [Artefacto 2, ej. CHANGELOG]: [sin cambios / N cambios detectados]
  ... (uno por artefacto tocado durante el hilo)
```

### Paso B3 — Aplicar cambios locales

Si hay cambios, seguir el flujo de MODO A (Pasos 2→3→4→5→6) — el Paso 2 (determinar tipo de versión) no se omite: toda entrada nueva de CHANGELOG necesita su SemVer. Si no hay cambios, decirlo y pasar a B4.

### Paso B4 — Publicar el Project Update en Linear

**Excepción — trabajo sin proyecto asociado:** si el issue/trabajo de este hilo no pertenece a ningún Project de Linear (ej. una personalización o incidencia suelta, sin Project vinculado), no ejecutes este paso — actualizar la documentación local (B1-B3) es todo lo que corresponde. Dilo explícitamente: `Sin Project Update — este trabajo no está asociado a ningún Project de Linear.` y pasa directo a B5.

Fuera de esa excepción, y a diferencia de la versión original de Mateo Support, este modo **siempre** intenta este paso al cerrar (no solo actualizar archivos locales):

1. Resolver el Project de Linear correspondiente (si no es evidente, preguntar).
2. Construir el body del update con la plantilla de avance (ver Protocolo de Ciclo de Vida en Linear, Paso 3):

```markdown
## 📍 Avance — <NOMBRE PROYECTO> (<FECHA>)

<Una línea de resumen del estado general.>

### Avance desde el último update
- <Issues movidos de estado desde la última actualización, por identificador, agrupados por frente si aplica.>

### Bloqueos / riesgos
- <Solo si hay alguno — se omite si no hay.>

### Próximos pasos
- <Qué sigue antes del próximo update.>
```

3. Publicar vía `save_status_update` con `type: project`, `health` (`onTrack`/`atRisk`/`offTrack` — inferido del avance real, nunca por defecto optimista sin evidencia).
4. Confirmar: `✓ Project Update publicado en Linear — [proyecto]`.

Si el MCP de Linear no está conectado o la publicación falla, decirlo explícitamente y no bloquear el resto del cierre por eso — los cambios locales ya aplicados en B3 quedan igual.

### Paso B5 — Prompt de continuidad

```
Continuamos [NOMBRE PROYECTO].
Archivos actualizados: [lista solo de los archivos con cambios reales]
Project Update en Linear: [publicado / no publicado — motivo]
Próximo paso: [acción concreta y específica].
```

### Paso B6 — Cierre

Listar por nombre los archivos modificados y confirmar si el Project Update quedó publicado. Si nada cambió, decirlo explícitamente.

---

## Reglas de operación

1. **Nunca reescribir un archivo existente completo** — solo `Edit` quirúrgico. `Write` solo se usa para crear un archivo que no existía (MODO INIT).
2. **Nunca ejecutar un Edit sin autorización explícita** del usuario.
3. **Siempre leer los archivos con `Read`** antes de empezar y antes de cada `Edit`.
4. **El tipo de versión lo determina el protocolo** (Paso 2) — no la percepción del cambio.
5. **Todo cambio de versión lleva su justificación explícita.**
6. **Una autorización por cambio.**
7. **Si un Edit falla**, mostrar el fragmento exacto que falló y pedir confirmación del texto correcto antes de reintentar.
8. **No documentar cambios en prueba** — si el usuario menciona que algo se está evaluando, detener y esperar nueva instrucción.
9. **Nunca insertar saltos de línea manuales a mitad de una oración o viñeta** — cada párrafo, viñeta o celda de tabla que se escriba o edite va en una sola línea de texto, sin cortar la oración a la mitad con un salto de línea. Esto aplica sin importar el editor (Claude Code o Cursor) ni el archivo (README, CHANGELOG, DOC técnico, etc.).
10. **MODO B siempre intenta publicar el Project Update en Linear**, incluso si no hubo cambios locales que documentar (el avance puede ser puramente de estado de issues, sin cambio de documentación).
11. **Si el proyecto no tiene documentación y no se puede confirmar la ubicación con el usuario**, no inventar una ruta — preguntar antes de crear nada (MODO INIT).

---

## Manejo de errores comunes

| Error | Causa | Acción |
|---|---|---|
| `Edit` no encuentra el `old_string` | El archivo fue modificado manualmente o el texto no es exacto | `Read`/`Grep` la sección, mostrar el texto actual y pedir confirmación |
| `Edit` dice que el `old_string` aparece más de una vez | Texto repetido | Incluir más contexto, o `replace_all` si es intencional en todas las ocurrencias |
| No se encuentra ningún artefacto de documentación del proyecto | Proyecto nuevo o sin documentar todavía | Activar MODO INIT |
| La ubicación convencional del Mapa no coincide con la estructura real del proyecto | El proyecto ya tiene su propia convención (ej. `docs/` con otro layout) | Preguntar dónde vive ese artefacto en este proyecto específico — no forzar la ubicación del Mapa sobre una convención ya establecida |
| No se puede resolver el Project de Linear en B4 | Nombre ambiguo o no provisto | Preguntar antes de publicar — nunca adivinar el proyecto destino del update |
| Cambio en la conversación ambiguo | Varios cambios discutidos, no está claro cuál fue aprobado | Una sola pregunta de aclaración antes de continuar |
