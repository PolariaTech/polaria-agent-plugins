---
name: validacion-formularios-polaria
description: Construye o modifica la validación de un formulario de Polaria siguiendo el Protocolo de Validación de Formularios — primero la entrevista del schema de campos, después los 5 niveles (tipo, interacción, reglas de negocio, backend, base de datos) con el stack que ya usa el repo, las pruebas y el checklist de prueba manual. Úsala SIEMPRE que se vaya a crear, cambiar o revisar un formulario, un campo de formulario o su lógica de validación, aunque no se mencione el protocolo — por ejemplo "hay que crear el formulario de agregar producto", "agrega un campo de fecha a este formulario", "valida este formulario", "el campo precio acepta letras", "el tab no sigue el orden", "el modal se cierra y pierdo lo que escribí", "arma el schema del formulario X". No la uses para revisar un diff antes del push (eso es `gate-calidad-tecnica-pre-merge-polaria`, cuyo criterio 7 verifica este protocolo) ni para formularios que no guardan datos (un buscador, un filtro).
---

# Skill: Validación de Formularios

Ejecuta `references/PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md`, la fuente de verdad de cada paso, regla, excepción, nivel y prueba. Esta skill dice **cómo** ejecutarlo en un repo real; el **qué** se exige vive en ese documento, y no se repite aquí.

**Instalación:** esta carpeta (`skill/`) es la copia canónica versionada dentro de la metodología de Polaria, inerte aquí. Se publica como el plugin `validacion-formularios` del marketplace `PolariaTech/polaria-agent-plugins` (skill + hook del schema, Claude Code y Cursor) y se instala en cada repo de código con `/plugin install validacion-formularios@polaria-agent-plugins` (Claude Code) o vía Team Marketplace en Cursor. Al publicar, `references/` recibe una copia del protocolo y de `PLANTILLA_SCHEMA_DE_CAMPOS_v1.1.md` (fuentes en `PROTOCOLOS_EXISTENTES/PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS/` y `PROTOCOLOS_EXISTENTES/SCHEMAS_FORMULARIOS/`). Cualquier cambio se hace en la fuente y se vuelve a publicar al plugin, nunca al revés.

## Paso 1 — Schema (Paso 1 del protocolo)

1. Busca si ya existe `schemas/schema_<formulario>.md` en el repo.
   - **Existe:** léelo. Pregunta al dev qué campos son nuevos o modificados en este cambio, entrevista solo esos campos con el orden de la plantilla, y actualiza la fila "Campos nuevos o modificados" y la versión del schema. Los Pasos 2 a 5 de esta skill aplican solo a esos campos (regla de alcance incremental, sección 4 del protocolo).
   - **No existe:** abre `references/PLANTILLA_SCHEMA_DE_CAMPOS_v1.1.md` y aplica su sección "Instrucciones para el Asistente de IA" tal cual: el orden de las preguntas, una pregunta a la vez, el nombre y la ubicación del archivo, y la regla de "cero relleno".
2. Si el formulario vive en otro repo (el backend en un repo y el formulario en otro): pide al dev la ruta del schema en ese repo o el issue de Linear que lo tiene, y léelo de ahí. NUNCA lo vuelvas a entrevistar desde cero.
3. Muéstrale al dev el archivo completo y créalo en disco solo cuando lo apruebe explícitamente.
4. Si al escribirlo el hook avisa que quedó texto de plantilla entre corchetes, repregunta ese dato al dev. NUNCA lo completes tú.
5. Si el dev no puede completar algún dato ahora (Excepción 2 del protocolo): guarda el schema con ese dato marcado `PENDIENTE`, dile que el trabajo queda pausado hasta completarlo y detente.

## Paso 2 — Stack (Paso 2 del protocolo)

Aplica `references/stacks.md`: detecta con qué librería se valida cada capa (Front, Back, BD) que el schema usa en este repo. Muéstrale al dev una sola línea, por ejemplo `Front: Zod · Back: (otro repo) · BD: (otro repo)`, y espera su confirmación antes de escribir código.

## Paso 3 — Construcción (Paso 3 y sección 6 del protocolo)

Por cada campo y cada capa que tenga en "Capas aplicables", construye los niveles de la sección 6 del protocolo con las librerías confirmadas en el Paso 2. Para saber cómo se traduce cada nivel en esa librería, ver `references/stacks.md`. Además:

- Los mensajes de error se copian **exactos** de la columna "Mensaje de error" de la Tabla 1 del schema, en todas las capas.
- Las reglas de modal, confirmaciones y pre-llenado del Nivel 2 están en la sección 4 del protocolo. Aplícalas según las filas "¿Vive en un modal?" y la Tabla 3 del schema.
- Los estados warning, teal y danger usan los tokens de color del sistema de diseño del repo. Si el repo no los tiene, pregúntale al dev qué usar.
- Antes de pasar al Paso 4, verifica cada nivel contra su columna "Listo cuando" y dile al dev cuál verificaste y cómo. Para el Nivel 4, la verificación es una petición directa al endpoint (ej. `curl`) con un valor inválido, citando la respuesta real.

## Paso 4 — Pruebas (Paso 4 y sección 7 del protocolo)

1. Escribe las pruebas de la sección 7 del protocolo con el runner que ya usa el repo. Si solo cambian algunos campos, corre además las pruebas que ya existían del formulario (regresión dirigida, sección 7).
2. Ejecútalas tú con el comando de pruebas del repo y cita la salida real (cuántas pasaron y cuántas fallaron).
3. Si alguna falla, corrige el código (no la prueba, salvo que la prueba contradiga el schema) y vuelve a ejecutar.
4. Guarda la salida real: se publica en el Paso 5 y la necesita el Gate.

## Paso 5 — Checklist de prueba manual (Paso 5 del protocolo)

Arma un checklist con los niveles que el schema exige, aplicados a los campos concretos de este formulario (ej. "Nivel 1: escribir `abc` en `cantidad` → no aparece nada"). Incluye solo las capas de este repo. Entrégaselo al dev: los Niveles 1 a 3 los recorre con teclado y navegador; para los Niveles 4 y 5 el ítem es la petición directa al endpoint y el intento de escritura directa en la BD, con la respuesta real citada. El dev marca PASS o FAIL en cada ítem.

- **Algún FAIL:** corrige, vuelve a correr el Paso 4, y pídele al dev que repita solo el ítem que falló.
- **Todo PASS:** ofrece publicar en el issue de Linear (`save_comment` del MCP de Linear) el checklist marcado junto con la salida de las pruebas del Paso 4. Confirma con el dev antes de publicar. Si no hay issue o no hay MCP de Linear, dale el texto listo para pegar en la descripción del PR. El Gate necesita esta evidencia para su criterio 7.

## Paso 6 — Gate (Pasos 6 y 7 del protocolo)

Dile al dev que el cambio está listo para el Gate de Calidad Técnica, y que su criterio 7 revisa este formulario contra el schema. Si el plugin `gate-calidad-tecnica` está instalado, ofrece correrlo. Si el Gate da `RECHAZADO` por el criterio 7, vuelve al Paso 3 con lo que señaló y repite los Pasos 4 y 5 solo para lo que cambió. NUNCA hagas `push` ni abras el PR desde esta skill: eso ocurre después del veredicto del Gate.

## Si hay un problema en producción (Excepción 4 y Rollback del protocolo)

- Validación desplegada que rompe algo: guía al dev a revertir el despliegue según `ADENDA_VERSIONAMIENTO_EXCEPCIONES_Y_ROLLBACK_v1.1.md`.
- Campo en producción sin las capas que pedía su schema: pregúntale al dev la severidad según la tabla de la Excepción 4 (el plazo lo decide esa tabla, no tú) y corrige desde el Paso 3, con una prueba de regresión de ese caso.

## Restricciones

- NUNCA escribas código de validación sin el schema completo y aprobado por el dev (Paso 1).
- NUNCA completes un dato del schema por tu cuenta, aunque parezca obvio. Si una respuesta es ambigua, repregunta.
- NUNCA agregues una librería si el repo ya tiene una que cumple esa función. Si hace falta una función que ninguna cubre, PUEDES agregarla, y SIEMPRE le dices al dev cuál y para qué (regla de stack, sección 4 del protocolo).
- NUNCA des un nivel por cerrado sin verificar su "Listo cuando".
- NUNCA reportes pruebas como pasadas sin haberlas ejecutado y citado la salida real.
- NUNCA publiques en Linear ni en GitHub sin confirmación del dev.
- SIEMPRE usa el mensaje de error exacto del schema, igual en todas las capas.
- NUNCA saltes un nivel por urgencia de despliegue: el protocolo no tiene excepción para eso.

## Verificación

Antes de dar por terminado un formulario con esta skill:

- [ ] Existe `schemas/schema_<formulario>.md` (o se leyó del otro repo o del issue de Linear), aprobado por el dev y sin texto de plantilla ni datos `PENDIENTE`.
- [ ] El dev confirmó el stack de cada capa.
- [ ] Cada nivel exigido por el schema se verificó contra su "Listo cuando".
- [ ] Las pruebas de la sección 7 existen, se ejecutaron y la salida real quedó guardada.
- [ ] El checklist de prueba manual quedó con todos los ítems en PASS y publicado en Linear (o entregado al dev para pegar en el PR).
- [ ] El dev sabe que el siguiente paso es el Gate antes del `push`.
