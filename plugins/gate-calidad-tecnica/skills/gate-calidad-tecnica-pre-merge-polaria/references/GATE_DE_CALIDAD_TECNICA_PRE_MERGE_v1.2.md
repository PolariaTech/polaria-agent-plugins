# GATE DE CALIDAD TÉCNICA PRE-MERGE

*Polaria | Técnico*

| Versión | Creado por | Aprobado por | Fecha |
|---|---|---|---|
| v1.2 | Responsable Metodología | Responsable Metodología | 22/09/2026 |

*(antes "Revisión de Pares" — renombrado el 22/09/2026 porque el revisor real es una IA actuando como "segundo par", no un dev humano)*

## Glosario

| Término | Significado |
|---|---|
| Diff | La lista exacta de líneas que cambiaron entre la rama del dev y la rama principal (`+` agregadas, `-` quitadas). Es lo único que se revisa. |
| Commit / push / PR | Commit: guardar el cambio en la máquina del dev. Push: subirlo a GitHub. PR (Pull Request): pedir que se mezcle con la rama principal. |
| Veredicto | Resultado de la revisión: `APROBADO`, `RECHAZADO` o `RECHAZADO_JUSTIFICADO` (rechazado, pero el dev justificó por escrito cada falla como falso positivo). |
| CI / staging | CI: servidor que corre las pruebas automáticamente al subir código (ej. GitHub Actions). Staging: entorno de pruebas que imita producción. Su "salida" es el resultado impreso de las pruebas (ej. "42 pasaron, 0 fallaron"). |
| Build | El comando que prepara el código para publicarlo (ej. `npm run build`). Además de empaquetar, revisa los tipos de TypeScript: un error de tipos que no aparece al desarrollar ni al correr las pruebas hace fallar el build. |
| Despliegue / preview | Despliegue: publicar el código en la plataforma donde corre (hoy Vercel). Preview: el despliegue de prueba que la plataforma crea sola por cada `push` a una rama. |
| Skill / subagente / hook / MCP | Piezas del plugin, explicadas en la sección 3. |

## 1. Contexto

Aplica cada vez que un dev termina un cambio de código (Bug, Feature o Improvement), **antes de hacer `push`**. Existe porque la validación de "Done" (Metodología de Trabajo v1.2, sección 7) confirma que el comportamiento funciona, pero no revisa la calidad técnica del código: nombres, manejo de errores, credenciales, código de debug, pruebas ni que el build de despliegue compile. También es el gate por el que pasa la corrección de todo hallazgo del Protocolo de Auditoría Técnica, que detecta y revalida pero no corrige.

## 2. Objetivo

Que ningún cambio llegue a GitHub sin que un revisor de IA independiente haya revisado su calidad técnica y ejecutado sus pruebas, sin depender de que otro dev esté disponible en un equipo de 3.

## 3. Cómo funciona (Pasos)

Todo lo ejecuta el plugin `gate-calidad-tecnica`, instalado en cada repo de código desde el marketplace `PolariaTech/polaria-agent-plugins` (Claude Code y Cursor). Tiene estas piezas:

| Pieza | Qué hace |
|---|---|
| Skill `gate-calidad-tecnica-pre-merge-polaria` | Coordina todo el flujo. No revisa el código. |
| Subagente `revisor-tecnico-pre-merge` | Revisa el diff en un contexto aislado: no ve la conversación en la que se escribió el código. Solo lee y ejecuta pruebas. |
| Hook de `git push` | Bloquea el `push` que ejecuta la IA si ese commit no tiene veredicto. Si el hook falla, también bloquea en vez de dejar pasar. Requiere Node.js en la máquina del dev. |
| Hook `pre-push` de git | Lo instala el plugin en el repo al abrir cada sesión. Bloquea el `push` sin veredicto venga de donde venga: la IA, la terminal o el panel de Git del editor. |
| MCP de Linear y GitHub | Lee el tipo de issue y publica el reporte, siempre con confirmación del dev. |
| MCP de Vercel (temporal) | Lo trae el plugin. Lee qué comando de build y qué versión de Node usa Vercel en el repo, y el estado del preview antes del merge. Cada dev inicia sesión en Vercel la primera vez que lo usa. |

**Paso 0 — Arranque.** El dev dice algo como *"terminé, revísalo antes de hacer push"* o *"¿puedo subir esto?"*, y la skill se activa sola. Si el dev pide el `push` sin pasar por el gate, el hook lo bloquea y eso activa la skill.

**Paso 1 — Previo.** La skill confirma que hay commits locales contra la rama principal. Si hay cambios sin commit, pide al dev hacer un commit local primero: el veredicto queda atado a ese commit, y si el código cambia después hay que revisarlo de nuevo.

**Paso 2 — Diff y contexto.** La skill obtiene el diff (`git diff <principal>...HEAD`) y el tipo de cambio: lo lee de Linear si la rama o el commit citan `POL-XX`, o se lo pregunta al dev. Si el tipo es Bug, se exige test de regresión. Si el repo se despliega en Vercel, la skill averigua el comando de build y la versión de Node exactos que usa Vercel en ese repo (Vercel — temporal, ver la nota de la sección 6). Si el diff está vacío, responde `ERROR: No se detectó un diff de código válido para auditar en Polaria.` y se detiene.

**Paso 3 — Revisión aislada.** El subagente recibe solo el diff y el contexto, aplica los 8 criterios (sección 6), **corre las pruebas él mismo** y, si el repo se despliega, **corre el build de despliegue**. Devuelve una tabla con los 8 criterios, el Veredicto Final y, debajo, cómo corregir cada `FAIL` (archivo, línea y qué cambiar). La skill lo muestra al dev en el chat sin cambios. El revisor solo sugiere: el dev decide y aplica la corrección (ver la regla de solo lectura en la sección 4).

**Paso 4 — Veredicto.** La skill lo registra con un solo comando, que escribe una marca dentro de `.git/` (nunca se sube al repo ni se ve en el proyecto). El gate no crea ningún otro archivo: el reporte vive en el chat y después en el PR/Linear.

| Veredicto | Qué pasa |
|---|---|
| `APROBADO` | El dev puede hacer `push`. |
| `RECHAZADO` | El dev corrige, hace un commit nuevo y vuelve al paso 1. El `push` queda bloqueado. |
| `RECHAZADO_JUSTIFICADO` | El dev justificó por escrito cada `FAIL` como falso positivo. Puede hacer `push`, y la justificación va junto al reporte en el PR/Linear. |

**Paso 5 — Push.** El dev pide el `push` después de ver el reporte; la IA no lo hace por su cuenta, aunque se lo hayan pedido antes del gate. Al ejecutar `git push`, los hooks revisan el veredicto del commit: si es `APROBADO` o `RECHAZADO_JUSTIFICADO`, dejan pasar; si no existe o es de un commit anterior, bloquean.

**Paso 6 — PR y evidencia.** La skill ofrece abrir el PR y publicar el reporte completo como primer comentario del PR y/o en el issue de Linear. Siempre pide confirmación antes.

**Paso 7 — Merge.** Con el reporte publicado, el dev mergea. Si el repo se despliega en Vercel, antes del merge la skill revisa el preview de ese commit con el MCP de Vercel (sin MCP, le pide al dev revisarlo en Vercel): si quedó en error, trae el log y no da vía libre al merge hasta que se corrija (Vercel — temporal).

```mermaid
flowchart TD
    A["Dev termina → commit local"] --> B["Skill: diff + tipo de issue (Linear)"]
    B --> C["Subagente aislado:<br/>8 criterios + corre pruebas y build"]
    C --> D{"Veredicto"}
    D -- RECHAZADO --> E{"¿Corrige o justifica<br/>cada FAIL?"}
    E -- "Corrige (commit nuevo)" --> B
    E -- "Justifica por escrito" --> F
    D -- APROBADO --> F["Marca en .git/polaria-gate/&lt;commit&gt;.md"]
    F --> G["git push → el hook verifica la marca → pasa"]
    G --> H["PR + reporte como 1er comentario<br/>(con confirmación)"]
    H --> I["Merge"]
```

## 4. Reglas

| Regla | Por qué existe |
|---|---|
| Todo cambio pasa por este gate antes del `push`, sin excepción — incluidos los issues Urgent | El SLA de Urgent es 24 horas y la revisión toma minutos. Eximir justo al código hecho bajo más presión lo dejaría sin ningún control técnico. |
| Todo el gate es solo lectura: desde que arranca hasta que entrega el reporte, la IA no edita ningún archivo (código, tests, schemas, docs) ni hace `commit`, `amend` u otro cambio en git, en ningún repo. Nunca ajusta un schema para que el criterio 7 pase. Las correcciones las pide el dev en un mensaje aparte, y después el gate empieza otra vez. La skill compara `HEAD` y `git status` al inicio y al final, y si algo cambió no registra el veredicto | Un gate que corrige lo que revisa deja de ser un segundo par: el dev pierde el control de su código, y bajar la exigencia del schema hace que un formulario incompleto pase como `APROBADO`. Pasó en una ejecución real: el agente editó modales, cambió un campo del schema de obligatorio a opcional e hizo commit sin que el dev lo pidiera |
| La revisión la hace el subagente aislado, nunca la misma sesión de IA que escribió el código | Una IA revisando su propio código comparte los supuestos que produjeron el defecto: eso es auto-revisión, no un segundo par. |
| No se hace `push` con `RECHAZADO` sin corregir o justificar por escrito cada `FAIL` | Publicar una rama que nace rechazada genera ruido al equipo y vuelve inútil la revisión. |
| El reporte completo (no solo el veredicto) queda en el PR o en Linear | Sin el detalle por criterio no hay forma de auditar qué se revisó realmente. |

## 5. Excepciones

| Situación | Qué hacer |
|---|---|
| La IA no está disponible | El dev escala al Responsable, quien decide si otro dev revisa manualmente o se espera. |
| El entorno no soporta subagentes | La skill lanza un agente genérico con las instrucciones del revisor; si tampoco se puede, revisa ella misma y lo declara en el reporte ("Revisión sin aislamiento"). |
| El dev no está de acuerdo con un `FAIL` | Lo justifica por escrito (queda `RECHAZADO_JUSTIFICADO`). Si la duda es real, consulta al Responsable antes de decidir solo. |
| Las pruebas no se pueden correr en la máquina del dev (necesitan servicios o credenciales que no tiene) | El dev pega la salida real de CI o staging. Sin ninguna salida real, el criterio 6 es `FAIL`. |
| El repo ya tiene su propio `pre-push` o usa `core.hooksPath` (por ejemplo, husky) | El plugin no lo pisa y avisa al abrir la sesión. El dev agrega al `pre-push` existente la línea que indica el aviso. Hasta hacerlo, el `push` desde la terminal no se bloquea, y la falta del reporte en el PR lo hace visible. |
| El build de despliegue falla en local solo porque falta una variable de entorno que el dev no tiene | El dev corre el build con las variables del entorno preview (`vercel env run -e preview -- <comando de build>`) o pega la salida real del build del preview. Sin ninguna salida real, el criterio 8 es `FAIL` (Vercel — temporal). |
| El dev hace el `push` con `--no-verify` | Salta el `pre-push`. Incumple el protocolo, y la falta del reporte en el PR lo hace visible. |

## 6. Los 8 criterios

La definición completa (rol, formato de salida, ejemplo) vive en el subagente `revisor-tecnico-pre-merge` del plugin. **Veredicto `APROBADO` solo si ningún criterio queda en `FAIL`**; un `N/A` nunca cuenta como `FAIL`.

| # | Criterio | `FAIL` si… |
|---|---|---|
| 1 | Nomenclatura | Hay variables ambiguas (`x`, `temp`, `data2`). |
| 2 | Manejo de errores | Una llamada a API, query o parsing no tiene manejo de errores explícito. |
| 3 | Secretos | Hay API keys, tokens, contraseñas o credenciales en el código. |
| 4 | Código de debug | Quedan `console.log`, `print`, `TODO borrar` o código muerto. |
| 5 | Convenciones Polaria | El estilo no es consistente con el lenguaje del diff. |
| 6 | Pruebas | No hay pruebas que cubran el cambio; es un Bug y no trae su test de regresión; no hay salida real de la ejecución; o alguna prueba falla. Mencionar pruebas no basta. Si el cambio no es automatizable, vale una prueba manual documentada con pasos y resultado. |
| 7 | Validación de formularios (`N/A` si el diff no toca un formulario) | Falta algo de lo que exige `PROTOCOLO_DE_VALIDACION_DE_FORMULARIOS_v1.1.md` para las capas que viven en este repo, con la librería que use el repo: el schema completo (`schemas/schema_<formulario>.md` de este repo; si no está, del repo de flujos u otro repo del workspace; o el issue de Linear), los niveles por campo, las pruebas por campo, su ejecución o el checklist de prueba manual en PASS. |
| 8 | Build de despliegue (`N/A` si el repo no se despliega en ninguna plataforma) | El comando de build que usa la plataforma de despliegue, corrido en local, termina con error (si la versión mayor de Node difiere de la de la plataforma, se dice en la evidencia); o deja modificados archivos versionados en git. Que las pruebas del criterio 6 pasen no basta: las pruebas no revisan los tipos y el build sí. |

> **Nota temporal — Vercel:** hoy los proyectos web de Polaria se despliegan en Vercel, y esa plataforma será reemplazada por AWS. Todo lo marcado "Vercel — temporal" en este documento (cómo se obtienen el comando de build y la versión de Node, el MCP de Vercel, la revisión del preview antes del merge y la excepción de variables de entorno) se reemplaza por su equivalente en AWS cuando ocurra la migración. El criterio 8 como tal no cambia: el build que corre la plataforma tiene que compilar en local antes del `push`.

## 7. Dependencias

- **Protocolo de Auditoría Técnica v1.2:** la auditoría no corrige; cada corrección de un hallazgo pasa por este gate, y después la auditoría la revalida.
- **Protocolo de Versionamiento (sección 3.1):** el criterio 6 revisa un cambio a la vez; no reemplaza el mínimo de pruebas por versión (Major/Minor/Patch) que ese protocolo exige al consolidar la versión.
- **Validación de "Done" (Metodología de Trabajo v1.2, sección 7):** sigue siendo necesaria; este gate cubre la calidad técnica, Done cubre el comportamiento funcional.

## 8. Rollback

Si un cambio ya mergeado tiene un problema, se revierte y se genera una versión PATCH nueva, como exige el Protocolo de Versionamiento ("una versión desplegada no se modifica").

## 9. Métricas de éxito

| Métrica | Meta |
|---|---|
| PRs mergeados con el reporte completo en el PR o en Linear | 100% |
| PRs mergeados con `RECHAZADO` sin justificación | 0 |
| Bugs que reaparecen después de corregidos | 0 |
