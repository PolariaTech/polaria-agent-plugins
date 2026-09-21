# EXTENSIÓN DE DOMINIO — Metodología y Protocolos al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y la orquestación de los agentes especializados de este mismo proyecto para auditar la metodología de Polaria. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Metodología y Protocolos** (documentos que definen cómo trabaja el equipo — ceremonias, flujos, roles, reglas — no software). A diferencia de los otros 6 dominios, aquí el artefacto real es texto, y los agentes especializados no viven en otro proyecto de `D:\POLARIA`: son los 20 agentes ya definidos en `.claude/agents/` de este mismo proyecto (Polaria Metodología), gobernados por la política de enrutamiento de `CLAUDE.md`.

## 2. Dimensiones de auditoría y KPI

Reutiliza los criterios que este proyecto ya tiene definidos en vez de crear una escala nueva:

| Dimensión | KPI/criterio | Agente que la cubre |
|---|---|---|
| Coherencia con el Manifiesto Ágil | 0 contradicciones con los 4 valores/12 principios | `agile-principles-auditor` |
| Anti-patrones de "teatro ágil" | 0 síntomas de cargo-cult (ceremonias vacías, métricas de vanidad, water-scrum-fall) | `anti-pattern-detector` |
| Coherencia interna del documento | 0 contradicciones de terminología/roles/artefactos entre secciones | `methodology-coherence-auditor` |
| Excelencia técnica | Prácticas XP (CI/CD, TDD, deuda técnica, ritmo sostenible) documentadas, no solo aspiracionales | `technical-excellence-agent` |
| Salud del equipo | Seguridad psicológica y ritmo sostenible cubiertos desde lo humano, no solo desde el proceso | `team-health-psychological-safety-agent` |
| Filtro de calidad de un protocolo individual (9 preguntas) | Responsable único por paso, criterio de salida claro, excepciones con respuesta, reglas justificadas, orden lógico, ejecutable sin interpretación adicional, versión/revisión, un solo problema resuelto, 5W2H completo | `methodology-coherence-auditor`, aplicando `references/guia_construccion_protocolos.md` de la skill `crear-protocolo-polaria` |
| Anti-patrones de protocolo individual (9 ítems) | Sin responsable ambiguo, criterio vago, excepción sin respuesta, regla sin justificación, protocolo multipropósito, dependencia oculta, sin criterio de salida, sin versión/revisión, protocolo zombi | Igual que arriba |

Las otras 14 dimensiones de los 20 agentes de este proyecto (escalado, gobernanza, liderazgo, métricas, aprendizaje organizacional, etc.) se activan solo si el síntoma declarado en el Paso 1 las requiere — ver la tabla completa de 20 agentes y sus disparadores en `CLAUDE.md` de este proyecto; no se duplica aquí para no desalinearse si esa tabla cambia.

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Contenido de un protocolo | Texto literal del documento (`PROTOCOLOS_EXISTENTES/` o el Drive real de Polaria) | Nunca `REFERENCIA_CORPUS_PROTOCOLOS.md` como sustituto — es un resumen; ya hubo un caso real de cita imprecisa tomada de ahí (adenda de nomenclatura Gemini) |
| Ejecución real del protocolo (si aplica) | Evidencia de que se sigue en la práctica (minutas, historial de Linear) | Si no hay evidencia disponible, se declara "no verificable, solo se evaluó el documento" — nunca se asume que se ejecuta tal como está escrito |
| Conocimiento tácito de la operación real | Confirmación directa con el Responsable antes de reportar un hallazgo de "ausencia" | Un mecanismo que ya funciona pero no está documentado es severidad Media (falta de documentación), no Crítica (ausencia del mecanismo) — precedente real de este proyecto: canal cliente→Edgar y buffer de capacidad en Sprint Planning |

## 4. Agente especializado recomendado

No se copian archivos a esta carpeta — los 20 agentes ya viven en `.claude/agents/` de este mismo proyecto y se referencian directamente desde ahí, para no duplicar archivos que ya se actualizan de forma nativa (copiarlos aquí los desalinearía con el tiempo, el mismo riesgo que ya se evitó separando protocolo base y extensiones en vez de reescribir todo junto).

- **Comité por defecto (auditoría amplia):** `agile-principles-auditor.md` + `anti-pattern-detector.md` + `methodology-coherence-auditor.md` + `technical-excellence-agent.md` + `team-health-psychological-safety-agent.md` — los mismos 5 que ya usa la cadena "Audita nuestra metodología" de `CLAUDE.md`.
- **Agente único (auditoría de un documento puntual, antes de aprobarse):** `methodology-coherence-auditor.md`, aplicando el filtro de calidad y los anti-patrones de `crear-protocolo-polaria` como checklist mecánico.
- **Agente(s) puntuales (auditoría por síntoma específico):** el que corresponda según la tabla de 20 agentes de `CLAUDE.md` — nunca "el que parezca más razonable", siempre el que la tabla indica para ese síntoma.
- **Si el entorno no soporta subagentes nativos:** usar el mecanismo de respaldo ya definido en `CLAUDE.md` de este proyecto — leer el archivo del agente y aplicarlo directamente en el hilo, o despacharlo como `general-purpose` con el contenido completo del agente pegado como system prompt.

## 5. Orquestación de agentes

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial) | Agente auditor (orquestador) | Determina el modo (amplia / documento puntual / por síntoma) y selecciona el/los agente(s) según la sección 4 | Pasos 1, 2 |
| **A — Ejecución** (paralelo si es comité de 5; agente único si es documento puntual o síntoma específico — regla del Paso 3 del protocolo base) | Agente(s) seleccionado(s) en la Pre-fase | Audita el artefacto real contra la dimensión que le corresponde; marca cada hallazgo con exactamente uno de los 3 símbolos fijos del Paso 4 del protocolo base: ✅ hecho observado (cita textual directa) · 🔄 riesgo condicional (depende de algo no confirmado, se dice qué) · ⚪ no verificable (se declara explícitamente) | Paso 3 |
| **B — Verificación de cita** (secuencial, después de A) | Agente auditor (orquestador) | Rechaza y regresa al agente de origen cualquier hallazgo que no cite el documento exacto + sección/línea — nunca se acepta "según la metodología" sin ese detalle | No ejecuta pasos nuevos |
| **C — Chequeo contra realidad tácita** (secuencial, después de B) | Agente auditor (orquestador), confirmando con el Responsable si hace falta | Antes de reportar un hallazgo de "ausencia", verifica si el mecanismo ya opera tácitamente; si es así, baja la severidad de Crítico a Medio | No ejecuta pasos nuevos |
| **D — Consolidación final** | Agente auditor (orquestador) | Integra el resultado filtrado en la tabla de severidad del Paso 5 del protocolo base, en formato de checklist priorizado (🔴🟠🟡🟢) | Paso 4 |

**Equivalencia entre el checklist priorizado y la tabla de severidad del protocolo base** (misma escala, solo con el formato visual que ya usa `ESTADO.md` de este proyecto): 🔴 = Crítico · 🟠 = Alto · 🟡 = Medio · 🟢 = Bajo. Cada fila del checklist final, además del color de severidad, conserva el símbolo ✅/🔄/⚪ de la Fase A que sostiene ese hallazgo — el color dice qué tan grave es, el símbolo dice qué tan verificado está; ninguno reemplaza al otro.

A diferencia de los otros 6 dominios, aquí no se usan `testing-evidence-collector.md` ni `testing-reality-checker.md` — están diseñados para evidencia visual/de ejecución de software, no para auditoría de texto. Las Fases B y C de este dominio cumplen el mismo propósito (nunca aceptar un hallazgo sin sostén, nunca reportar con más severidad de la que la evidencia sostiene) con un método propio ya validado en la auditoría real de agosto 2026 de este proyecto.

**Nota sobre remediación:** esta orquestación termina en el informe consolidado (Fase D). Redactar la corrección de un hallazgo confirmado (con `documentation-playbook-builder`) es un paso posterior, fuera del alcance de esta extensión — corresponde a la cadena "Mejora el proceso de X" ya definida en `CLAUDE.md`, no a este protocolo de auditoría.

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Metodología y Protocolos.
- **Contexto:** Sistema/artefacto: [documento o carpeta declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó):** lectura directa del texto literal del documento en `PROTOCOLOS_EXISTENTES/` o el Drive real de Polaria — nunca `REFERENCIA_CORPUS_PROTOCOLOS.md`.
- **Tarea (en este orden exacto, sin saltar pasos):**
  1. **[Agente auditor — Pre-fase]** Determinar el modo de auditoría: si el Solicitante pidió una revisión amplia de todo el corpus, usar el modo "amplia"; si pidió revisar un documento nuevo antes de aprobarse, usar el modo "documento puntual"; si señaló un síntoma específico (ej. "¿esto es realmente ágil?", "¿hay teatro ágil aquí?"), usar el modo "por síntoma". Si el Solicitante no especificó ninguno de los tres, preguntar antes de continuar — nunca asumir el modo.
  2. **[Agente auditor — Pre-fase]** Seleccionar el/los agente(s) según el modo determinado en el paso 1 y la sección 4 de esta extensión. Declarar por escrito cuál(es) se seleccionaron y por qué.
  3. **[Agente(s) seleccionado(s) — Fase A]** Cada agente lee el texto literal del artefacto real (nunca el resumen), reporta sus hallazgos citando el documento exacto y la sección/línea, y marca cada uno con su símbolo ✅/🔄/⚪ (mismo significado que el Paso 4 del protocolo base) — un hallazgo sin cita o sin símbolo no es válido y se descarta en la Fase B.
  4. **[Agente auditor — Fases B, C, D]** Verificar que cada hallazgo cite el documento y sección exactos y tenga su símbolo ✅/🔄/⚪ (Fase B); para cada hallazgo de "ausencia", confirmar contra el conocimiento tácito real de la operación antes de fijar la severidad (Fase C); consolidar el resultado filtrado en la tabla de severidad del Paso 5 del protocolo base, con el formato de checklist priorizado 🔴 Crítico / 🟠 Alto / 🟡 Medio / 🟢 Bajo que ya usa `ESTADO.md` de este proyecto, conservando el símbolo de evidencia de cada hallazgo.
- **Restricciones:**
  - Nunca citar `REFERENCIA_CORPUS_PROTOCOLOS.md` como evidencia suficiente de un hallazgo — solo el texto literal del documento o el Drive real.
  - Nunca reportar como "Crítico" la ausencia de un mecanismo sin haber confirmado primero, contra el conocimiento tácito real o con el Responsable, que de verdad no existe en la práctica.
  - Ningún hallazgo se convierte en tarea de `documentation-playbook-builder` ni en issue de Linear sin confirmación del Responsable.
  - No consolidar pegando las salidas crudas de cada agente una tras otra sin reconciliar solapes — regla ya fijada en `CLAUDE.md` de este proyecto.
- **Audiencia:** Responsable del proyecto/sistema auditado (en este dominio, típicamente el Responsable de la metodología de Polaria).
- **Output esperado:** Checklist priorizado por severidad (mismo formato que `ESTADO.md`), cada hallazgo con su cita exacta de documento + sección, y sección "Qué no se pudo verificar".

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Depende de | Protocolo de Auditoría Técnica de Software y Workflows v1.1 (esta extensión no cambió de contenido — v1.1 del base solo agregó reglas y delegación en spec-kit para dominios de código, que no aplican a este dominio) |
| Fecha de aprobación | 25/08/2026 |
| Aprobado por | Responsable Técnico |
| Próxima revisión | Con cada cambio de versión del protocolo base, o tras una auditoría real ejecutada con esta extensión específica — lo que ocurra primero |
