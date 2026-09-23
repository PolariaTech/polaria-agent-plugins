---
name: construccion-de-producto-desde-cero
description: Orquesta el Protocolo de Construcción de Producto desde Cero de Polaria — desde una idea que no existe todavía, pasando por inicializar la carpeta del proyecto (git, spec-kit, plugins de Polaria, docs/ con la Guía de Documentación), hasta que entra al ciclo de Versionamiento. Sirve para software y para workflows n8n. Úsala SIEMPRE que alguien proponga construir algo completamente nuevo o quiera arrancar un proyecto desde una carpeta vacía — incluso si no menciona el protocolo por nombre (ej. "tengo una idea para...", "quiero construir un agente nuevo que...", "deberíamos hacer una herramienta para...", "vamos a arrancar un proyecto nuevo", "prepara esta carpeta para empezar desde cero", "ya tengo la spec, armemos el proyecto en n8n"). No la uses para bugs, mejoras incrementales, features de un producto que ya existe, ni para configurar un proyecto que ya está avanzado (para eso está `claude-code-setup`).
---

# Skill: Construcción de Producto desde Cero

Ejecuta, paso a paso, `PROTOCOLO_DE_CONSTRUCCION_DE_PRODUCTO_DESDE_CERO_v1.1.md` (en el plugin: `references/`; en el repo de metodología: la carpeta superior de esta skill) — esa es la fuente de verdad de cada regla, excepción y criterio de salida. Esta skill es la capa de ejecución: qué persona, herramienta o referencia usar en cada paso, y el mecanismo de respaldo si el entorno no soporta subagentes nativos.

**Instalación:** esta carpeta (`skill/`) es la copia canónica versionada dentro de la metodología de Polaria, inerte aquí. Se publica como el plugin `construccion-desde-cero` del marketplace `PolariaTech/polaria-agent-plugins` (Claude Code y Cursor). Se instala **a nivel de usuario**, no de proyecto, porque corre antes de que la carpeta del proyecto exista: `/plugin install construccion-desde-cero@polaria-agent-plugins` eligiendo alcance de usuario (Claude Code), o desde el Team Marketplace con alcance de usuario (Cursor). Cualquier cambio se hace aquí y se vuelve a publicar al plugin, nunca al revés.

## Antes de empezar

Confirma con quien te habla que esto es un producto/iniciativa que **no existe todavía** (Contexto del protocolo). Si es una funcionalidad nueva de un producto ya existente, esta skill no aplica — redirige a Épica Planning directamente. Si el proyecto ya existe y está avanzado, redirige a `claude-code-setup`.

## Paso 1 — Idea y recursos de origen

1. Pregunta con qué herramienta se va a acompañar toda la iniciativa: Claude o Cursor — nunca ambas en la misma iniciativa (Regla del protocolo).
2. Pregunta qué recursos ya existen: specs, documentos de requisitos, JSON de workflows, diagramas, enlaces. Léelos completos antes de seguir.
3. Ejecuta el proceso de `references/idea-refine.md` (persona copiada de [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), MIT) — sus Fases 1 y 2 (Entender y Expandir, Evaluar y Converger) son literalmente el Paso 1 del protocolo. Usa `references/idea-refine-frameworks.md` y `references/idea-refine-refinement-criteria.md` como esa persona indica. Si los recursos del punto 2 ya responden algo (el problema, la audiencia, una dirección elegida), tómalo de ahí, díselo al Responsable de la iniciativa y pregunta solo lo que falta. NUNCA des por validado un supuesto solo porque aparece escrito en un recurso.

**Excepción obligatoria a como está escrita esa persona:** su Fase 3 ("Sharpen & Ship") produce, en su plantilla original, un "MVP Scope" y un "Not Doing" — eso es contenido del Paso 8 del protocolo, que solo existe **después** de que el Responsable Técnico aprueba el appetite (Paso 7). Producirlo aquí, en el Paso 1, violaría la Regla del protocolo de que el appetite se aprueba como presupuesto de tiempo, nunca como alcance ya comprometido. Al ejecutar la Fase 3 de `idea-refine.md`, **omite las secciones "MVP Scope" y "Not Doing" de su plantilla** — quédate solo con "Problem Statement", "Recommended Direction", "Key Assumptions to Validate" y "Open Questions". El MVP y el "Not Doing" reales se redactan en el Paso 8, no aquí.

**Salida de este paso:** el Brief, que hasta el Paso 9 vive en esta conversación, con problema, audiencia, hipótesis de valor, supuestos no validados, herramienta elegida y una sección "Recursos de origen" con la ruta o enlace de cada recurso — el "Criterio de salida" del Paso 1 del protocolo, sin adelantar MVP ni exclusiones todavía.

## Pasos 2 a 8 — Camino, validación, factibilidad, viabilidad, appetite, MVP

No hay una persona externa para estos pasos — son la política propia de Polaria. Guía la conversación con el Responsable de la iniciativa siguiendo el protocolo paso por paso, en el orden exacto ahí escrito, sin saltarte ningún criterio de salida. Presta atención especial a:

- **Paso 2:** el camino (Camino 1 = usuarios/clientes externos reales, Camino 2 = puramente interno) no se asume, se pregunta y se declara por escrito.
- **Pasos 3-4 (Camino 1):** nunca aceptes una síntesis tuya como sustituto de la conversación real con el cliente — si no hay evidencia de esa conversación, el paso no está completo (Paso 3 — Camino 1 del protocolo: "nunca una encuesta indirecta ni una suposición").
- **Paso 5:** aquí se declara el medio de construcción (software/código o n8n, con o sin componente de IA). Esta decisión determina qué aplica en el Paso 9 y en los Pasos 10 a 14. Si es n8n, anota también su tamaño según la sección 1 de `references/catalogo-inicializacion.md`.
- **Paso 7:** el appetite es un presupuesto de tiempo, nunca un alcance cerrado — si el Responsable de la iniciativa (o tú) empiezan a listar funcionalidades exactas en vez de un tiempo, corrige el rumbo antes de presentarlo al Responsable Técnico.
- **Paso 8:** la lista "Not Doing" no es opcional — sin ella el MVP no tiene criterio de salida cumplido.

## Paso 9 — Inicializar la carpeta del proyecto

Sigue `references/inicializar-carpeta.md` tal cual, en orden, usando `references/catalogo-inicializacion.md` para saber qué aplica a este medio y a este editor. Lo esencial:

- DEBES mostrar el árbol, los plugins y los documentos que vas a crear, y esperar la confirmación del Responsable de la iniciativa antes de crear cualquier archivo.
- NUNCA sobrescribas un archivo que ya existe en la carpeta.
- NUNCA crees un documento vacío o con contenido inventado: solo lo que el catálogo marca como "Al inicializar".
- NUNCA hagas `push` en este paso: termina en el primer commit local.

## Paso 10 — Constitución del repo

Verifica si el repo ya tiene una constitución de `spec-kit` (`.specify/memory/constitution.md`) con contenido real — no la plantilla con `[PROJECT_NAME]` y `[PRINCIPLE_1_NAME]` sin reemplazar. Si existe, reutilízala tal cual y sigue al Paso 11 — nunca la renegocies sin que el Responsable Técnico lo pida explícitamente (Regla del protocolo). Si no existe:

1. Si el Paso 9 dejó spec-kit como pendiente, detente: este paso no puede empezar sin él (Excepción del protocolo).
2. Ejecuta `/speckit.constitution`, usando el appetite y el MVP del Brief como contexto de qué calidad/testing/UX/performance importa para esta iniciativa.
3. **Si el medio es n8n:** los principios de la constitución DEBEN incluir la versión vigente de los Estándares de Diseño de Workflows N8N (Drive de Polaria, `00_PROTOCOLOS/07_AGENTES_IA_N8N/RECURSOS/`) — nomenclatura de workflows y nodos, "un workflow = una responsabilidad", el patrón Trigger → Preparar Payload → Router y los 3 niveles de manejo de errores. Si hay componente de IA, también las reglas del Protocolo de Construcción de Agentes de IA en N8N (misma carpeta superior en Drive). Pídele al Responsable de la iniciativa el documento si no lo tienes a mano. No los reescribas de memoria.

## Paso 11 — Especificación técnica

1. Ejecuta `/speckit.specify` con el Brief (`docs/brief.md`) y los "Recursos de origen" como entrada. Si ya existe una spec escrita, úsala como descripción de la funcionalidad: no se copia suelta a `specs/`.
2. Ejecuta `/speckit.clarify`. No avances si deja preguntas sin resolver.
3. Ejecuta `/speckit.plan` con el stack y arquitectura decididos. **Si el medio es n8n:** el plan describe la arquitectura del workflow (router, sub-workflows, credenciales, datos) contra la constitución; si hay componente de IA, sigue además las fases de diseño del Protocolo de Construcción de Agentes de IA en N8N. En un workflow n8n **pequeño**, este punto es opcional: pregúntale al Responsable de la iniciativa si lo quiere.

## Paso 12 — Tareas

1. Ejecuta `/speckit.tasks`, y después `/speckit.analyze`. Si `/speckit.analyze` reporta inconsistencias entre Brief, spec, plan y tareas, no continúes — vuelve sobre el punto señalado hasta que quede resuelto (Regla del protocolo).
2. **En un workflow n8n pequeño** ambos son opcionales, y si se omitió el plan en el Paso 11 también se omiten (`/speckit.tasks` necesita el plan): en ese caso, descompón el workflow en tareas desde la spec con slicing vertical (una función completa de punta a punta por tarea, no "todos los triggers, luego toda la lógica, luego todas las salidas").
3. Las tareas quedan registradas en Linear — como épica nueva si el tamaño lo amerita, o directo al backlog. Usa `linear-crear-issue` del plugin `gestion-linear` y confirma con el Responsable de la iniciativa antes de crearlas.

## Paso 13 — Construcción

Esta skill no construye. Confirma que las tareas del Paso 12 están listas y recuérdale al Responsable de la iniciativa que:

- Cada cambio pasa por el Gate de Calidad Técnica (`gate-calidad-tecnica-pre-merge-polaria`) antes del `push`.
- **Si el medio es n8n:** el workflow se versiona en `workflows/`, y mientras no exista un gate propio para n8n se revisa con la excepción para n8n de ese Gate.
- **Piloto n8n con Workflow SDK** (opcional): el workflow se escribe como código en `workflows/<nombre>.ts` siguiendo la referencia del SDK (`get_workflow_sdk_reference` del MCP de n8n), se valida con `validate_workflow` y se crea con `create_workflow_from_code`. Confirma con el Responsable de la iniciativa antes de crear o actualizar nada en la instancia de n8n: es visible para el equipo.

## Paso 14 — Convergencia

Cuando el Responsable de la iniciativa indique que la construcción del Paso 13 terminó, ejecuta `/speckit.converge`. Si no reporta "Converged", agrega las tareas pendientes que señale y repite. Si tras 3 intentos sigue sin converger, detente y escala al Responsable Técnico (Excepción del protocolo) — no sigas iterando sin límite por tu cuenta.

**Si el medio es n8n:** este paso aplica solo si se usó el piloto con Workflow SDK del Paso 13. Si no, la revalidación queda cubierta por el gate del Paso 13 y, si hay componente de IA, por el checklist de producción del Protocolo de Construcción de Agentes de IA en N8N. Si se usó el piloto, anota en `docs/adr/` si `/speckit.converge` funcionó bien contra el `.ts`: es el dato que decide si el piloto se adopta.

## Paso 15 — Entrega a Versionamiento

No ejecutes nada nuevo aquí — confirma que el Brief y el spec/plan/tareas quedan enlazados como evidencia de origen, que `docs/CHECKLIST_DOCUMENTACION.md` refleja el estado real, y que la iniciativa entra al ciclo ya existente de `POLARIA_PROTOCOLO_VERSIONAMIENTO.md` v1.1. Esta skill termina aquí.

## Si el entorno no soporta subagentes nativos

Mismo mecanismo de respaldo que ya usa `CLAUDE.md` del repo de metodología y `AUDITORIA/` dentro de él: si estás en un entorno donde no puedes despachar la persona de `idea-refine.md` como un subagente real, léela igual y aplica sus instrucciones directamente en el hilo actual — el contenido de la persona no cambia, solo cómo se ejecuta.

## Restricciones

- NUNCA marques un paso como completo sin su criterio de salida — están listados uno por uno en el protocolo, no se infieren.
- NUNCA sustituyas una conversación real con el cliente (Camino 1) por una síntesis propia.
- NUNCA uses Claude y Cursor al mismo tiempo dentro de la misma iniciativa.
- NUNCA crees archivos en el Paso 9 sin la confirmación del Responsable de la iniciativa, ni sobrescribas uno existente.
- NUNCA crees documentos vacíos o con contenido inventado.
- NUNCA avances a construir con hallazgos abiertos de `/speckit.analyze`.
- NUNCA hagas `push`, crees issues en Linear ni cambies algo en la instancia de n8n sin confirmación.

## Verificación

Antes de dar por cerrado el trabajo de esta skill (Paso 15):

- [ ] El Brief existe en `docs/brief.md` y tiene los puntos de los Pasos 1-8 completos (o marcados "pendiente" solo si no son problema/audiencia/hipótesis ni validación de Valor), con sus recursos de origen.
- [ ] El medio de construcción está declarado desde el Paso 5 (y el tamaño, si es n8n).
- [ ] La carpeta cumple el criterio de salida del Paso 9, y cada pendiente de "Pendientes de instalación" de `AGENTS.md` se cerró en el paso que tenía asignado (salvo los que dependen de una herramienta todavía no publicada, como `versionamiento-polaria`).
- [ ] Hay constitución real (en n8n, con los Estándares N8N), spec sin preguntas abiertas de `/speckit.clarify` y, salvo en n8n pequeño, plan, tareas y `/speckit.analyze` sin inconsistencias.
- [ ] Cada cambio pasó por su gate, y `/speckit.converge` quedó en "Converged" (software, o n8n con el piloto del SDK).
- [ ] La iniciativa quedó registrada en Linear y enlazada a su Brief.
