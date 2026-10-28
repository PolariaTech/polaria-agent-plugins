---
name: trabajo-en-paralelo-polaria
description: Coordina el trabajo en paralelo de varios devs, cada uno con su asistente de IA y sus cambios en local, para que nadie toque lo mismo ni se rompa el merge. Estima qué archivos va a tocar un ticket (POL-X de Linear o REQ-NNN del Sheet), los publica como CLAIM.md en la rama, revisa que nadie más los haya reclamado, descarga los cambios nuevos antes de empezar, cambia a la rama del ticket, mantiene al asistente dentro de esas zonas, libera el reclamo antes del PR y deja al día el Estado y el Asignado a del REQ-NNN en el Sheet. Úsala SIEMPRE que alguien diga "vamos a trabajar en POL-X", "retomemos REQ-012", "¿alguien está tocando esto?", "terminé el código de REQ-012 y lo pruebo", "voy a crear el PR", "ya terminé POL-X, libera", o cuando un hook rechace una edición, un commit o un gh pr create por el CLAIM.md. No la uses para crear, cambiar el estado ni cerrar issues de Linear (eso es `gestion-linear`), ni para revisar el diff (eso es `gate-calidad-tecnica-pre-merge-polaria`).
---

# Skill: Trabajo en paralelo sin pisarse

Los cambios de cada dev viven en su máquina y nadie ve lo del otro. Lo único que todos ven es git. Por eso el reclamo de cada ticket es un archivo **`CLAIM.md` en la raíz de la rama**: la única fuente de verdad. Los hooks leen una copia local de los `CLAIM.md` de las ramas remotas para avisar antes de que dos personas editen lo mismo, y rechazan que el asistente escriba fuera de las zonas de su propio `CLAIM.md`. Cada ticket es una rama distinta **del mismo proyecto**: al empezar uno se cambia de rama en esa misma carpeta y al terminar se libera y se vuelve a la rama principal. Nunca se crea una carpeta ni un worktree por rama.

**Dónde se mira si alguien ya reclamó algo:** siempre en el `CLAIM.md` de las ramas remotas del repo (lo hace `importar-claims`). Linear y el Sheet solo sirven para leer el ticket que se va a trabajar; nunca se buscan en ellos reclamos ni "issues activos".

**Raíz del plugin:** la carpeta dos niveles arriba de esta skill. Los scripts se llaman `node "<raíz del plugin>/scripts/paralelo.js" <comando>`, siempre desde dentro del repo. Formato del archivo y quién puede cambiarlo: `references/formato-reclamo.md`.

**Requisitos:** repo git con remoto `origin`, Node ≥18 y Git ≥2.38. Para leer el ticket: el MCP de Linear (lo trae el plugin `gestion-linear`) si es `POL-X`, o el conector de Google Sheets si es `REQ-NNN`; con el Sheet también se cambian el Estado y el Asignado a de la fila (`references/sheet-requerimientos.md`). Si falta el conector, sigue `references/instalar-conectores.md`.

Todo es automático, sin preguntar, **excepto estos casos**: un solape con el reclamo de otra rama (Modo A, paso 5), no saber dónde está el ticket (paso 1), la rama actual con un reclamo todavía activo (Modo A, paso 6), salir de las zonas (Modo E), un `REQ-NNN` asignado a otra persona o en `En Revisión` (`references/sheet-requerimientos.md`, paso 3) y un prefijo de rama que no se reconoce (Modo A, paso 2). En esos casos te detienes y le preguntas al dev, porque coordinar con otra persona o autorizar un cambio de alcance no lo puede decidir un asistente.

## Modo A: Reclamar (al empezar un ticket)

Si `linear-transicionar-estado` también se activa por la misma frase, déjala mover el issue a In Progress primero y sigue después con estos pasos.

**Antes del paso 1, siempre:** ejecuta `node "<raíz del plugin>/scripts/paralelo.js" sincronizar`. Hace `git fetch` y descarga los cambios nuevos si es seguro (sin cambios sin guardar y sin que la rama haya divergido), para que nadie trabaje con código viejo. Muéstrale al dev su salida si dice algo distinto de "al día". Si avisa que no pudo comprobar, que hay cambios sin guardar o que la rama divergió, díselo al dev y sigue: no descargues por tu cuenta ni uses `git pull` sin `--ff-only`. El hook de inicio de sesión hace lo mismo al abrir la sesión.

1. **Identifica el ticket y dónde vive.** El ID es el que dijo el dev o, si no dijo ninguno, el que sale de `git rev-parse --abbrev-ref HEAD`. `POL-X` es un issue de Linear y `REQ-NNN` es una fila del Sheet de requerimientos. Si no hay ID, pídelo en una línea. Si el ID no es de ninguno de los dos tipos, pregunta en una línea dónde está el ticket.
2. **Lee el ticket.**
   - **Linear:** `get_issue` (pide `gitBranchName`, `assignee`, `project`, `description`) y `list_comments`. La rama es el `gitBranchName`.
   - **Sheet:** sigue los pasos 1 a 3 de `references/sheet-requerimientos.md` (buscar la fila por el ID en la columna B y leer su Estado y su Asignado a). Si la fila está en `En Revisión`, detente: el requerimiento espera la revisión de Edgar y no se reclama. La rama es `<prefijo>/<id-en-minúsculas>-<título-corto>`, con el título en 3 a 5 palabras separadas por guiones. El `<prefijo>` lo da `node "<raíz del plugin>/scripts/paralelo.js" prefijo` (sale de `git config user.name`; imprime `dani`, `lucho` o `mauro`). Nunca uses el usuario del sistema operativo del PC. Si sale con código 8, pregúntale al dev una sola vez cuál es su nombre y repite con `--linear "<su nombre>"`; si tampoco se reconoce, pídele que agregue su primer nombre en `scripts/prefijos.json`. `iniciar-rama` (paso 6) rechaza una rama nueva de un REQ-NNN con otro prefijo.
   - Si no hay herramientas del conector que necesitas, sigue `references/instalar-conectores.md`.
3. **Estima las zonas.** Aplica `references/estimacion-de-zonas.md` de principio a fin: obtienes la lista de zonas (rutas exactas de archivo, nunca carpetas), la de compartidos y un porcentaje de confianza. No le preguntes nada al dev; investiga en el repo con Glob, Grep y Read. Estima generosamente en archivos, no en carpetas: el reclamo es un contrato.
4. **Trae los reclamos ajenos.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" importar-claims`.
5. **Cruza.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" comparar --zonas "<zona1>,<zona2>,..." --issue <ID>` con tus zonas (archivos exactos; funciones como `archivo#función`).
   - Sin línea `SOLAPE`: sigue al paso 6.
   - Con `SOLAPE` de zona: **detente**. Muéstrale al dev, en una tabla corta, de quién es el reclamo y qué rutas chocan. Ofrece dos caminos: (a) coordinar con esa persona antes de empezar, (b) tomar otro ticket primero. No existe un tercer camino de seguir con el solape. Espera su respuesta antes de crear nada.
   - Con `SOLAPE EN COMPARTIDO` solamente: no te detengas; sigue y menciónalo en el paso 9.
6. **Cambia a la rama del ticket, en este mismo proyecto.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" iniciar-rama <rama>`. Cambia de rama en la carpeta actual; no crea carpetas. Si ya estás en esa rama, no hace nada. Si la rama ya existía y estaba atrás de su remota, descarga los cambios antes de empezar. Según el código de salida:
   - `0`: listo. Trabaja en esta misma carpeta.
   - `8`: el prefijo de la rama no es el del dev (o no se pudo determinar). Corrige el prefijo como dice el paso 2 y repite.
   - `6`: hay cambios sin guardar en la rama actual. Dile al dev cuáles son y que los guarde (commit) antes; no los descartes ni los muevas tú.
   - `7`: la rama actual tiene un reclamo activo de otro ticket. **Pregúntale al dev una sola vez** si ese trabajo terminó o lo deja pausado. Si terminó, ejecuta `paralelo.js liberar --volver` (Modo D) y repite este paso. Si lo deja pausado, repite este paso con `--pausar`: el reclamo de ese ticket sigue vigente.
7. **Reclama.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" reclamar --issue <ID> --zonas "<zonas>" --nuevos "<archivos que el ticket crea>" --compartidos "<compartidos>" --confianza <N> --responsable "<asignado>" --porque "<una frase>"`. El comando vuelve a cruzar con las otras ramas, escribe el `CLAIM.md`, lo commitea como primer commit y publica la rama. NUNCA escribas el `CLAIM.md` a mano. Según el código de salida:
   - `0`: listo.
   - `3`: apareció un choque entre el paso 5 y ahora; vuelve al paso 5.
   - `5`: el commit quedó pero el push falló. Lee el error, díselo al dev y, si lo bloqueó el gate de calidad, sigue sus instrucciones. Los demás no ven el reclamo hasta que la rama se publique.
   - `2`: error de uso; corrige el argumento que dice el mensaje. Si rechaza una carpeta, lista los archivos con Glob y repite; si dice que una ruta no existe, corrígela o agrégala a `--nuevos`.
8. **Marca el Sheet (solo si el ticket es `REQ-NNN`).** Sigue `references/sheet-requerimientos.md`: Estado = `En Progreso` y Asignado a = el dev. Los `POL-X` no se marcan aquí.
9. **Informa al dev en 4 líneas:** zonas reclamadas, confianza, rama activa y si hay solapes en compartidos. No pegues el `CLAIM.md` completo.

## Modo B: Sincronizar (traer los reclamos de las ramas a la caché local)

Los hooks no pueden hacer `git fetch` en cada edición; leen `<git-common-dir>/polaria-paralelo/reclamos.json`. Este modo lo llena.

1. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" importar-claims`. Hace `git fetch`, lee el `CLAIM.md` de cada rama remota sin mergear y el propio, y reescribe la caché.
2. Muestra su salida al dev en una línea (cuántos reclamos vigentes e inactivos).
3. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" solapes`. Si imprime algo distinto de "Sin solapes", pásaselo al dev y sigue con el Modo C.

## Modo C: Seguimiento (cuando un hook avisa o antes de pedir el push)

Úsalo cuando un hook de este plugin muestre un aviso, cuando el dev pregunte "¿esto choca con algo?" o justo antes de que el dev pida el push.

1. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" solapes`. Hace `git fetch` y compara contra las ramas remotas y los reclamos.
2. Según la línea que salga:
   - **CONFLICTO REAL** (otra rama toca las mismas líneas): dile al dev de qué rama y archivos se trata; propón esperar a que esa rama se mergee y hacer rebase, o repartir los archivos. No resuelvas el conflicto tú.
   - **MISMO ARCHIVO** o **ARCHIVOS DENTRO DE UNA ZONA RECLAMADA**: avísale y sugiere coordinar con el dueño pronto; todavía no es un conflicto.
   - **ARCHIVOS PROPIOS FUERA DE LO QUE RECLAMÓ**: ve al Modo E.
3. Si el dev va a hacer push, recuérdale que el primer push temprano, aunque el trabajo esté a medias, es lo que hace visible su rama para los demás.

## Modo D: Entregar y liberar (antes de crear el PR y al cerrar el ticket)

### Antes de crear el PR (siempre, sin excepción)

El `CLAIM.md` no puede llegar a la rama principal con el PR. Un hook rechaza `gh pr create` si la rama o su remota todavía lo traen, y el push final es el de la rama sobre la que se va a crear el PR: un push intermedio conserva el reclamo. Sigue este orden, sin saltarte pasos:

1. Ejecuta el Modo C, paso 1 (`solapes`), y resuelve lo que diga antes de seguir.
2. **Libera el reclamo, sin `--volver`.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" liberar`. Borra el `CLAIM.md` con un commit y lo publica en la misma rama, antes de crear el PR. Deja en el mensaje del commit "N de M archivos dentro de lo reclamado (confianza declarada X%)", que sirve para ver con el tiempo si el porcentaje estimado era honesto. Si sale con código 5, el commit quedó pero el push falló: díselo al dev, y no crees el PR hasta que la liberación esté publicada (`git push origin <rama>`).
3. Crea el PR (`gh pr create`) con `Refs <ID>` en la descripción. Si el hook lo rechaza por el `CLAIM.md`, vuelve al paso 2; no busques otro camino.
4. **Marca el Sheet (solo si el ticket es `REQ-NNN`).** Sigue `references/sheet-requerimientos.md`: Estado = `En paso a producción`. Los `POL-X` no se marcan aquí.

### Al cerrar (PR mergeado o ticket abandonado)

1. Confirma con el dev que el trabajo terminó (PR mergeado) o se abandona. Si no está claro, pregunta una sola vez. `Completado` en el Sheet lo marca una persona cuando el cambio está en producción; tú no lo escribes.
2. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" liberar --volver`. Si la rama aún tiene el `CLAIM.md` (ticket abandonado, sin PR), lo borra con un commit y lo publica. Si ya se liberó antes del PR, lo dice y solo continúa. Luego vuelve a la rama principal en este mismo proyecto y borra la rama local si ya está mergeada (si no lo está, la conserva y lo dice).
3. Si git no pudo volver a la principal (por ejemplo por cambios sin guardar), muéstrale el aviso al dev y no fuerces nada.

## Modo F: Avanzar el estado del REQ-NNN a "En validación"

Se activa cuando el dev dice que terminó de escribir el código de un `REQ-NNN` y va a empezar a verificar que la implementación funciona (primera prueba de cualquier tipo: automatizada, manual o en un ambiente). Hazlo ANTES de correr la primera prueba, no después.

1. Si el ticket es un `POL-X`, no hagas nada aquí: lo cambia `gestion-linear`.
2. Si es `REQ-NNN`, sigue `references/sheet-requerimientos.md` con Estado = `En validación`.
3. Dile al dev en una línea que quedó marcado.

## Modo E: Salir de las zonas (cuando un hook o el pre-commit rechaza)

Se activa cuando un hook rechaza una edición con "no puedes editar ... fuera de las zonas", cuando el pre-commit rechaza un commit, o cuando `solapes` dice "ARCHIVOS PROPIOS FUERA DE LO QUE ... RECLAMÓ". Solo el usuario puede ampliar el alcance.

1. Detén la edición. NUNCA busques otro camino para escribir ese archivo: ni por la terminal, ni editando el `CLAIM.md`, ni con `--no-verify`.
2. Dile al dev, en 3 líneas: qué archivo, que está fuera del `CLAIM.md` y por qué lo necesitas.
3. Pregúntale si autoriza ampliar el alcance. Que lo digas en el chat no basta: el asistente no puede correr el comando.
4. Si el dev acepta, dale este comando exacto para que lo corra **él, en su terminal**: `node "<raíz del plugin>/scripts/paralelo.js" autorizar <ruta>`. Se detiene si la ruta choca con el reclamo de otra rama; si no, le pide confirmar, agrega la ruta al `CLAIM.md` y publica el nuevo alcance.
5. Espera a que el dev diga que terminó y continúa con la edición. Si el comando se detuvo por un choque, no edites: ofrécele coordinar con esa persona o tomar otro ticket.

## Restricciones

- NUNCA edites un archivo fuera de las zonas y compartidos del `CLAIM.md` de tu rama. Los hooks lo rechazan, pero la regla es tuya primero.
- NUNCA escribas, muevas ni borres el `CLAIM.md` por ningún medio que no sea `paralelo.js reclamar` y `paralelo.js liberar`. `autorizar` solo lo corre el dev en su terminal.
- NUNCA uses `--no-verify`, cambies `core.hooksPath` ni escribas en `<git>/polaria-paralelo` o en `<git>/hooks`.
- NUNCA escribas en el Sheet nada que no sea el Estado (columna G) y el Asignado a (columna J) de la fila del ticket que estás trabajando, ni un valor que no esté en la lista desplegable de esa celda, ni los estados `En Revisión`, `Completado`, `Rechazado` o `Proximo Sprint`. Sigue `references/sheet-requerimientos.md` paso a paso.
- NUNCA pises el Asignado a de otra persona sin preguntarle al dev, ni reclames un `REQ-NNN` que esté en `En Revisión`.
- NUNCA crees el PR con el `CLAIM.md` puesto: libéralo antes con `paralelo.js liberar` (sin `--volver`).
- NUNCA armes el prefijo de la rama con el usuario del sistema operativo: sale de `paralelo.js prefijo`.
- NUNCA descargues cambios con un `git pull` que cree un commit de merge, ni con `--force`: solo `paralelo.js sincronizar` (`--ff-only`).
- NUNCA reclames zonas inventadas: cada ruta DEBE existir en el repo o ser un archivo nuevo que el ticket pide crear (va en `--nuevos`).
- NUNCA reclames una carpeta para evitarte listar archivos. `--permitir-carpetas` solo se usa cuando los archivos no se pueden conocer antes de trabajar, y el motivo va en `--porque`.
- NUNCA crees carpetas ni worktrees por rama, y nunca uses `git push --force` ni `git branch -D`.
- NUNCA busques reclamos en Linear ni en el Sheet: los reclamos activos salen solo del `CLAIM.md` de las ramas (`importar-claims`).
- SIEMPRE publica el reclamo **antes** de editar código; un reclamo tardío no protege a nadie.
- DEBERÍAS reclamar más archivos antes que menos, pero siempre archivos concretos: un archivo de sobra cuesta una coordinación; uno faltante detiene el trabajo y pide una autorización.
- Los hooks de zonas ajenas y de push avisan; solo `POLARIA_PARALELO_MODO=bloquear` los vuelve bloqueantes. El rechazo de escribir fuera del propio `CLAIM.md` es siempre, sin depender de esa variable.
- Si el hook de otro plugin (el gate de calidad) bloquea el push, eso no tiene que ver con esta skill: sigue las instrucciones del gate.
