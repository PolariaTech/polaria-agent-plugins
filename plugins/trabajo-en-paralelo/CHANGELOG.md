# Changelog — trabajo-en-paralelo

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-10-26

### Agregado
- Skill `trabajo-en-paralelo-polaria` con cuatro modos: reclamar (estima zonas con % de confianza, las publica como comentario del issue en Linear, crea rama y worktree), sincronizar (copia los reclamos de Linear a la caché local), seguimiento (revisa solapes y corrige el reclamo si el trabajo se sale) y liberar.
- `scripts/paralelo.js` (importar, estado, comparar, solapes, crear-worktree, base) y `scripts/solapes.js`: conflicto real con `git merge-tree`, mismo archivo cambiado en otra rama y zonas reclamadas por otros issues.
- Hooks para Claude Code y Cursor: resumen de reclamos al abrir sesión, aviso al editar una zona reclamada por otro issue y revisión de solapes antes de `git push`. Solo avisan; `POLARIA_PARALELO_MODO=bloquear` los vuelve bloqueantes.
