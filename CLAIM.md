<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-399
**Rama:** dani/pol-399-agregar-al-gate-de-calidad-el-limite-de-tamano-de-archivo
**Responsable:** Daniel De Jesus Galvis Zambrano
**Confianza:** 80%

### Zonas que voy a tocar
- `plugins/gate-calidad-tecnica/skills/gate-calidad-tecnica-pre-merge-polaria/references/GATE_DE_CALIDAD_TECNICA_PRE_MERGE_v1.4.md`
- `plugins/gate-calidad-tecnica/skills/gate-calidad-tecnica-pre-merge-polaria/SKILL.md`
- `plugins/gate-calidad-tecnica/agents/revisor-tecnico-pre-merge.md`
- `plugins/gate-calidad-tecnica/hooks/registrar-veredicto.js`
- `plugins/gate-calidad-tecnica/hooks/medir-tamano.js` — archivo nuevo
- `plugins/gate-calidad-tecnica/tests/limites-de-tamano.test.js` — archivo nuevo
- `plugins/gate-calidad-tecnica/plantillas/eslint-limites/eslint.config.limites.mjs` — archivo nuevo
- `plugins/gate-calidad-tecnica/plantillas/eslint-limites/LEEME.md` — archivo nuevo
- `plugins/gate-calidad-tecnica/.claude-plugin/plugin.json`
- `plugins/gate-calidad-tecnica/.cursor-plugin/plugin.json`
- `plugins/gate-calidad-tecnica/hooks/ronda-previa.js` — autorizada por el usuario el 2026-10-30

### Compartidos (cambio mínimo y aviso)
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/marketplace.json`
- `README.md`

### Por qué
Criterio 9 del gate (tamano de archivo, funcion y complejidad): protocolo, revisor, skill, script de medicion con pruebas y plantilla ESLint; sube la version del plugin.
