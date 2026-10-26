# Formato del comentario de reclamo

El reclamo es un comentario normal del issue en Linear. Los scripts del plugin lo leen con `scripts/lib.js` (`parsearReclamo`), así que el marcador y los encabezados son literales: si cambian, el reclamo deja de existir para los hooks.

## Plantilla

```markdown
<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Rama:** usuario/pol-123-titulo-del-issue
**Responsable:** Nombre del asignado en Linear
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/auth/` — carpeta
- `src/lib/session.ts` — archivo
- `src/lib/token.ts#refreshToken` — función
- `src/modules/auth/nuevo-guard.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
- `package.json`

### Solapes conocidos
- POL-118 (otra persona) también toca `src/lib/session.ts`; acordado: yo solo agrego la función `cerrarSesion`.

### Por qué
Una o dos frases: qué pide el issue y qué evidencia sostiene la estimación (por ejemplo, "la Especificación técnica lista 3 de los 4 archivos; el cuarto salió de buscar `refreshToken`").
```

## Reglas del formato

- La primera línea es SIEMPRE `<!-- polaria-reclamo v1 -->`.
- `**Estado:**` vale `ACTIVO` o `LIBERADO`. Al liberar se cambia el mismo comentario, no se crea otro.
- `**Rama:**` es el `gitBranchName` del issue. `**Responsable:**` es el asignado del issue.
- `**Confianza:**` es un número entero seguido de `%`: la probabilidad de que el diff final quede dentro de las zonas y compartidos declarados (cómo se calcula: `estimacion-de-zonas.md`).
- Cada zona es una viñeta que empieza por la ruta entre comillas invertidas, relativa a la raíz del repo y con `/` (nunca `\`):
  - carpeta: termina en `/`;
  - archivo: ruta completa;
  - función: `ruta#nombreDeLaFunción` (los hooks avisan por archivo; la función sirve para que dos personas en el mismo archivo vean si de verdad se pisan);
  - lo que dice después de la ruta (`— carpeta`, `— archivo nuevo`) es solo para humanos.
- `### Compartidos` lleva los archivos que casi toda tarea toca de pasada (manifiestos, lockfiles, esquemas, índices de rutas). Un solape en compartidos no frena a nadie, pero queda visible.
- `### Solapes conocidos` y `### Resultado` son opcionales; `### Resultado` se agrega solo al liberar.
- Un comentario por issue y rama. Si hay varios con el marcador, los scripts usan el más reciente.
