---
name: auditoria-tecnica-polaria
description: Orquesta el Protocolo de Auditoría Técnica de Software y Workflows v1.1 de Polaria — desde que alguien pide verificar que algo "funciona bien" hasta el hallazgo marcado ✅ Resuelto. Úsala SIEMPRE que se pida auditar, verificar, revisar si algo funciona, diagnosticar un bug, o evaluar una propuesta antes de construirla — incluso si no se menciona "auditoría" por nombre (ej. "¿esto funciona?", "revisa X", "arreglé un bug, ¿qué le agrego de test?", "¿deberíamos construir esto?"). No la uses para ceremonias/gestión sin artefacto real que verificar, ni para redactar la corrección de un hallazgo ya confirmado (eso es `documentation-playbook-builder`, fuera del alcance de esta skill).
---

# Skill: Auditoría Técnica y Tests

Ejecuta, paso a paso, el `PROTOCOLO_DE_AUDITORIA_TECNICA_DE_SOFTWARE_Y_WORKFLOWS_v1.1.md` y la
extensión de dominio correspondiente (en `references/` y `references/EXTENSIONES_DOMINIO/` de
esta misma skill) — esos son la fuente de verdad de cada paso, regla, excepción y criterio de
salida. Esta skill es la capa de ejecución: qué agente/comando invocar en cada paso, cómo
delega en spec-kit, y el gate que bloquea código sin confirmación.

**Nota sobre numeración:** "Paso" aquí (1-8) es la numeración propia de esta skill — distinta
de los "Paso 1-7" del protocolo base y de los "Paso 1-N" de la sección 6 de cada extensión de
dominio. Los tres son sistemas de numeración paralelos e independientes; esta skill cita a
los otros dos explícitamente entre paréntesis para no mezclarlos.

**Instalación:** esta skill se distribuye como parte del plugin `auditoria-tecnica` del
marketplace `PolariaTech/polaria-agent-plugins` — se instala en el repo de código real con
`/plugin install auditoria-tecnica@polaria-agent-plugins` (Claude Code) o vía Team Marketplace
en Cursor (ver el `README.md` de ese repo). El plugin trae consigo los agentes de dominio
(`agents/`); sigue requiriendo spec-kit instalado por separado en el repo auditado
(`uv tool install specify-cli` → `specify init` si el repo no lo tiene → `specify extension add
bug` → `specify extension add assess`) — eso no lo instala este plugin, es un prerrequisito
externo. Sin spec-kit, esta skill queda inerte. La fuente de verdad de este contenido es
`PROTOCOLOS_NUEVOS/AUDITORIA/skill/` del repo de metodología; cualquier cambio se hace ahí y se
vuelve a publicar al plugin, nunca al revés.

## Antes de empezar

Si spec-kit (o su extensión `bug`/`assess`) no está instalado en el repo que se va a auditar,
detente y señálalo — no ejecutes manualmente lo que esas extensiones automatizan como
sustituto, eso reintroduciría exactamente los agentes que esta skill retiró (ver
`references/mapa_de_despacho_spec_kit.md`).

## Paso 1 — Levantamiento y alcance (Paso 1 y 2 del protocolo base)

Pide al Solicitante los 3 campos fijos del Paso 1 del protocolo base: **Sistema/artefacto**,
**Motivo** (Release / Cierre de épica / Sospecha puntual / Diseño o propuesta antes de
construir / Otro), **Dominio** (Workflow n8n / Base de datos / Agente IA / Integraciones /
Frontend / Backend / Metodología y Protocolos). No avances sin los 3 campos. Con el Dominio
declarado, lee la extensión de dominio correspondiente en
`references/EXTENSIONES_DOMINIO/<DOMINIO>/` (Paso 2 del protocolo base) — nunca un resumen, el
archivo completo.

## Bifurcación — Motivo "Diseño o propuesta antes de construir"

Si el Motivo declarado es este y el Dominio no es Metodología y Protocolos, esta skill
**no continúa** al resto de los pasos de abajo. En vez de eso:

1. Ejecuta `/speckit-assess-intake` con la propuesta como input, y sigue la cadena
   `research → define → shape → decide` de la extensión Idea Assessment de spec-kit.
2. El resultado es una decisión `go` / `clarify` / `stop` — regístrala y entrega el
   documento que produce esa cadena. El trabajo de esta skill termina aquí para este caso.
3. Si la decisión es `go` y el Solicitante quiere construirlo, redirige al Protocolo de
   Construcción de Producto desde Cero (`/speckit-specify` en adelante) — no lo ejecutes tú.

Para cualquier otro Motivo, o si el Dominio es Metodología y Protocolos (que no usa spec-kit
— ver su propia extensión), continúa al Paso 2.

## Paso 2 — Detectar candidatos (Paso 3 del protocolo base: mecánica de comité)

Según la sección 4/5 de la extensión de dominio ya leída, despacha el/los agente(s)
especializado(s) recomendados (comité en paralelo si hay más de uno, secuencial si el
dominio solo tiene un especialista — Bases de Datos). Cada agente genera **candidatos con
evidencia cruda** (escaneo, benchmark, request/response real, ejecución forzada) — ya no
redacta el hallazgo final, eso lo hace spec-kit en el Paso 3 de abajo.

Si el Dominio es Metodología y Protocolos, sigue en cambio el mecanismo propio de esa
extensión (Fases A/B/C/D descritas ahí) para el diagnóstico y la consolidación — no aplican
los Pasos 2-4 siguientes de esta skill. Tampoco aplican los Pasos 5-8: esa extensión declara
explícitamente que redactar la corrección de un hallazgo de texto es un paso posterior, fuera
de su alcance (cadena "Mejora el proceso de X" de `CLAUDE.md`), no el gate/implementación de
código de esta skill. El trabajo de esta skill para ese dominio termina en el informe
consolidado de esa extensión.

## Paso 3 — Diagnóstico spec-kit (Paso 4 del protocolo base, Fase B de la extensión)

Por cada candidato del Paso 2, ejecuta `/speckit.bug.assess` pasando la evidencia cruda como
input. Cada `assessment.md` resultante trae causa raíz + severidad + evidencia + remediación
propuesta — no reescribas ni resumas ese contenido, es el hallazgo formal. El veredicto está
calibrado por spec-kit: si la reproducción no se ejecutó de verdad, el hallazgo nunca se
marca con más confianza que 🔄 riesgo condicional.

## Paso 4 — Consolidación (Paso 5 del protocolo base)

Integra los `assessment.md` de todos los candidatos en la tabla de severidad fija del
protocolo base (Crítico / Alto / Medio / Bajo — en texto, salvo que el proyecto auditado ya
use el formato con emoji 🔴🟠🟡🟢 de `ESTADO.md` de este repo de metodología, como hace la
extensión de Metodología), cada fila con su columna Evidencia y su símbolo ✅/🔄/⚪, más la
sección "Qué no se pudo verificar" (nunca se omite).

## Paso 5 — GATE ⛔ (Paso 6 del protocolo base, reforzado)

Presenta la tabla consolidada al Responsable del proyecto/sistema auditado, junto con un plan
de corrección riguroso por cada hallazgo (qué cambia, en qué orden, cómo se revalida — no un
resumen vago). Pide confirmación explícita.

**Cero código se escribe sin esa confirmación — ni un solo dígito.** Esto es más estricto que
"ningún hallazgo pasa a Linear sin confirmación" (regla ya existente del protocolo base): aquí
ni siquiera se toca el código. Si el Responsable no confirma, el informe queda como está,
ningún hallazgo pasa a Linear, y esta skill termina aquí para ese hallazgo.

## Paso 6 — Implementación (Paso 7 del protocolo base, reforzado) — bifurca por tipo

Solo para hallazgos confirmados en el Paso 5:

- **Comportamiento roto:** ejecuta `/speckit.bug.fix` (mismo slug del assessment), y después
  `/speckit.bug.test`. El fix se mantiene dentro del alcance evaluado — si aparece evidencia
  que lo amplía, se registra como desviación explícita en `fix.md`, nunca se expande en
  silencio.
- **Funcionalidad faltante:** ejecuta `/speckit.tasks` → `/speckit.implement` →
  `/speckit.converge` (mismo patrón que ya usa el Protocolo de Construcción de Producto desde
  Cero). Repite `implement → converge` hasta que reporte "Converged".

En ambos casos, antes de cerrar el hallazgo confirma que existe un test de regresión propio
de ese hallazgo (bug corregido o funcionalidad agregada) — regla nueva del protocolo base v1.1,
sección 5.

## Paso 7 — Revalidar (Paso 7 del protocolo base)

Ejecuta el test de regresión del Paso 6, el caso original, y los casos vecinos (mismo
componente/nodo/tabla). El veredicto de `bug.test` (`verified`/`partial`/`failed`) nunca se
infla: si la reproducción no se ejecutó de verdad, el resultado es `partial`, no `verified`.

## Paso 8 — Cierre (Paso 7 del protocolo base)

Marca el hallazgo ✅ Resuelto con fecha y evidencia — nunca se borra. Los tres archivos
(`assessment.md`, `fix.md`, `test.md`, o el equivalente de tasks/implement/converge) quedan
juntos en `.specify/bugs/<slug>/` para trazabilidad — no se consolidan en un solo documento
propio, esa es la fuente de verdad ya nativa de spec-kit.

## Si el entorno no soporta subagentes nativos

Mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto y el resto de
`AUDITORIA/`: si no puedes despachar un agente especializado como subagente real, lee su
archivo igual y aplica sus instrucciones directamente en el hilo actual — el contenido del
agente no cambia, solo cómo se ejecuta. Esto no aplica a los comandos de spec-kit
(`/speckit.*`): esos son skills propias del repo auditado, se invocan tal cual una vez
instaladas.

## Restricciones

- Nunca marques un paso como completo sin su criterio de salida — están en el protocolo base,
  no se infieren.
- Nunca ejecutes manualmente lo que `bug.assess`/`bug.fix`/`bug.test` automatizan como
  sustituto de tenerlos instalados.
- Nunca escribas ni un carácter de código antes de la confirmación explícita del Paso 5.
- Nunca cierres un hallazgo de dominio de código sin su test de regresión propio.
- Nunca reportes un veredicto más confiado del que la evidencia sostiene (regla nativa de
  spec-kit, ya alineada con "nunca se acepta 'según el documento' como evidencia" del
  protocolo base).

## Verificación

Antes de dar por cerrado el trabajo de esta skill (Paso 8):

- [ ] Los 3 campos del Paso 1 están declarados y la extensión de dominio correspondiente fue
      leída completa.
- [ ] Si el Motivo era "Diseño o propuesta antes de construir": la cadena de Idea Assessment
      terminó en una decisión `go`/`clarify`/`stop` registrada.
- [ ] Cada candidato del Paso 2 tiene su `assessment.md` de `/speckit.bug.assess` — ninguno se
      reportó sin ese diagnóstico formal.
- [ ] El Responsable confirmó explícitamente antes de que se escribiera cualquier código.
- [ ] Cada hallazgo confirmado tiene su test de regresión propio, y su revalidación
      (`bug.test` o el equivalente) con veredicto no inflado.
- [ ] El hallazgo quedó marcado ✅ Resuelto con fecha y evidencia, nunca borrado.
