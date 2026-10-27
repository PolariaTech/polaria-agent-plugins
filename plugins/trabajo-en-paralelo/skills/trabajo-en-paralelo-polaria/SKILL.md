---
name: trabajo-en-paralelo-polaria
description: Coordina el trabajo en paralelo de varios devs, cada uno con su asistente de IA y sus cambios en local, para que nadie toque lo mismo ni se rompa el merge. Estima qué archivos va a tocar un ticket (issue de Linear POL-X o fila del Sheet REQ-NNN), los publica como CLAIM.md en la rama, revisa que ninguna otra rama los haya reclamado, crea la rama y su worktree, mantiene al asistente dentro de esas zonas y al terminar libera el reclamo. Úsala SIEMPRE que alguien diga "vamos a trabajar en POL-X", "sigamos con REQ-012", "retomemos POL-X", "voy a empezar el ticket X", "¿alguien está tocando esto?", "¿puedo tocar este módulo?", "¿esto choca con lo de otro dev?", "sincroniza los reclamos", "ya terminé POL-X, libera", o cuando un hook rechace una edición o un commit por salirse de las zonas del CLAIM.md o avise de un solape, incluso si no dice "reclamo" ni "worktree". No la uses para crear issues, cambiar su estado ni cerrarlos (eso es `gestion-linear`), ni para revisar la calidad del diff (eso es `gate-calidad-tecnica-pre-merge-polaria`).
---

# Skill: Trabajo en paralelo sin pisarse

Los cambios de cada dev viven en su máquina y nadie ve lo del otro. Lo único que todos ven es git. Por eso el reclamo de cada ticket es un archivo **`CLAIM.md` en la raíz de la rama**: la única fuente de verdad. Los hooks leen una copia local de los `CLAIM.md` de las ramas remotas para avisar antes de que dos personas editen lo mismo, y rechazan que el asistente escriba fuera de las zonas de su propio `CLAIM.md`. Un `git worktree` por tarea aísla al asistente de Claude y al de Cursor de una misma persona.

**Raíz del plugin:** la carpeta dos niveles arriba de esta skill. Los scripts se llaman `node "<raíz del plugin>/scripts/paralelo.js" <comando>`, siempre desde dentro del repo (o de uno de sus worktrees). Formato del archivo y quién puede cambiarlo: `references/formato-reclamo.md`.

**Requisitos:** repo git con remoto `origin`, Node ≥18 y Git ≥2.38. Para leer el ticket: el MCP de Linear (lo trae el plugin `gestion-linear`) si es `POL-X`, o el conector de Google Sheets si es `REQ-NNN`. Si falta, sigue `references/instalar-conectores.md`.

Todo es automático, sin preguntar, **excepto tres casos**: un solape con el reclamo de otra rama (Modo A, paso 5), no saber dónde está el ticket (paso 1) y salir de las zonas (Modo E). En esos casos te detienes y le preguntas al dev, porque coordinar con otra persona o autorizar un cambio de alcance no lo puede decidir un asistente.

## Modo A: Reclamar (al empezar un ticket)

Si `linear-transicionar-estado` también se activa por la misma frase, déjala mover el issue a In Progress primero y sigue después con estos pasos.

1. **Identifica el ticket y dónde vive.** El ID es el que dijo el dev o, si no dijo ninguno, el que sale de `git rev-parse --abbrev-ref HEAD`. `POL-X` es un issue de Linear y `REQ-NNN` es una fila del Sheet de requerimientos. Si no hay ID, pídelo en una línea. Si el ID no es de ninguno de los dos tipos, pregunta en una línea dónde está el ticket.
2. **Lee el ticket.**
   - **Linear:** `get_issue` (pide `gitBranchName`, `assignee`, `project`, `description`) y `list_comments`. La rama es el `gitBranchName`.
   - **Sheet:** con las herramientas de lectura del conector de Google Sheets, busca el ID en la columna B de la pestaña `Requerimientos` (hoja "Requerimientos", ID `1AdIh-6s7iMPuYbLEwLSevvp6uMfIZpqP7UJ-9h0loDY`). Columnas: C tipo, D descripción, F prioridad, G estado, H duplicado de, I relacionado con, J asignado a, L comentarios. Avisa en una línea, sin detenerte, si el estado es `Completado` o `Rechazado`, si "Duplicado de" apunta a otro REQ distinto, o si el estado es `Asignado` o `En Progreso` para una persona distinta del dev. Recuérdale al dev que marque a mano `En Progreso` y "Asignado a" en el Sheet. La rama es `<usuario>/<id-en-minúsculas>-<título-corto>`, con el usuario de `git config user.name` en minúsculas y sin espacios ni tildes, y el título en 3 a 5 palabras separadas por guiones.
   - Si no hay herramientas del conector que necesitas, sigue `references/instalar-conectores.md`.
3. **Estima las zonas.** Aplica `references/estimacion-de-zonas.md` de principio a fin: obtienes la lista de zonas, la de compartidos y un porcentaje de confianza. No le preguntes nada al dev; investiga en el repo con Glob, Grep y Read. Estima generosamente: el reclamo es un contrato.
4. **Trae los reclamos ajenos.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" importar-claims`.
5. **Cruza.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" comparar --zonas "<zona1>,<zona2>,..." --issue <ID>` con tus zonas (carpetas terminadas en `/`, funciones como `archivo#función`).
   - Sin línea `SOLAPE`: sigue al paso 6.
   - Con `SOLAPE` de zona: **detente**. Muéstrale al dev, en una tabla corta, de quién es el reclamo y qué rutas chocan. Ofrece dos caminos: (a) coordinar con esa persona antes de empezar, (b) tomar otro ticket primero. No existe un tercer camino de seguir con el solape. Espera su respuesta antes de crear nada.
   - Con `SOLAPE EN COMPARTIDO` solamente: no te detengas; sigue y menciónalo en el paso 8.
6. **Crea la rama y el worktree.** Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" crear-worktree <rama>`. Imprime la ruta del worktree. Trabaja desde ahí: usa esa ruta en todas tus lecturas, ediciones y comandos git. Si el dev ya está parado en un worktree de esta misma rama, omite este paso.
7. **Reclama.** Desde el worktree, ejecuta `node "<raíz del plugin>/scripts/paralelo.js" reclamar --issue <ID> --zonas "<zonas>" --compartidos "<compartidos>" --confianza <N> --responsable "<asignado>" --porque "<una frase>"`. El comando vuelve a cruzar con las otras ramas, escribe el `CLAIM.md`, lo commitea como primer commit y publica la rama. NUNCA escribas el `CLAIM.md` a mano. Según el código de salida:
   - `0`: listo.
   - `3`: apareció un choque entre el paso 5 y ahora; vuelve al paso 5.
   - `5`: el commit quedó pero el push falló. Lee el error, díselo al dev y, si lo bloqueó el gate de calidad, sigue sus instrucciones. Los demás no ven el reclamo hasta que la rama se publique.
   - `2`: error de uso; corrige el argumento que dice el mensaje.
8. **Informa al dev en 4 líneas:** zonas reclamadas, confianza, ruta del worktree y si hay solapes en compartidos. No pegues el `CLAIM.md` completo.

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

## Modo D: Liberar (al terminar o abandonar el ticket)

1. Confirma con el dev que el trabajo terminó (PR mergeado) o se abandona. Si no está claro, pregunta una sola vez.
2. Ejecuta `node "<raíz del plugin>/scripts/paralelo.js" liberar`. Borra el `CLAIM.md` con un commit, lo publica y deja en el mensaje del commit "N de M archivos dentro de lo reclamado (confianza declarada X%)", que sirve para ver con el tiempo si el porcentaje estimado era honesto.
3. Si el trabajo se hizo en un worktree creado por esta skill y el dev confirma que ya no lo necesita, ejecuta `git worktree remove <ruta>` desde el repo principal. Sin `--force`: si git dice que hay cambios sin guardar, muéstraselo al dev y no lo fuerces.

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
- NUNCA llames a herramientas de escritura del conector de Google Sheets. El Sheet es solo de lectura.
- NUNCA reclames zonas inventadas: cada ruta DEBE existir en el repo o ser un archivo nuevo que el ticket pide crear.
- NUNCA uses `--force` en `git worktree remove` ni `git push --force`.
- SIEMPRE publica el reclamo **antes** de editar código; un reclamo tardío no protege a nadie.
- DEBERÍAS reclamar de más antes que de menos: una zona de sobra cuesta una coordinación; una zona faltante detiene el trabajo y pide una autorización.
- Los hooks de zonas ajenas y de push avisan; solo `POLARIA_PARALELO_MODO=bloquear` los vuelve bloqueantes. El rechazo de escribir fuera del propio `CLAIM.md` es siempre, sin depender de esa variable.
- Si el hook de otro plugin (el gate de calidad) bloquea el push, eso no tiene que ver con esta skill: sigue las instrucciones del gate.
