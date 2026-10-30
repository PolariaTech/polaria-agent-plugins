# Límites de tamaño y complejidad (criterio 9 del gate)

Esta carpeta trae la configuración de ESLint que mide el criterio 9. Se copia a cada repo de código de Polaria (web y api). Los repos de flujos n8n quedan fuera.

| Límite | Valor | Regla |
|---|---|---|
| Líneas por archivo | 300, sin contar líneas en blanco ni comentarios | `max-lines` |
| Líneas por función | 50, sin contar líneas en blanco ni comentarios | `max-lines-per-function` |
| Complejidad cognitiva por función | 15 | `sonarjs/cognitive-complexity` (S3776) |

El código que ya incumple estos límites no bloquea el gate: se congela en `eslint-suppressions.json` y solo puede quedar igual o mejorar. Lo nuevo sí bloquea.

## Poner el baseline en un repo (lo hace el dev, una sola vez)

El gate es de solo lectura: nunca genera el baseline. Lo genera el dev en una rama propia.

1. Confirma que ESLint es 9.24.0 o superior: `npx eslint --version`. Si es menor, súbelo antes de seguir.
2. Instala el plugin: `npm install --save-dev eslint-plugin-sonarjs`.
3. Copia `eslint.config.limites.mjs` a la raíz del repo y súmalo a `eslint.config.mjs` como indica el comentario del archivo.
4. Genera el baseline: `npx eslint --suppress-all`. Crea `eslint-suppressions.json` en la raíz con los incumplimientos que existen hoy.
5. Revisa `eslint-suppressions.json`: debe listar solo archivos y funciones que ya existían. Commitéalo junto con el cambio de configuración.
6. No corras `prettier --write` sobre archivos enteros para preparar el baseline. En el api mezclan CRLF y LF y el commit termina tocando archivos que nada tienen que ver.

## Cómo lo usa el gate

- `hooks/medir-tamano.js` compara contra la rama principal los archivos del diff y entrega el resultado de las 300 líneas:
  - Archivo nuevo, o que cruza las 300 líneas: `FAIL`.
  - Archivo heredado ya excedido que crece: `FAIL`. Si pasa de 1.000 líneas, el aviso lo dice, y no tiene excepción.
  - Archivo heredado ya excedido que no crece: advertencia que no bloquea.
  - `eslint-suppressions.json` que suma incumplimientos respecto de la rama principal: `FAIL`.
- El revisor corre `npx eslint --max-warnings 0 <archivos del diff>` para las líneas por función y la complejidad. Lo congelado en `eslint-suppressions.json` no se reporta; una función nueva que pasa de 50 líneas o de 15 de complejidad, sí.

## Qué hacer cuando el gate rechaza

Parte el archivo o la función. No agregues el incumplimiento a `eslint-suppressions.json`: el gate lo rechaza porque ese archivo solo puede encogerse. Para limpiar lo que ya se arregló: `npx eslint --prune-suppressions`.

## Límite conocido

ESLint cuenta incumplimientos por archivo y regla, no por tamaño. Si una función heredada que ya pasaba de 50 líneas crece, el conteo sigue igual y ESLint no la marca. Para archivos, `medir-tamano.js` cubre ese hueco. Para funciones no hay cobertura todavía.

## Fuentes

[ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions), [max-lines](https://eslint.org/docs/latest/rules/max-lines), [max-lines-per-function](https://eslint.org/docs/latest/rules/max-lines-per-function), SonarJS S3776 (complejidad cognitiva, umbral 15) y S104 (archivos de más de 1.000 líneas). Los números son valores por defecto de esas herramientas, no verdades científicas: el criterio se justifica por mantenibilidad (revisión, conflictos, pruebas), no por tasa de bugs.
