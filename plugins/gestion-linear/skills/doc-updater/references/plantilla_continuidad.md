# Plantilla de CONTINUIDAD.md

Plantilla que usa el Paso B5 del `doc-updater` para escribir `CONTINUIDAD.md` en la raíz del repo del proyecto. El archivo se sobrescribe completo en cada cierre: es un traspaso puntual de una sesión de Claude/Cursor a la siguiente, no un histórico. El histórico del proyecto vive en el feed de Project Updates de Linear y en los artefactos de documentación (CHANGELOG, ADRs); `CONTINUIDAD.md` está fuera de git (`.gitignore`) porque solo le sirve a quien retoma en esta máquina.

## Reglas de llenado

- Cada sección DEBE llenarse con información verificable de la sesión que cierra, del Project Update recién publicado (Paso B4), de los issues de Linear del proyecto o de la documentación del repo. NUNCA inventar ni rellenar con texto genérico.
- Si una sección no tiene contenido real, se escribe `Ninguno.` — nunca se omite la sección ni se rellena.
- El objetivo es UNA sola tarea, idealmente un solo issue de Linear (`POL-XX`). Si hay varias pendientes, se elige la siguiente por este orden: el issue que quedó In Progress sin terminar → el de mayor prioridad en Todo del mismo Project → lo que el usuario haya dicho que sigue. Las demás van en "Fuera de alcance".
- Rutas siempre relativas a la raíz del repo, con la sección exacta cuando aplique.
- El primer paso DEBE ser literal y ejecutable sin interpretar: "Lee X, sección Y, y propón Z", nunca "sigue con lo de X".
- Cada párrafo o viñeta en una sola línea, sin saltos de línea manuales.
- DEBERÍA quedar bajo 80 líneas. Si no cabe, sobra detalle: lo que ya está en Linear o en la documentación del repo se enlaza (identificador del issue, ruta del archivo), no se copia.

## Plantilla

```markdown
# CONTINUIDAD — [NOMBRE PROYECTO]

> Generado por `doc-updater` (Modo B) el [AAAA-MM-DD] al cerrar la sesión: "[objetivo de la sesión que cierra, en una frase]".

## 0. Instrucción de arranque
Lee este archivo completo antes de hacer nada. Después lee solo lo listado en la sección 4 ("Leer primero"). Las decisiones de la sección 3 ya están tomadas: NO las re-discutas ni las vuelvas a proponer. Empieza por el paso de la sección 5. Cuando se cumpla la sección 6, aplica el Modo C de `doc-updater` (sugerir cierre de hilo).

## 1. Objetivo de esta sesión
[UNA tarea, en una frase, con su resultado verificable y su issue. Ej.: "POL-84 — validar el campo teléfono del formulario de registro en backend, con prueba automatizada pasando."]

## 2. Contexto mínimo
- [Por qué esta tarea es la siguiente — máx. 3 viñetas.]
- [En qué quedó la sesión anterior respecto a esta tarea, y en qué estado de Linear está el issue.]

## 3. Decisiones ya tomadas (no re-discutir)
- [Decisión] — porque [razón]. ([fecha, ADR o issue donde quedó])

## 4. Archivos
**Leer primero:**
- `[ruta]` — [sección] — [para qué]

**Tocados en la sesión anterior:**
- `[ruta]` — [qué cambió en una línea]

## 5. Primer paso
[Acción literal y ejecutable. Ej.: "Lee `src/api/registro.ts`, función `validarRegistro`, y propón la regla de backend para el campo teléfono según `schemas/schema_registro.md`."]

## 6. Criterio de terminado
- [Condición observable que indica que la tarea terminó. Ej.: "La prueba `registro.test.ts` pasa y POL-84 está en In Review."]

## 7. Restricciones activas
- [Regla del proyecto, protocolo de Polaria o acuerdo del equipo que aplica a ESTA tarea, por nombre.]

## 8. Preguntas abiertas / bloqueos
- [Pregunta] — la responde [rol, nunca nombre propio]. [Issue que bloquea, si hay.]

## 9. Fuera de alcance
- [Lo que NO se hace en esta sesión, incluidas las otras tareas pendientes que esperan su propia sesión.]

## 10. Skills y agentes
- [skill o agente] — [en qué paso se usa]
```
