---
name: gate-calidad-n8n-polaria
description: Ejecuta el Gate de Calidad N8N de Polaria sobre la copia DEV de un workflow de n8n ANTES de publicarlo (script de criterios mecánicos + revisor aislado + veredicto + reporte en Linear) y verifica el JSON en git después de publicar. Úsala SIEMPRE que alguien diga que terminó o cambió un workflow, sub-workflow o el Error Handler de n8n, pregunte "¿puedo publicar esto?", "revisa el workflow antes de publicarlo", "terminé la copia DEV", "pásalo a producción", "ya lo publiqué, verifica el git", o cuando un publish_workflow quede bloqueado por el hook — incluso si no menciona "gate" por nombre. Aplica sin excepción, incluidos los Urgent. No la uses para código de un repo (eso es `gate-calidad-tecnica-pre-merge-polaria`), para diseñar o construir el workflow, ni para auditar un sistema completo (eso es `auditoria-tecnica-polaria`).
---

# Skill: Gate de Calidad N8N

Ejecuta, paso a paso, `GATE_DE_CALIDAD_N8N_v1.0.md` (en `references/` del plugin; fuente de verdad de cada paso, regla y excepción). Los criterios son los Criterios de aceptación de `POLARIA_ESTANDARES_N8N_v2.1.md` (también en `references/`; la fuente vive en `PROTOCOLOS_NUEVOS/ESTANDARES_N8N/` del repo de metodología). Esta skill orquesta; **no revisa el workflow ella misma**: los criterios mecánicos los revisa `scripts/revisar-workflow.js` y los de juicio el subagente `revisor-workflow-n8n` (`agents/revisor-workflow-n8n.md`).

**Instalación:** esta carpeta (`skill/`) es la copia canónica en el repo de metodología de Polaria, inerte aquí. Se publica como el plugin `gate-calidad-n8n` del marketplace `PolariaTech/polaria-agent-plugins` e incluye el conector MCP de n8n de Polaria (`.mcp.json` para Claude Code, `mcp.json` para Cursor, en la raíz del plugin). Se instala en el repo de cada proyecto n8n con `/plugin install gate-calidad-n8n@polaria-agent-plugins` (Claude Code) o vía Team Marketplace en Cursor. La raíz del plugin es la carpeta dos niveles arriba de esta skill; ahí están `scripts/` y `hooks/`. Cualquier cambio se hace en la copia canónica y se vuelve a publicar al plugin, nunca al revés.

## Antes de empezar

0. Confirma que el MCP de n8n responde (por ejemplo, `search_workflows` con el nombre de la copia DEV). El plugin trae el conector `n8n` a `https://polariatech.app.n8n.cloud/mcp-server/http`; si no responde, pide a quien construye autenticarlo una vez con su cuenta de n8n: en Claude Code, `/mcp` → `n8n` → autenticar; en Cursor, Settings → MCP → `n8n` → iniciar sesión. Si ya tiene otro conector de n8n a la misma instancia (por ejemplo, el de claude.ai), sirve igual.
1. Confirma que estás en la raíz del repo git del proyecto n8n (`git rev-parse --show-toplevel`). Si no hay repo, detente: sin repo no hay N9 ni marca del veredicto.
2. Identifica la copia DEV (nombre terminado en ` - DEV`) y el issue de Linear (`POL-XX`) del cambio. Si no los sabes, pregúntalos.
3. Si un publish bloqueado por el hook te trajo aquí, eso no exime del gate: corre la skill completa.

## Paso 1 — Insumos (Paso 1 del protocolo)

- **JSON descargado:** pide la ruta del JSON de la copia DEV (menú del workflow → **Download**). Si dice que ya lo descargó sin dar la ruta, busca en su carpeta de Descargas el `.json` más reciente con el nombre de la copia DEV y confírmalo con él. NUNCA armes el JSON a partir de la respuesta del MCP: no trae el pin data y transcribirlo introduce errores.
- **Del MCP de n8n** (`search_workflows`): el ID de `Polaria - Error Handler`, el ID del workflow de producción (mismo nombre sin ` - DEV`) y la descripción de la copia DEV. Si el workflow de producción no existe, pide a quien construye crearlo importando el JSON de la copia DEV, sin publicarlo, y darte su ID (excepción de primera publicación, sección 5 del protocolo).
- **Ejecuciones** (`search_workflow_executions` de la copia DEV, últimas 24 horas): anota cuántas terminaron en `success` y en `error`. Es evidencia para el criterio 14.
- **Sin MCP de n8n o sin Available in MCP:** pide esos datos a quien construye y anótalo para el reporte (sección 5 del protocolo).

## Paso 2 — Revisión mecánica (Paso 2 del protocolo)

Desde la raíz del repo:

`node "<raíz del plugin>/scripts/revisar-workflow.js" antes --json "<JSON descargado>" --error-handler-id <ID> --descripcion "<descripción>"`

No interpretes ni corrijas su salida: pasa al Paso 3.

## Paso 3 — Revisión aislada (Paso 3 del protocolo)

Despacha el subagente `revisor-workflow-n8n` con:
- `<revision_mecanica>`: la salida completa del script.
- `<contexto>`: ruta del JSON descargado, ruta del repo, issue de Linear, ejecuciones del Paso 1 y la ruta de `references/POLARIA_ESTANDARES_N8N_v2.1.md`.

NUNCA le pases la conversación en la que se construyó el workflow ni tu opinión sobre él. Devuelve su reporte tal cual, sin reescribirlo ni suavizarlo.

**Si el entorno no soporta subagentes nativos:** despacha `subagent_type: general-purpose` con el contenido completo de `agents/revisor-workflow-n8n.md` como instrucciones, seguido de la misma entrada. Si tampoco es posible, aplica ese archivo tú mismo y agrega al reporte `Revisión sin aislamiento: la ejecutó la misma sesión que construyó el workflow.`

## Paso 4 — Veredicto (Paso 4 del protocolo)

Desde la raíz del repo, sin crear ningún otro archivo:

`node "<raíz del plugin>/scripts/registrar-veredicto.js" <ID del workflow de producción> <APROBADO | RECHAZADO | RECHAZADO_JUSTIFICADO> <versionId de la copia DEV>`

El `versionId` de la copia DEV es el que imprime el script en la línea `versionId del JSON`. Después, sea cual sea el veredicto, publica el reporte completo en el issue de Linear (`save_comment`), confirmándolo antes con quien construye. Si no confirma, recuérdale que sin el reporte en Linear no puede publicar (sección 4 del protocolo).

- **`APROBADO`:** dile que puede publicar (Paso 5).
- **`RECHAZADO`:** deja explícito que **no** debe publicar. No corrijas tú la copia DEV salvo que te lo pida. Con la corrección hecha y el JSON descargado de nuevo, repite desde el Paso 1.
- **Quien construye justifica por escrito cada `FAIL`:** registra `RECHAZADO_JUSTIFICADO` y publica en Linear el reporte con las justificaciones.

## Paso 5 — Publicar (Paso 5 del protocolo)

Quien construye publica siguiendo P5 de los Estándares. Si te pide publicar a ti por el MCP, confirma antes (es una acción sobre producción) y sigue este orden: `update_workflow` del workflow de producción con el contenido de la copia DEV; `get_workflow_details` para mostrarle la credencial de cada nodo y que confirme que son las de producción; recién entonces `publish_workflow`. El hook bloquea `publish_workflow` sin marca vigente; NUNCA lo esquives (ni borrando la marca, ni escribiéndola sin reporte, ni pidiendo que publique por la interfaz para saltarlo).

## Paso 6 — Git, el mismo día (Paso 6 del protocolo)

Cuando quien construye diga que aplicó N9:

1. Obtén el `activeVersionId` del workflow de producción con `get_workflow_details`.
2. Corre `node "<raíz del plugin>/scripts/revisar-workflow.js" despues --json workflows/<archivo>.json --version-publicada <activeVersionId>`.
3. Ofrece agregar la fila del criterio 23 al issue de Linear. Si queda en `FAIL`, dile qué falta. No es un veredicto nuevo: se corrige en git, sin volver a publicar.

## Restricciones

- NUNCA decidas tú un criterio si puedes despachar el subagente: la independencia es la razón de ser del gate.
- NUNCA cambies el estado de un criterio del reporte, ni conviertas un `FAIL` del script en `PASS`.
- NUNCA escribas una marca `APROBADO` o `RECHAZADO_JUSTIFICADO` que no salga de un reporte real y, en el segundo caso, de una justificación escrita de cada `FAIL`.
- NUNCA publiques en Linear ni en n8n sin confirmación de quien construye.
- NUNCA publiques la copia DEV: lo que se publica es el workflow de producción después de importarle el JSON de la copia DEV (P5).
- DEBES correr el Paso 6 el mismo día de la publicación; si quien construye no lo ha hecho, recuérdaselo antes de cerrar.

## Verificación

- [ ] El script corrió sobre el JSON descargado de la copia DEV, no sobre una transcripción.
- [ ] Los `REVISAR` los decidió el subagente aislado (o el reporte declara que no hubo aislamiento).
- [ ] Existe `.git/polaria-gate-n8n/<ID de producción>.md` con el veredicto.
- [ ] El reporte completo quedó en el issue de Linear antes de publicar, sea cual sea el veredicto.
- [ ] Después de publicar, el criterio 23 se revisó y su resultado quedó en Linear.
