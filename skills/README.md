# Variantes repo-específicas (no distribuidas vía plugin)

Esta carpeta es distinta de `plugins/`: guarda skills que **no se instalan vía marketplace**
porque están adaptadas a un solo repo externo, no pensadas para reutilizarse entre repos.
Existen igual aquí, como fuente de verdad respaldada, en vez de vivir solo en un clon local
descartable o en el scratchpad de una sesión.

Diferencias con `plugins/`:

| | `plugins/<nombre>/` | `skills/<nombre>/` |
|---|---|---|
| Instalación | `/plugin install <nombre>@polaria-agent-plugins` (Claude Code) o Team Marketplace (Cursor) | Manual: copiar el `SKILL.md` a `.claude/skills/<nombre>/` y/o `.cursor/skills/<nombre>/` del repo destino |
| Declarado en `marketplace.json` | Sí | No |
| Pensada para reutilizarse entre repos | Sí | No — adaptada a las particularidades de un solo repo/equipo |
| Quién la mantiene actualizada | Se actualiza aquí y se reinstala en cada repo destino | Se actualiza aquí y se vuelve a copiar a mano al repo destino cuando cambie |

## Variantes actuales

| Skill | Repo destino | Estado de entrega |
|---|---|---|
| `doc-updater-flujos` | `luiscantilloo/flujos` (`.claude/skills/doc-updater-flujos/` y `.cursor/skills/doc-updater-flujos/`) | Pendiente — sin acceso de escritura al repo de Lucho desde esta cuenta; hay que copiarla a mano |

Cuando se entregue una variante a su repo destino, marcar aquí el estado como "Entregada
(fecha)" en vez de borrar la fila — esta carpeta sigue siendo la fuente de verdad aunque ya
esté copiada afuera.
