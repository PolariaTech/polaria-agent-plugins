# EXTENSIÓN DE DOMINIO — Workflow n8n al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y el prompt operativo de ejecución para este dominio. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Workflow n8n**. Define qué cuenta como artefacto real, qué KPI se verifican, y el prompt operativo exacto que ejecuta el Agente auditor.

## 2. Dimensiones de calidad y KPI

| Dimensión | KPI / umbral |
|---|---|
| Manejo de errores | 100% de nodos críticos con `On Error` configurado; Error Workflow global activo |
| Configuración pre-producción | 100% del checklist de estándares n8n del proyecto cumplido |
| Confiabilidad de ejecución | 0 ejecuciones fallidas sin captura por el Error Workflow |
| Idempotencia | 100% de los fallos forzados con reintento verificado sin duplicar el efecto (registro creado, notificación enviada, cobro/actualización aplicada) |

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Comportamiento del workflow | JSON exportado del workflow vigente | Diff contra el JSON real, nunca contra un resumen o el documento técnico |
| Lógica en ejecución | Ejecución real controlada | Contra el entorno de desarrollo, nunca producción |
| Configuración pre-activación | Checklist de estándares n8n del proyecto | Verificación nodo por nodo, no por la descripción del workflow |

## 4. Agente especializado recomendado

- **Principal:** `specialized-workflow-architect.md` + `automation-governance-architect.md` — copiados en esta misma carpeta (también ya instalados en MATEO_SUPPORT y PDF-GENERATOR).
- **Herramienta complementaria opcional (externa, no copiada aquí):** [n8n-Audit-Workflow](https://github.com/christinec-dev/n8n-Audit-Workflow) — workflow n8n real que auto-audita seguridad, rendimiento, manejo de errores, legibilidad y uso de IA de otro workflow; útil como generador adicional de evidencia, no reemplaza los pasos de este prompt.
- **Diagnóstico formal (reemplaza a `testing-evidence-collector.md`/`testing-reality-checker.md`, retirados de esta carpeta):** `/speckit.bug.assess` — spec-kit, bug extension, instalado en el repo auditado — toma la evidencia cruda de `specialized-workflow-architect.md`/`automation-governance-architect.md` como input y produce causa raíz + severidad + evidencia + remediación propuesta en un solo paso, con veredicto calibrado (nunca se infla sin reproducción real ejecutada).
- **Cómo usar estos archivos:** el Agente auditor lee el(los) archivo(s) de esta carpeta y usa su contenido como persona/system-prompt para ejecutar la auditoría; cada candidato que producen se formaliza después con `/speckit.bug.assess` — mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto. Nunca se improvisa la especialización sin leer el archivo primero.

## 5. Orquestación de agentes

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial) | Agente auditor (orquestador) | Exporta el JSON real vigente | Paso 1 |
| **A — Ejecución** (paralelo, comité — regla del Paso 3 del protocolo base) | `specialized-workflow-architect.md` | Mapea ramas, ejecuta/fuerza fallos reales y verifica idempotencia del reintento; genera candidatos con evidencia cruda | Pasos 3, 4, 5 |
| | `automation-governance-architect.md` | Verifica checklist de configuración y guardrails de gobernanza IA; genera candidatos con evidencia cruda | Pasos 2, 6 |
| **B — Diagnóstico spec-kit** (secuencial, después de A) | `/speckit.bug.assess` (por candidato) | Produce causa raíz + severidad + evidencia + remediación por candidato, con veredicto calibrado | No ejecuta pasos nuevos, formaliza los de A |
| **C — Consolidación final** | Agente auditor (orquestador) | Integra el resultado de los `assessment.md` de la Fase B en la tabla de severidad | Paso 7 |

La herramienta complementaria n8n-Audit-Workflow (sección 4), si se usa, corre dentro de la Fase A como insumo adicional de `specialized-workflow-architect.md` — no sustituye ninguno de sus pasos.

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Workflow n8n.
- **Contexto:** Sistema/artefacto: [declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó):** exportación real del workflow desde n8n + ejecución controlada (tipo `test_workflow`/`execute_workflow` o equivalente del proyecto).
- **Tarea (en este orden exacto, sin saltar pasos, sin sustituir ninguno por "leer la descripción del workflow"):**
  1. **[Agente auditor — Pre-fase]** Exportar el JSON real del workflow vigente — nunca trabajar sobre una copia de memoria o una versión anterior. Declarar por escrito el `versionId` o el timestamp exacto de la exportación.
  2. **[Automation Governance Architect — Fase A]** Verificar nodo por nodo el checklist de configuración pre-producción del proyecto (nomenclatura, Error Workflow global configurado, `On Error` en nodos críticos, tags de entorno/proyecto, documentación mínima). Cada ítem se marca explícitamente ✅/🔄/⚪ — ninguno se asume por la descripción general del workflow.
  3. **[Workflow Architect — Fase A]** Ejecutar el workflow completo contra desarrollo con al menos un caso de entrada real por cada rama/condición documentada. Si hay más de 5 ramas, se requiere primero un diagrama de flujo. Adjuntar el ID de ejecución de cada corrida como evidencia.
  4. **[Workflow Architect — Fase A]** Forzar al menos un fallo real por cada dependencia externa del workflow (timeout, error 4xx/5xx simulado) y confirmar que el Error Workflow lo captura — nunca se acepta como evidencia que "el flujo normal no falló", se fuerza el fallo.
  5. **[Workflow Architect — Fase A]** Para cada fallo forzado en el paso 4, ejecutar el mismo caso una segunda vez inmediatamente después de la recuperación/reintento y confirmar que el efecto (registro creado, notificación enviada, cobro/actualización aplicada) no se duplica. Adjuntar el ID de ambas ejecuciones y el estado final del recurso afectado como evidencia de idempotencia.
  6. **[Automation Governance Architect — Fase A]** Si el workflow incluye nodos de IA, verificar que cada uno tiene guardrails de input/output configurados y que el logging de prompt + respuesta está activo — adjuntar un ejemplo real de ese log.
  7. **[spec-kit bug.assess → Agente auditor — Fases B, C]** Cada candidato de los pasos 2-6 se formaliza con `/speckit.bug.assess` (Fase B); el Agente auditor consolida los `assessment.md` resultantes en la tabla de severidad del Paso 5 del protocolo base (Fase C).
- **Restricciones:**
  - Nunca ejecutar contra producción sin autorización explícita del Responsable.
  - Nunca aceptar la descripción del workflow o del nodo como evidencia de que algo está configurado — siempre inspección directa del nodo real.
  - Ningún hallazgo se convierte en issue de Linear sin confirmación del Responsable.
- **Audiencia:** Responsable del proyecto/sistema auditado.
- **Output esperado:** Tabla de severidad consolidada + sección "Qué no se pudo verificar", cada fila enlazada al ID de ejecución o evidencia correspondiente.

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.1 |
| Depende de | Protocolo de Auditoría Técnica de Software y Workflows v1.1 |
| Fecha de aprobación v1.0 | 25/08/2026 |
| Fecha de esta revisión (v1.1) | 16/09/2026 |
| Aprobado por | Responsable Técnico |
| Qué cambió en v1.1 | El diagnóstico y la formalización de hallazgos se delegan en `/speckit.bug.assess`; `testing-evidence-collector.md`/`testing-reality-checker.md` se retiraron de esta carpeta. Los agentes Principal y la herramienta complementaria n8n-Audit-Workflow no cambian de función, solo de destino |
| Próxima revisión | Con cada cambio de versión del protocolo base, o tras una auditoría real ejecutada con esta extensión específica — lo que ocurra primero |
