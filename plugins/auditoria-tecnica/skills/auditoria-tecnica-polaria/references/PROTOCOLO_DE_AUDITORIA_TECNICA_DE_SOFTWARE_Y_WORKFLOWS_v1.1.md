# PROTOCOLO DE AUDITORÍA TÉCNICA DE SOFTWARE Y WORKFLOWS

*Polaria | Técnico*

## 1. Contexto

Aplica cuando hay que verificar que un sistema de software o workflow (Workflow n8n, Agente IA, Integraciones, Base de datos, Frontend, Backend), o un documento del dominio Metodología y Protocolos, funciona/se cumple como se espera — típicamente al cierre de una épica, antes de un release, o cuando surge sospecha de discrepancia entre lo documentado y el comportamiento real. Lo usa cualquier miembro del equipo que necesite ejecutar o solicitar una auditoría técnica, sin importar el proyecto.

## 2. Objetivo

Convertir cualquier solicitud de auditoría técnica de software/workflow — sin importar el proyecto ni cómo se formule ("¿esto funciona?", "revisa X") — en un proceso formal y repetible que verifica contra el artefacto real, prioriza por severidad con evidencia citada, y no cierra un hallazgo sin regresión verificada.

## 3. Actores

| Actor | Rol y responsabilidad |
|---|---|
| Solicitante de la auditoría | Define qué se audita y por qué. Puede ser el Responsable del proyecto (= del sistema auditado) o el Responsable del equipo |
| Agente auditor (IA) | Ejecuta la verificación contra el artefacto real; comité paralelo si es análisis divergente, autor único si es tarea convergente |
| Responsable del proyecto/sistema auditado | Confirma decisiones abiertas que la auditoría no puede resolver sola, y aprueba explícitamente que un hallazgo se convierta en issue de Linear — nunca automático |

## 4. Pasos

**Paso 1**

Solicitante declara el alcance en formato fijo: **Sistema/artefacto** + **Motivo** (Release / Cierre de épica / Sospecha puntual / Diseño o propuesta antes de construir / Otro) + **Dominio** (Workflow n8n / Base de datos / Agente IA / Integraciones / Frontend / Backend / Metodología y Protocolos).

**Criterio de salida:**

- Los 3 campos completados antes de empezar — sin esto, el agente auditor no arranca

**Paso 2**

Agente auditor identifica el artefacto real obligatorio según la extensión de dominio correspondiente al valor declarado en el paso 1 (ver Dependencias). Si el Motivo es **Diseño o propuesta antes de construir**, el artefacto real es el corpus de datos/documentos ya existentes contra el que se verifica la propuesta — nunca el sistema propuesto en sí, porque todavía no existe. En dominios de código (todos salvo Metodología y Protocolos), este Motivo delega en la extensión Idea Assessment de spec-kit (`intake → research → define → shape → decide`) en vez de una revisión ad-hoc del corpus — ver `skill/SKILL.md` de esta carpeta para la orquestación exacta.

**Criterio de salida:**

- Artefacto(s) real(es) definidos en la extensión de dominio (o el corpus real correspondiente) accedidos y citables

**Paso 3**

Agente auditor elige mecánica con esta regla fija: la tarea es **auditar/verificar/comparar** (varias lentes válidas sobre el mismo artefacto) → **comité en paralelo**, un agente por lente · la tarea es **diseñar/redactar un plan de remediación** (una sola versión coherente) → **autor único**, nunca se reparte la redacción · la tarea es **auditar una propuesta de diseño todavía no implementada, en rondas sucesivas mientras se corrige** → **auditoría iterativa de diseño**: un agente auditor fresco por ronda (nunca el mismo hilo que propuso o corrigió el diseño), cada ronda sobre la versión ya corregida de la ronda anterior (ver Reglas para el criterio de parada y la confirmación entre rondas).

**Criterio de salida:**

- Mecánica registrada en el informe con la regla que la determinó

**Paso 4**

Agente(s) auditor(es) ejecutan la verificación. Cada hallazgo se marca con exactamente uno de 3 símbolos fijos: ✅ hecho observado (evidencia directa citada) · 🔄 riesgo condicional (depende de una condición no confirmada, se dice cuál) · ⚪ no verificable (se declara explícitamente, nunca se rellena con suposición).

**Criterio de salida:**

- 100% de los hallazgos con símbolo + evidencia o motivo citado

**Paso 5**

Agente auditor consolida en tabla de severidad fija: **Crítico** (rompe funcionalidad core, expone datos, o pérdida irreversible) · **Alto** (afecta funcionalidad importante, sin workaround) · **Medio** (afecta con workaround) · **Bajo** (cosmético, no afecta operación) — cada fila con columna "Evidencia" obligatoria, más una sección final fija "Qué no se pudo verificar" (nunca se omite, aunque quede vacía).

**Criterio de salida:**

- Tabla completa, ninguna fila sin evidencia, sección de no-verificado presente

**Paso 6**

Agente auditor presenta el informe al Responsable del proyecto/sistema auditado.

**Criterio de salida:**

- Responsable confirma por escrito qué hallazgos se accionan y en qué orden — ningún hallazgo pasa a Linear sin esta confirmación

**Paso 7**

Tras una corrección, agente auditor revalida con ejecución real: el caso original + los casos vecinos (mismo componente/nodo/tabla).

**Criterio de salida:**

- Hallazgo marcado ✅ Resuelto (fecha + evidencia) — nunca se borra, queda trazabilidad histórica

## 5. Reglas

| Regla | Por qué existe |
|---|---|
| Nunca se acepta "según el documento/DOC" como evidencia suficiente — siempre se verifica contra el artefacto real | La revisión estática no atrapa lo que solo aparece en ejecución real |
| Ningún caso de auditoría corre contra producción, salvo autorización explícita del Responsable — por defecto contra entorno de desarrollo | Las auditorías son de solo lectura; correr contra producción sin necesidad expone datos/usuarios reales sin motivo |
| Ningún hallazgo se convierte en issue de Linear automáticamente | La decisión de accionar es del Responsable, no del agente auditor |
| Un hallazgo resuelto nunca se borra — se marca ✅ Resuelto con fecha y evidencia | Sin trazabilidad, una auditoría futura puede repetir el mismo hallazgo sin memoria de que ya se investigó |
| La revalidación de una corrección siempre incluye los casos vecinos, no solo el caso original reportado | Un fix puede resolver el síntoma reportado y dejar el mismo defecto en un componente hermano |
| En auditoría iterativa de diseño (ver paso 3), una ronda nueva nunca se lanza sin que el Solicitante confirme explícitamente "otra ronda" — nunca por iniciativa del propio agente auditor ni del agente que coordina | La decisión de seguir auditando o pasar a implementar es del Solicitante, igual que la decisión de accionar hallazgos (paso 6) |
| La iteración de auditoría de diseño se da por cerrada cuando una ronda no reporta ningún hallazgo Crítico ni Alto nuevo y el propio agente auditor lo declara explícitamente en su veredicto — nunca por un número de rondas fijado de antemano | Un número fijo de rondas puede detenerse antes de que aparezca el hallazgo real, o seguir gastando rondas después de que el diseño ya convergió |
| En dominios de código, ningún código se escribe hasta que el Responsable confirma explícitamente el plan de corrección del paso 6 — esto es más estricto que "ningún hallazgo pasa a Linear sin confirmación": aquí ni siquiera se toca el código, se pase o no a Linear | Confirmar que se accione un hallazgo y confirmar que se puede tocar código son dos permisos distintos; el primero no implica el segundo |
| Toda corrección de un hallazgo en dominios de código incluye un test de regresión propio de ese hallazgo (bug corregido o funcionalidad agregada), antes de darse por cerrado en el paso 7 | Sin un test dedicado, nada impide que el mismo defecto reaparezca sin que la siguiente auditoría lo note a tiempo |

## 6. Excepciones

| Situación | Qué hacer |
|---|---|
| El artefacto real no es accesible (sin acceso a la DB, workflow no exportable, entorno caído) | Se declara explícitamente "no verificable" — nunca se sustituye por documentación como si fuera equivalente |
| Documentación y evidencia real se contradicen sobre el mismo hecho | Se reconcilia la contradicción antes de reportar — nunca se reportan ambas versiones como igualmente válidas |
| Una precondición asumida resulta falsa al verificar | El agente auditor decide de forma autónoma cómo proceder, documentando la decisión explícitamente como tomada sin poder confirmar con el Responsable |
| El alcance completo excede el tiempo/costo disponible para verificar todo | Se declara explícitamente qué quedó "no reverificado" — nunca se asume vigente o resuelto sin evidencia |
| El Responsable no está disponible para confirmar qué hallazgos accionar | El informe se entrega completo y priorizado; solo queda bloqueada la conversión a issues, no la auditoría |
| Una verificación se ejecutó por error contra producción en vez de desarrollo | Se detiene de inmediato — las auditorías son de solo lectura, no hay nada que revertir |
| Un hallazgo se convirtió en issue de Linear sin confirmación del Responsable | El issue se cierra/cancela con nota explicando el error; el hallazgo vuelve al informe como pendiente |
| Una corrección aplicada resulta incorrecta al revalidar | Se documenta como hallazgo nuevo derivado de la corrección fallida y se repiten los pasos 4 a 7 sobre ese hallazgo |

## Herramientas y accesos

| Herramienta | Para qué | Acceso |
|---|---|---|
| Linear | Registrar hallazgos que el Responsable confirmó accionar | Agente auditor: solo escritura tras confirmación explícita del Responsable |
| Herramienta(s) de verificación del dominio auditado | Acceder al artefacto real | Definido en cada extensión de dominio — lectura mínima necesaria, nunca escritura sobre producción salvo autorización explícita |

## Rollback

| Situación | Cómo revertir |
|---|---|
| Una verificación se ejecutó por error contra producción | Se detiene de inmediato — las auditorías son de solo lectura, no modifican nada, no hay nada que revertir |
| Un hallazgo se convirtió en issue de Linear sin confirmación del Responsable | El issue se cierra/cancela con nota explicando el error; el hallazgo vuelve al informe como pendiente de confirmación |
| Una corrección aplicada resulta incorrecta al revalidar | No se revierte el protocolo — se documenta como hallazgo nuevo y se repiten los pasos 4 a 7 sobre ese hallazgo |

## Métricas de éxito

| Métrica | Indicador de éxito |
|---|---|
| Hallazgos cerrados sin evidencia de regresión real | 0 |
| Hallazgos reportados (✅/🔄/⚪) sin evidencia o motivo citado | 0 |
| Hallazgos que reaparecen tras marcarse ✅ Resuelto | 0 |

## Dependencias

| Protocolo | Cuándo se activa |
|---|---|
| Extensión de dominio correspondiente (Workflow n8n / Base de datos / Agente IA / Integraciones / Frontend / Backend / Metodología y Protocolos) | Siempre — el paso 2 no puede ejecutarse sin la extensión del dominio declarado en el paso 1 |
| Protocolo de Versionamiento (si el proyecto lo usa) | Cuando el Motivo declarado es "Release" — esta auditoría es la verificación técnica previa a la aprobación de despliegue |
| `plantilla_prompt_auditoria.md` (misma carpeta que este protocolo) | Siempre que se redacta el prompt de un agente auditor — sea auditoría de sistema real o auditoría iterativa de diseño |
| spec-kit (bug extension + SDD + assess extension) instalado en el repo auditado | En dominios de código: siempre para diagnóstico (`bug.assess`) y corrección (`bug.fix`/`bug.test` o `tasks`/`implement`/`converge`); para el Motivo "Diseño o propuesta antes de construir" (Idea Assessment) — ver `skill/SKILL.md` y `GUIA_DE_INSTALACION_CURSOR_Y_CLAUDE_v1.0.md` de esta carpeta |

## Modo de emergencia

Si durante la ejecución aparece un hallazgo que representa un **riesgo activo en producción** (no una condición hipotética, algo que ya está causando daño), el Agente auditor notifica al Responsable de inmediato, en paralelo, sin esperar a terminar el informe completo — la auditoría sigue corriendo, pero ese hallazgo puntual no espera la consolidación final (paso 5) para reportarse.

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.1 |
| Fecha de aprobación v1.0 | 25/08/2026 |
| Fecha de esta revisión (v1.1) | 16/09/2026 |
| Aprobado por | Responsable Técnico |
| Qué cambió en v1.1 | Se envuelve el protocolo en una skill instalable (`skill/`) que delega diagnóstico y corrección en dominios de código a spec-kit (bug extension, SDD, assess extension); se agregan 2 reglas nuevas (gate de código antes del paso 6, test de regresión por hallazgo en el paso 7) y la dependencia de spec-kit. Ningún paso, criterio de salida ni regla existente de v1.0 se eliminó o contradijo |
| Próxima revisión | Tras cada auditoría realizada con este protocolo |
