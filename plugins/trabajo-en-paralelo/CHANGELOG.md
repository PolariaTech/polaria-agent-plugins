# Changelog — trabajo-en-paralelo

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [1.3.0] — 2026-10-28

### Cambiado
- **El reclamo lista archivos exactos, no carpetas.** `references/estimacion-de-zonas.md` §2 ya no manda subir a la carpeta cuando hay 3 o más archivos en un directorio ni cuando la confianza queda bajo 70%. Cada zona es la ruta completa de un archivo (o `archivo#función`), con sus pruebas, tipos, fixtures y documentación listados por ruta. Si hay duda, se incluye el archivo probable y baja la confianza.
- `paralelo.js reclamar` rechaza (código 2) las zonas que terminan en `/`. La única excepción es `--permitir-carpetas`, que exige explicar el motivo en `--porque`; el `CLAIM.md` la marca "carpeta (excepción)".
- `paralelo.js reclamar` rechaza (código 2) las rutas que no existen en el repo, salvo que el ticket las cree y vayan también en `--nuevos "ruta1,ruta2"`. El `CLAIM.md` las marca "archivo nuevo", así se ve qué se modifica y qué se crea. También rechaza `--nuevos` con archivos que ya existen o que no están en `--zonas`.
- La skill (Modo A, pasos 3 y 7, y Restricciones) y `references/formato-reclamo.md` reflejan la regla nueva.

### Límites conocidos
- Los reclamos ya publicados con carpetas siguen siendo válidos; la regla se aplica al crear uno nuevo. `autorizar` no cambió.
- Sin probar en sesiones reales (niveles 2 y 3 del laboratorio): que el asistente, con la regla nueva, arme listas de archivos completas y no genere interrupciones excesivas por archivos faltantes.

## [1.2.0] — 2026-10-28

Refs POL-393.

### Agregado
- **Liberar el `CLAIM.md` antes de crear el PR.** Hook nuevo `exigir-claim-liberado.js` (Claude Code y Cursor): rechaza `gh pr create` (código 2) si el último commit de la rama, o su remota `origin/<rama>`, todavía trae el `CLAIM.md`, y dice cómo liberarlo. Un push intermedio no pasa por este hook y conserva el reclamo; el push final es el de la rama sobre la que se crea el PR. El Modo D de la skill queda en dos tiempos: antes del PR se corre `liberar` (sin `--volver`) y después del merge `liberar --volver`.
- **Prefijo de la rama según git o Linear, nunca el usuario del PC.** `paralelo.js prefijo [--linear "Nombre"]` toma `git config user.name` y, si no se reconoce, el nombre de Linear, y lo convierte con la tabla `scripts/prefijos.json` (`dani`, `lucho`, `mauro`; para sumar a alguien se agrega su primer nombre). `iniciar-rama` rechaza una rama nueva de un `REQ-NNN` con otro prefijo (código 8); las ramas de un `POL-X` siguen usando el nombre que sugiere Linear y las ramas que ya existían se reutilizan.
- **Descargar los cambios nuevos antes de trabajar.** `scripts/sincronizar.js`, usado por el hook de inicio de sesión, por `paralelo.js sincronizar` y por `iniciar-rama` (cuando la rama ya existía): `git fetch` y, solo si el árbol está limpio y el avance es limpio, `git merge --ff-only`. Con cambios sin guardar, con una rama que divergió o con la principal por delante de una rama de ticket, avisa y no toca nada. Si `git fetch` falla, avisa y deja trabajar. El timeout del hook de inicio de sesión sube de 15 a 45 s por el fetch.
- **Estado y Asignado a del `REQ-NNN` en el Sheet.** La skill cambia, con el conector de Google Sheets, el Estado (columna G) y el Asignado a (columna J) de la fila del ticket: `En Progreso` al reclamar, `En validación` al terminar el código y empezar a verificar (Modo F) y `En paso a producción` al crear el PR. Nunca escribe `En Revisión` (el ticket espera a Edgar y no se reclama), `Completado`, `Rechazado` ni `Proximo Sprint`; no pisa la asignación de otra persona sin preguntar; verifica el valor contra la lista desplegable de la celda antes de escribir. Procedimiento en `references/sheet-requerimientos.md`.

### Cambiado
- Deja de ser cierto que el Sheet es solo de lectura para este plugin; ahora solo se escriben esas dos celdas de la fila del ticket.
- `liberar --volver` ya no falla si el reclamo se liberó antes del PR: lo dice y solo vuelve a la rama principal.
- Descripción de la skill acortada a menos de 1024 caracteres.

### Límites conocidos
- La escritura en el Sheet es una instrucción de la skill, no un hook (los hooks no pueden llamar a conectores): depende de que el asistente siga el procedimiento.
- Sin probar en sesiones reales: que el hook `exigir-claim-liberado.js` se dispare con el `matcher` `gh` de Cursor, y la escritura en el Sheet con el conector en Claude Code y Cursor (niveles 2 y 3 del laboratorio).

## [1.1.0] — 2026-10-28

Sube la versión porque Claude Code indexa su caché de plugins por número de versión: quien instaló la 1.0.0 antes del rediseño con `CLAIM.md` (diseño anterior, que leía los reclamos de comentarios de Linear) no recibía el cambio al actualizar.

### Cambiado
- **Una rama por ticket dentro del mismo proyecto, sin carpetas nuevas.** `crear-worktree` se reemplaza por `iniciar-rama <rama>`: cambia de rama en la carpeta actual (nueva desde la principal y sin tracking). Se detiene con código 6 si hay cambios sin guardar y con código 7 si la rama actual tiene un reclamo activo; en ese caso la skill pregunta al dev si terminó (`liberar --volver`) o lo deja pausado (`iniciar-rama --pausar`, el reclamo sigue vigente).
- `liberar --volver` libera el reclamo, vuelve a la rama principal en el mismo proyecto y borra la rama local solo si ya está mergeada.
- La skill dice de forma explícita que los reclamos activos se buscan solo en el `CLAIM.md` de las ramas remotas; Linear y el Sheet solo se leen para conocer el ticket que se va a trabajar.

## [1.0.0] — 2026-10-26

Primera versión. Nadie la había instalado cuando se rediseñó el 27/10/2026, así que el rediseño se hizo sobre esta misma versión y no cambió el número.

### Agregado
- Skill `trabajo-en-paralelo-polaria` con cinco modos: reclamar (estima zonas con % de confianza, cruza con las otras ramas, crea rama y worktree y publica el `CLAIM.md`), sincronizar, seguimiento, liberar y salir de las zonas (pedir al usuario que autorice).
- **El reclamo es un `CLAIM.md` en la raíz de la rama**, única fuente de verdad. El ticket puede vivir en Linear (`POL-X`, con el MCP de `gestion-linear`) o en el Sheet de requerimientos (`REQ-NNN`, con el conector de Google Sheets, solo lectura); `references/instalar-conectores.md` dice cómo instalar el que falte.
- `scripts/paralelo.js`: `importar-claims`, `estado`, `comparar`, `solapes`, `crear-worktree`, `base`, `reclamar`, `autorizar` y `liberar`. `reclamar` y `autorizar` se detienen si una zona choca con el reclamo vigente de otra rama; `autorizar` solo funciona en una terminal interactiva y pide confirmación.
- Un reclamo cuya rama lleva más de 5 días sin commits está inactivo y no cuenta.
- **Límite de escritura** en cuatro capas: el hook `limitar-escritura.js` rechaza editar fuera de las zonas del `CLAIM.md` (siempre, sin depender de `POLARIA_PARALELO_MODO`) y protege el `CLAIM.md`, el plugin, su caché y los hooks de git; el hook `guardar-bash.js` rechaza los rodeos por terminal (`--no-verify`, `core.hooksPath`, escribir el `CLAIM.md`); el `pre-commit` de git, que el plugin instala al abrir sesión, rechaza archivos fuera de las zonas y cualquier cambio del `CLAIM.md` que no haya hecho `paralelo.js`.
- Hooks que solo avisan, para Claude Code y Cursor: resumen al abrir sesión, zona reclamada por otra rama al editar y solapes antes de `git push`. `POLARIA_PARALELO_MODO=bloquear` los vuelve bloqueantes.
- `solapes` detecta conflicto real con `git merge-tree`, mismo archivo cambiado en otra rama y zonas reclamadas por otros, e ignora el `CLAIM.md` propio para no ver choques entre ramas que solo tienen reclamo.

### Límites conocidos
- El límite de escritura no es una garantía total: un cambio hecho por la terminal que no se commitea no se frena en el momento, y `--no-verify` solo lo bloquea el hook de terminal si reconoce la forma del comando.
- Sin probar en sesiones reales: que `autorizar` obtenga una terminal interactiva en Claude Code y en Cursor, que los matchers `Write|Delete` de Cursor cubran las ediciones, y que el gate de calidad no bloquee el push del primer commit (solo el `CLAIM.md`).
