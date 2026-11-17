<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-412
**Rama:** dani/pol-412-corregir-falso-rechazado-del-gate-pruebas-y
**Responsable:** Daniel De Jesus Galvis Zambrano
**Confianza:** 85%

### Zonas que voy a tocar
- `plugins/gate-calidad-tecnica/hooks/correr-verificaciones.js`
- `plugins/gate-calidad-tecnica/tests/verificaciones-paralelas.test.js`
- `plugins/gate-calidad-tecnica/skills/gate-calidad-tecnica-pre-merge-polaria/SKILL.md`
- `plugins/gate-calidad-tecnica/agents/revisor-tecnico-pre-merge.md`
- `plugins/gate-calidad-tecnica/.claude-plugin/plugin.json`
- `plugins/gate-calidad-tecnica/.cursor-plugin/plugin.json`

### Compartidos (cambio mínimo y aviso)
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/marketplace.json`
- `README.md`

### Por qué
Secuenciar el build despues de pruebas y ESLint en correr-verificaciones.js para que prisma generate no pise a Jest, y subir gate-calidad-tecnica a 1.12.1
