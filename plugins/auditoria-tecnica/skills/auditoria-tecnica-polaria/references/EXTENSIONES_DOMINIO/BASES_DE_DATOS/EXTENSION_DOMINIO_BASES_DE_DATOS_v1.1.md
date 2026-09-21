# EXTENSIÓN DE DOMINIO — Bases de Datos al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y el prompt operativo de ejecución para este dominio. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Base de datos**. Define qué cuenta como artefacto real, qué KPI se verifican, y el prompt operativo exacto que ejecuta el Agente auditor.

## 2. Dimensiones de calidad y KPI

| Dimensión | KPI / umbral |
|---|---|
| Integridad | 0 violaciones de integridad referencial/constraints en el catálogo vivo |
| Rendimiento | Tiempo de query p95 bajo el umbral del proyecto; sin queries sin índice en rutas críticas |
| Seguridad | 100% de tablas con datos sensibles cubiertas por política de acceso (RLS o equivalente) |
| Calidad de datos | 0 inconsistencias entre lo que exige el código y lo que permite el schema, en la muestra verificada |

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Schema y estructura | Catálogo vivo de la base (`information_schema`/`pg_catalog` o equivalente del motor) | Consulta SQL directa — nunca un diagrama ERD o diccionario de datos |
| Salud y rendimiento | Estadísticas en vivo + herramienta de advisors de la plataforma | Se ejecuta la herramienta, no se asume por el schema declarado |
| Datos reales | Consulta directa a las tablas relevantes | Muestra real de registros, nunca se asume el estado de los datos por el código |

## 4. Agente especializado recomendado

- **Principal:** `engineering-database-optimizer.md` — copiado en esta misma carpeta (específico para Postgres/Supabase; también ya instalado en AWS/MIGRACION_AWS y MATEO_SUPPORT).
- **Diagnóstico formal (reemplaza a `testing-evidence-collector.md`/`testing-reality-checker.md`, retirados de esta carpeta):** `/speckit.bug.assess` — spec-kit, bug extension, instalado en el repo auditado — toma la evidencia cruda de `engineering-database-optimizer.md` como input y produce causa raíz + severidad + evidencia + remediación propuesta en un solo paso, con veredicto calibrado (nunca se infla sin reproducción real ejecutada).
- **Cómo usar estos archivos:** el Agente auditor lee el(los) archivo(s) de esta carpeta y usa su contenido como persona/system-prompt para ejecutar la auditoría; cada candidato que produce se formaliza después con `/speckit.bug.assess` — mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto. Nunca se improvisa la especialización sin leer el archivo primero.

## 5. Orquestación de agentes

Este dominio tiene un solo especialista de dominio — no aplica comité paralelo (regla del Paso 3 del protocolo base: sin varias lentes distintas, no hay nada que correr en paralelo). La orquestación es secuencial:

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial) | Agente auditor (orquestador) | Obtiene el catálogo vivo y determina las tablas críticas | Pasos 1, 2 |
| **A — Ejecución** (secuencial, un solo especialista) | `engineering-database-optimizer.md` | Verifica integridad, rendimiento y calidad de datos; genera candidatos con evidencia cruda | Pasos 3, 4, 5, 6 |
| **B — Diagnóstico spec-kit** (secuencial, después de A) | `/speckit.bug.assess` (por candidato) | Produce causa raíz + severidad + evidencia + remediación por candidato, con veredicto calibrado | No ejecuta pasos nuevos, formaliza los de A |
| **C — Consolidación final** | Agente auditor (orquestador) | Integra el resultado de los `assessment.md` de la Fase B en la tabla de severidad | Paso 7 |

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Bases de Datos.
- **Contexto:** Sistema/artefacto: [declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó):** consulta SQL directa contra el catálogo del motor real (`information_schema`, `pg_catalog`, `pg_policies`, `pg_stat_*` para Postgres/Supabase, o el equivalente del motor que use el proyecto) + la herramienta de advisors de la plataforma si existe.
- **Tarea (en este orden exacto, sin saltar pasos, sin sustituir ninguno por "leer el diagrama o el código del ORM"):**
  1. **[Agente auditor — Pre-fase]** Obtener el catálogo vivo de la base mediante consulta directa — nunca un diagrama ERD ni la definición del ORM en el código como sustituto.
  2. **[Agente auditor — Pre-fase]** Determinar las tablas críticas: las que el Solicitante declaró en el Paso 1. Si no las declaró, usar las tablas referenciadas por los endpoints/flujos críticos ya identificados en una auditoría de Backend previa sobre el mismo sistema, si existe; si no existe, usar las tablas con datos marcados como sensibles por el proyecto o con mayor volumen de registros, y declarar por escrito ese criterio.
  3. **[Database Optimizer — Fase A]** Para cada tabla crítica, verificar mediante consulta directa: llaves foráneas con índice correspondiente, constraints de integridad activos (NOT NULL, UNIQUE, CHECK según lo que el proyecto declare como esperado), y si contiene datos sensibles, que tenga una política de acceso (RLS o equivalente) activa — no basta con que exista, se confirma que está habilitada.
  4. **[Database Optimizer — Fase A]** Ejecutar la herramienta de advisors/diagnóstico de la plataforma, si existe, y adjuntar el resultado completo (no un resumen propio).
  5. **[Database Optimizer — Fase A]** Identificar las 5 consultas más lentas si hay telemetría real disponible; si no la hay, ejecutar el análisis de plan de ejecución (tipo EXPLAIN ANALYZE) sobre las consultas del flujo crítico ya identificado, y verificar que usan índice. Adjuntar el plan de ejecución real de cada una.
  6. **[Database Optimizer — Fase A]** Tomar una muestra de al menos 20 registros (o el 1% de la tabla, lo que sea mayor) de cada tabla crítica y confirmar que no hay valores que violen una regla que el código de la aplicación asume pero el schema no fuerza (ej. un campo que el backend siempre espera no vacío pero la columna permite NULL).
  7. **[spec-kit bug.assess → Agente auditor — Fases B, C]** Cada candidato de los pasos 3-6 se formaliza con `/speckit.bug.assess` (Fase B); el Agente auditor consolida los `assessment.md` resultantes en la tabla de severidad del Paso 5 del protocolo base (Fase C).
- **Restricciones:**
  - Nunca ejecutar consultas de escritura, actualización o borrado durante la auditoría — es de solo lectura.
  - Nunca asumir el estado de los datos o del schema por lo que dice el código de la aplicación o el ORM — siempre consulta directa contra el catálogo real.
  - Ningún hallazgo se convierte en issue de Linear sin confirmación del Responsable.
- **Audiencia:** Responsable del proyecto/sistema auditado.
- **Output esperado:** Tabla de severidad consolidada + sección "Qué no se pudo verificar", cada fila enlazada a la consulta/resultado real que la sostiene.

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.1 |
| Depende de | Protocolo de Auditoría Técnica de Software y Workflows v1.1 |
| Fecha de aprobación v1.0 | 25/08/2026 |
| Fecha de esta revisión (v1.1) | 16/09/2026 |
| Aprobado por | Responsable Técnico |
| Qué cambió en v1.1 | El diagnóstico y la formalización de hallazgos se delegan en `/speckit.bug.assess`; `testing-evidence-collector.md`/`testing-reality-checker.md` se retiraron de esta carpeta. El agente Principal no cambia de función, solo de destino |
| Próxima revisión | Con cada cambio de versión del protocolo base, o tras una auditoría real ejecutada con esta extensión específica — lo que ocurra primero |
