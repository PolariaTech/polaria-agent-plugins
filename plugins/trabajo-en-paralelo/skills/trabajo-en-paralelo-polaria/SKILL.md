---
name: trabajo-en-paralelo-polaria
description: Coordina el trabajo en paralelo de varios devs, cada uno con su asistente de IA y sus cambios en local, para que nadie toque lo mismo ni se rompa el merge. Estima solo qué módulos, archivos y funciones va a tocar un issue (con % de confianza), los reclama como comentario del issue en Linear, revisa que nadie más los haya reclamado, crea la rama y su worktree aislado, y al terminar libera el reclamo. Úsala SIEMPRE que alguien diga "vamos a trabajar en POL-X", "sigamos con POL-X", "retomemos POL-X", "voy a empezar el issue X", "¿alguien está tocando esto?", "¿puedo tocar este módulo?", "¿esto choca con lo de Mauro/Lucho?", "sincroniza los reclamos", "ya terminé POL-X, libera", o cuando un hook avise de un solape con otra rama o reclamo — incluso si no dice "reclamo" ni "worktree". No la uses para crear issues, cambiar su estado ni cerrarlos (eso es `gestion-linear`), ni para revisar la calidad del diff (eso es `gate-calidad-tecnica-pre-merge-polaria`).
---

# Skill: Trabajo en paralelo sin pisarse

Los cambios de cada dev viven en su máquina y nadie ve lo del otro. Lo único que todos ven es Linear. Por eso esta skill registra **qué va a tocar cada issue como un comentario del issue**, y los hooks del plugin (`hooks/`) leen una copia local de esos comentarios para avisar antes de que dos personas editen lo mismo. Un `git worktree` por tarea aísla al asistente de Claude y al de Cursor de una misma persona.

**Raíz del plugin:** la carpeta dos niveles arriba de esta skill. Los scripts se llaman `node "<raíz del plugin>/scripts/paralelo.js" <comando>`, siempre desde dentro del repo (o de uno de sus worktrees).

**Requisitos:** repo git con remoto `origin`, plugin `gestion-linear` instalado (trae el MCP de Linear) y Node ≥18. Si falta el MCP de Linear, díselo al dev en una línea y detente: sin Linear no hay dónde publicar el reclamo.

Todo es automático, sin preguntar, **excepto un caso**: si el reclamo propuesto se solapa con el de otro issue activo (Modo A, paso 5). Ahí te detienes y le preguntas al dev, porque coordinar con otra persona no lo puede decidir un asistente.

## Modo A — Reclamar (al empezar un issue)

Si `linear-transicionar-estado` también se activa por la misma frase, déjala mover el issue a In Progress primero y sigue después con estos pasos.

1. **Identifica el issue.** Es el `POL-X` que dijo el dev o, si no dijo ninguno, el que sale de `git rev-parse --abbrev-ref HEAD` (la rama de Linear es `usuario/pol-123-titulo`). Si no hay ninguno de los dos, pídelo en una línea.
2. **Lee el issue.** Con `get_issue` (pide `gitBranchName`, `assignee`, `project`, `description`) y `list_comments` sobre ese issue. Si ya existe un comentario con `<!-- polaria-reclamo v1 -->` de esta misma rama, es una actualización: guarda su `id` para el paso 6 y sigue.
3. **Estima las zonas.** Aplica `references/estimacion-de-zonas.md` de principio a fin. Obtienes: la lista de zonas (carpeta, archivo o `archivo#función`), la lista de compartidos y un porcentaje de confianza. No le preguntes nada al dev para esto: investiga en el repo con Glob, Grep y Read.
4. **Sincroniza los reclamos ajenos.** Ejecuta el Modo B completo.
5. **Cruza.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" comparar --zonas "<zona1>,<zona2>,..." --issue POL-X` con tus zonas (carpetas terminadas en `/`, funciones como `archivo#función`).
   - Sin salida de `SOLAPE`: sigue al paso 6.
   - Con `SOLAPE`: **detente**. Muéstrale al dev, en una tabla corta, de quién es el reclamo, qué rutas chocan y si es zona o compartido. Ofrece tres caminos: (a) coordinar con esa persona antes de empezar, (b) tomar otro issue primero, (c) seguir con el solape dejándolo escrito en el reclamo. Espera su respuesta antes de publicar nada. Si elige (c), agrega al reclamo la sección `### Solapes conocidos` con el issue, la persona y la ruta.
   - `SOLAPE EN COMPARTIDO` solamente: no te detengas; anótalo en `### Solapes conocidos` y sigue.
6. **Publica el reclamo.** Con `save_comment` sobre el issue (con `id` si es actualización). El cuerpo sigue exactamente `references/formato-reclamo.md`: sin el marcador de la primera línea y los encabezados literales, los hooks no lo entienden.
7. **Refresca la caché propia.** Vuelve a ejecutar el Modo B (así tu reclamo también queda en la caché local).
8. **Crea la rama y el worktree.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" crear-worktree <gitBranchName>`. Imprime la ruta del worktree. Trabaja desde ahí: usa esa ruta en todas tus lecturas, ediciones y comandos git. Si el dev ya está parado en un worktree de esta misma rama, omite este paso.
9. **Informa al dev en 4 líneas:** zonas reclamadas, confianza, ruta del worktree y si hay solapes conocidos. No pegues el comentario completo.

## Modo B — Sincronizar (traer los reclamos de Linear a la caché local)

Los hooks no pueden llamar a Linear; leen `<git-common-dir>/polaria-paralelo/reclamos.json`. Este modo lo llena.

1. Ejecuta `git rev-parse --git-common-dir` y resuelve la ruta absoluta; la llamamos `<común>`.
2. Con `list_issues` del mismo proyecto del issue actual, trae los issues en estado `In Progress` y `In Review` (dos llamadas, una por estado). Si no hay issue actual, usa el proyecto que indique el dev.
3. Para cada issue, `list_comments` y quédate con los comentarios cuyo cuerpo contiene `<!-- polaria-reclamo v1 -->`.
4. Escribe `<común>/polaria-paralelo/importar.json` con un arreglo de objetos `{ "issue": "POL-X", "comentarioId": "...", "autor": "nombre", "creado": "fecha ISO", "cuerpo": "texto completo del comentario" }`, uno por comentario de reclamo. Si no encontraste ninguno, escribe `[]`.
5. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" importar "<común>/polaria-paralelo/importar.json"` y muestra su salida al dev en una línea (cuántos reclamos activos).
6. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" solapes` y, si imprime algo distinto de "Sin solapes", pásaselo al dev con el siguiente paso sugerido (ver Modo C).

## Modo C — Seguimiento (cuando un hook avisa o antes de pedir el push)

Úsalo cuando un hook de este plugin muestre un aviso, cuando el dev pregunte "¿esto choca con algo?" o justo antes de que el dev pida el push.

1. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" solapes`. Hace `git fetch` y compara contra las ramas remotas y los reclamos.
2. Según la línea que salga:
   - **CONFLICTO REAL** (otra rama toca las mismas líneas): dile al dev de qué rama y archivos se trata; propón esperar a que esa rama se mergee y hacer rebase, o repartir los archivos. No resuelvas el conflicto tú.
   - **MISMO ARCHIVO**: avísale y sugiere coordinar con la otra persona pronto; todavía no es un conflicto.
   - **ARCHIVOS DENTRO DE UNA ZONA RECLAMADA**: igual que el caso anterior; nómbrale al dueño del reclamo.
   - **ARCHIVOS PROPIOS FUERA DE LO QUE RECLAMÓ**: el trabajo se salió de lo estimado. Actualiza tu reclamo: agrega las rutas nuevas, baja la confianza y re-publica con `save_comment` usando el `id` del comentario; luego corre el Modo B y el paso 5 del Modo A (`comparar`) con las zonas nuevas. Si ahora hay `SOLAPE`, detente como en el Modo A.
3. Si el dev va a hacer push, recuérdale que el primer push temprano (aunque el trabajo esté a medias, en PR borrador) es lo que hace visible su rama para el chequeo de los demás.

## Modo D — Liberar (al terminar o abandonar el issue)

1. Confirma con el dev que el trabajo terminó (PR mergeado) o se abandona. Si no está claro, pregunta una sola vez.
2. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" solapes --sin-fetch` y cuenta cuántos archivos propios cayeron fuera del reclamo (línea "FUERA DE LO QUE ... RECLAMÓ"; si no sale, fueron 0).
3. Edita tu comentario de reclamo con `save_comment` y su `id`: cambia `**Estado:**` a `LIBERADO` y agrega al final `### Resultado` con "N de M archivos dentro de lo reclamado (confianza declarada: X%)". Así se ve con el tiempo si el % estimado era honesto.
4. Ejecuta el Modo B para refrescar la caché.
5. Si el trabajo se hizo en un worktree creado por esta skill y el dev confirma que ya no lo necesita, ejecuta `git worktree remove <ruta>` desde el repo principal. Sin `--force`: si git dice que hay cambios sin guardar, muéstraselo al dev y no lo fuerces.

## Restricciones

- NUNCA edites archivos del proyecto dentro de una zona que otro issue reclamó sin haber pasado por el paso 5 del Modo A y sin que el dev lo haya aceptado.
- NUNCA publiques un reclamo con zonas inventadas: cada ruta DEBE existir en el repo o ser un archivo nuevo que el issue pide crear (márcalo "nuevo" en el reclamo).
- NUNCA uses `--force` en `git worktree remove` ni `git push --force`.
- SIEMPRE publica el reclamo **antes** de editar código; un reclamo tardío no protege a nadie.
- DEBERÍAS reclamar de más antes que de menos: una zona de sobra cuesta una coordinación; una zona faltante cuesta un conflicto.
- Los hooks avisan, no bloquean. Si el equipo decide bloquear, se activa con la variable de entorno `POLARIA_PARALELO_MODO=bloquear`.
- Si el hook de otro plugin (el gate de calidad) bloquea el push, eso no tiene que ver con esta skill: sigue las instrucciones del gate.
