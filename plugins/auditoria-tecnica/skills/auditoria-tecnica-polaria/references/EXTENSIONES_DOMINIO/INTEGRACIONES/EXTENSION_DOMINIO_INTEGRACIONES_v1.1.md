# EXTENSIÓN DE DOMINIO — Integraciones al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y el prompt operativo de ejecución para este dominio. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Integraciones** (comunicación entre dos o más sistemas, propios o de terceros). Define qué cuenta como artefacto real, qué KPI se verifican, y el prompt operativo exacto que ejecuta el Agente auditor.

## 2. Dimensiones de calidad y KPI

| Dimensión | KPI / umbral |
|---|---|
| Corrección end-to-end | 100% del flujo principal ejecutado real entre los sistemas integrados, no simulado por partes |
| Resiliencia a fallos | Todos los casos de fallo esperado (timeout, error de la API externa) probados con fallo forzado real |
| Propagación | Tiempo de propagación de un evento entre sistemas dentro del umbral que el proyecto declare |
| Gestión de secretos | 0 credenciales de terceros hardcodeadas o expuestas en logs/JSON exportado; todas con mecanismo de rotación conocido |

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Comportamiento del flujo completo | Ejecución real end-to-end entre los sistemas integrados | Nunca se valida leyendo el código de cada lado por separado |
| Manejo de fallos | Simulación real de un fallo (timeout, error de la API externa) | Se fuerza el caso de fallo, no se asume el comportamiento por el código de manejo de errores |
| Gestión de secretos | Configuración real de credenciales del sistema integrado | Inspección directa de dónde y cómo se almacenan (variable de entorno, vault, hardcodeado), nunca por la documentación |

## 4. Agente especializado recomendado

- **Principal:** `testing-api-tester.md` + `cloud-production-readiness-reviewer.md` — copiados en esta misma carpeta (también ya instalados en varios proyectos y en AWS/MIGRACION_AWS, para integraciones que cruzan infraestructura cloud).
- **Diagnóstico formal (reemplaza a `testing-evidence-collector.md`/`testing-reality-checker.md`, retirados de esta carpeta):** `/speckit.bug.assess` — spec-kit, bug extension, instalado en el repo auditado — toma la evidencia cruda de `testing-api-tester.md`/`cloud-production-readiness-reviewer.md` como input y produce causa raíz + severidad + evidencia + remediación propuesta en un solo paso, con veredicto calibrado (nunca se infla sin reproducción real ejecutada).
- **Cómo usar estos archivos:** el Agente auditor lee el(los) archivo(s) de esta carpeta y usa su contenido como persona/system-prompt para ejecutar la auditoría; cada candidato que producen se formaliza después con `/speckit.bug.assess` — mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto. Nunca se improvisa la especialización sin leer el archivo primero.

## 5. Orquestación de agentes

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial) | Agente auditor (orquestador) | Determina el flujo de integración crítico | Paso 1 |
| **A — Ejecución** (paralelo, comité — regla del Paso 3 del protocolo base) | `testing-api-tester.md` | Ejecuta el flujo real end-to-end y fuerza fallos, confirmando backoff exponencial y circuit breaker; genera candidatos con evidencia cruda | Pasos 2, 3 |
| | `cloud-production-readiness-reviewer.md` | Verifica gestión de secretos, mide propagación real y evalúa la readiness de infraestructura involucrada; genera candidatos con evidencia cruda | Pasos 4, 5 |
| **B — Diagnóstico spec-kit** (secuencial, después de A) | `/speckit.bug.assess` (por candidato) | Produce causa raíz + severidad + evidencia + remediación por candidato, con veredicto calibrado | No ejecuta pasos nuevos, formaliza los de A |
| **C — Consolidación final** | Agente auditor (orquestador) | Integra el resultado de los `assessment.md` de la Fase B en la tabla de severidad | Paso 6 |

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Integraciones.
- **Contexto:** Sistema/artefacto: [declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó):** ejecución real del flujo completo (cliente HTTP scriptable, herramienta de ejecución de workflow, o la que el proyecto ya use). Nunca lectura de código como sustituto de ejecución.
- **Tarea (en este orden exacto, sin saltar pasos, sin sustituir ninguno por "revisar el código de cada lado por separado"):**
  1. **[Agente auditor — Pre-fase]** Determinar el flujo de integración crítico: el que el Solicitante declaró en el Paso 1. Si no lo declaró, usar el camino completo desde el sistema origen hasta el sistema destino que un usuario real dispara con más frecuencia, y declarar por escrito ese criterio.
  2. **[API Tester — Fase A]** Ejecutar el flujo completo real de punta a punta al menos 3 veces, adjuntando el ID o log de cada una de las 3 ejecuciones.
  3. **[API Tester — Fase A]** Para cada punto de fallo posible del flujo (timeout del sistema externo, error 4xx/5xx, respuesta malformada), forzar ese fallo real y confirmar el comportamiento de reintento/recuperación configurado, distinguiendo específicamente si el reintento usa backoff exponencial (no reintento inmediato en bucle) y si existe un mecanismo de circuit breaker que aísle el fallo tras N intentos fallidos en vez de seguir reintentando indefinidamente contra el sistema caído. Adjuntar evidencia de cada caso forzado — no se asume el comportamiento por el código de manejo de errores.
  4. **[Cloud Production Readiness Reviewer — Fase A]** Inspeccionar directamente dónde están almacenadas las credenciales del sistema externo (variable de entorno, vault/gestor de secretos, o hardcodeado en el código/JSON exportado) y confirmar que ninguna aparece expuesta en logs, en el JSON exportado del workflow, o en el repositorio de código. Si existe un mecanismo de rotación, confirmar que está activo; si no existe, reportarlo como hallazgo. Adjuntar evidencia directa (no descripción) de dónde vive cada credencial.
  5. **[Cloud Production Readiness Reviewer — Fase A]** Medir el tiempo de propagación real de un evento entre los dos sistemas (desde que ocurre en el origen hasta que se refleja en el destino) usando los timestamps reales de la ejecución. Si el proyecto declaró un umbral objetivo, comparar contra ese umbral; si no lo declaró, reportar el dato medido sin comparar contra un objetivo y señalarlo explícitamente en "Qué no se pudo verificar".
  6. **[spec-kit bug.assess → Agente auditor — Fases B, C]** Cada candidato de los pasos 2-5 se formaliza con `/speckit.bug.assess` (Fase B); el Agente auditor consolida los `assessment.md` resultantes en la tabla de severidad del Paso 5 del protocolo base (Fase C).
- **Restricciones:**
  - Nunca ejecutar contra producción sin autorización explícita del Responsable.
  - Nunca validar una integración leyendo el código de cada lado por separado — siempre ejecución real end-to-end.
  - Ningún hallazgo se convierte en issue de Linear sin confirmación del Responsable.
- **Audiencia:** Responsable del proyecto/sistema auditado.
- **Output esperado:** Tabla de severidad consolidada + sección "Qué no se pudo verificar", cada fila enlazada al ID/log de ejecución que la sostiene.

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.1 |
| Depende de | Protocolo de Auditoría Técnica de Software y Workflows v1.1 |
| Fecha de aprobación v1.0 | 25/08/2026 |
| Fecha de esta revisión (v1.1) | 16/09/2026 |
| Aprobado por | Responsable Técnico |
| Qué cambió en v1.1 | El diagnóstico y la formalización de hallazgos se delegan en `/speckit.bug.assess`; `testing-evidence-collector.md`/`testing-reality-checker.md` se retiraron de esta carpeta. Los agentes Principal no cambian de función, solo de destino |
| Próxima revisión | Con cada cambio de versión del protocolo base, o tras una auditoría real ejecutada con esta extensión específica — lo que ocurra primero |
