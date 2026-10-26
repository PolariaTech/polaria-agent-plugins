# SCHEMA DE CAMPOS — PLANTILLA (no editar ni entregar directamente)

*Polaria | Plantilla de referencia para el Paso 1 de `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`*

| Versión | Creado por | Aprobado por | Fecha |
|---|---|---|---|
| v1.1 | Responsable Metodología | Pendiente | Pendiente |

## Instrucciones para el Asistente de IA (leer esto primero, siempre)

**Qué es este archivo:** una plantilla de referencia, con texto de ejemplo entre corchetes (`[Sí/No]`, `[nombre_del_campo]`, etc.). Nunca se edita, se copia tal cual, ni se entrega como si fuera el schema de un formulario real — se usa únicamente para saber qué preguntar, en qué orden, y qué estructura debe tener el archivo que sí entregas.

**Entregable que debes producir (obligatorio, siempre un archivo nuevo y separado de este):**

- **Nombre exacto:** `schema_[nombre_formulario].md` — nombre del formulario en snake_case, minúsculas, sin tildes ni espacios (ej. `schema_agregar_producto_orden.md`).
- **Ubicación exacta:** carpeta `schemas/` en la raíz del repo del proyecto de código donde vive el formulario (ej. `polaria-wms-web/schemas/schema_agregar_producto_orden.md`) — **nunca en este repo de metodología**. Crea la carpeta `schemas/` si todavía no existe en ese repo.
- **Contenido exacto:** copia las secciones "Datos del formulario", "Tabla 1", "Tabla 2", "Tabla 3" (solo si aplica), "Tabla 4" (siempre), "Notas y justificaciones" y "Versión y revisión" de esta plantilla, con **todos los valores reales del formulario que estás documentando**. No copies la "Nota — Niveles de validación" ni el "Glosario" — esas dos secciones son referencia de esta plantilla, no datos de un formulario específico.
- **Regla de "cero relleno":** el archivo entregado nunca contiene texto de plantilla entre corchetes. Cada celda tiene un valor real, o "—" únicamente en las columnas donde eso es válido por definición (Rango/Límite, Valor por defecto, Depende de, Regla de dependencia, Orden de tabulación, Foco automático y Origen del pre-llenado; en la Tabla 4: Pasos para abrir el formulario, Registro que debe existir, Botón Cancelar / Cerrar, los dos botones del diálogo de descarte, Botón de la advertencia no-saltable y Valor de prueba), o una línea de justificación explícita en "Notas y justificaciones" si una celda no aplica por otro motivo. Un hook del plugin `validacion-formularios` avisa si queda texto de plantilla al escribir el archivo.

**Flujo de entrevista — preguntar en este orden exacto, una pregunta a la vez, nunca todas juntas, y nunca inferir un valor sin confirmación explícita del Desarrollador:**

1. Nombre del formulario, y proyecto/repo donde vive. Si el formulario ya tenía schema, pregunta además qué campos son nuevos o modificados en este cambio (fila "Campos nuevos o modificados"); si es un formulario nuevo, el valor es "Todos (formulario nuevo)".
2. ¿Vive en un modal? (Sí/No).
3. ¿Algún campo se pre-llena automáticamente (Extracción IA, información de BD, o ambos)? (Sí/No) — si la respuesta es No, la Tabla 3 completa (encabezado incluido) no se incluye en el entregable.
4. Pide la lista completa de nombres de campos del formulario.
5. Por cada campo, en este orden exacto: tipo de dato → obligatorio (Sí/No) → rango/límite → valor por defecto → único (Sí/No) → depende de otro campo (si sí, cuál y la regla de dependencia exacta) → mensaje de error exacto → capas aplicables (Front/Back/BD) → orden de tabulación → ¿está deshabilitado? (Sí/No) → foco automático (si aplica, en qué momento) → *[solo si la pregunta 3 fue Sí]* origen del pre-llenado de ese campo (Extracción IA / Información de BD / Ambas / —) → editable manualmente (Sí/No; si Origen = Extracción IA, no preguntes — siempre es "Sí", ver la Regla correspondiente en `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`, sección 4).
6. Tabla 4 (prueba automatizada del Nivel 2), en este orden exacto: rol del WMS con el que se inicia sesión → ruta de la página → pasos para abrir el formulario desde esa ruta → registro que debe existir (solo formularios de edición o con pre-llenado de BD) → archivos del formulario (rutas en el repo de código de los archivos que lo implementan) → botón Guardar → botón Cancelar / Cerrar → *[solo si la pregunta 2 fue Sí]* botón que confirma descartar y botón para seguir editando en el diálogo de descarte → *[solo si la pregunta 3 fue Sí]* botón de la advertencia no-saltable → por cada campo: localizador y valor de prueba. Todo localizador se escribe con la notación de la Tabla 4 (`testid=...` o `rol "nombre accesible"`). Puedes proponer cada valor leyendo el código del formulario, pero siempre lo confirma el Desarrollador.
7. Responsable (el rol del Desarrollador — nunca su nombre propio) y fecha de creación.
8. Si una respuesta es ambigua o incompleta, repregunta antes de avanzar al siguiente campo — no rellenes el hueco con una suposición razonable.
9. Al terminar todos los campos, escribe el archivo entregable completo y muéstraselo al Desarrollador. Espera su confirmación explícita antes de crear el archivo en disco.

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
| Rol, Ruta y Pasos para abrir (Tabla 4) | Le dicen a la prueba automatizada del Nivel 2 con qué usuario entrar y cómo llegar al formulario — sin esto no puede ni abrirlo | Como la dirección y la llave de un apartamento: sin ellas no se puede revisar lo que hay adentro. Ej: rol "Administrador de cuenta", ruta `/flota/camiones`, `clic button "Nuevo camión"`. |
| Registro que debe existir (Tabla 4) | Un formulario de edición o con pre-llenado de BD solo se abre sobre un dato que ya existe — la prueba tiene que saber cuál preparar | Para probar el formulario "editar camión" primero tiene que haber un camión. Ej: "Un camión activo de la cuenta de prueba". |
| Archivos del formulario (Tabla 4) | Dice qué archivos del repo implementan el formulario, para revalidarlo automáticamente en staging cuando se despliega un cambio en alguno de ellos | Como la lista de piezas de un electrodoméstico: si cambias una, sabes qué aparato revisar. Ej: `src/features/flota/components/CamionCrearModal.tsx`. |
| Botones (Tabla 4) | Guardar, Cancelar, el diálogo de descarte y la advertencia no-saltable son los que prueban las reglas de modal y pre-llenado de la sección 4 del protocolo | Como saber cuál es el freno y cuál el acelerador antes de probar un carro. Ej: `button "Guardar"`, `button "Descartar cambios"`. |
| Localizador (Tabla 4) | Dice cómo encuentra la prueba automatizada cada campo en la pantalla | Como la etiqueta con el nombre en cada casillero: sin ella hay que adivinar cuál es. Ej: `testid=field-placa` o `textbox "Placa"`. |
| Valor de prueba (Tabla 4) | Un valor válido que la prueba escribe para dejar datos sin guardar y verificar que esos datos no se pierden al cerrar el modal | Como escribir algo en un borrador para comprobar que el programa pregunta antes de cerrarlo. Ej: `ABC123` en `Placa`. |

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

### Tabla 4 — Prueba automatizada (Nivel 2)

**Notación de localizador** (se usa en todas las celdas que piden un botón o un campo): `testid=<valor del atributo data-testid>` si el elemento lo tiene; si no, `<rol> "<nombre accesible>"`, donde el rol es el rol accesible del elemento (`button`, `textbox`, `combobox`, `checkbox`, `slider`, `dialog`…) y el nombre accesible es el texto de su label o del botón, exacto. Ej: `testid=field-placa`, `button "Guardar"`, `textbox "Placa"`.

**Tabla 4.1 — Acceso y botones**

| Campo | Valor |
|---|---|
| Rol con que se inicia sesión | [Rol del WMS, ej. Administrador de cuenta] |
| Ruta | [Ruta relativa de la página, ej. /flota/camiones] |
| Pasos para abrir el formulario | [Pasos separados por " → ": `clic <localizador>`, `escribir <localizador> = "<texto>"` o `esperar <localizador>`. Ej. clic button "Nuevo camión" → esperar dialog "Crear camión". — si el formulario ya está visible al cargar la ruta] |
| Registro que debe existir | [Descripción del dato que debe existir antes de abrir el formulario, ej. Un camión activo de la cuenta de prueba. — si no aplica] |
| Archivos del formulario | [Rutas relativas a la raíz del repo de código, separadas por "; ". Solo los archivos propios del formulario, no los componentes compartidos. Ej. src/features/flota/components/CamionCrearModal.tsx; src/features/flota/schemas/camion.ts] |
| Botón Guardar | [Localizador] |
| Botón Cancelar / Cerrar | [Localizador, o — si no existe] |
| Diálogo de descarte: botón que confirma descartar | [Localizador, o — si no vive en un modal] |
| Diálogo de descarte: botón para seguir editando | [Localizador, o — si no vive en un modal] |
| Botón de la advertencia no-saltable | [Localizador, ej. button "Entendido, continuar", o — si no hay pre-llenado] |

**Tabla 4.2 — Campos** (una fila por cada campo de la Tabla 1, con el mismo nombre)

| Campo | Localizador | Valor de prueba |
|---|---|---|
| [nombre_del_campo] | [Localizador] | [Valor válido que se puede escribir en el campo, o — si no se escribe (picker, slider, deshabilitado)] |

### Notas y justificaciones

[Solo si algún campo no lleva alguna de las capas Front/Back/BD, o hay un caso especial que las tablas no pueden capturar — toda omisión necesita una justificación explícita aquí, nunca una celda vacía o "N/A" sin explicar. Si no hay notas, escribir "Sin notas".]

### Versión y revisión (del schema de ese formulario, no de esta plantilla)

| Campo | Valor |
|---|---|
| Versión del schema | [v1.0] |
| Fecha de aprobación | [DD/MM/AAAA] |
| Aprobado por | [Rol] |
| Próxima revisión | Cuando el formulario cambie de campos o de reglas |
