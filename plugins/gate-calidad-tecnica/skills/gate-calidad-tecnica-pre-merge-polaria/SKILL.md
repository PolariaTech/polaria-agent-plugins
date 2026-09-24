---
name: gate-calidad-tecnica-pre-merge-polaria
description: Ejecuta el gate de calidad técnica de Polaria sobre los commits locales de un cambio, ANTES de hacer push o abrir PR, despachando un revisor aislado. Úsala SIEMPRE que un dev diga que terminó un cambio, pida revisar un diff/rama/PR, pregunte "¿puedo subir esto?", "revisa esto antes de hacer push", "terminé el cambio, ¿está listo?", "¿puedo mergear esto?", "ya corregí el hallazgo de la auditoría", o pegue un diff pidiendo el segundo par de revisión — y SIEMPRE que pida "haz push" o "sube los cambios" sin veredicto del gate, o un push quede bloqueado por el hook — incluso si no menciona "gate de calidad" o "revisión de pares" por nombre. Aplica a todo cambio sin excepción, incluyendo issues Urgent. No la uses para la validación de "Done" (comportamiento funcional, cubierta por otro protocolo), ni para auditar un sistema completo (eso es `auditoria-tecnica-polaria`), ni para workflows de n8n (eso es `gate-calidad-n8n-polaria`), ni para publicar el resultado en GitHub/Linear sin que el dev lo pida.
---

# Skill: Gate de Calidad Técnica Pre-Merge

Ejecuta, paso a paso, `GATE_DE_CALIDAD_TECNICA_PRE_MERGE_v1.2.md` (documento hermano de esta skill, en la carpeta superior) — fuente de verdad de cada paso, regla, excepción y métrica. Esta skill orquesta; **no revisa el código ella misma**. La revisión la hace el subagente `revisor-tecnico-pre-merge` (`agents/revisor-tecnico-pre-merge.md`), que es la fuente ejecutable de los 7 criterios, el formato de salida y el ejemplo.

**Instalación:** esta carpeta (`skill/`) es la copia canónica versionada dentro de la metodología de Polaria, inerte aquí. Se publica como el plugin `gate-calidad-tecnica` del marketplace `PolariaTech/polaria-agent-plugins` (skill + subagente + hook de `git push` para Claude Code y Cursor + hook `pre-push` de git que el plugin instala en el repo al abrir cada sesión) y se instala en cada repo de código con `/plugin install gate-calidad-tecnica@polaria-agent-plugins` (Claude Code) o vía Team Marketplace en Cursor. Cualquier cambio se hace aquí y se vuelve a publicar al plugin, nunca al revés.

## Antes de empezar

0. Confirma que el gate está instalado en el repo: el archivo que devuelve `git rev-parse --git-path hooks/pre-push` existe y contiene `polaria-gate-calidad-tecnica`, y existe `registrar-veredicto.js` en la carpeta `polaria-gate` de `git rev-parse --git-common-dir`. Si falta algo, ejecuta `node <raíz del plugin>/hooks/instalar-pre-push.js` desde la raíz del repo (la raíz del plugin es la carpeta dos niveles arriba de esta skill) y muestra al dev cualquier aviso que imprima. Si un pedido de push trajo al dev hasta aquí, un pedido de push no exime del gate: primero se corre esta skill completa.
1. Confirma que hay commits locales reales contra la rama principal (`git log <principal>..HEAD` no vacío). La rama principal es la que apunta `origin/HEAD` (`git symbolic-ref refs/remotes/origin/HEAD`); si no existe, pregúntala.
2. Si hay cambios sin commit (`git status` no limpio), pide al dev que los incluya en un commit local antes de revisar. El veredicto queda atado al commit revisado: si el código cambia después, el hook bloquea el `push` hasta revisar de nuevo.

Si el dev te da un número de PR ya abierto (cambio publicado antes de esta versión, o push hecho por su cuenta), igual puedes correr el gate sobre `gh pr diff <número>`.

## Paso 1 — Diff y contexto (Paso 1 del protocolo)

- **Diff:** `git diff <principal>...HEAD`.
- **Tipo de cambio:** si la rama o los commits citan un issue (`POL-XX`), lee su tipo (Bug / Feature / Improvement) con el MCP de Linear (`get_issue`). Si no hay issue o no hay MCP de Linear, pregúntaselo al dev. El tipo decide si se exige test de regresión (criterio 6b).
- **Salida de pruebas:** si el dev ya corrió las pruebas en otro entorno (CI, staging) porque no se pueden correr en local, pide esa salida real (Excepción de la sección 5).
- **Formularios:** si el diff toca un formulario o su validación, trae el checklist de prueba manual y la salida de pruebas que se publicaron en el issue de Linear (`list_comments`), o pídeselos al dev. Busca el schema `schemas/schema_<formulario>.md` en este orden y detente en el primero que lo tenga: (1) este repo; (2) si este repo no tiene la carpeta `schemas/` o no está el schema, un repo cuyo nombre contenga `flujo` entre las demás carpetas del workspace (en Cursor, las otras raíces del workspace; si no hay varias, las carpetas hermanas de este repo); (3) cualquier otra carpeta del workspace o carpeta hermana que tenga ese schema; (4) si no aparece, pídele al dev la ruta o el issue de Linear que lo tiene. Si lo encontraste fuera de este repo, dile al dev de dónde lo leíste y pasa su contenido completo. Todo va en `<contexto>`: el subagente no tiene acceso a Linear ni a otros repos (criterio 7).

**Workflow n8n:** no se revisa con este gate. Si el cambio es un workflow de n8n, usa `gate-calidad-n8n-polaria` (plugin `gate-calidad-n8n`).

Si el diff está vacío o no es código, responde exactamente `ERROR: No se detectó un diff de código válido para auditar en Polaria.` y detente (Excepción de la sección 5).

## Paso 2 — Revisión aislada (Paso 1 del protocolo)

Despacha el subagente `revisor-tecnico-pre-merge` con el diff entre `<code_diff>` y el tipo de cambio, issue y salida de pruebas entre `<contexto>`. NUNCA le pases la conversación en la que se escribió el código ni tu opinión sobre el cambio: su valor es que no comparte tus supuestos.

Devuelve al dev el reporte del subagente tal cual, sin reescribirlo ni suavizarlo.

**Si el entorno no soporta subagentes nativos** (mismo respaldo que `CLAUDE.md` del repo de metodología): despacha `subagent_type: general-purpose` con el contenido completo de `agents/revisor-tecnico-pre-merge.md` como instrucciones, seguido del diff y el contexto. Si tampoco eso es posible, aplica ese archivo tú mismo en el hilo actual y agrega al reporte la línea `Revisión sin aislamiento: la ejecutó la misma sesión que escribió el código.`

## Paso 3 — Registrar el veredicto (Pasos 2 y 3 del protocolo)

Registra el veredicto con un solo comando desde la raíz del repo, sin crear ningún archivo (ni temporal) en el proyecto:

`node "$(git rev-parse --git-common-dir)/polaria-gate/registrar-veredicto.js" <APROBADO | RECHAZADO | RECHAZADO_JUSTIFICADO>`

El script escribe la marca dentro de `.git/` (no se commitea ni se ve en el proyecto), atada al commit actual. Es lo único que lee el hook de `git push`. El reporte no se guarda en archivo: se muestra en el chat y, en el Paso 4, va al PR/Linear.

- **`APROBADO`:** dile al dev que puede hacer `push` y abrir el PR. No hagas el `push` tú: espera a que el dev lo pida después de ver el reporte. Un "haz push" dicho antes del gate no cuenta como autorización.
- **`RECHAZADO`:** el reporte ya trae, debajo del veredicto, cómo corregir cada `[FAIL]`. Deja explícito que **no** debe hacer `push` todavía. No apliques tú las correcciones salvo que el dev lo pida. Cuando llegue la corrección (un commit nuevo), repite desde el Paso 1.
- **El dev justifica por escrito cada `[FAIL]`** (posible falso positivo, Excepción de la sección 5): registra de nuevo con `RECHAZADO_JUSTIFICADO`. La justificación de cada `FAIL` queda en el chat y en el PR/Linear junto al reporte (Paso 4).

## Paso 4 — Publicar la evidencia (Paso 2 del protocolo)

Después del `push` y de abrir el PR, el reporte completo (no solo el veredicto, y con las justificaciones si las hay) queda como primer comentario del PR y/o en el issue de Linear. Ofrece publicarlo tú: `gh pr comment` o el MCP de GitHub para el PR, `save_comment` del MCP de Linear para el issue. Confirma con el dev antes de publicar y antes de `gh pr create`: son acciones visibles para el resto del equipo.

## Paso 5 — Merge (Paso 4 del protocolo)

Con el reporte ya publicado, confirma que el dev puede mergear. Si te pide mergear tú mismo (`gh pr merge`), confirma antes: es una acción visible e irreversible sobre la rama principal.

## Si el hook bloquea un push

El hook de la IA o el `pre-push` de git se disparan cuando el commit que se va a publicar no tiene marca `APROBADO` ni `RECHAZADO_JUSTIFICADO`. No los esquives (ni borrando el hook, ni con `git push --no-verify`, ni escribiendo la marca sin revisión, ni pidiendo al dev que haga el `push` por otra vía para saltarlo): corre esta skill desde el Paso 1 sobre el commit actual.

## Excepciones (sección 5 del protocolo)

- Si no puedes ejecutar la revisión: dile al dev que escala al Responsable, quien decide si otro dev revisa manualmente o se espera.
- Si el dev no está de acuerdo con un `[FAIL]`: ver el tercer punto del Paso 3. Si la duda es real, que consulte al Responsable; esta skill no decide eso por él.
- Pruebas que no se pueden correr en local o diff inválido: ver el Paso 1. Workflow n8n: ver el Paso 1.

## Si hay un problema después del merge (sección 9 del protocolo — Rollback)

No corrijas el commit ya mergeado. Guía al dev a revertirlo y generar una versión PATCH nueva, siguiendo el Protocolo de Versionamiento — "una versión desplegada no se modifica, todo cambio genera una versión nueva."

## Restricciones

- NUNCA revises el diff en tu propio contexto si puedes despachar el subagente: la independencia es la razón de ser del gate.
- NUNCA reescribas, resumas ni cambies el estado de un criterio del reporte del subagente.
- NUNCA crees archivos en el proyecto, ni siquiera temporales para armar la marca: la única escritura del gate es la de `registrar-veredicto.js` dentro de `.git/`.
- NUNCA escribas una marca `APROBADO` o `RECHAZADO_JUSTIFICADO` que no salga de un reporte real y, en el segundo caso, de una justificación escrita del dev para cada `FAIL`.
- NUNCA le digas al dev que haga `push`/abra PR con un Veredicto `RECHAZADO` sin justificar.
- NUNCA hagas el `push` tú sin que el dev lo pida después de ver el reporte, ni lo hagas sin veredicto porque el dev pidió "solo el push", ni uses `--no-verify`.
- NUNCA publiques el reporte en GitHub/Linear, abras el PR o mergees sin que el dev lo confirme.
- NUNCA decidas tú lo que el protocolo deja al Responsable en una Excepción.

## Verificación

Antes de dar por cerrado un ciclo de esta skill:

- [ ] La revisión corrió sobre commits locales antes de `push`/abrir PR, y la hizo el subagente aislado (o el reporte declara que no hubo aislamiento).
- [ ] El tipo de cambio se obtuvo de Linear o del dev, y el criterio 6 se evaluó con ejecución real de pruebas.
- [ ] Existe la marca `<git-dir>/polaria-gate/<sha>.md` con el veredicto del commit revisado.
- [ ] Si `APROBADO` o `RECHAZADO_JUSTIFICADO`: el reporte completo quedó publicado en el PR o en Linear antes de considerar el ciclo cerrado.
- [ ] Si `RECHAZADO`: no se hizo `push`.
