# Sheet de requerimientos: leer la fila y cambiar su Estado y su Asignado

Solo aplica a tickets `REQ-NNN`. Los `POL-X` viven en Linear y su estado lo cambia `gestion-linear`.

## Datos fijos

- **Sheet:** "Requerimientos", ID `1AdIh-6s7iMPuYbLEwLSevvp6uMfIZpqP7UJ-9h0loDY`.
- **Pestaña:** `Requerimientos` (la pestaña `Resumen` no se toca).
- **Fila 1** es el encabezado. Los encabezados son: `ID`, `TIPO`, `DESCRIPCIÓN`, `SOLICITANTE`, `PRIORIDAD`, `RELACIONADO`, `ESTADO`, `ASIGNADO`, `VALIDADO`, `OBSERVACIONES`, `COMENTARIOS`. A la fecha de esta versión ocupan las columnas B a L (ID en B, ESTADO en H, ASIGNADO en I), pero las columnas se han movido antes: **no uses las letras de esta lista, búscalas por el texto del encabezado** (paso 1 del procedimiento).
- El asistente solo escribe en `ESTADO` y `ASIGNADO`. `VALIDADO` (casilla del solicitante), `OBSERVACIONES` y `COMENTARIOS` no se tocan.
- Los IDs tienen huecos (por ejemplo faltan REQ-128 y REQ-157), así que la fila se busca por el texto del ID en la columna `ID`, nunca por su número.

## Estados (lista desplegable de la columna ESTADO)

Una celda de Estado vacía significa que el ticket se creó y nadie lo ha revisado.

| Estado | Significado | Quién lo escribe | Estado equivalente en Linear |
| -- | -- | -- | -- |
| (vacío) | Se creó y nadie lo ha revisado | Quien crea el ticket | Triage |
| `En Revisión` | Se evalúa si se hará o no | Una persona (Edgar) | Triage |
| `Backlog` | Se va a hacer, en lista de espera | Una persona | Backlog |
| `Proximo Sprint` | Se va a hacer, no de inmediato; lo define Edgar, no el equipo de desarrollo (sin tilde, tal como está en la lista) | Una persona | Proximo Sprint |
| `En Progreso` | Alguien lo tiene asignado y empezó, aunque sea solo investigación | **El asistente**, al reclamar | En Progreso (y En Pruebas durante las pruebas) |
| `En paso a producción` | PR abierto, todavía sin mergear a main | **El asistente**, al crear el PR | En paso a producción |
| `Completado` | Ya está mergeado a main | Una persona | Completado |
| `Rechazado` | Se descartó | Una persona | Rechazado |

`En validación` ya no existe en la lista. Las pruebas de verificación se hacen con el ticket en `En Progreso`, antes de crear el PR.

La casilla `VALIDADO` no es un estado: la marca el solicitante cuando verifica que el requerimiento se implementó y funciona. El asistente nunca la marca.

## Transiciones

| De | A | Quién | Cuándo |
| -- | -- | -- | -- |
| (vacío) | En Revisión | Persona | Alguien empieza a evaluar el ticket |
| En Revisión | Backlog | Persona | Se decide que sí se hará, sin fecha |
| En Revisión | Proximo Sprint | Persona (Edgar) | Se decide que sí se hará pronto |
| En Revisión | Rechazado | Persona | Se decide que no se hará |
| Backlog | Proximo Sprint | Persona (Edgar) | Se programa |
| Backlog, Proximo Sprint, (vacío) | En Progreso | **Asistente** | El dev reclama el ticket (Modo A) |
| En Progreso | Backlog | Persona | Se pausa por falta de capacidad |
| En Progreso | En paso a producción | **Asistente** | Se crea el PR (Modo D) |
| En paso a producción | En Progreso | Persona | El PR recibe cambios y se vuelve a trabajar |
| En paso a producción | Completado | Persona | El PR se mergeó a main |
| Cualquiera | Rechazado | Persona | Se descarta |

El asistente solo escribe las dos transiciones marcadas **Asistente**. Cualquier otro cambio lo hace una persona en el Sheet; si el dev se lo pide al asistente, dile que lo cambie él.

## Personas (lista desplegable de la columna ASIGNADO)

`Mauro`, `Lucho`, `Dani`. La lista es estricta y permite varias personas a la vez, separadas por coma y espacio: `Mauro, Dani`. Se escribe `Dani`, nunca `Daniel`. Para saber cuál es el dev, usa `node "<raíz del plugin>/scripts/paralelo.js" prefijo` y pon la primera letra en mayúscula (`dani` → `Dani`).

## Procedimiento para cambiar el Estado y el Asignado

Ejecútalo cada vez que la skill diga "marca el Sheet". Usa las herramientas del conector de Google Sheets (`get_values`, `get_spreadsheet` y `update_values`).

1. **Ubica las columnas.** Lee `Requerimientos!1:1` con `get_values`. Anota la letra de la columna cuyo encabezado es exactamente `ID`, la de `ESTADO` y la de `ASIGNADO`. Llámalas `{ID}`, `{ESTADO}` y `{ASIGNADO}`. Si falta alguna, no escribas: dile al dev "no encontré la columna <nombre> en el Sheet" y sigue con el trabajo.
2. **Busca la fila.** Lee `Requerimientos!{ID}1:{ID}1000` con `get_values`. La fila es la posición (empezando en 1) de la celda cuyo texto es exactamente el ID del ticket, por ejemplo `REQ-012`. Llámala `n`. Si el ID no aparece, dile al dev "no encontré REQ-NNN en el Sheet", no escribas nada y sigue con el trabajo.
3. **Lee lo que hay.** Lee `Requerimientos!{ESTADO}{n}` y `Requerimientos!{ASIGNADO}{n}` con `get_values`.
4. **Aplica las reglas de lectura:**
   - Si el Estado es `En Revisión`: **detente**. No reclames ni escribas. Dile al dev que el requerimiento espera la revisión de Edgar.
   - Si el Estado es `Completado` o `Rechazado`: avisa en una línea y pregunta si de verdad se trabaja.
   - Si el Estado es `En paso a producción`: avisa en una línea que ya tiene PR abierto y pregunta si se vuelve a trabajar.
   - Si el Asignado tiene a otra persona y no al dev: **pregúntale al dev una sola vez** si agrega su nombre (`Mauro, Dani`) o la deja como está. No escribas hasta que responda.
5. **Comprueba la lista desplegable.** Llama a `get_spreadsheet` con `includeGridData: true`, `ranges: ["Requerimientos!{ESTADO}{n}", "Requerimientos!{ASIGNADO}{n}"]` y `fields: ["sheets.data.rowData.values.dataValidation"]`. En `dataValidation.condition.values` está la lista de opciones de cada celda. El valor que vas a escribir debe estar escrito igual (mayúsculas, tildes y espacios) en esa lista. Si no está, no escribas: dile al dev qué valor falta en la lista.
6. **Escribe solo lo que cambia**, una celda por llamada a `update_values`:
   - Estado: `range` = `Requerimientos!{ESTADO}{n}`, `values` = `[["<estado>"]]`.
   - Asignado: `range` = `Requerimientos!{ASIGNADO}{n}`, `values` = `[["<nombres>"]]`. Si el dev ya estaba en esa celda, no la escribas.
7. **Verifica.** Vuelve a leer las dos celdas con `get_values`. Si no coinciden con lo que escribiste, díselo al dev con ambos valores.
8. **Si el conector no está o falla la escritura:** avisa en una línea ("no pude actualizar el Sheet: <error>"), sigue con el trabajo y dile al dev que lo marque a mano. No bloquees el trabajo por el Sheet.

## Cuándo se escribe cada valor

| Momento | Estado | Asignado |
| -- | -- | -- |
| Reclamar el ticket (Modo A, paso 8) | `En Progreso` | El dev, si no estaba |
| Crear el PR (Modo D, paso 4) | `En paso a producción` | Sin cambio |

El asistente nunca escribe `En Revisión`, `Backlog`, `Proximo Sprint`, `Completado` ni `Rechazado`, ni marca `VALIDADO`. Si el dev pide uno de esos, dile que lo cambie él en el Sheet.
