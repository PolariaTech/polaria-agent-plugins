# EXTENSIÓN DE DOMINIO — Frontend al Protocolo de Auditoría Técnica de Software y Workflows

*Polaria | Técnico — Extensión de dominio, define el Paso 2 (artefacto real) y el prompt operativo de ejecución para este dominio. No modifica ningún otro paso, regla o excepción del protocolo base.*

## 1. Alcance

Aplica cuando el Dominio declarado en el Paso 1 del protocolo base es **Frontend** (cualquier interfaz web que un usuario final opera directamente). Define qué cuenta como artefacto real, qué KPI se verifican, y el prompt operativo exacto que ejecuta el Agente auditor — sin dejar ningún paso a criterio propio.

## 2. Dimensiones de calidad y KPI

| Dimensión | KPI / umbral |
|---|---|
| Rendimiento (Core Web Vitals) | LCP ≤2.5s, INP ≤200ms, CLS <0.1 (percentil 75) |
| Accesibilidad | WCAG 2.2 nivel AA — contraste ≥4.5:1 (texto normal) / ≥3:1 (texto grande), navegable 100% por teclado |
| Compatibilidad | Funciona en los navegadores/dispositivos que el proyecto declare como soportados |
| Seguridad | 0 secretos/API keys expuestos en el bundle de producción; headers Content-Security-Policy y Strict-Transport-Security configurados; 0 vulnerabilidades de severidad alta/crítica sin resolver en dependencias (`npm audit` o equivalente) |

Un KPI incumplido se reporta como hallazgo con la severidad que corresponda según el Paso 5 del protocolo base — este KPI no reemplaza esa escala, la alimenta.

## 3. Artefacto real obligatorio (Paso 2 del protocolo base)

| Qué se audita | Artefacto real | Cómo se verifica |
|---|---|---|
| Rendimiento | La aplicación corriendo en un navegador real | Auditoría automatizada (Lighthouse o equivalente) + datos de campo si existen |
| Accesibilidad | La página ya renderizada en el navegador | Escaneo automatizado (axe-core o equivalente) + verificación manual de teclado |
| Compatibilidad | La aplicación cargada en cada navegador/dispositivo objetivo | Carga real y confirmación visual — nunca solo lectura de CSS/media queries |
| Seguridad | El bundle de producción real servido y los headers HTTP reales de la respuesta | Inspección directa del bundle y de los headers, nunca de la configuración declarada en el código fuente |

## 4. Agente especializado recomendado

- **Principal:** `testing-accessibility-auditor.md` + `testing-performance-benchmarker.md` — copiados en esta misma carpeta (fuente original: `D:\POLARIA\RECURSOS_CLAUDE\agency-agents-main\testing\`). Generan el candidato y la evidencia cruda (escaneo, benchmark); ya no redactan el hallazgo final.
- **Diagnóstico formal (reemplaza a `testing-evidence-collector.md`/`testing-reality-checker.md`, retirados de esta carpeta):** `/speckit.bug.assess` — spec-kit, bug extension, instalado en el repo auditado — toma la evidencia cruda de los agentes Principal como input y produce causa raíz + severidad + evidencia + remediación propuesta en un solo paso, con veredicto calibrado (nunca se infla sin reproducción real ejecutada).
- **Cómo usar estos archivos:** el Agente auditor lee el(los) archivo(s) de esta carpeta y usa su contenido como persona/system-prompt para ejecutar el Paso 5 (o el equivalente en el proyecto auditado); cada candidato que producen se formaliza después con `/speckit.bug.assess` — mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto para los 20 agentes de metodología. Nunca se improvisa la especialización sin leer el archivo primero.

## 5. Orquestación de agentes

Los 2 agentes de esta carpeta no se usan sueltos ni a discreción — trabajan en 3 fases fijas, en este orden:

| Fase | Agente(s) | Qué hace | Pasos de la Tarea (sección 6) que ejecuta |
|---|---|---|---|
| **Pre-fase** (secuencial, antes de todo) | Agente auditor (orquestador) | Determina las rutas críticas | Paso 1 |
| **A — Ejecución** (paralelo, comité — regla del Paso 3 del protocolo base: distintas lentes sobre el mismo artefacto) | `testing-performance-benchmarker.md` | Mide rendimiento/Core Web Vitals, genera candidatos con evidencia cruda | Pasos 2, 3, 4 |
| | `testing-accessibility-auditor.md` | Audita accesibilidad/WCAG/teclado, genera candidatos con evidencia cruda | Pasos 5, 6 |
| | Agente auditor (orquestador) | Verifica compatibilidad cross-browser | Paso 7 |
| | Agente auditor (orquestador) | Verifica seguridad del bundle de producción, headers HTTP y dependencias | Paso 8 |
| **B — Diagnóstico spec-kit** (secuencial, después de A) | `/speckit.bug.assess` (por candidato) | Toma la evidencia cruda de cada candidato de la Fase A y produce causa raíz + severidad + evidencia + remediación propuesta, con veredicto calibrado (sin reproducción real ejecutada, nunca pasa de 🔄) | No ejecuta pasos nuevos, formaliza los de A |
| **C — Consolidación final** (secuencial, después de B) | Agente auditor (orquestador) | Integra el resultado de los `assessment.md` de la Fase B en la tabla de severidad | Paso 9 |

La Fase A no empieza hasta que la Pre-fase entrega las rutas críticas por escrito. La Fase B no empieza hasta que la Fase A entrega TODOS sus candidatos (no se diagnostica a medias). Ningún hallazgo llega a la tabla de severidad del Paso 5 del protocolo base sin haber pasado por `/speckit.bug.assess`.

## 6. Prompt operativo (RECCAO)

- **Rol:** Eres el Agente auditor del Protocolo de Auditoría Técnica de Software y Workflows, ejecutando el dominio Frontend.
- **Contexto:** Sistema/artefacto: [declarado en Paso 1]. Motivo: [Release / Cierre de épica / Sospecha puntual / Otro].
- **Herramienta de referencia (declarar por escrito cuál se usó, nunca asumir sin decirlo):** Lighthouse para rendimiento, axe-core (o el escáner de accesibilidad integrado en Playwright) para accesibilidad. Si el proyecto ya usa otra herramienta equivalente, se usa esa y se declara el nombre exacto en el informe.
- **Tarea (en este orden exacto, sin saltar pasos, sin sustituir ninguno por "revisar el código"):**
  1. **[Agente auditor — Pre-fase]** Determinar las rutas críticas: las que el Solicitante declaró en el Paso 1. Si no las declaró, el Agente auditor las define como las páginas mínimas necesarias para completar la función principal del sistema de inicio a fin, y las escribe explícitamente en el informe antes de continuar.
  2. **[Performance Benchmarker — Fase A]** Para cada ruta crítica, ejecutar la herramienta de rendimiento con throttling de red/CPU activado. Si no se define una configuración específica, usar la que la herramienta trae por defecto y declarar por escrito cuál es esa configuración.
  3. **[Performance Benchmarker — Fase A]** Guardar el reporte completo generado (archivo JSON o HTML, no una captura del resumen) y adjuntarlo al hallazgo correspondiente — sin este archivo, el hallazgo no puede marcarse ✅.
  4. **[Performance Benchmarker — Fase A]** Preguntar al Solicitante si existen datos de campo reales (RUM/CrUX). Si existen, usar esos valores de LCP/INP/CLS. Si no existen o no se puede confirmar, usar el valor de laboratorio del paso 2 y marcar ese hallazgo con símbolo 🔄 (nunca ✅), indicando "valor de laboratorio, no de campo".
  5. **[Accessibility Auditor — Fase A]** Para cada ruta crítica, ejecutar la herramienta de accesibilidad sobre la página ya cargada y renderizada. Adjuntar el listado completo de violaciones con selector CSS y criterio WCAG de cada una.
  6. **[Accessibility Auditor — Fase A]** Recorrer a mano, sin mouse, usando solo Tab / Shift+Tab / Enter, el camino más corto para completar la función principal de cada ruta. En cada punto donde el foco se detiene, confirmar visualmente que hay un indicador de foco visible. Si algún control no se puede operar sin mouse, documentarlo aparte con símbolo ⚪ ("no verificable por teclado").
  7. **[Agente auditor — Fase A]** Determinar navegadores/dispositivos: los que el Solicitante declaró como soportados. Si no los declaró, usar exactamente estos tres: Chrome (última versión estable), Safari/WebKit (última versión estable), y una ventana de 390px de ancho. Para cada uno, cargar cada ruta crítica y confirmar visualmente que el contenido y la interacción principal funcionan.
  8. **[Agente auditor — Fase A]** Inspeccionar el bundle de producción real (el build servido, nunca el código fuente) y confirmar que no contiene secretos ni API keys expuestas. Revisar los headers HTTP reales de la respuesta y confirmar que Content-Security-Policy y Strict-Transport-Security están configurados. Ejecutar `npm audit` (o el equivalente del gestor de paquetes que use el proyecto) y adjuntar el reporte completo, marcando como hallazgo cualquier vulnerabilidad de severidad alta o crítica sin resolver.
  9. **[spec-kit bug.assess → Agente auditor — Fases B, C]** Cada candidato de los pasos 2-8 se formaliza con `/speckit.bug.assess` (Fase B), produciendo causa raíz + severidad + evidencia + remediación con veredicto calibrado; el Agente auditor consolida los `assessment.md` resultantes en la tabla de severidad del Paso 5 del protocolo base (Fase C).
- **Restricciones:**
  - Nunca ejecutar contra producción sin autorización explícita del Responsable.
  - Nunca reportar un KPI citando solo el score compuesto (0-100) de la herramienta — siempre la métrica individual exacta.
  - Si un paso no se puede ejecutar tal como está escrito, se declara ⚪ no verificable con el motivo exacto — nunca se reemplaza en silencio por otra forma de verificación.
  - Ningún hallazgo se reporta sin su archivo de evidencia adjunto citado por nombre.
  - Ningún hallazgo se convierte en issue de Linear sin confirmación del Responsable.
- **Audiencia:** Responsable del proyecto/sistema auditado.
- **Output esperado:** Tabla de severidad consolidada (formato del Paso 5) + sección "Qué no se pudo verificar", cada fila enlazada al archivo de evidencia, con la herramienta/agente exacto usado declarado al inicio.

## Versión y revisión

| Campo | Valor |
|---|---|
| Versión | v1.1 |
| Depende de | Protocolo de Auditoría Técnica de Software y Workflows v1.1 |
| Fecha de aprobación v1.0 | 25/08/2026 |
| Fecha de esta revisión (v1.1) | 16/09/2026 |
| Aprobado por | Responsable Técnico |
| Qué cambió en v1.1 | El diagnóstico y la formalización de hallazgos (antes Fases B/C con `testing-evidence-collector.md`/`testing-reality-checker.md`) se delegan en `/speckit.bug.assess`; los 2 archivos genéricos se retiraron de esta carpeta. Los agentes Principal no cambian de función, solo de destino (alimentan a spec-kit en vez de redactar el hallazgo final) |
| Próxima revisión | Con cada cambio de versión del protocolo base, o tras una auditoría real ejecutada con esta extensión específica — lo que ocurra primero |
