---
name: gate-calidad-n8n-polaria
description: Ejecuta el Gate de Calidad N8N de Polaria sobre la copia DEV de un workflow de n8n ANTES de publicarlo (descarga por la API de n8n, verificación de cambio de solo texto, script de criterios mecánicos + revisor aislado + veredicto + reporte en Linear) y verifica el JSON en git después de publicar. Úsala SIEMPRE que alguien diga que terminó o cambió un workflow, sub-workflow o el Error Handler de n8n, pregunte "¿puedo publicar esto?", "revisa el workflow antes de publicarlo", "terminé la copia DEV", "pásalo a producción", "solo cambié unos textos", "corregí las tildes del workflow", "ya lo publiqué, verifica el git", o cuando un publish_workflow quede bloqueado por el hook — incluso si no menciona "gate" por nombre. Aplica a todo cambio, incluidos los Urgent; un cambio de solo texto que el script demuestre se resuelve sin el revisor aislado. No la uses para código de un repo (eso es `gate-calidad-tecnica-pre-merge-polaria`), para diseñar o construir el workflow, ni para auditar un sistema completo (eso es `auditoria-tecnica-polaria`).
---

# Skill: Gate de Calidad N8N

Ejecuta, paso a paso, `GATE_DE_CALIDAD_N8N_v1.1.md` (en `references/` del plugin; fuente de verdad de cada paso, regla y excepción). Los criterios son los Criterios de aceptación de `POLARIA_ESTANDARES_N8N_v2.2.md` (también en `references/`; la fuente vive en `PROTOCOLOS_APROBADOS/ESTANDARES_N8N/` del repo de metodología). Esta skill orquesta; **no revisa el workflow ella misma**: los criterios mecánicos los revisa `scripts/revisar-workflow.js`, la exención de solo texto la decide el mismo script en modo `texto`, y los criterios de juicio el subagente `revisor-workflow-n8n` (`agents/revisor-workflow-n8n.md`).

**Instalación:** esta carpeta (`skill/`) es la copia canónica en el repo de metodología de Polaria, inerte aquí. Se publica como el plugin `gate-calidad-n8n` del marketplace `PolariaTech/polaria-agent-plugins` e incluye el conector MCP de n8n de Polaria (`.mcp.json` para Claude Code, `mcp.json` para Cursor, en la raíz del plugin). Se instala en el repo de cada proyecto n8n con `/plugin install gate-calidad-n8n@polaria-agent-plugins` (Claude Code) o vía Team Marketplace en Cursor. La raíz del plugin es la carpeta dos niveles arriba de esta skill; ahí están `scripts/` y `hooks/`. Cualquier cambio se hace en la copia canónica y se vuelve a publicar al plugin, nunca al revés.

## Antes de empezar

0. **Clave de la API de n8n, lo primero.** Desde la raíz del repo corre `node "<raíz del plugin>/scripts/descargar-workflow.js" verificar`.
   - Salida 0: sigue.
   - Salida 2 (falta la clave, está vencida o no tiene permiso): muestra a quien construye la salida del script **tal cual, completa**, y espera a que diga que ya la configuró y reabrió Claude Code o Cursor; entonces vuelve a correr `verificar`. NUNCA le pidas que pegue la clave en el chat ni que la configure con `! comando`.
   - Si quien construye dice que no puede crear la clave, o la salida es 1 (sin conexión con la API): sigue con el Download manual del Paso 1 y anótalo para el reporte (sección 5 del protocolo).
1. Confirma que el MCP de n8n responde (por ejemplo, `search_workflows` con el nombre de la copia DEV). El plugin trae el conector `n8n` a `https://polariatech.app.n8n.cloud/mcp-server/http`; si no responde, pide a quien construye autenticarlo una vez con su cuenta de n8n: en Claude Code, `/mcp` → `n8n` → autenticar; en Cursor, Settings → MCP → `n8n` → iniciar sesión. Si ya tiene otro conector de n8n a la misma instancia (por ejemplo, el de claude.ai), sirve igual.
2. Confirma que estás en la raíz del repo git del proyecto n8n (`git rev-parse --show-toplevel`). Si no hay repo, detente: sin repo no hay N9 ni marca del veredicto.
3. Identifica la copia DEV (nombre terminado en ` - DEV`) y el issue de Linear (`POL-XX`) del cambio. Si no los sabes, pregúntalos.
4. Si un publish bloqueado por el hook te trajo aquí, eso no exime del gate: corre la skill completa.

## Paso 1 — Insumos (Paso 1 del protocolo)

- **Del MCP de n8n** (`search_workflows`): el ID de la copia DEV, el ID de `Polaria - Error Handler`, el ID del workflow de producción (mismo nombre sin ` - DEV`) y la descripción de la copia DEV. Con `get_workflow_details` del workflow de producción, su `activeVersionId`. Si el workflow de producción no existe, pide a quien construye crearlo importando el JSON de la copia DEV, sin publicarlo, y darte su ID (excepción de primera publicación, sección 5 del protocolo).
- **JSON de la copia DEV:** `node "<raíz del plugin>/scripts/descargar-workflow.js" <ID de la copia DEV>`. Guarda el archivo dentro de `.git/polaria-gate-n8n/descargas/` e imprime su ruta y su `versionId`. **Sin clave (Antes de empezar, punto 0):** pide la ruta del JSON descargado a mano (menú del workflow → **Download**); si dice que ya lo descargó sin dar la ruta, busca en su carpeta de Descargas el `.json` más reciente con el nombre de la copia DEV y confírmalo con él.
- **JSON de producción** (solo si tiene `activeVersionId`): igual, con el ID del workflow de producción. Sin clave, usa `workflows/<archivo>.json` de git como base.
- NUNCA armes un JSON a partir de la respuesta del MCP: no trae el pin data y transcribirlo introduce errores.
- **Ejecuciones** (`search_workflow_executions` de la copia DEV, últimas 24 horas): anota cuántas terminaron en `success` y en `error`. Es evidencia para el criterio 14.
- **Sin MCP de n8n o sin Available in MCP:** pide esos datos a quien construye y anótalo para el reporte (sección 5 del protocolo).

## Paso 1b — Verificación de cambio de solo texto (sección 5.1 del protocolo)

Corre siempre que producción tenga `activeVersionId`; nadie tiene que declarar que el cambio "es solo texto". Las condiciones de la exención están en la sección 5.1 del protocolo y las aplica el script: no las evalúes tú.

1. **Parejas DEV:** si la copia DEV llama a otras copias DEV (`executeWorkflow` o `toolWorkflow`), por cada una busca con `search_workflows` el workflow cuyo nombre es el mismo sin ` - DEV` y arma `<ID de producción>=<ID de la copia DEV>`. SOLO declara parejas comprobadas así; NUNCA una que proponga quien construye sin esa comprobación.
2. Desde la raíz del repo:

   `node "<raíz del plugin>/scripts/revisar-workflow.js" texto --json "<JSON de la copia DEV>" --publicado "<JSON de producción>" --workflow-id <ID de producción> --version-publicada <activeVersionId> [--mapa-dev <idProd>=<idDev>,...]`

3. **Salida 0 (`EXENTO_TEXTO`):** el script ya registró la marca; NO despaches al revisor ni corras los Pasos 2 a 4. Si la última entrada del `CHANGELOG.md` no describe este cambio, detente y pídela. Publica en el issue de Linear (`save_comment`, confirmándolo antes con quien construye) la salida completa del script y esa entrada, y sigue al Paso 5. Si no confirma, recuérdale que sin el reporte en Linear no puede publicar (sección 4 del protocolo).
4. **Salida 3 (`NO EXENTO`):** dile en una línea qué diferencia lo impidió y sigue con el Paso 2. No intentes "arreglar" la exención.
5. **Salida 1:** error de uso o sin repo; no hay exención ni marca. Corrige el comando y repite. NUNCA uses `--registrar no` en el gate real: solo sirve para probar el script y no deja marca.

## Paso 2 — Revisión mecánica (Paso 2 del protocolo)

Desde la raíz del repo:

`node "<raíz del plugin>/scripts/revisar-workflow.js" antes --json "<JSON de la copia DEV>" --error-handler-id <ID> --descripcion "<descripción>"`

No interpretes ni corrijas su salida: pasa al Paso 3.

## Paso 3 — Revisión aislada (Paso 3 del protocolo)

Despacha el subagente `revisor-workflow-n8n` con:
- `<revision_mecanica>`: la salida completa del script.
- `<contexto>`: ruta del JSON de la copia DEV, ruta del repo, issue de Linear, ejecuciones del Paso 1 y la ruta de `references/POLARIA_ESTANDARES_N8N_v2.2.md`.

NUNCA le pases la conversación en la que se construyó el workflow ni tu opinión sobre él. Devuelve su reporte tal cual, sin reescribirlo ni suavizarlo.

**Si el entorno no soporta subagentes nativos:** despacha `subagent_type: general-purpose` con el contenido completo de `agents/revisor-workflow-n8n.md` como instrucciones, seguido de la misma entrada. Si tampoco es posible, aplica ese archivo tú mismo y agrega al reporte `Revisión sin aislamiento: la ejecutó la misma sesión que construyó el workflow.`

## Paso 4 — Veredicto (Paso 4 del protocolo)

Desde la raíz del repo, sin crear ningún otro archivo:

`node "<raíz del plugin>/scripts/registrar-veredicto.js" <ID del workflow de producción> <APROBADO | RECHAZADO | RECHAZADO_JUSTIFICADO> <versionId de la copia DEV> <ID de la copia DEV>`

El `versionId` de la copia DEV es el que imprime el script en la línea `versionId del JSON`. Con el ID de la copia DEV, el hook comprueba antes de publicar que la copia no cambió después del veredicto. Después, sea cual sea el veredicto, publica el reporte completo en el issue de Linear (`save_comment`), confirmándolo antes con quien construye. Si no confirma, recuérdale que sin el reporte en Linear no puede publicar (sección 4 del protocolo).

- **`APROBADO`:** dile que puede publicar (Paso 5).
- **`RECHAZADO`:** deja explícito que **no** debe publicar. No corrijas tú la copia DEV salvo que te lo pida. Con la corrección hecha, repite desde el Paso 1 (vuelve a descargar).
- **Quien construye justifica por escrito cada `FAIL`:** registra `RECHAZADO_JUSTIFICADO` y publica en Linear el reporte con las justificaciones.

## Paso 5 — Publicar (Paso 5 del protocolo)

Quien construye publica siguiendo P5 de los Estándares. Si te pide publicar a ti por el MCP, confirma antes (es una acción sobre producción) y sigue este orden: `update_workflow` del workflow de producción con el contenido de la copia DEV; `get_workflow_details` para mostrarle la credencial de cada nodo y que confirme que son las de producción; recién entonces `publish_workflow`. El hook bloquea `publish_workflow` sin marca vigente y, si quien publica tiene la clave de la API, también si la copia DEV cambió después del veredicto; NUNCA lo esquives (ni borrando la marca, ni escribiéndola sin reporte, ni pidiendo que publique por la interfaz para saltarlo).

## Paso 6 — Git, el mismo día (Paso 6 del protocolo)

Cuando quien construye diga que aplicó N9:

1. Obtén el `activeVersionId` del workflow de producción con `get_workflow_details`.
2. Corre `node "<raíz del plugin>/scripts/revisar-workflow.js" despues --json workflows/<archivo>.json --version-publicada <activeVersionId> --dev "<JSON de la copia DEV revisado en el Paso 1>" [--mapa-dev <las parejas del Paso 1b o, si no se corrió, armadas igual que en su punto 1>]`, con el JSON de la copia DEV cuyo `versionId` es el registrado en la marca. Con `--dev`, el criterio 23 también falla si lo publicado no es la copia DEV que se revisó.
3. Ofrece agregar la fila del criterio 23 al issue de Linear. Si queda en `FAIL`, dile qué falta. No es un veredicto nuevo: se corrige en git, sin volver a publicar; si lo publicado no es lo revisado, el cambio pasa de nuevo por el gate.

## Restricciones

- NUNCA decidas tú un criterio ni la exención de solo texto si puedes correr el script y despachar el subagente: la independencia es la razón de ser del gate.
- NUNCA cambies el estado de un criterio del reporte, ni conviertas un `FAIL` del script en `PASS`, ni un `NO EXENTO` en exención.
- NUNCA escribas una marca a mano. `APROBADO` y `RECHAZADO_JUSTIFICADO` salen de `registrar-veredicto.js` tras un reporte real (y, en el segundo caso, una justificación escrita de cada `FAIL`); `EXENTO_TEXTO` solo lo escribe `revisar-workflow.js texto`.
- NUNCA pidas, muestres ni guardes la clave de la API de n8n: vive solo en la variable de entorno `N8N_API_KEY` de quien construye.
- NUNCA publiques en Linear ni en n8n sin confirmación de quien construye.
- NUNCA publiques la copia DEV: lo que se publica es el workflow de producción después de importarle el JSON de la copia DEV (P5).
- DEBES correr el Paso 6 el mismo día de la publicación; si quien construye no lo ha hecho, recuérdaselo antes de cerrar.

## Verificación

- [ ] Se comprobó la clave de la API antes de empezar, o el reporte declara el Download manual.
- [ ] Los scripts corrieron sobre JSON descargados (por la API o a mano), no sobre una transcripción.
- [ ] Si producción ya estaba publicada, corrió el Paso 1b antes de despachar al revisor.
- [ ] Los `REVISAR` los decidió el subagente aislado (o el reporte declara que no hubo aislamiento), salvo `EXENTO_TEXTO`.
- [ ] Existe `.git/polaria-gate-n8n/<ID de producción>.md` con el veredicto.
- [ ] El reporte completo (o la salida del modo `texto`) quedó en el issue de Linear antes de publicar.
- [ ] Después de publicar, el criterio 23 se revisó con `--dev` y su resultado quedó en Linear.
