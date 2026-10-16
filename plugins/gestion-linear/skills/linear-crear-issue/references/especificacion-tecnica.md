# Sección `## 📐 Especificación técnica` — plantilla y reglas de llenado

Esta sección convierte el issue en un contrato autocontenido: quien implementa sabe exactamente qué entregar, quien prueba sabe qué verificar y el cierre se hace contra criterios concretos, no contra "ya funciona". Los issues los leen directamente agentes de IA (Claude, Cursor) que pueden NO tener este plugin instalado, así que todo lo que el agente necesita saber DEBE estar escrito dentro del issue.

Caso que la motivó: en POL-332 (Dockerfile del backend) la meta "< 400 MB" no decía si era la imagen comprimida o sin comprimir, y se descubrió recién en el CI.

## 1. Cuándo va y en qué versión

- **NUNCA** en issues de tipo `Question`.
- **Versión completa** — SIEMPRE que el issue cumpla al menos una de estas condiciones:
  1. Tiene un valor con unidad o un límite (tamaño, tiempo, versión, cantidad, porcentaje).
  2. Toca un contrato: endpoint, variable de entorno, schema o tabla de BD, payload o webhook de n8n, evento.
  3. Afecta más de un componente (archivo, workflow, servicio).
  4. Es de tipo Bug.
- **Versión mínima** — si no cumple ninguna: solo Fuente de verdad, el bloque "Para quien implemente", Criterios de aceptación y Fuera de alcance. Ejemplos: cambiar un texto, un ajuste visual puntual, renombrar algo sin contrato.
- La talla de la estimación NO decide la versión (POL-332 era pequeño y aun así tenía un límite ambiguo).
- El preview DEBE decir en una línea qué versión se eligió y por qué, para que el usuario lo corrija antes de crear. Ejemplo: `Especificación: completa (tiene un límite de tamaño de imagen)`.

## 2. Plantilla (versión completa)

Va **después de `## 🚧 Restricciones` y antes del `---` que separa la estimación**. El orden, los títulos, los emojis y el bloque "Para quien implemente" son fijos y literales.

```markdown
## 📐 Especificación técnica

**Fuente de verdad:** [ruta del spec/ADR relativa a la raíz del repo, p. ej. `docs/adr/0007-imagen-docker.md` — o "Este issue"]. Si este issue y ese archivo se contradicen, manda el archivo.

> **Para quien implemente (persona o agente):** Si un valor dice _Pendiente_, no lo asumas: detente y pregunta. No toques nada listado en "Fuera de alcance". El issue está terminado solo cuando todos los criterios de la tabla dan el resultado esperado.

### Requisitos
| # | Requisito | Valor exacto | Cómo se verifica |
|---|---|---|---|
| R1 | [qué] | [valor con unidad, versión o estado] | [comando, prueba o revisión] |

### Componentes afectados
- `ruta/relativa/al/repo` — [crea / modifica / elimina] — [qué cambia]

### Contratos e interfaces
[Endpoints (método, ruta, request/response), variables de entorno, cambios de schema/BD, payloads de n8n, eventos. Si no aplica: "No cambia ningún contrato."]

### Criterios de aceptación
| # | Criterio | Cómo se verifica | Resultado esperado | Dónde corre |
|---|---|---|---|---|
| CA1 | [criterio] | [comando exacto, prueba o revisión] | [valor o estado observable] | [local / CI / DEV / ambiente X] |

### Fuera de alcance
- [lo que explícitamente NO entra en este issue, y a qué issue va si existe — o "Nada adicional."]
```

La **versión mínima** es la misma plantilla sin las subsecciones Requisitos, Componentes afectados y Contratos e interfaces.

## 3. Reglas de llenado

1. **Se construye sin preguntar**, igual que la estimación: desde la conversación, la documentación del repo y los specs existentes. Solo se pregunta si falta algo crítico.
2. **Si existe un spec o ADR en el repo**, se enlaza en "Fuente de verdad" y la sección resume SOLO lo que aplica a este issue — NUNCA lo copia completo.
3. **NUNCA inventar un valor.** Lo que no se conoce va como `_Pendiente: [qué falta y quién lo define]_` y se lista también en "Información faltante" del preview.
4. **Formato de cada criterio** (columna "Criterio"), con una regla fija:
   - Describe una **acción con resultado** (código con comportamiento, workflow de n8n, Bug) → Gherkin: `Dado [contexto], cuando [acción], entonces [resultado]`. Ejemplo: `Dado un webhook con email vacío, cuando se ejecuta el workflow, entonces corta en la validación y envía una alerta`.
   - Describe un **estado o una medida** (infraestructura, configuración, CI, Dockerfile, IaC) → afirmación medible. Ejemplo: `Imagen del backend < 400 MB comprimida (gzip)`.
   - Un mismo issue PUEDE mezclar ambos formatos.
5. **Cada criterio DEBE ser verificable**: la columna "Cómo se verifica" lleva el comando, la prueba (con su ruta) o la revisión exacta, y "Resultado esperado" un número, un estado o un resultado observable. Prohibido "funciona bien", "es rápido", "queda limpio".
6. **Unidades y condiciones explícitas**, dentro del valor mismo: "< 400 MB comprimida (gzip)", "p95 < 500 ms con 10 usuarios concurrentes". Si la unidad admite dos lecturas, se aclara cuál.
7. **Rutas y referencias que un agente pueda abrir:** rutas relativas a la raíz del repo y entre backticks (nunca "el archivo del backend"); otros issues por identificador (`POL-332`); workflows de n8n por nombre exacto.
8. **En un Bug** (versión completa siempre): R1 = Comportamiento actual, R2 = Comportamiento esperado, R3 = Pasos para reproducir. El criterio principal es el Gherkin del reproducir: `Dado [R3], cuando [acción], entonces [R2]`.
9. **Fuera de alcance es obligatorio** en ambas versiones — es la defensa contra que un agente "mejore" cosas que nadie pidió. Si no hay nada que excluir: "Nada adicional."

## 4. Validación antes del preview

Antes de mostrar el preview, revisa la sección y corrige lo que falle — NUNCA muestres el preview con alguno de estos fallos:

- [ ] Cada requisito tiene "Cómo se verifica".
- [ ] Cada criterio tiene "Cómo se verifica", "Resultado esperado" y "Dónde corre".
- [ ] Ningún criterio ni requisito usa un adjetivo sin número o estado ("rápido", "liviano", "estable").
- [ ] Cada unidad es inequívoca.
- [ ] Cada `_Pendiente_` también aparece en "Información faltante".
- [ ] Las rutas son relativas a la raíz del repo y van entre backticks.
- [ ] Fuera de alcance está presente.
