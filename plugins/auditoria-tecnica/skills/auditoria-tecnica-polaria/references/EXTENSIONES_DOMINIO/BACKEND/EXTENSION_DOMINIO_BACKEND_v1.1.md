# EXTENSIÓN DE DOMINIO — Backend al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y el prompt operativo de ejecución para este dominio. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Backend** (API/servicio que no es visto directamente por el usuario final). Define qué cuenta como artefacto real, qué KPI se verifican, y el prompt operativo exacto que ejecuta el Agente auditor.

## 2. Dimensiones de calidad y KPI

| Dimensión | KPI / umbral |
|---|---|
| Rendimiento | Latencia p95 bajo el umbral que el proyecto defina como aceptable |
| Confiabilidad | Tasa de error <1%; disponibilidad objetivo (SLO) declarada por el proyecto |
| Corrección funcional | 100% de endpoints externos con test de contrato pasando |
| Seguridad | Sin hallazgos abiertos del checklist OWASP API Security Top 10 (edición 2023) aplicable al nivel de riesgo del proyecto; ver también OWASP ASVS v5.0 para lo que el Top 10 no cubre (autenticación, gestión de sesión, criptografía, lógica de negocio) |

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Comportamiento del endpoint | Ejecución real de la llamada (no lectura del código del handler) | Request/response real contra el entorno de desarrollo |
| Rendimiento bajo carga | Ejecución real con tráfico simulado | Prueba de carga controlada, nunca estimación teórica |
| Seguridad | Comportamiento real ante entradas adversarias | Ejecución real de cada ítem del checklist OWASP, no lectura de código de validación |

## 4. Agente especializado recomendado

- **Principal:** `testing-api-tester.md` + `engineering-security-engineer.md` — copiados en esta misma carpeta (también ya instalados en AWS/MIGRACION_AWS, MATEO_SUPPORT y PDF-GENERATOR).
- **Marco de referencia primario de seguridad:** OWASP API Security Top 10 (edición 2023) — los KPI de las secciones 2 y 6 citan directamente sus categorías. **Marco complementario:** OWASP ASVS v5.0, para verificaciones de autenticación, gestión de sesión, criptografía y lógica de negocio que el Top 10 no cubre directamente; no se exige ejecutar las ~350 verificaciones completas, se usa como referencia ante cualquier hallazgo que no encaje en las categorías del Top 10.
- **Diagnóstico formal (reemplaza a `testing-evidence-collector.md`/`testing-reality-checker.md`, retirados de esta carpeta):** `/speckit.bug.assess` — spec-kit, bug extension, instalado en el repo auditado — toma la evidencia cruda de `testing-api-tester.md`/`engineering-security-engineer.md` como input y produce causa raíz + severidad + evidencia + remediación propuesta en un solo paso, con veredicto calibrado (nunca se infla sin reproducción real ejecutada).
- **Cómo usar estos archivos:** el Agente auditor lee el(los) archivo(s) de esta carpeta y usa su contenido como persona/system-prompt para ejecutar la auditoría; cada candidato que producen se formaliza después con `/speckit.bug.assess` — mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto. Nunca se improvisa la especialización sin leer el archivo primero.

## 5. Orquestación de agentes

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial) | Agente auditor (orquestador) | Determina los endpoints a auditar | Paso 1 |
| **A — Ejecución** (paralelo, comité — regla del Paso 3 del protocolo base) | `testing-api-tester.md` | Prueba de contrato y de carga, genera candidatos con evidencia cruda | Pasos 2, 3 |
| | `engineering-security-engineer.md` | Checklist OWASP API + fallos forzados, genera candidatos con evidencia cruda | Pasos 4, 5 |
| **B — Diagnóstico spec-kit** (secuencial, después de A) | `/speckit.bug.assess` (por candidato) | Produce causa raíz + severidad + evidencia + remediación por candidato, con veredicto calibrado | No ejecuta pasos nuevos, formaliza los de A |
| **C — Consolidación final** | Agente auditor (orquestador) | Integra el resultado de los `assessment.md` de la Fase B en la tabla de severidad | Paso 6 |

La Fase A no empieza hasta que la Pre-fase entrega la lista de endpoints por escrito. Ningún hallazgo llega a la tabla de severidad sin pasar por `/speckit.bug.assess`.

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Backend.
- **Contexto:** Sistema/artefacto: [declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó):** herramienta de pruebas de API/carga que el proyecto ya use. Si no hay una definida, usar cualquier cliente HTTP scriptable (ej. una colección de requests ejecutable) y declarar exactamente cuál.
- **Tarea (en este orden exacto, sin saltar pasos, sin sustituir ninguno por "leer el código del endpoint"):**
  1. **[Agente auditor — Pre-fase]** Determinar los endpoints a auditar: los que el Solicitante declaró en el Paso 1. Si no los declaró, usar todos los endpoints expuestos externamente listados en el contrato de la API (OpenAPI/Swagger o equivalente); si no existe contrato documentado, extraerlos directamente del router/código real del servicio — nunca inventar ni asumir la lista, y declarar por escrito de dónde salió.
  2. **[API Tester — Fase A]** Para cada endpoint del paso 1, ejecutar la llamada real y comparar el schema de la respuesta contra el contrato documentado. Adjuntar la respuesta real y, si hay discrepancia, el contrato citado en el mismo hallazgo.
  3. **[API Tester — Fase A]** Para cada endpoint crítico (los del flujo principal), ejecutar una prueba de carga con al menos 3 niveles: 1x, 5x y 10x el tráfico normal que el Solicitante declare. Si no declara un tráfico normal, usar 10, 50 y 100 solicitudes concurrentes como default y declararlo por escrito. Registrar latencia p95 y tasa de error de cada nivel, adjuntando el reporte crudo de la herramienta.
  4. **[Security Engineer — Fase A]** Ejecutar contra cada endpoint crítico el checklist OWASP API Security Top 10 (edición 2023): autorización rota a nivel de objeto (BOLA/IDOR), autenticación rota, autorización rota a nivel de propiedad de objeto, consumo de recursos sin restricción, autorización rota a nivel de función, acceso sin restricción a flujos de negocio sensibles, **Server-Side Request Forgery (SSRF)**, configuración de seguridad incorrecta, gestión de inventario de APIs, y **consumo inseguro de APIs de terceros (Unsafe Consumption of APIs)** — este último ítem es obligatorio siempre que el endpoint consuma una API externa o de otro sistema interno (n8n, Integraciones). Cada ítem se marca explícitamente ✅/🔄/⚪ con la evidencia de la ejecución que lo sostiene — ningún ítem se omite en silencio.
  5. **[Security Engineer — Fase A]** Forzar al menos un caso de fallo real por endpoint crítico (token inválido, payload malformado, o timeout simulado de un servicio dependiente) y confirmar que la respuesta de error tiene el código correcto y no expone información interna (stack trace, ruta de archivo, credenciales) en el cuerpo del mensaje.
  6. **[spec-kit bug.assess → Agente auditor — Fases B, C]** Cada candidato de los pasos 2-5 se formaliza con `/speckit.bug.assess` (Fase B); el Agente auditor consolida los `assessment.md` resultantes en la tabla de severidad del Paso 5 del protocolo base (Fase C).
- **Restricciones:**
  - Nunca ejecutar pruebas de carga ni casos de fallo forzado contra producción sin autorización explícita del Responsable.
  - Nunca marcar un ítem del checklist OWASP como cumplido sin la evidencia específica (request/response real) que lo sostiene.
  - Ningún hallazgo se convierte en issue de Linear sin confirmación del Responsable.
- **Audiencia:** Responsable del proyecto/sistema auditado.
- **Output esperado:** Tabla de severidad consolidada + sección "Qué no se pudo verificar", cada fila enlazada a su evidencia, con la herramienta usada declarada al inicio del informe.

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
