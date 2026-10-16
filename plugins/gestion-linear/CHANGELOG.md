# Changelog — gestion-linear

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/). Las versiones anteriores a 1.2.0 están descritas en los commits del repo (`git log -- plugins/gestion-linear`).

## [1.2.0] — 2026-10-15

### Agregado
- `linear-crear-issue`: sección `## 📐 Especificación técnica` en cada issue nuevo (salvo `Question`), entre `## 🚧 Restricciones` y la estimación. Plantilla, reglas de llenado y validación en `skills/linear-crear-issue/references/especificacion-tecnica.md`.
  - Versión completa (Fuente de verdad, bloque "Para quien implemente", Requisitos, Componentes afectados, Contratos e interfaces, Criterios de aceptación, Fuera de alcance) cuando el issue tiene un valor con unidad o límite, toca un contrato, afecta más de un componente o es un Bug; si no, versión mínima (Criterios de aceptación y Fuera de alcance). El preview dice qué versión se eligió y por qué.
  - Criterios de aceptación en una sola tabla (Criterio | Cómo se verifica | Resultado esperado | Dónde corre), en Gherkin si describen una acción y como afirmación medible si describen un estado o una medida.
  - Bloque fijo "Para quien implemente (persona o agente)" para que un agente sin este plugin respete `_Pendiente_`, "Fuera de alcance" y la definición de terminado.
  - Valores desconocidos como `_Pendiente_` y en "Información faltante", nunca inventados; validación antes del preview.
- `linear-crear-issue`: modo para agregar la Especificación técnica a un issue existente, solo a pedido explícito ("agrega la sección de specs a POL-X").
- `linear-transicionar-estado`: en issues con Especificación técnica, MODO INICIO no pasa a In Progress con un `_Pendiente_` sin decisión del usuario; MODO PRUEBAS ejecuta y reporta cada criterio (✅ / ❌ + evidencia); MODO CIERRE no mueve a Done con un criterio ❌ o sin evidencia salvo exclusión explícita escrita en el comentario; regla de cambio de alcance (editar la sección + comentario con valor anterior, nuevo y motivo).

### Cambiado
- `linear-crear-issue`: la estimación cuenta criterios y componentes afectados como complejidad, y cada `_Pendiente_` baja la confianza un nivel.

### Sin cambios
- Los issues creados antes de esta versión no se migran; los modos de `linear-transicionar-estado` funcionan igual que en 1.1.1 sobre issues sin la sección. `doc-updater`, `linear-crear-proyecto` y `linear-cerrar-proyecto` no cambian.
