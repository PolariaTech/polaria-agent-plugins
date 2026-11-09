---
name: iniciar-ticket-polaria
description: Empieza un ticket de principio a fin antes de tocar código - lee el ticket y sus imágenes, investiga la causa con un subagente, estima los archivos, propone un plan y solo entonces reclama. Úsala SIEMPRE que el dev diga "vamos a trabajar en POL-X", "vamos a trabajar en REQ-012", "retomemos REQ-012", "sigamos con POL-X", "empecemos el ticket", "arregla el bug REQ-012" o "implementa POL-X", aunque no nombre la skill. No la uses para liberar, para ver solapes ni para ampliar el reclamo (eso es `trabajo-en-paralelo-polaria`), ni para cambiar el estado de un issue de Linear sin empezar a trabajarlo (eso es `gestion-linear`).
---

# Skill: Iniciar un ticket (leer, investigar, planear y reclamar)

Esta skill ordena los primeros pasos de un ticket. Reutiliza los pasos de la skill `trabajo-en-paralelo-polaria` en vez de repetirlos: cuando dice "Modo A, paso N", abre `../trabajo-en-paralelo-polaria/SKILL.md` y haz exactamente ese paso. Si un término, un aviso o un código no se entiende, mira `../trabajo-en-paralelo-polaria/references/glosario.md`.

Aplica a tickets de tipo `Bug`, `Feature` e `Improvement`. Si el ticket es `Administrative` (permisos, usuarios, configuración de cuentas), no investigues ni planees: sigue el Modo A de `trabajo-en-paralelo-polaria` completo.

Hay dos reglas que no cambian: el reclamo se publica **antes** de editar cualquier archivo, y el asistente no sale de las zonas de su `CLAIM.md`.

## Paso 0: Sincroniza y busca un plan guardado

1. Ejecuta lo que dice el Modo A antes del paso 1 (`paralelo.js sincronizar`).
2. Busca `TMP/<ID>-plan.md`. Si existe, sigue "Retomar un plan guardado" en `references/plantilla-plan.md`.

## Paso 1: Identifica dónde vive el ticket

Haz el Modo A, paso 1. Si el ID empieza con `REQ-`, el ticket está en el Sheet de requerimientos. Si empieza con `POL-`, está en Linear.

## Paso 2: Lee el ticket, sus imágenes, y márcalo en progreso

1. Lee el ticket como dice el Modo A, paso 2.
   - Si es `REQ-NNN`, aplica también las reglas de lectura de `sheet-requerimientos.md` (paso 4 del procedimiento): se detiene si está en `En Revisión`, y pregunta antes de seguir si está `Completado`, `Rechazado`, `En paso a producción` o asignado a otra persona.
2. Lee la descripción completa y los comentarios. Anota el tipo del ticket. Si es `Administrative`, sal de esta skill como dice arriba.
3. Busca imágenes asociadas y léelas con la mejor forma que tenga tu cliente (verlas directamente o descargarlas primero).
   - Linear: usa `extract_images` sobre el markdown de la descripción y de los comentarios, y `get_attachment` para los adjuntos.
   - Sheet: busca enlaces a imágenes o a Drive en la descripción y en la columna `COMENTARIOS`.
   - Si una imagen no se puede abrir, dilo en una línea y pídele al dev que la pegue en el chat. No supongas lo que muestra.
4. Guarda una copia de cada imagen y dile al dev la ruta de la carpeta de evidencias. Las reglas (carpeta `TMP/`, nombres, qué hacer si no se puede copiar) están en `references/plantilla-plan.md`, secciones "Preparar la carpeta TMP" y "Carpeta de evidencias".
5. Averigua en qué repo va el cambio. Si es `POL-X`, usa la primera línea `Repo:` de la descripción del proyecto (`get_project`). Si es `REQ-NNN` o el proyecto no tiene esa línea, pregúntale al dev una sola vez en cuál repo se trabaja (por ejemplo el de la API o el de la web).
6. Marca el ticket en progreso. Aquí, y no después de reclamar, porque en progreso incluye la investigación.
   - `REQ-NNN`: sigue `sheet-requerimientos.md` con Estado = `En Progreso` y Asignado = el dev.
   - `POL-X`: aplica los pasos 1 a 5 del MODO INICIO de `linear-transicionar-estado`.

## Paso 3: Investiga con subagentes de solo lectura

1. Decide qué fuentes se investigan (el repo, n8n, Supabase) y lanza un subagente de solo lectura por cada una, todos al mismo tiempo. Cómo decidir las fuentes, las herramientas permitidas y las prohibidas de n8n y de Supabase, y qué hacer con datos personales: `references/fuentes-solo-lectura.md`. En Claude Code, el agente `Explore`; en Cursor, un subagente de exploración o de solo lectura.
2. Dale a cada uno como instrucciones, literalmente: el texto del ticket, la ruta de la carpeta de evidencias, la fuente que le toca, el contenido de las secciones 3 a 5 de `references/fuentes-solo-lectura.md` que correspondan a esa fuente, y esta orden: "Busca en tu fuente la causa de este problema (o, si es un Feature o un Improvement, dónde se implementaría). No edites, no crees, no borres ni ejecutes nada que cambie algo. Devuelve: la hipótesis en dos frases, los archivos y líneas implicados, los archivos relacionados (pruebas, tipos, fixtures, documentación) y tu confianza de 1 a 100".
3. Si la causa está en otro repo distinto del que se abrió, detente. Dile al dev en qué repo está y que ahí va su propio reclamo y su propia rama.
4. Si ningún subagente encuentra nada, dilo y pídele al dev una pista. No inventes una causa.
5. Junta los resultados en una sola hipótesis. Si dos fuentes se contradicen, muéstrale al dev las dos.

## Paso 4: Estima los archivos y cruza con los demás

1. Aplica `../trabajo-en-paralelo-polaria/references/estimacion-de-zonas.md` de principio a fin, partiendo de lo que devolvió el subagente. Obtienes zonas (archivos exactos), compartidos y confianza.
2. Ejecuta `paralelo.js importar-claims` y luego `paralelo.js comparar --zonas "<zonas>" --issue <ID>` (Modo A, pasos 4 y 5). Este cruce solo lee.
3. Si sale `SOLAPE` de zona: detente. Muéstrale al dev la tabla corta del Modo A, paso 5, y ofrece las dos opciones (coordinar o tomar otro ticket). Antes de terminar, guarda el plan como dice `references/plantilla-plan.md`. El ticket queda en progreso: dile al dev que si toma otro ticket cambie el estado de este a mano.

## Paso 5: Plan

1. Decide si el cambio es trivial. Es trivial solo si cumple las tres: es solo texto, títulos, nombres o estilos; es un único archivo; no toca lógica. Si es trivial, di en una línea "cambio trivial, sin plan" y salta al Paso 6. El dev puede pedir el plan aunque sea trivial, o pedir saltarlo aunque no lo sea.
2. Si no es trivial, cambia a modo de planeación:
   - Claude Code: entra a Plan Mode con `EnterPlanMode`.
   - Cursor: cambia al modo Plan con la herramienta de cambio de modo. Si tu cliente no tiene esa herramienta, pídele al dev que cambie a Plan y espera su confirmación.
3. Escribe el plan: qué se cambia en cada archivo, en qué orden, cómo se verifica que funciona y qué pruebas se agregan. Usa solo archivos de la lista del Paso 4; si el plan necesita otro, agrégalo a la lista y repite el cruce del Paso 4.
4. Pide la aprobación (en Claude Code, con `ExitPlanMode`; en Cursor, con una pregunta directa). No sigas sin ella.

## Paso 6: Reclama y empieza a editar

1. Con el plan aprobado, haz el Modo A, pasos 6 y 7 (`iniciar-rama` y `reclamar`), con las zonas del plan.
   - Código `3` en `reclamar`: apareció un choque mientras se planeaba. Guarda el plan como dice `references/plantilla-plan.md` y vuelve al Paso 4, punto 3.
   - Otros códigos: sigue la tabla del Modo A, paso 7.
2. No repitas el Modo A, paso 8: el Sheet ya se marcó en el Paso 2.
3. Informa al dev en 5 líneas: zonas reclamadas, confianza, rama activa, solapes en compartidos y la ruta de la carpeta de evidencias (o "sin evidencias").
4. Empieza a editar solo después de que el reclamo esté publicado.

## Restricciones

- NUNCA edites un archivo del proyecto antes de que `reclamar` salga con código `0`. Las únicas escrituras permitidas antes son las de la carpeta `TMP/` y `.git/info/exclude`.
- NUNCA crees la carpeta `TMP/` sin que el dev diga que sí.
- NUNCA edites `.gitignore` para esconder `TMP/`: usa `.git/info/exclude`.
- NUNCA dejes que un subagente de investigación edite, cree o borre archivos, ejecute un workflow de n8n o ejecute SQL que no sea un `SELECT`. Lo que no esté en las listas de `references/fuentes-solo-lectura.md` está prohibido.
- NUNCA copies secretos ni datos personales a `TMP/` ni al plan.
- NUNCA inventes la causa ni el contenido de una imagen que no pudiste abrir.
- NUNCA pongas en el plan un archivo fuera de la lista cruzada en el Paso 4. Un workflow de n8n no se reclama: va en el plan como "workflow de n8n: <nombre>" y le avisas al dev.
- SIEMPRE marca el ticket en progreso en el Paso 2, no al final.
- DEBES guardar el plan en `TMP/<ID>-plan.md` cuando el reclamo no se pueda publicar.
- DEBERÍAS investigar antes de pedirle al dev información que ya está en el código.
- PUEDES saltar el plan solo con un cambio trivial, y lo dices en una línea.
