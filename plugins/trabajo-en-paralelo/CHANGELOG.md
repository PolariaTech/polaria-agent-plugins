# Changelog — trabajo-en-paralelo

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

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
