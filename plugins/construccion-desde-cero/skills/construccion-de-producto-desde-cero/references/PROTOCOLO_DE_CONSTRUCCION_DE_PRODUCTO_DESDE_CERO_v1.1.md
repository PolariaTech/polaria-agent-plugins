# PROTOCOLO DE CONSTRUCCIÓN DE PRODUCTO DESDE CERO

*Polaria | Flujo de trabajo*

## 1. Contexto

Aplica cuando surge una idea de producto o iniciativa **completamente nueva — algo que no existe todavía** dentro de Polaria (no aplica a una funcionalidad dentro de un producto ya existente; eso sigue el flujo normal de Épica Planning directamente). Lo usa el Responsable de la iniciativa antes de que exista cualquier épica o tarea formal en Linear, y lo acompaña hasta que la iniciativa entra al ciclo ya existente de Versionamiento.

Existe porque hoy el único punto de entrada formal al trabajo es la Épica Planning, que ya asume que se sabe qué construir, cómo especificarlo técnicamente, y que el código construido converge con lo planeado. No había ningún paso previo que validara si vale la pena construir algo, ni un puente formal entre "decidimos construirlo" y "lo construido corresponde a lo que se planeó".

## 2. Objetivo

Evitar que el equipo invierta tiempo construyendo algo completamente nuevo antes de validar que resuelve un problema real, arrancar cada proyecto con la misma estructura de carpeta, documentación y herramientas, definir técnicamente qué se va a construir antes de construirlo, y confirmar que lo construido converge con lo planeado antes de entrar al ciclo de release.

## 3. Actores

| Actor | Rol y responsabilidad |
|---|---|
| Responsable de la iniciativa | Propone la idea, ejecuta la validación del camino correspondiente, define appetite y MVP, inicializa la carpeta del proyecto, ejecuta las fases de spec-kit, y decide cómo entra el trabajo a Linear. |
| Responsable Técnico | Aprueba o ajusta el appetite; decide si actualiza la constitución del repo; resuelve escalamientos de convergencia no lograda. |
| Cliente / Usuario externo | Solo en el Camino 1 — fuente real de validación de Valor y Usabilidad. |
| Quien construye (el Responsable de la iniciativa, o quien el Responsable Técnico asigne si no es la misma persona) | Ejecuta la construcción real en el Paso 13, siguiendo la spec, el plan y las tareas de los Pasos 11 y 12. |
| Todo el equipo | Participación opcional, a discreción del Responsable de la iniciativa, para confirmar Factibilidad técnica. |
| Claude o Cursor (una sola herramienta por iniciativa) | Acompaña al Responsable de la iniciativa en la discusión de cada paso, incluida la inicialización de la carpeta y la ejecución de los comandos de `spec-kit`, hasta llegar a un acuerdo — nunca decide sola. |

## 4. Pasos

**Paso 1**

Responsable de la iniciativa le entrega la idea a Claude o a Cursor — nunca a ambas en la misma iniciativa — junto con los recursos que ya existan (specs, documentos, JSON de workflows, enlaces). Junto con la IA, aplica una fase divergente (generar 5-8 variaciones de la idea con lentes como inversión, quitar restricciones, cambio de audiencia, simplificación) y luego convergente (agrupar en 2-3 direcciones, elegir una, y declarar explícitamente qué se está apostando sin validar todavía). Si los recursos ya responden algo de esto, la IA lo toma de ahí y solo pregunta lo que falta. Hasta el Paso 9 el Brief vive en la conversación con la IA (la carpeta del proyecto todavía no existe); el Paso 9 lo guarda en `docs/brief.md`.

**Criterio de salida:**

- El Brief tiene el problema, la audiencia, la hipótesis de valor, y los supuestos no validados escritos, con la herramienta de IA elegida y los recursos de origen declarados.

**Paso 2**

Responsable de la iniciativa, con la IA, determina si el producto tendrá usuarios o clientes reales fuera de Polaria (Camino 1) o es puramente interno (Camino 2).

**Criterio de salida:**

- El camino queda declarado por escrito en el Brief.

**Paso 3 — Camino 1**

Responsable de la iniciativa sostiene al menos una conversación real con un cliente o usuario potencial — nunca una encuesta indirecta ni una suposición — confirmando que el problema existe y le importa.

**Criterio de salida:**

- Evidencia real de la conversación (notas o cita) queda adjunta al Brief.

**Paso 4 — Camino 1**

Responsable de la iniciativa muestra un boceto o flujo (nunca código) al mismo cliente y confirma que entendería cómo usarlo.

**Criterio de salida:**

- El feedback de usabilidad queda documentado.

**Paso 3 — Camino 2**

Responsable de la iniciativa confirma, con evidencia interna (métricas, incidentes repetidos, carga de trabajo real) — nunca solo su opinión — que el problema es real.

**Criterio de salida:**

- La evidencia interna queda citada en el Brief.

**Paso 5**

Responsable de la iniciativa (opcionalmente con todo el equipo, a su discreción) confirma que la iniciativa es construible con el tiempo/stack/skills disponibles, y declara el medio de construcción: software/código, o workflow n8n. Si es n8n, se rige por la versión vigente de los Estándares de Diseño de Workflows N8N; si además incluye un componente de IA (nodos de razonamiento/LLM), también se rige por el Protocolo de Construcción de Agentes de IA en N8N. Este paso puede correr en paralelo a los Pasos 3-4 (o al Paso 3 del Camino 2).

**Criterio de salida:**

- La confirmación técnica y el medio de construcción quedan escritos en el Brief, con riesgos identificados si los hay. Si el medio es n8n, también su tamaño (pequeño, o mediano o grande, según el catálogo de inicialización de la skill).

**Paso 6**

Responsable de la iniciativa confirma que la iniciativa no compromete soporte, capacidad del equipo, ni otro protocolo vigente.

**Criterio de salida:**

- El Brief queda sin bloqueo de viabilidad, o con el bloqueo resuelto por escrito.

**Paso 7**

Responsable de la iniciativa presenta el Brief al Responsable Técnico y propone un "appetite": un presupuesto de tiempo, nunca una estimación de alcance completo.

**Criterio de salida:**

- El Responsable Técnico aprueba o ajusta el appetite por escrito. Puede aprobar con puntos menores marcados "pendiente" — nunca con el problema/audiencia/hipótesis (Paso 1) o la validación de Valor (Paso 3) pendientes.

**Paso 8**

Con el appetite aprobado, Responsable de la iniciativa, con la IA, define lo mínimo construible que prueba la hipótesis, la lista explícita de qué queda fuera ("Not Doing", con la razón de cada exclusión), y la métrica que dirá si el MVP funcionó.

**Criterio de salida:**

- Alcance del MVP, lista de exclusiones, y métrica de éxito quedan escritos en el Brief.

**Paso 9**

Responsable de la iniciativa, con la IA, inicializa la carpeta del proyecto según el medio y la herramienta declarados: repo git, spec-kit con sus extensiones, instrucciones del proyecto para el editor, plugins de Polaria que aplican, el Brief guardado en `docs/brief.md`, la checklist de la Guía de Documentación Extendida con los puntos que aplican a este medio, y solo la documentación que ya tiene contenido real (README base, ADR del medio de construcción, `llms.txt`, glosario si hay términos). La IA muestra la estructura antes de crearla y no crea nada sin la confirmación del Responsable de la iniciativa. Si la carpeta ya existe, solo agrega lo que falta.

**Criterio de salida:**

- La carpeta tiene su primer commit local con, siempre: `.gitignore`, `README.md`, `AGENTS.md`, `llms.txt`, `docs/brief.md`, `docs/CHECKLIST_DOCUMENTACION.md` y `docs/adr/0001-medio-de-construccion.md`. Si el editor es Claude, además `CLAUDE.md` y `.claude/settings.json` con los plugins; si es Cursor, la lista de plugins en `AGENTS.md`. Si el medio es n8n, además `workflows/`. Si hay términos del negocio, además `docs/glosario.md`.
- spec-kit está inicializado con las extensiones `bug` y `assess`, o anotado como pendiente en `AGENTS.md` (en ese caso el Paso 10 no empieza hasta resolverlo).
- Todo lo que no se pudo dejar listo queda en "Pendientes de instalación" de `AGENTS.md`, con el paso que lo cierra.

**Paso 10**

Si el repo no tiene constitución de spec-kit, Responsable de la iniciativa la establece con `/speckit.constitution` (principios de calidad, testing, UX, performance). Si el medio es n8n, los Estándares N8N (y, si hay componente de IA, el Protocolo de Construcción de Agentes de IA en N8N) entran como principios de la constitución. Si el repo ya tiene una, se reutiliza sin cambios salvo que el Responsable Técnico decida actualizarla explícitamente.

**Criterio de salida:**

- El repo tiene una constitución vigente (nueva o reutilizada), declarada por escrito en el Brief.

**Paso 11**

Responsable de la iniciativa ejecuta `/speckit.specify` con el Brief y los recursos de origen como entrada, `/speckit.clarify` para resolver zonas subespecificadas, y luego `/speckit.plan` con el stack y arquitectura elegidos. Si el medio es n8n y el workflow es pequeño (un solo trigger, sin sub-workflows y sin componente de IA), `/speckit.plan` es opcional.

**Criterio de salida:**

- La spec existe sin zonas marcadas como no resueltas por `/speckit.clarify`, y el plan técnico existe (salvo en un workflow n8n pequeño, donde puede omitirse).

**Paso 12**

Responsable de la iniciativa ejecuta `/speckit.tasks` para descomponer el plan en tareas atómicas, y luego `/speckit.analyze` como gate de consistencia entre Brief, spec, plan y tareas — nunca se avanza a construir con inconsistencias que `/speckit.analyze` haya señalado sin resolver. En un workflow n8n pequeño ambos son opcionales, y si se omitió el plan en el Paso 11 también se omiten (`/speckit.tasks` necesita el plan): las tareas se descomponen directamente desde la spec.

**Criterio de salida:**

- Las tareas quedan registradas en Linear (como épica nueva si el tamaño lo amerita, o directo al backlog), con `/speckit.analyze` sin inconsistencias abiertas si se ejecutó.

**Paso 13**

Responsable de la iniciativa (o quien el Responsable Técnico asigne, si no es la misma persona que construye) ejecuta la construcción real de las tareas — código o workflow n8n según el medio declarado en el Paso 5. Cada cambio de código pasa por el Gate de Calidad Técnica antes del `push`. Si el medio es n8n, cada workflow pasa por el Gate de Calidad N8N antes de publicarse y se versiona en `workflows/`. En n8n se puede, como piloto, escribir el workflow como código con el Workflow SDK de n8n y crearlo en la instancia con el MCP de n8n.

**Criterio de salida:**

- Cada cambio tiene veredicto `APROBADO` (o `RECHAZADO_JUSTIFICADO`) del gate que le corresponde.

**Paso 14**

Responsable de la iniciativa ejecuta `/speckit.converge` para comparar lo construido contra spec/plan/tareas. Si no converge, se agregan las tareas pendientes que `/speckit.converge` señale y se repite. Si el medio es n8n, este paso aplica solo si el workflow se escribió como código con el Workflow SDK (piloto); si no, la revalidación queda cubierta por el gate del Paso 13 y, si hay componente de IA, por el checklist de producción del Protocolo de Construcción de Agentes de IA en N8N.

**Criterio de salida:**

- Software/código, o n8n con Workflow SDK: `/speckit.converge` reporta "Converged". Si después de 3 iteraciones no converge, se escala al Responsable Técnico para decidir si se ajusta el plan original o se sigue iterando.
- n8n sin Workflow SDK: el gate del Paso 13 (y el checklist de Agentes de IA en N8N, si aplica) queda aprobado sin pendientes.

**Paso 15**

Responsable de la iniciativa registra la entrada de la iniciativa al ciclo ya existente del Protocolo de Versionamiento v1.1 (testing → approved → stable).

**Criterio de salida:**

- La versión queda en el ciclo normal de Versionamiento, con el Brief y el spec/plan/tareas enlazados como evidencia de origen.

## 5. Reglas

| Regla | Por qué existe |
|---|---|
| Nunca se salta la validación de Valor (Paso 3, ambos caminos). | Es el riesgo que más mata iniciativas y el que más se evita por ser el más incómodo de probar. |
| El appetite se aprueba como presupuesto de tiempo, nunca como compromiso de alcance completo. | Evita comprometerse a un alcance fijo antes de saber lo suficiente. |
| Nunca se empieza a construir sin la aprobación explícita del Responsable Técnico del appetite. | Mismo gate que ya usa Versionamiento. |
| El Brief no es un checklist 100% bloqueante, salvo el problema/audiencia/hipótesis y la validación de Valor. | Evita tanto un stage-gate rígido como construir sin validación real. |
| Nunca se usan Claude y Cursor al mismo tiempo dentro de la misma iniciativa. | Evita fragmentar el contexto de la discusión. |
| El MVP siempre declara explícitamente qué queda fuera. | Evita scope creep silencioso y deja la métrica de éxito medible. |
| Todo proyecto arranca con la carpeta inicializada del Paso 9, y la inicialización nunca crea documentos vacíos ni con contenido inventado. | Sin una estructura común, cada proyecto termina con herramientas y documentación distintas; y un documento vacío da la falsa impresión de que algo ya está documentado. |
| spec-kit se instala en todo proyecto, sea software o n8n. | La auditoría técnica lo necesita en cualquier repo, y la spec y la clarificación son lo que más evita construir el workflow o el código equivocado. |
| Nunca se avanza a construir (Paso 13) con inconsistencias abiertas de `/speckit.analyze`. | Un gate de consistencia que se ignora no sirve de nada — el mismo motivo por el que Polaria nunca acepta un hallazgo de auditoría sin evidencia. |
| La constitución de un repo se establece una sola vez y se reutiliza entre iniciativas, salvo decisión explícita del Responsable Técnico de actualizarla. | Evita renegociar el mismo estándar de calidad cada vez — sobre-proceso que nadie sostendría. |

## 6. Excepciones

| Situación | Qué hacer |
|---|---|
| El cliente no está disponible para la conversación real (Camino 1). | No se aprueba el appetite hasta conseguirla. Nunca se cambia de camino por conveniencia. |
| El Responsable Técnico rechaza el appetite. | Se ajusta y se vuelve a presentar, o se archiva la iniciativa — el Brief queda como histórico. |
| La validación de Factibilidad revela que no es construible. | Se documenta; se ajusta el MVP o se archiva. No avanza al Paso 7. |
| La validación de Valor resulta negativa. | La iniciativa no avanza y se archiva — un "no" validado es un resultado correcto, no un fracaso. |
| spec-kit no se puede instalar o ejecutar en la máquina (Paso 9). | Se termina el resto de la inicialización, se anota como pendiente en `AGENTS.md` y el Paso 10 no empieza hasta resolverlo. |
| `/speckit.analyze` encuentra inconsistencias entre Brief, spec, plan y tareas. | Se corrigen antes del Paso 13 — nunca se avanza con inconsistencias conocidas. |
| `/speckit.converge` no llega a "Converged" tras 3 iteraciones. | Se escala al Responsable Técnico para decidir si se ajusta el plan/spec original o se sigue iterando. |
| Ya en construcción se descubre que la hipótesis de valor era incorrecta. | Se detiene el desarrollo y se regresa a este protocolo para reevaluar. |
| Urgencia real de negocio no permite completar el proceso completo. | El Responsable Técnico puede autorizar saltar un paso, documentado explícitamente — nunca en silencio, y nunca la validación de Valor del Paso 3 (ambos caminos), que no se salta bajo ninguna excepción. |
| El Responsable de la iniciativa y la IA no llegan a un acuerdo. | El Responsable de la iniciativa tiene la última palabra. |

## Diagrama de flujo

```
Paso 1 (Idea + recursos de origen + elegir Claude o Cursor)
   ↓
Paso 2 (Determinar camino)
   ↓
   ├─ Camino 1 → Paso 3 (Valor, cliente real) → Paso 4 (Usabilidad, cliente real) ─┐
   └─ Camino 2 → Paso 3 (Valor, evidencia interna) ─────────────────────────────────┤
                                                                                     ↓
                              Paso 5 (Factibilidad + declarar medio: código / n8n)
                                                                                     ↓
                                                              Paso 6 (Viabilidad)
                                                                                     ↓
                                                Paso 7 (Appetite — Responsable Técnico)
                                                                                     ↓
                                                    Paso 8 (MVP + Not Doing + métrica)
                                                                                     ↓
                    Paso 9 (Inicializar carpeta: git, spec-kit, plugins, docs/ con el Brief)
                                                                                     ↓
                         Paso 10 (constitución; en n8n incluye los Estándares N8N)
                                                                                     ↓
                      Paso 11 (specify + clarify + plan; plan opcional en n8n pequeño)
                                                                                     ↓
                     Paso 12 (tasks + analyze → Linear; opcionales en n8n pequeño)
                                                                                     ↓
                                Paso 13 (Construcción → Gate antes de cada push)
                                                                                     ↓
                  Paso 14 (converge — código, o n8n escrito con el Workflow SDK)
                                                                                     ↓
                                        Paso 15 (entra a Versionamiento v1.1)
```

## Métricas de éxito

| Métrica | Indicador de éxito |
|---|---|
| Tiempo promedio desde el Paso 1 hasta el Paso 15. | Sin umbral fijo todavía — se establece con el uso real. |
| Cantidad de ajustes significativos hechos después de construido, comparados contra el Brief y el plan original (dato que `/speckit.converge` ya deja explícito). | Entre menos ajustes, mejor fue la planificación inicial. |

## Comunicación externa

La conversación con el cliente en el Camino 1 se hace por el canal que el proyecto ya use con ese cliente. Nunca se le revela el appetite ni detalles de aprobación interna.

## Dependencias

| Protocolo / herramienta | Cuándo se activa |
|---|---|
| Guía de Documentación Extendida v2.0 | Paso 9, siempre — define la checklist y la estructura de `docs/`. |
| Plugins de `polaria-agent-plugins` | Paso 9, siempre — se habilitan los que aplican al medio. |
| Gate de Calidad Técnica Pre-Merge v1.2 | Paso 13, siempre — antes de cada `push`. Para n8n, con su excepción para workflows, hasta que exista un gate propio para n8n. |
| Protocolo de Versionamiento v1.1 | Paso 15, siempre — es el destino final de toda iniciativa que pasa por este protocolo. |
| Estándares de Diseño de Workflows N8N (versión vigente) | Pasos 5 y 10, cuando el medio declarado es workflow n8n. |
| Protocolo de Construcción de Agentes de IA en N8N | Pasos 5, 10 y 11, cuando el medio es n8n y además incluye un componente de IA. |
| `spec-kit` (github/spec-kit) | Pasos 9 a 14, en ambos medios — herramienta externa, no protocolo de Polaria. |
| MCP de n8n | Pasos 13 y 14, cuando el workflow se escribe como código con el Workflow SDK (piloto). |

## Versión y revisión

v1.1 · aprobado 23/09/2026 · Responsable Técnico · próxima revisión: tras cada uso real de este protocolo, en esta fase inicial (formato de una línea de la Guía de Construcción de Protocolos v1.2)

_Historial: v1.0 (14/09/2026). v1.1 (23/09/2026): Paso 1 con recursos de origen; Paso 9 nuevo de inicialización de la carpeta (los Pasos 9 a 14 pasan a 10 a 15); spec-kit se instala siempre y n8n también lo usa desde la constitución, con plan, tasks y analyze opcionales en workflows pequeños y converge como piloto con el Workflow SDK; `/speckit.specify` explícito en el Paso 11; la revisión de la construcción pasa de "Revisión de Pares" al Gate de Calidad Técnica._
