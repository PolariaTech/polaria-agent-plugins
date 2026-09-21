# Mapa de despacho a spec-kit

Referencia operativa de `SKILL.md` (Pasos 2-3 y bifurcación de Motivo). No es un resumen del
protocolo ni de las extensiones de dominio — es una tabla de consulta rápida para decidir a
qué agente y a qué comando de spec-kit despachar cada caso, sin tener que releer las 7
extensiones completas cada vez.

## Por Dominio (Paso 2 — detectar candidatos)

| Dominio | Agente(s) especializado(s) (generan candidato + evidencia cruda) | Diagnóstico formal |
|---|---|---|
| Frontend | `testing-accessibility-auditor.md` + `testing-performance-benchmarker.md` | `/speckit.bug.assess` |
| Backend | `testing-api-tester.md` + `engineering-security-engineer.md` | `/speckit.bug.assess` |
| Bases de Datos | `engineering-database-optimizer.md` (único, sin comité) | `/speckit.bug.assess` |
| Workflow n8n | `specialized-workflow-architect.md` + `automation-governance-architect.md` | `/speckit.bug.assess` |
| Agente IA | `agentic-identity-trust.md` + `identity-graph-operator.md` | `/speckit.bug.assess` |
| Integraciones | `testing-api-tester.md` + `cloud-production-readiness-reviewer.md` | `/speckit.bug.assess` |
| Metodología y Protocolos | Los 20 agentes de `.claude/agents/` de este proyecto, según `CLAUDE.md` | Mecanismo propio (Fases A-D de su extensión) — **no usa spec-kit** |

## Por tipo de hallazgo confirmado (Paso 6 — implementación)

| Tipo de hallazgo | Comandos de spec-kit | Veredicto/salida |
|---|---|---|
| Comportamiento roto (algo que ya existe y falla) | `/speckit.bug.fix` (slug) → `/speckit.bug.test` (slug) | `verified` / `partial` / `failed` — nunca se infla sin reproducción real |
| Funcionalidad faltante (no existe, hay que construirla) | `/speckit.tasks` → `/speckit.implement` → `/speckit.converge` (repetir hasta "Converged") | "Converged" o lista de pendientes |

## Por Motivo declarado (Paso 1, bifurcación)

| Motivo | Proceso de spec-kit | Notas |
|---|---|---|
| Diseño o propuesta antes de construir (dominios de código) | Idea Assessment: `/speckit-assess-intake` → `research` → `define` → `shape` → `decide` | Termina en `go`/`clarify`/`stop`; un `go` se entrega a `/speckit-specify`, fuera del alcance de esta skill |
| Release / Cierre de épica / Sospecha puntual / Otro | Flujo normal (Pasos 2-8 de `SKILL.md`) | — |
| Cualquier Motivo, Dominio = Metodología y Protocolos | Ninguno — mecanismo propio | Spec-kit no aplica a auditoría de texto |

## Prerrequisito común

Todo lo de esta tabla, salvo la fila de Metodología y Protocolos, requiere spec-kit instalado
en el repo auditado con sus extensiones `bug` y `assess` activas (`uv tool install
specify-cli` → `specify init` si el repo no lo tiene → `specify extension add bug` →
`specify extension add assess`) — spec-kit es un prerrequisito externo, este plugin no lo
instala.
