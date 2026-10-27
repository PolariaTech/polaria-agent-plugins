# Formato del CLAIM.md

El reclamo es un archivo `CLAIM.md` en la raíz de la rama del dev. Es la única fuente de verdad de los reclamos: los demás lo leen de las ramas remotas con `paralelo.js importar-claims`. Lo escribe el CLI (`paralelo.js reclamar`), nunca el asistente a mano, y lo lee `scripts/lib.js` (`parsearReclamo`), así que el marcador y los encabezados son literales: si cambian, el reclamo deja de existir para los hooks.

## Plantilla

```markdown
<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-123
**Rama:** usuario/pol-123-titulo-del-issue
**Responsable:** Nombre del asignado
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/auth/`
- `src/lib/session.ts`
- `src/lib/token.ts#refreshToken`
- `src/modules/auth/nuevo-guard.ts`
- `src/lib/token.ts` — autorizada por el usuario el 2026-10-27

### Compartidos (cambio mínimo y aviso)
- `package.json`

### Por qué
Una o dos frases: qué pide el ticket y qué evidencia sostiene la estimación.
```

## Reglas del formato

- La primera línea es SIEMPRE `<!-- polaria-reclamo v1 -->`.
- `**Estado:**` vale `ACTIVO`. Para liberar no se cambia el estado: se borra el archivo con `paralelo.js liberar`.
- `**Issue:**` es el ID del ticket: `POL-123` si vive en Linear o `REQ-012` si vive en el Sheet de requerimientos. Si falta, se toma de la rama.
- `**Rama:**` es la rama del dev. `**Responsable:**` es el asignado del ticket (Linear) o el valor de "Asignado a" (Sheet); si no hay, el dev.
- `**Confianza:**` es un número entero seguido de `%`: la probabilidad de que el diff final quede dentro de las zonas y compartidos declarados (cómo se calcula: `estimacion-de-zonas.md`).
- Cada zona es una viñeta que empieza por la ruta entre comillas invertidas, relativa a la raíz del repo y con `/` (nunca `\`):
  - carpeta: termina en `/`;
  - archivo: ruta completa;
  - función: `ruta#nombreDeLaFunción` (sirve para que dos personas en el mismo archivo vean si de verdad se pisan; el límite de escritura se aplica por archivo);
  - lo que dice después de la ruta (`— autorizada por el usuario el ...`) lo agrega el CLI al ampliar.
- `### Compartidos` lleva los archivos que casi toda tarea toca de pasada (manifiestos, lockfiles, esquemas, índices de rutas). Un solape en compartidos no frena a nadie, pero queda visible, y el asistente sí puede editarlos.
- `### Por qué` es opcional.

## Quién puede cambiarlo

| Acción | Comando | Quién |
|---|---|---|
| Crear | `paralelo.js reclamar` | El asistente. Se detiene si una zona choca con el reclamo de otra rama. |
| Ampliar | `paralelo.js autorizar <ruta>` | Solo el usuario, en su terminal. Se detiene si choca con otra rama, pide confirmación y publica el nuevo alcance. |
| Borrar | `paralelo.js liberar` | El asistente, cuando el usuario confirma que terminó. |

Un `CLAIM.md` escrito o cambiado de cualquier otra forma lo rechaza el pre-commit de git.

## Cuándo deja de contar

Un reclamo cuya rama lleva más de 5 días sin commits está inactivo y se ignora al comparar; un commit nuevo lo reactiva. `solapes` ignora el propio `CLAIM.md` al comparar ramas.
