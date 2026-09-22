---
name: auditoria-tecnica-polaria
description: Orquesta el Protocolo de Auditoría Técnica de Software y Workflows v1.2 de Polaria — desde que alguien pide verificar que algo "funciona bien" hasta el hallazgo marcado ✅ Resuelto tras revalidar la corrección que hizo otro. Úsala SIEMPRE que se pida auditar, verificar, revisar si algo funciona, diagnosticar un bug, revalidar una corrección ya hecha, o evaluar una propuesta antes de construirla — incluso si no se menciona "auditoría" por nombre (ej. "¿esto funciona?", "revisa X", "¿por qué falla Y?", "ya corregí el hallazgo, revalídalo", "¿deberíamos construir esto?"). No la uses para corregir un hallazgo ni para escribir sus pruebas (eso lo hace el dev y lo revisa `gate-calidad-tecnica-pre-merge-polaria` antes del push), ni para ceremonias/gestión sin artefacto real que verificar, ni para redactar la corrección de un hallazgo de texto (eso es `documentation-playbook-builder`).
---

# Skill: Auditoría Técnica

Ejecuta, paso a paso, el `PROTOCOLO_DE_AUDITORIA_TECNICA_DE_SOFTWARE_Y_WORKFLOWS_v1.2.md` y la
extensión de dominio correspondiente (en `references/` y `references/EXTENSIONES_DOMINIO/` de
esta misma skill) — esos son la fuente de verdad de cada paso, regla, excepción y criterio de
salida. Esta skill es la capa de ejecución: qué agente/comando
invocar en cada paso y cómo delega el diagnóstico en spec-kit. **Audita, no corrige:** nunca
escribe código ni pruebas (regla del protocolo base v1.2, sección 5).

**Nota sobre numeración:** "Paso" aquí (1-7) es la numeración propia de esta skill — distinta
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

Si el Dominio es de código (todos salvo Metodología y Protocolos, que no usa spec-kit) y
spec-kit (o su extensión `bug`/`assess`) no está instalado en el repo que se va a auditar,
detente después del Paso 1 y señálalo — no ejecutes manualmente lo que esas extensiones automatizan como
sustituto, eso reintroduciría exactamente los agentes que esta skill retiró (ver
`references/mapa_de_despacho_spec_kit.md`).

Si lo que piden es revalidar una corrección ya hecha sobre un hallazgo existente, salta
directo al Paso 6.

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
redacta el hallazgo final, eso lo hace spec-kit en el Paso 3 de abajo. Que estos agentes
ejecuten pruebas (carga, contrato, fallos forzados) es auditar contra el artefacto real, no
escribir pruebas del producto: lo que ejecutan no se agrega al repo auditado.

Si el Dominio es Metodología y Protocolos, sigue en cambio el mecanismo propio de esa
extensión (Fases A/B/C/D descritas ahí) para el diagnóstico y la consolidación — no aplican
los Pasos 3-7 siguientes de esta skill. Redactar la corrección de un hallazgo de texto es un
paso posterior, fuera de su alcance (cadena "Mejora el proceso de X" de `CLAUDE.md`). El
trabajo de esta skill para ese dominio termina en el informe consolidado de esa extensión.

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

## Paso 5 — Presentar y entregar (Paso 6 del protocolo base)

Presenta la tabla consolidada al Responsable del proyecto/sistema auditado y pide que
confirme por escrito qué hallazgos se accionan y en qué orden. Solo con esa confirmación
crea el issue de Linear de cada hallazgo confirmado (tipo Bug si es comportamiento roto,
Feature/Improvement si es funcionalidad faltante), enlazando su `assessment.md` — la
remediación propuesta ahí es el punto de partida del dev, no un plan que esta skill ejecute.

Aquí termina el trabajo de esta skill para ese hallazgo hasta que exista una corrección. La
corrección la hace un dev fuera de esta skill (spec-kit `bug.fix` o `tasks`/`implement`, a su
criterio) y pasa por `gate-calidad-tecnica-pre-merge-polaria` antes del `push`, que es donde
se exigen las pruebas de la corrección, incluido el test de regresión propio si el
hallazgo es un Bug (criterio 6 de ese gate).

## Paso 6 — Revalidar (Paso 7 del protocolo base)

Cuando el dev avisa que la corrección está lista, ejecuta con ejecución real: el caso
original del `assessment.md`, los casos vecinos (mismo componente/nodo/tabla), y, si el
hallazgo era un Bug, el test de regresión que el gate exigió. Si la reproducción no se pudo ejecutar de verdad, el resultado
es parcial, no resuelto. Si la corrección resulta incorrecta, documéntala como hallazgo
nuevo derivado y vuelve al Paso 3 sobre ese hallazgo (Excepciones del protocolo base).

## Paso 7 — Cierre (Paso 7 del protocolo base)

Marca el hallazgo ✅ Resuelto con fecha y evidencia de la revalidación — nunca se borra. El
`assessment.md` queda en `.specify/bugs/<slug>/` junto a lo que haya generado la corrección
del dev, para trazabilidad.

## Si el entorno no soporta subagentes nativos

Mismo mecanismo de respaldo que ya usa `CLAUDE.md` de este proyecto y el resto de
`AUDITORIA/`: si no puedes despachar un agente especializado como subagente real, lee su
archivo igual y aplica sus instrucciones directamente en el hilo actual — el contenido del
agente no cambia, solo cómo se ejecuta. Esto no aplica a los comandos de spec-kit
(`/speckit.*`): esos son skills propias del repo auditado, se invocan tal cual una vez
instaladas.

## Restricciones

- NUNCA escribas ni modifiques código ni pruebas del repo auditado, ni siquiera después de la
  confirmación del Paso 5 — ni ejecutes `bug.fix`, `tasks` ni `implement`. Si te lo piden,
  explica que la corrección la hace el dev y la revisa el gate pre-merge.
- NUNCA marques un paso como completo sin su criterio de salida — están en el protocolo base,
  no se infieren.
- NUNCA ejecutes manualmente lo que `bug.assess` automatiza como sustituto de tenerlo
  instalado.
- NUNCA crees un issue de Linear sin la confirmación escrita del Responsable (Paso 5).
- NUNCA marques ✅ Resuelto sin la revalidación del Paso 6 con ejecución real.
- NUNCA reportes un veredicto más confiado del que la evidencia sostiene (regla nativa de
  spec-kit, ya alineada con "nunca se acepta 'según el documento' como evidencia" del
  protocolo base).

## Verificación

Antes de dar por cerrado el trabajo de esta skill:

- [ ] Los 3 campos del Paso 1 están declarados y la extensión de dominio correspondiente fue
      leída completa.
- [ ] Si el Motivo era "Diseño o propuesta antes de construir": la cadena de Idea Assessment
      terminó en una decisión `go`/`clarify`/`stop` registrada.
- [ ] Cada candidato del Paso 2 tiene su `assessment.md` de `/speckit.bug.assess` — ninguno se
      reportó sin ese diagnóstico formal.
- [ ] Ningún issue de Linear se creó sin confirmación escrita del Responsable.
- [ ] Esta skill no escribió ni una línea de código ni de pruebas del repo auditado.
- [ ] Cada hallazgo cerrado tiene revalidación con ejecución real (caso original + vecinos +
      test de regresión si era un Bug) y quedó marcado ✅ Resuelto con fecha y evidencia, nunca borrado.
