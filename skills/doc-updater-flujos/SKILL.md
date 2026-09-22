---
name: doc-updater-flujos
description: "Mantiene sincronizada la documentación técnica del Dev Hub `flujos` (glosario, runbooks, onboarding, seguridad, testing, arquitectura, changelog compartido) con el estado real de Polaria WMS, cuando el cambio que la dispara ocurrió en cualquiera de los 4 repos de código (polaria-wms-web, polaria-wms-api, polaria-wms-db, Widget-react) o en este mismo Dev Hub. Variante específica de este repo — no es la versión genérica del plugin `gestion-linear` de `polaria-agent-plugins`: usa la guía propia de este proyecto (`public/docs/guia_documentacion_proyectos.md`, 19 puntos) en vez de la Guía de Documentación de Polaria, sabe que el CHANGELOG y el número de versión de producto son compartidos entre los 4 repos + este hub, y sabe editar contenido que vive como módulos JS (`src/data/polaria*Doc.js`) además de Markdown plano. Se activa en dos momentos — MODO A (frase exacta \"Documenta el cambio aprobado\") y MODO B (cierre de hilo o fin de sesión de trabajo: \"cerremos el hilo\", \"abrimos otro chat\", \"cierro aquí\", \"nuevo hilo\"). NO cubre manuales de usuario (`public/docs/manual-usuario/` — eso es la skill `manuales-usuario-metadata-drive`) ni los schemas de formularios (`public/docs/formularios/schemas/` — protocolo de validación v1.0 aparte)."
compatibility: "Requiere acceso de archivos (Read/Edit/Write) a este repo (flujos) y, si el cambio se originó en otro repo del producto, también acceso de lectura a ese repo (clonado localmente o accesible por otra vía) para confirmar qué cambió exactamente."
---

# Doc Updater — Dev Hub `flujos` (Polaria WMS)

Mantiene sincronizada la documentación técnica de este Dev Hub con el estado real de Polaria WMS. A diferencia de la skill `doc-updater` genérica del plugin compartido `gestion-linear` (que orquesta hacia `GUIA_DOCUMENTACION_EXTENDIDA/RESUMIDA` de Polaria, asume un proyecto con SemVer independiente y contenido en Markdown en rutas convencionales), esta variante existe porque este repo diverge en tres puntos reales:

1. **Guía propia:** este proyecto ya tiene su propio checklist de documentación — `public/docs/guia_documentacion_proyectos.md` (19 puntos, inspirado en `documentacion_bodega_frio_v2`) — que es la fuente de verdad de estructura aquí, no la Guía de Polaria.
2. **Versión y CHANGELOG compartidos:** `CHANGELOG.md` de este repo no versiona solo este hub — versiona **el producto Polaria WMS completo**, compartido entre `polaria-wms-web`, `polaria-wms-api`, `polaria-wms-db`, `Widget-react` y este hub. Un cambio en cualquiera de esos 4 repos puede requerir una entrada aquí, aunque el código de este hub no haya cambiado.
3. **Contenido en JS, no solo Markdown:** buena parte de la documentación real no son archivos `.md` en rutas convencionales — son módulos JS hechos a mano (`src/data/polaria*Doc.js`) con el Markdown embebido como texto (template literals o arrays de líneas), que un portal React (`src/docs/`) renderiza. Editar estos módulos sigue siendo quirúrgico con `Edit`, pero el `old_string`/`new_string` debe respetar la sintaxis JS (comillas, comas, backticks) además del texto en sí.

**Principio de orquestación:** igual que la versión genérica, esta skill decide **qué** artefacto toca un cambio y **dónde** vive — la estructura de cada artefacto la define `guia_documentacion_proyectos.md`, no esta skill.

---

## Mapa de artefactos de este Dev Hub

| Elemento (de la guía propia) | Prioridad | Dónde vive en `flujos` | Nota |
|---|---|---|---|
| 1. README.md | Alta | raíz | Incluye "Versión de producto" — debe coincidir con `VERSION` y `polariaWmsMeta.js` |
| 2. Diagrama de arquitectura | Alta | `src/architecture/*.jsx` + `src/data/projectArchitecture.js`, `polariaArchitectureDoc.js`, `projectStructureTrees.js`, `polariaStructureTrees.js` | Portales interactivos, no Markdown suelto |
| 3. Contrato de API | Alta | **No vive aquí** — Swagger en `polaria-wms-api` (`/api/docs`) | Si el cambio es de API, señalar que corresponde documentarlo en ese repo, no en este hub |
| 4. Variables de entorno | Alta | **No vive aquí** — `.env.example` de cada repo de código | Fuera de alcance de este hub |
| 5. Instalación | Alta | sección del README de este hub (para levantar el Dev Hub) | Instalación del producto en sí vive en cada repo de código |
| 6. CONTRIBUTING | Alta | **No existe todavía en este repo** | Si un cambio lo requiere, confirmar con el usuario antes de crearlo — no está en el Mapa de los 21 de Polaria por defecto aquí |
| 7. Glosario | Alta | `src/data/polariaGlossaryDoc.js` (`GLOSSARY_ROWS`, tabla `Término / Definición / En el sistema`) | JS, no Markdown |
| 8. Flujos de negocio | Alta | `src/data/flowsData.js`, `appDevelopmentFlow.js`, `bodegaDocSubflows.js`, `bodegaStepByStepData.js` + diagramas interactivos | JS, no Markdown |
| 9. ADRs | Media | **No existen en este repo** | Si un cambio amerita uno, preguntar antes de inventar convención/ubicación |
| 10. Testing y CI | Media | `src/data/polariaTestingDoc.js` | JS |
| 11. Runbooks | Media | `src/data/polariaRunbooksDoc.js` (`formatPolariaRunbooksMarkdown()`) | JS |
| 12. Onboarding | Media | `src/data/polariaOnboardingDoc.js` | JS |
| 13. CHANGELOG y versionado | Media | `CHANGELOG.md` (raíz) — **compartido entre los 4 repos + este hub** | Ver "Versión compartida" abajo |
| 14. Seguridad | Media | `src/data/polariaSecurityDoc.js` | JS |
| 15. Entornos | Media | No hay archivo dedicado hoy — confirmar con el usuario si aplica antes de crear uno | — |
| 16. Observabilidad | Baja | No hay archivo dedicado hoy | — |
| 17. Migraciones entre versiones mayores | Baja | Se mencionan inline en `CHANGELOG.md` (ej. "Migración 083") — los archivos de migración viven en `polaria-wms-db`, no aquí | Solo la referencia/número va en el CHANGELOG de este hub |
| 18. Catálogo UI (Storybook) | Baja | No aplica — este hub no tiene Storybook | — |
| 19. Cumplimiento normativo | Baja | No hay archivo dedicado hoy | — |

**Fuera del Mapa — no tocar con esta skill:**
- `public/docs/manual-usuario/` y `src/data/userManualRegistry.js` — manuales de usuario final, con su propia skill `manuales-usuario-metadata-drive` (metadatos de roles + sincronización a Google Drive). Si un cambio requiere actualizar un manual, señalarlo y remitir a esa skill en vez de tocarlo desde aquí.
- `public/docs/formularios/schemas/` — schemas de validación de formularios, protocolo v1.0 aparte, no documentación técnica del Mapa.
- `public/docs/novedades_*.md` — notas de "novedades" por fecha, independientes del CHANGELOG; solo tocarlas si el usuario lo pide explícitamente además del CHANGELOG.

**No todos los puntos aplican siempre** — si un cambio no toca ninguno de los que sí viven en este hub (por ejemplo, un fix interno de `polaria-wms-api` sin impacto visible), decirlo explícitamente y no forzar una entrada.

---

## Versión compartida — cómo funciona aquí

Tres lugares deben quedar en sync cuando el producto sube de versión:

1. `VERSION` (raíz) — versión de este hub.
2. `package.json` → campo `version` — debe coincidir con `VERSION`.
3. `src/data/polariaWmsMeta.js` → `POLARIA_WMS.productVersion` — alimenta los callouts de estado (`POLARIA_STATUS_CALLOUT`) que se muestran dentro del glosario, runbooks, etc. **Puede quedar rezagado** respecto a `VERSION`/`package.json`/README si nadie lo actualiza a mano tras un cambio en otro repo — es exactamente el tipo de desincronización que esta skill debe detectar y ofrecer corregir.

El README también muestra "**Versión de producto: X.X.X**" en la primera línea — debe coincidir con los tres anteriores.

**Paso extra respecto a la versión genérica:** antes de aplicar el Paso 2 (determinar tipo de versión SemVer), preguntar o confirmar en qué repo ocurrió el cambio real (`polaria-wms-web`, `-api`, `-db`, `Widget-react` o este mismo hub) — el SemVer se evalúa sobre el impacto en el **producto completo**, no solo en el código de este hub. Si el cambio ya trae consigo un número de versión de producto decidido en otro repo/conversación, usar ese número directo en vez de recalcularlo aquí; si no, aplicar el mismo checklist MAJOR/MINOR/PATCH de la versión genérica (ver Paso 2 abajo), mirando el impacto en el producto, no solo en `flujos`.

---

## Triggers

**MODO A — Cambio aprobado:** frase exacta `"Documenta el cambio aprobado"`. Sin esa frase, no se activa aunque haya cambios discutidos o probados en la conversación.

**MODO B — Cierre de hilo / fin de sesión:** frases como "cerremos el hilo", "abrimos otro chat", "cierro aquí", "nuevo hilo", o el equivalente de fin de sesión de trabajo sobre el Dev Hub o sobre cualquiera de los 4 repos del producto si la conversación tocó documentación de este hub.

**MODO INIT — no aplica aquí:** este repo ya tiene documentación — si algún artefacto puntual del Mapa no existe todavía (CONTRIBUTING, ADRs, entornos, observabilidad, compliance), tratarlo como creación puntual dentro de MODO A/B (confirmando con el usuario antes de crear), no como una inicialización completa de proyecto nuevo.

---

## Herramientas

| Acción | Herramienta | Nota |
|---|---|---|
| Leer archivo o sección | `Read` | Obligatorio antes de editar, tanto `.md` como `.js` |
| Reemplazo quirúrgico | `Edit` | En archivos `.js`, el `old_string`/`new_string` debe incluir la sintaxis JS exacta (comillas, comas, backticks) — no solo el texto en prosa |
| Buscar una sección/fragmento | `Grep` | Útil para ubicar el bloque exacto en `src/data/*.js` |
| Crear archivo nuevo | `Write` | Solo para artefactos del Mapa que hoy no existen y el usuario confirmó crear |

---

## Protocolo de ejecución — MODO A

### Paso 1 — Leer el contexto del cambio aprobado

Identificar: en qué repo ocurrió (`polaria-wms-web`, `-api`, `-db`, `Widget-react` o `flujos`), qué componente/endpoint/tabla/flujo cambió, valor anterior vs. nuevo, y si es bug, mejora o funcionalidad nueva. Si no es evidente en la conversación, preguntar una sola vez.

### Paso 2 — Determinar tipo de versión (SemVer del producto)

**Es MAJOR si cualquiera es SÍ:**
- ¿Rompe compatibilidad con la BD o con integraciones externas (Mateo, widget)?
- ¿Se rediseña la arquitectura de un módulo del producto?
- ¿Se elimina o reemplaza un componente principal?
- ¿El usuario final o un integrador necesita adaptar su forma de usar el sistema?

**Es MINOR si cualquiera es SÍ:**
- ¿El usuario puede hacer algo nuevo que antes no podía (en cualquiera de los 4 repos)?
- ¿Se agrega una integración, módulo o rol nuevo?
- ¿Se expone una capacidad nueva sin romper las existentes?

**Es PATCH si cualquiera es SÍ:**
- ¿Es corrección de un error reportado o detectado?
- ¿Es un ajuste interno sin cambio de comportamiento visible?
- ¿Es una migración de BD sin cambio de comportamiento para el usuario?

Incremento: PATCH x.x.X→x.x.(X+1) · MINOR x.X.x→x.(X+1).0 · MAJOR X.x.x→(X+1).0.0. Evaluar de arriba hacia abajo, gana el primer bloque con al menos un SÍ. Justificar siempre qué pregunta respondió SÍ.

### Paso 3 — Identificar qué artefactos del Mapa toca este cambio

Usar la tabla de "Mapa de artefactos de este Dev Hub" arriba. Ejemplos:
- Un endpoint nuevo/modificado en `polaria-wms-api` → **no** se documenta aquí (vive en Swagger de ese repo); solo señalar si el cambio también afecta un flujo de negocio documentado en `flowsData.js`.
- Una migración de BD → línea en `CHANGELOG.md` (sección "Base de datos", igual que las entradas existentes) referenciando el número de migración.
- Un rol o capacidad nueva → `polariaGlossaryDoc.js` (si introduce término nuevo) y/o `wmsRoles.js` si es un rol.
- Un cambio de arquitectura → `src/data/projectArchitecture.js`/`polariaArchitectureDoc.js`.
- Casi cualquier cambio de producto → entrada en `CHANGELOG.md`, con el mismo formato que las entradas existentes (`### Añadido`/`### Cambiado`/`### Base de datos`, cerrando con "La generación de diseño sigue siendo V2. El número de producto es X.X.X.") y, si corresponde, sync de versión (ver sección de arriba).

Si un artefacto relevante no existe todavía en el Mapa (CONTRIBUTING, ADRs, entornos, observabilidad, compliance), confirmar con el usuario antes de crearlo — no forzar la estructura de la Guía genérica de Polaria sobre este repo.

### Paso 4 — Presentar autorizaciones una por una

```
¿Me autorizas a reemplazar esto:

[bloque de texto/código actual — copiado exacto del archivo, incluida sintaxis JS si aplica]

por esto:

[bloque nuevo]

en [nombre del artefacto] (`ruta/del/archivo`)?
```

Una autorización por cambio. Esperar respuesta explícita antes de seguir. Si se rechaza, registrar y continuar con la siguiente. Si se pide modificar, ajustar y volver a presentar la misma autorización.

### Paso 5 — Ejecutar Edit por cada autorización aprobada

1. `Edit` con `old_string`/`new_string` exactos (sintaxis JS íntegra en archivos `.js`).
2. Confirmar: `✓ Actualizado en [archivo] — [artefacto]`.
3. Siguiente autorización pendiente.

Si `old_string` no es único, agregar contexto o usar `replace_all` solo si el reemplazo debe aplicarse a todas las ocurrencias intencionalmente.

### Paso 6 — Verificación final

Mostrar el conteo por archivo tocado, incluyendo si la versión (`VERSION`, `package.json`, `polariaWmsMeta.js`, README) quedó en sync o si algún archivo de esos tres quedó pendiente de actualizar y por qué.

---

## Protocolo de ejecución — MODO B (cierre de hilo / fin de sesión)

### Paso B1 — Leer los artefactos del Mapa relevantes al hilo (silenciosamente)

### Paso B2 — Comparar contra lo trabajado en el hilo

```
Dev Hub `flujos` — Polaria WMS
  [Artefacto 1, ej. CHANGELOG]: [sin cambios / N cambios detectados]
  [Artefacto 2, ej. polariaGlossaryDoc.js]: [sin cambios / N cambios detectados]
  Versión (VERSION / package.json / polariaWmsMeta.js / README): [en sync / desincronizada — detalle]
  ... (uno por artefacto tocado durante el hilo)
```

### Paso B3 — Aplicar cambios locales

Si hay cambios, seguir el flujo de MODO A (Pasos 2→3→4→5→6) — el Paso 2 (SemVer) no se omite. Si no hay cambios, decirlo y pasar a B4.

### Paso B4 — Project Update en Linear (si aplica)

Este Dev Hub no tiene necesariamente un único Project de Linear equivalente al de un repo de código — antes de intentar publicar, preguntar a qué Project de Linear corresponde el trabajo de este hilo (si no es evidente) en vez de asumir uno. Si el trabajo no está asociado a ningún Project, decirlo explícitamente (`Sin Project Update — este trabajo no está asociado a ningún Project de Linear.`) y pasar a B5 sin bloquear el resto del cierre. Si sí hay Project, publicar con `save_status_update` (`type: project`, `health` inferido del avance real) siguiendo la misma plantilla de avance que la versión genérica de `doc-updater`.

### Paso B5 — Prompt de continuidad

```
Continuamos [tema/hilo].
Archivos actualizados: [lista solo de los archivos con cambios reales]
Versión: [en sync / desincronizada — detalle]
Project Update en Linear: [publicado / no publicado — motivo]
Próximo paso: [acción concreta y específica].
```

### Paso B6 — Cierre

Listar por nombre los archivos modificados. Si nada cambió, decirlo explícitamente.

---

## Reglas de operación

1. **Nunca reescribir un archivo existente completo** — solo `Edit` quirúrgico, incluso en los módulos `.js`. `Write` solo para artefactos que no existían.
2. **Nunca ejecutar un Edit sin autorización explícita** del usuario.
3. **Siempre leer los archivos con `Read`** antes de empezar y antes de cada `Edit`.
4. **El tipo de versión lo determina el checklist del Paso 2**, mirando impacto en el producto completo, no solo en el código de este hub.
5. **Todo cambio de versión lleva su justificación explícita**, y debe reflejarse en los tres lugares (`VERSION`, `package.json`, `polariaWmsMeta.js`) más el README — nunca actualizar uno sin verificar los otros tres.
6. **Una autorización por cambio.**
7. **Si un Edit falla** en un archivo `.js`, mostrar el fragmento exacto que falló (incluida la sintaxis JS) y pedir confirmación antes de reintentar.
8. **No documentar cambios en prueba** — si el usuario menciona que algo se está evaluando, detener y esperar nueva instrucción.
9. **Nunca insertar saltos de línea manuales a mitad de una oración o viñeta** — cada párrafo, viñeta, celda de tabla o línea de array/template literal que se escriba o edite va en una sola línea de texto.
10. **No tocar manuales de usuario ni schemas de formularios desde esta skill** — remitir a `manuales-usuario-metadata-drive` o al protocolo de validación v1.0 respectivamente.
11. **Si no es evidente en qué repo ocurrió el cambio que dispara esta skill**, preguntar antes de decidir qué artefactos toca — no asumir que todo cambio es de este hub.

---

## Manejo de errores comunes

| Error | Causa | Acción |
|---|---|---|
| `Edit` no encuentra el `old_string` en un módulo `.js` | El texto real incluye comillas/backticks/comas que no se copiaron exactos | `Read`/`Grep` la sección, mostrar el fragmento real y pedir confirmación |
| `Edit` dice que el `old_string` aparece más de una vez | Texto repetido (común en tablas como `GLOSSARY_ROWS`) | Incluir más contexto de la fila completa, o `replace_all` solo si es intencional |
| El cambio viene de un repo de código y no es evidente si afecta a este hub | Cambio interno sin impacto documentado | Preguntar explícitamente si corresponde entrada en el Mapa de este hub, o si vive solo en el repo de origen |
| `VERSION`/`package.json`/`polariaWmsMeta.js` no coinciden entre sí | Alguno quedó desincronizado de una sesión anterior | Señalarlo explícitamente en el Paso 6/B2 y ofrecer corregir los tres a la vez, no solo el que disparó el cambio actual |
| No se puede resolver el Project de Linear en B4 | Este hub no tiene un Project 1:1 evidente | Preguntar antes de publicar — nunca adivinar el proyecto destino |
| Cambio en la conversación ambiguo | Varios cambios discutidos, no está claro cuál fue aprobado | Una sola pregunta de aclaración antes de continuar |
