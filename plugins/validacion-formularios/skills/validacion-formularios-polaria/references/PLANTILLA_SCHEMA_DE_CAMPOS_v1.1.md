# SCHEMA DE CAMPOS — PLANTILLA (no editar ni entregar directamente)

*Polaria | Plantilla de referencia para el Paso 1 de `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`*

## Instrucciones para el Asistente de IA (leer esto primero, siempre)

**Qué es este archivo:** una plantilla de referencia, con texto de ejemplo entre corchetes (`[Sí/No]`, `[nombre_del_campo]`, etc.). Nunca se edita, se copia tal cual, ni se entrega como si fuera el schema de un formulario real — se usa únicamente para saber qué preguntar, en qué orden, y qué estructura debe tener el archivo que sí entregas.

**Entregable que debes producir (obligatorio, siempre un archivo nuevo y separado de este):**

- **Nombre exacto:** `schema_[nombre_formulario].md` — nombre del formulario en snake_case, minúsculas, sin tildes ni espacios (ej. `schema_agregar_producto_orden.md`).
- **Ubicación exacta:** carpeta `schemas/` en la raíz del repo del proyecto de código donde vive el formulario (ej. `polaria-wms-web/schemas/schema_agregar_producto_orden.md`) — **nunca en este repo de metodología**. Crea la carpeta `schemas/` si todavía no existe en ese repo.
- **Contenido exacto:** copia las secciones "Datos del formulario", "Tabla 1", "Tabla 2", "Tabla 3" (solo si aplica), "Notas y justificaciones" y "Versión y revisión" de esta plantilla, con **todos los valores reales del formulario que estás documentando**. No copies la "Nota — Niveles de validación" ni el "Glosario" — esas dos secciones son referencia de esta plantilla, no datos de un formulario específico.
- **Regla de "cero relleno":** el archivo entregado nunca contiene texto de plantilla entre corchetes. Cada celda tiene un valor real, o "—" únicamente en las columnas donde eso es válido por definición (Rango/Límite, Valor por defecto, Depende de, Regla de dependencia, Orden de tabulación, Foco automático y Origen del pre-llenado), o una línea de justificación explícita en "Notas y justificaciones" si una celda no aplica por otro motivo. Un hook del plugin `validacion-formularios` avisa si queda texto de plantilla al escribir el archivo.

**Flujo de entrevista — preguntar en este orden exacto, una pregunta a la vez, nunca todas juntas, y nunca inferir un valor sin confirmación explícita del Desarrollador:**

1. Nombre del formulario, y proyecto/repo donde vive. Si el formulario ya tenía schema, pregunta además qué campos son nuevos o modificados en este cambio (fila "Campos nuevos o modificados"); si es un formulario nuevo, el valor es "Todos (formulario nuevo)".
2. ¿Vive en un modal? (Sí/No).
3. ¿Algún campo se pre-llena automáticamente (Extracción IA, información de BD, o ambos)? (Sí/No) — si la respuesta es No, la Tabla 3 completa (encabezado incluido) no se incluye en el entregable.
4. Pide la lista completa de nombres de campos del formulario.
5. Por cada campo, en este orden exacto: tipo de dato → obligatorio (Sí/No) → rango/límite → valor por defecto → único (Sí/No) → depende de otro campo (si sí, cuál y la regla de dependencia exacta) → mensaje de error exacto → capas aplicables (Front/Back/BD) → orden de tabulación → ¿está deshabilitado? (Sí/No) → foco automático (si aplica, en qué momento) → *[solo si la pregunta 3 fue Sí]* origen del pre-llenado de ese campo (Extracción IA / Información de BD / Ambas / —) → editable manualmente (Sí/No; si Origen = Extracción IA, no preguntes — siempre es "Sí", ver la Regla correspondiente en `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`, sección 4).
6. Responsable (el rol del Desarrollador — nunca su nombre propio) y fecha de creación.
7. Si una respuesta es ambigua o incompleta, repregunta antes de avanzar al siguiente campo — no rellenes el hueco con una suposición razonable.
8. Al terminar todos los campos, escribe el archivo entregable completo y muéstraselo al Desarrollador. Espera su confirmación explícita antes de crear el archivo en disco.

## Nota — Niveles de validación

> Este documento (y el entregable que produce) es un insumo de `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`, donde se definen los 5 niveles en detalle (sección 6). Resumen rápido: **Nivel 1** = tipo/formato (frontend) · **Nivel 2** = foco/tabulación/modal (frontend) · **Nivel 3** = reglas de negocio (frontend) · **Nivel 4** = revalidación (backend) · **Nivel 5** = restricciones (base de datos). Si algo de este schema no queda claro, la definición completa está en ese protocolo, no aquí.

## Glosario — por qué existe cada columna

| Columna | Por qué existe | Analogía / Ejemplo |
|---|---|---|
| Campo | Identifica cada campo de forma única — sin esto no se puede referenciar en ninguna regla de dependencia | Es el "nombre de la casilla" en un formulario de papel — sin nombre no puedes decir "esta casilla depende de aquella otra". Ej: `cantidad`. |
| Tipo de dato | Define el Nivel 1 — qué caracteres puede aceptar el campo | Como decidir si una casilla es "solo números" o "solo texto" antes de imprimir el formulario. Ej: `cantidad` = Numérico entero. |
| Obligatorio | Define si el Nivel 3 bloquea el guardado cuando está vacío | El asterisco (*) junto a una casilla en un formulario de papel — sin llenarla, no se puede entregar. Ej: `fecha_entrega_desde` es obligatorio; `descuento` no. |
| Rango/Límite | Define los valores límite que el Nivel 3 valida y que las pruebas unitarias (sección 7 del protocolo) deben cubrir | El letrero "edad entre 18 y 65" al lado de una casilla — fuera de ese rango, se rechaza. Ej: `cantidad` mínimo 1, sin máximo. |
| Valor por defecto | Evita un campo "vacío en apariencia" con un valor inválido oculto | Una báscula que marca "0" aunque no le hayas puesto nada encima — parece un dato real, pero es un cero disfrazado. Ej: `precio` nunca debería nacer en 0. |
| Único | Define si el Nivel 5 necesita una restricción de unicidad en la base de datos | Como un número de cédula: no puede haber dos personas con el mismo. Ej: un `codigo_producto` no se repite entre productos. |
| Depende de / Regla de dependencia | Define las reglas multi-campo del Nivel 3 | El check-in y el check-out de un hotel — el check-out no puede ser antes del check-in. Ej: `fecha_entrega_desde` ≤ `fecha_entrega_hasta`. |
| Mensaje de error | Texto exacto que ve el usuario — evita que cada implementación invente el suyo | El letrero "máquina fuera de servicio" en vez de que la máquina simplemente no responda — le dice a la persona qué pasó exactamente. Ej: "Cantidad debe ser mayor a 0". |
| Capas aplicables | Define en cuáles capas (y por tanto en cuáles de los 5 niveles de la sección 6 del protocolo) debe implementarse este campo | Decidir si un control de seguridad va en la puerta, en el pasillo, o en ambos — cada capa es un filtro independiente. Ej: `precio` se valida en Front + Back + BD. |
| Orden de tabulación | Define el Nivel 2 — en qué secuencia se navega el formulario con Tab | El orden en que firmas página por página un contrato. Ej: `cantidad → especificación → precio → botón agregar`. |
| Deshabilitado | Define qué campos se excluyen del tab order en el Nivel 2 | Una casilla sombreada que dice "no llenar, uso interno" — nadie espera tocarla. Ej: `unidad`, `descuento`. |
| Foco automático | Define cuándo el Nivel 2 debe mover el foco automáticamente | Cuando terminas tu PIN en un cajero y la pantalla salta sola a la siguiente. Ej: el foco salta a `cantidad` tras agregar un producto. |
| Origen del pre-llenado | Define cuándo aplica la advertencia de discrepancia (reglas de pre-llenado, sección 4 del protocolo) — solo si hay 2 fuentes que puedan no coincidir | Como llenar un formulario de aduana que ya trae tus datos precargados del sistema, pero si tu pasaporte escaneado dice algo distinto, te lo marcan y preguntan cuál vale antes de dejarte pasar. Ej: un campo de "nombre del proveedor" con Origen = Ambas. |
| Editable manualmente | Define si el usuario puede corregir el valor pre-llenado o solo confirmarlo/rechazarlo | Como un campo de "fecha de nacimiento" que el sistema ya trae del documento escaneado y no te deja tocar, contra uno que sí puedes corregir a mano si el escaneo salió mal. |

## Estructura a copiar en el entregable

*(Lo que sigue es la forma exacta que debe tener `schema_[nombre_formulario].md` — con valores reales en vez del texto entre corchetes.)*

### Datos del formulario

| Campo | Valor |
|---|---|
| Formulario | [ej. Agregar producto a orden] |
| Proyecto / repo | [ej. polaria-wms-web] |
| Protocolo de referencia | PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md |
| Campos nuevos o modificados | [Todos (formulario nuevo) / lista de campos que cambian en esta versión del schema] |
| ¿Vive en un modal? | [Sí/No] |
| ¿Algún campo se pre-llena automáticamente (Extracción IA, información de BD, o ambos)? | [Sí/No] |
| Responsable (Desarrollador) | [Rol — nunca nombre propio] |
| Fecha de creación | [DD/MM/AAAA] |

### Tabla 1 — Validación de datos (Niveles 1, 3, 4, 5)

| Campo | Tipo de dato | Obligatorio | Rango/Límite | Valor por defecto | Único | Depende de | Regla de dependencia | Mensaje de error | Capas aplicables (Front/Back/BD) |
|---|---|---|---|---|---|---|---|---|---|
| [nombre_del_campo] | [Numérico / Texto / Fecha / Selección] | [Sí/No] | [Mín X, Máx Y, longitud Z] | [Valor, o —] | [Sí/No] | [Otro campo, o —] | [Regla exacta, o —] | [Mensaje exacto] | [Front, Back, BD] |

### Tabla 2 — Interacción (Nivel 2)

| Campo | Orden de tabulación | Deshabilitado | Foco automático (cuándo, si aplica) |
|---|---|---|---|
| [nombre_del_campo] | [Posición numérica, o — si no aplica] | [Sí/No] | [Momento exacto, o —] |

### Tabla 3 — Pre-llenado (omitir por completo si la pregunta 3 fue "No")

| Campo | ¿Tiene pre-llenado? | Origen del pre-llenado (única respuesta) | Editable manualmente por el usuario |
|---|---|---|---|
| [nombre_del_campo] | [Sí/No] | [Extracción IA / Información de BD / Ambas / —] | [Si Origen = Extracción IA: siempre "Sí" (lo fija la regla, no se pregunta). Si Origen = Ambas o Información de BD: Sí/No a definir] |

### Notas y justificaciones

[Solo si algún campo no lleva alguna de las capas Front/Back/BD, o hay un caso especial que las tablas no pueden capturar — toda omisión necesita una justificación explícita aquí, nunca una celda vacía o "N/A" sin explicar. Si no hay notas, escribir "Sin notas".]

### Versión y revisión (del schema de ese formulario, no de esta plantilla)

| Campo | Valor |
|---|---|
| Versión del schema | [v1.0] |
| Fecha de aprobación | [DD/MM/AAAA] |
| Aprobado por | [Rol] |
| Próxima revisión | Cuando el formulario cambie de campos o de reglas |

## Versión y revisión (de esta plantilla)

v1.1 · pendiente de aprobación (junto con `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`) · Responsable Técnico · próxima revisión: cuando cambie ese protocolo

_Historial: v1.0 (14/09/2026). v1.1 (23/09/2026): referencias alineadas con la numeración del protocolo v1.1, "Único" sin atarlo a Prisma, lista explícita de columnas que aceptan "—", fila "Campos nuevos o modificados" y mención del hook que avisa si queda texto de plantilla._
