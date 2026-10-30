// Límites de tamaño y complejidad del criterio 9 del Gate de Calidad Técnica (POL-399).
// Cópialo a la raíz del repo y súmalo a tu eslint.config.mjs:
//   import limites from './eslint.config.limites.mjs';
//   export default [...tuConfiguracionActual, ...limites];
// Pasos completos (baseline con eslint-suppressions.json): LEEME.md, en esta misma carpeta.
// Requiere ESLint 9.24.0 o superior (bulk suppressions) y eslint-plugin-sonarjs con soporte de flat config.

import sonarjs from 'eslint-plugin-sonarjs';

const SIN_BLANCOS_NI_COMENTARIOS = { skipBlankLines: true, skipComments: true };

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.next/**', '**/*.d.ts'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    plugins: { sonarjs },
    rules: {
      'max-lines': ['error', { max: 300, ...SIN_BLANCOS_NI_COMENTARIOS }],
      'max-lines-per-function': ['error', { max: 50, ...SIN_BLANCOS_NI_COMENTARIOS }],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
];
