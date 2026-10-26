# Cómo estimar las zonas de un issue y su confianza

Objetivo: decir, **antes de escribir código**, qué carpetas, archivos y funciones va a tocar el issue, y con qué probabilidad el cambio real se queda dentro de eso. Se hace solo, leyendo el issue y el repo; no se le pregunta al dev.

## 1. Reunir la evidencia

1. Lee del issue, en este orden de confiabilidad: la **Especificación técnica** (rutas y criterios de aceptación), la descripción 5W2H, los comentarios, los issues relacionados (`relations`).
2. Toma como punto de partida las rutas que el issue nombra. Verifica cada una con Glob: una ruta que no existe es un archivo nuevo (se marca así) o un dato malo (baja la confianza).
3. Busca con Grep los términos del ticket: nombres de funciones, componentes, tablas, rutas de API, textos de pantalla, mensajes de error. Cada archivo con coincidencias directas es candidato.
4. Sube una capa: quién llama o importa lo que vas a cambiar (Grep del nombre exportado) y qué prueba lo cubre. Los llamadores solo entran si el cambio rompe su contrato (firma, forma del dato, nombre); las pruebas del archivo cambiado entran siempre.
5. Para cada criterio de aceptación pregúntate "¿qué archivo cambia para que este criterio se cumpla?". Un criterio sin archivo claro es una incertidumbre y descuenta confianza (paso 3).

## 2. Elegir la granularidad de cada zona

| Situación | Zona |
|---|---|
| Hay 3 o más archivos del mismo directorio, o la confianza queda bajo 70% | Carpeta (termina en `/`) |
| Un archivo de más de 300 líneas y el cambio cae en funciones identificables | `archivo#función` (una por función) |
| Cualquier otro caso | Archivo |
| El issue pide crear un archivo | Su ruta, marcada "archivo nuevo" |

Reclama el directorio contenedor cuando dudes entre dos granularidades: una zona de sobra cuesta una conversación, una zona faltante cuesta un conflicto de merge.

## 3. Separar los compartidos

Van en `### Compartidos`, no en zonas, estos archivos cuando el cambio los toque solo de pasada: manifiestos y lockfiles (`package.json`, `package-lock.json`, `pnpm-lock.yaml`, `requirements.txt`), migraciones y esquemas de base de datos, índices de rutas o de exportaciones (`index.ts`, `routes.*`), tipos y constantes globales, configuración (`.env.example`, `*.config.*`), traducciones. Si el issue trata justamente de uno de ellos (por ejemplo, "agregar una tabla"), ese archivo es zona, no compartido.

## 4. Calcular la confianza

Es la probabilidad de que el diff final quede dentro de las zonas y compartidos declarados. Calcúlala así y redondea a múltiplos de 5:

1. Parte de **95%** si la Especificación técnica lista rutas y todas existen; de **85%** si las rutas salieron solo de tu búsqueda con coincidencias claras y coherentes; de **65%** si solo identificaste el módulo y no los archivos.
2. Resta **10 puntos** por cada criterio de aceptación sin archivo claro.
3. Resta **10 puntos** si el issue no tiene criterios de aceptación o es ambiguo.
4. Resta **15 puntos** si el cambio atraviesa una capa compartida (base de datos, API usada por varios, componente de UI reutilizado).
5. Resta **10 puntos** si el repo no tiene pruebas que cubran el área (no hay red que avise si te saliste).
6. Mínimo **30%**. Si el resultado queda bajo 70%, aplica la regla del paso 2 (reclama carpeta).

Ejemplo: spec con rutas verificadas (95) − un criterio sin archivo (10) − capa compartida (15) = **70%**.

## 5. Calibrar con el tiempo

Al liberar el reclamo, la skill anota "N de M archivos dentro de lo reclamado". Si de forma repetida los reclamos con 90% terminan con archivos fuera, la rúbrica es optimista: se ajustan los descuentos de este archivo, no se pide al asistente que "sea más cuidadoso".
