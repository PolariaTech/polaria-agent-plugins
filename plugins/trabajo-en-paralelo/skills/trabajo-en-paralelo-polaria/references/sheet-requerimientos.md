# Sheet de requerimientos: leer la fila y cambiar su Estado y su Asignado a

Solo aplica a tickets `REQ-NNN`. Los `POL-X` viven en Linear y su estado lo cambia `gestion-linear`.

## Datos fijos

- **Sheet:** "Requerimientos", ID `1AdIh-6s7iMPuYbLEwLSevvp6uMfIZpqP7UJ-9h0loDY`.
- **Pestaña:** `Requerimientos` (la pestaña `Resumen` no se toca).
- **Columnas:** B = ID, C = Tipo, D = Descripción, F = Prioridad, **G = Estado**, H = Duplicado de, I = Relacionado con, **J = Asignado a**, L = Comentarios. El asistente solo escribe en G y J.
- **Fila 1** es el encabezado. Los IDs tienen huecos (por ejemplo faltan REQ-128 y REQ-157), así que la fila se busca por el texto del ID en la columna B, nunca por su número.

## Estados (lista desplegable de la columna G)

| Estado | Significado | Quién lo escribe |
| -- | -- | -- |
| `En Revisión` | No está claro y requiere que Edgar lo revise | Una persona |
| `En Progreso` | Se está desarrollando | **El asistente**, al reclamar |
| `En validación` | Código terminado y se está verificando que la implementación funcionó | **El asistente**, al terminar el código y empezar a verificar |
| `En paso a producción` | Terminado, todavía sin mergear | **El asistente**, al crear el PR |
| `Completado` | Ya está en producción | Una persona |
| `Rechazado` | Se descartó | Una persona |
| `Proximo Sprint` | Lo define Edgar, no el equipo de desarrollo (sin tilde, tal como está en la lista) | Una persona |

El estado `Asignado` ya no existe: la columna J lo cubre.

## Personas (lista desplegable de la columna J)

`Mauro`, `Lucho`, `Dani`. La lista es estricta y permite varias personas a la vez, separadas por coma y espacio: `Mauro, Dani`. Se escribe `Dani`, nunca `Daniel`. Para saber cuál es el dev, usa `node "<raíz del plugin>/scripts/paralelo.js" prefijo` y pon la primera letra en mayúscula (`dani` → `Dani`).

## Procedimiento para cambiar el Estado y el Asignado a

Ejecútalo cada vez que la skill diga "marca el Sheet". Usa las herramientas del conector de Google Sheets (`get_values`, `get_spreadsheet` y `update_values`).

1. **Busca la fila.** Lee `Requerimientos!B1:B1000` con `get_values`. La fila es la posición (empezando en 1) de la celda cuyo texto es exactamente el ID del ticket, por ejemplo `REQ-012`. Llámala `n`. Si el ID no aparece, dile al dev "no encontré REQ-NNN en el Sheet", no escribas nada y sigue con el trabajo.
2. **Lee lo que hay.** Lee `Requerimientos!G{n}` y `Requerimientos!J{n}` con `get_values`.
3. **Aplica las reglas de lectura:**
   - Si G{n} es `En Revisión`: **detente**. No reclames ni escribas. Dile al dev que el requerimiento espera la revisión de Edgar.
   - Si G{n} es `Completado` o `Rechazado`: avisa en una línea y pregunta si de verdad se trabaja.
   - Si "Duplicado de" (columna H) apunta a otro REQ: avisa en una línea.
   - Si J{n} tiene a otra persona y no al dev: **pregúntale al dev una sola vez** si agrega su nombre (`Mauro, Dani`) o la deja como está. No escribas hasta que responda.
4. **Comprueba la lista desplegable.** Llama a `get_spreadsheet` con `includeGridData: true` y `ranges: ["Requerimientos!G{n}", "Requerimientos!J{n}"]`. En `dataValidation.condition.values` está la lista de opciones de cada celda. El valor que vas a escribir debe estar escrito igual (mayúsculas, tildes y espacios) en esa lista. Si no está, no escribas: dile al dev qué valor falta en la lista.
5. **Escribe solo lo que cambia**, una celda por llamada a `update_values`:
   - Estado: `range` = `Requerimientos!G{n}`, `values` = `[["<estado>"]]`.
   - Asignado a: `range` = `Requerimientos!J{n}`, `values` = `[["<nombres>"]]`. Si el dev ya estaba en J{n}, no la escribas.
6. **Verifica.** Vuelve a leer `Requerimientos!G{n}` y `Requerimientos!J{n}` con `get_values`. Si no coinciden con lo que escribiste, díselo al dev con ambos valores.
7. **Si el conector no está o falla la escritura:** avisa en una línea ("no pude actualizar el Sheet: <error>"), sigue con el trabajo y dile al dev que lo marque a mano. No bloquees el trabajo por el Sheet.

## Cuándo se escribe cada valor

| Momento | Estado (G) | Asignado a (J) |
| -- | -- | -- |
| Reclamar el ticket (Modo A, paso 8) | `En Progreso` | El dev, si no estaba |
| Terminar el código y empezar a verificar que funciona (Modo F) | `En validación` | Sin cambio |
| Crear el PR (Modo D, paso 4) | `En paso a producción` | Sin cambio |

El asistente nunca escribe `En Revisión`, `Completado`, `Rechazado` ni `Proximo Sprint`. Si el dev pide uno de esos, dile que lo cambie él en el Sheet.
