# ESTÁNDARES DE DISEÑO DE WORKFLOWS N8N

*Polaria | Técnico*

## Glosario

| Término | Significado |
|---|---|
| Workflow | Un flujo de n8n con su propio trigger. |
| Sub-workflow | Workflow que empieza con el nodo **Execute Sub-workflow Trigger** y solo se ejecuta cuando otro workflow lo llama. |
| Trigger de evento | Trigger que se dispara cuando llega algo desde fuera: webhook, mensaje, formulario, cola. No lo es un Schedule. |
| Payload crudo | Los datos tal como los entrega el trigger, antes de que un nodo los normalice. |
| Nodo de sesión | Nodo Edit Fields que arma los datos de una conversación o solicitud. Cuando hay varios canales de origen, hay una variante por canal. |
| Error Workflow | Ajuste de n8n (**Workflow Settings → Error Workflow**) que indica qué workflow se ejecuta cuando este falla. |
| Error Handler | El workflow de Polaria al que apunta ese ajuste. Empieza con el nodo **Error Trigger**. |
| Publicar | Poner un workflow a funcionar en producción (antes n8n lo llamaba "activar"). |
| Ejecución | Una corrida completa de un workflow. Es la unidad que cobra el plan de n8n Cloud. |
| Ejecución manual | Corrida lanzada desde el editor (botón de ejecutar o URL de test de un webhook). No cuenta para el plan. |
| Pin data | Datos de entrada fijados en un nodo para repetir una prueba sin llamar al sistema de origen. Solo se usa en ejecuciones manuales. |
| Idempotencia | Propiedad de un workflow que, si recibe dos veces el mismo evento, produce el mismo resultado que si lo hubiera recibido una sola vez. |
| `versionId` | Identificador que n8n asigna a cada versión guardada de un workflow; aparece dentro del JSON exportado. |
| JSON exportado (o descargado) | El archivo que baja n8n desde el menú del workflow → **Download**. Trae nodos, conexiones, settings, tags, pin data y `versionId`. |
| Copia DEV (copia de desarrollo) | Copia del workflow donde se construye y prueba un cambio antes de pasarlo a producción (P5). |
| Veredicto | Resultado del Gate de Calidad N8N: `APROBADO`, `RECHAZADO` o `RECHAZADO_JUSTIFICADO` (rechazado, con cada `FAIL` justificado por escrito como falso positivo). |
| Perfil | Conjunto de reglas que depende del hosting de n8n. El vigente es n8n Cloud, plan Starter. |

## 1. Contexto

Aplica a todo workflow de n8n que construya o modifique Polaria, desde el primer nodo, incluidos los sub-workflows y el Error Handler. Lo usa quien construye el workflow y quien lo revisa antes de publicarlo.

La v1.0 salió de los dos primeros workflows de producción (Mateo Support y Minutas) y cubría bien el diseño y la nomenclatura. No decía nada de cómo versionar, probar, separar entornos, evitar duplicados en reintentos ni proteger los webhooks, y su checklist dependía de que quien la llenaba fuera honesto. Esta versión separa lo que vale en cualquier hosting (núcleo común, 4.1) de lo que depende del plan contratado (perfil Cloud Starter, 4.2), para que una migración de hosting solo cambie el perfil.

## 2. Objetivo

Que todo workflow de Polaria sea legible por alguien que no lo construyó, no duplique efectos al reintentarse, tenga su historial en git y se pueda verificar contra criterios objetivos antes de publicarse.

## 3. Pasos

La parte ejecutable por IA de este documento es la revisión de los Criterios de aceptación, que hace el Gate de Calidad N8N (protocolo + plugin `gate-calidad-n8n`, separado del Gate de Calidad Técnica). Los workflows que ya están en producción se adaptan en su próximo cambio, no en bloque.

**Paso 1**

Quien construye trabaja en la copia de desarrollo del workflow (4.2, P5) aplicando las reglas de 4.1 y 4.2, ejecuta las pruebas de N11 y agrega al `CHANGELOG.md` del proyecto la entrada del cambio con los casos probados y su resultado. El `versionId` se añade a esa misma entrada después de publicar (N9).

**Criterio de salida:**

- La copia de desarrollo pasa el camino feliz y al menos un caso de error, y la entrada del `CHANGELOG.md` los lista.

**Paso 2**

Quien construye descarga el JSON de la copia de desarrollo (menú del workflow → **Download**) y la revisa con el Gate de Calidad N8N contra los Criterios de aceptación "antes de publicar". El reporte va al issue de Linear.

**Criterio de salida:**

- El veredicto del gate es `APROBADO`, o `RECHAZADO_JUSTIFICADO` con la justificación de cada `FAIL`, y el reporte completo está en Linear.

**Paso 3**

Quien construye pasa el cambio a producción (P5), publica y ese mismo día aplica N9 (JSON en git, commit y `CHANGELOG.md` con el `versionId`).

**Criterio de salida:**

- El Gate de Calidad N8N marca en PASS el criterio 23.

## 4. Reglas

### 4.1 Núcleo común

#### N1. Nombres de workflows

Formato: `[Dominio] - [Acción] - [Destino]`. Excepciones de formato: sub-workflows reutilizables y el Error Handler (N4) y copias de desarrollo (P5).

| Regla | Por qué existe |
|---|---|
| Dominio = sistema o área (`Mateo Support`, `RAG`, `Minutas`); Acción = verbo en infinitivo; Destino = sistema o resultado final. Mayúscula inicial en cada palabra salvo artículos y preposiciones. | El nombre tiene que decir qué hace sin abrir el workflow. |
| Si el nombre necesita "y", el workflow tiene dos responsabilidades y se divide. | Un workflow con dos responsabilidades se rompe entero cuando cambia una de ellas. |
| El nombre nunca lleva versión. La versión vive en el changelog con su `versionId` (N9). | Un nombre con versión queda desactualizado en el primer cambio. |
| Todo workflow lleva dos tags: entorno (`producción` o `desarrollo`) y proyecto (`mateo-support`, `rag`, `minutas`). | Permite filtrar en n8n qué está en producción y de qué proyecto es. |

| ✅ Correcto | ❌ Incorrecto |
|---|---|
| `RAG - Indexar Manual de Usuario - Supabase` | `Subir manual` |
| `Minutas - Archivar Minuta - Google Drive` | `Minutas - Organizar y Archivar - Google Drive` (dos responsabilidades) |
| `Mateo Support - Atender Mensaje - WhatsApp` | `Mateo Support - v1.2.0 testing` (sin acción ni destino, con versión) |

#### N2. Nombres de nodos

Formato: `[Prefijo:] Verbo + Objeto [+ Contexto]`.

| Regla | Por qué existe |
|---|---|
| Verbo en infinitivo y en español. Mayúscula inicial en cada palabra salvo artículos y preposiciones (`de`, `del`, `en`, `por`, `a`, `con`). Sin abreviaciones, salvo `DB`. | Se lee el canvas como una secuencia de acciones. |
| Ningún nodo conserva el nombre por defecto (`HTTP Request`, `Edit Fields`, `If`, `Code`, `Node 3`, `OpenAI Chat Model1`). | Un nombre por defecto obliga a abrir el nodo para saber qué hace. |
| Agentes: `Agente [Rol] [de/del Objeto]` (ej. `Agente Clasificador de Issue`). Sus sub-nodos llevan el nombre del agente: `Modelo [Agente]`, `Memoria [Agente]`, `Parser [Agente]`. | Deja claro a qué agente pertenece cada modelo, memoria y parser. |

| Prefijo | Cuándo | Ejemplo |
|---|---|---|
| `DB:` | Nodo que consulta o escribe en base de datos | `DB: Buscar Usuario por Teléfono` |
| `Tool:` | Nodo configurado como tool de un agente | `Tool: Registrar Requerimiento en DB` |
| `OK:` / `ERROR:` | Nodo terminal que devuelve un resultado tipado (éxito o fallo). El código después de `ERROR:` va en `UPPER_SNAKE_CASE`. | `OK: Creado`, `ERROR: INVALID_INPUT` |

#### N3. Nombres de campos

| Regla | Por qué existe |
|---|---|
| Todo campo que crea Polaria (Edit Fields, Code, salida de un parser) va en `snake_case` y en inglés. | Es la misma convención de las columnas de Supabase/Postgres: el campo se llama igual en n8n y en la tabla. Postgres no acepta `camelCase` sin comillas. |
| Los campos que devuelve un nodo de n8n se usan con el nombre que trae (`sessionId`, `pageContent`); no se renombran solo por la convención. | n8n no fija convención para campos de workflow y sus nodos devuelven `camelCase`; renombrarlos agrega nodos sin valor. |
| El nombre dice qué valor contiene, sin prefijos de tipo (`str_`, `int_`) ni abreviaciones salvo `id`, `url`, `db`, `api`. | `msg`, `usr`, `temp` o `x` son ilegibles a los tres meses. |

| ✅ Correcto | ❌ Incorrecto |
|---|---|
| `user_phone` | `phone` |
| `message_id` | `id` |
| `message_text` | `texto` |
| `image_url` | `url` |
| `message_sentiment` | `sentimiento` |
| `cleaned_message` | `msg_clean` |
| `created_at` | `createdAt` |

#### N4. Sub-workflows y Error Handler

| Regla | Por qué existe |
|---|---|
| Sub-workflow reutilizable: `UTIL - [Verbo] [Objeto]` (ej. `UTIL - Validar Email`). | Identifica a simple vista los workflows que otros llaman. |
| Polaria tiene un solo Error Handler para todos los workflows: `Polaria - Error Handler`. No se crean Error Handlers por workflow ni por proyecto. | El **Error Trigger** ya entrega el nombre del workflow y el nodo que falló, y todas las alertas van al mismo rol; un handler por workflow o por proyecto duplica lógica sin agregar información. |
| La descripción de un sub-workflow dice qué recibe y qué devuelve. | Quien lo llama no debería tener que abrirlo. |
| El Error Handler tiene su propio repo, `ERROR_HANDLER`, con la misma estructura que cualquier proyecto n8n (`workflows/`, `docs/`, `CHANGELOG.md`). | No pertenece a ningún proyecto; sin repo propio no tendría historial en git ni documento técnico (N9, N12). |

#### N5. Arquitectura

| Regla | Por qué existe |
|---|---|
| Un workflow = una responsabilidad. | Un cambio en una responsabilidad no rompe las demás. |
| Workflows con trigger de evento: `[Trigger] → [Preparar Payload] → [Remove Duplicates (N6)] → [Router, solo si hay más de una rama] → [Ramas]`. Después de Preparar Payload, ningún nodo lee el payload crudo. En un Schedule no hay payload y ese nodo se omite. | Si el origen cambia su formato, solo se toca un nodo. |
| Antes de un agente o de una rama compleja, un nodo Edit Fields consolida los campos que esa rama necesita; el agente nunca lee nodos lejanos. | Evita dependencias ocultas entre nodos distantes del canvas. |
| Si hay varias variantes de un nodo de sesión, ningún nodo posterior referencia una variante a secas: lee el nodo que las consolida o, si no existe, usa el fallback en cascada de abajo. | Caso POL-113 (01/08/2026): 9 nodos de Mateo Support leían una variante a secas; uno falló en producción con `ExpressionError` cuando la ejecución llegó por otra rama. |
| Sub-nodos de agente (modelo, memoria, parser) conectados por el canal AI, nunca por el canal principal. | Un sub-nodo conectado al canal principal no llega al agente y falla sin error visible. |
| Canvas de izquierda a derecha; ramas paralelas una arriba de otra; sub-nodos de agente debajo del agente. | El canvas se lee en el orden en que se ejecuta. |

Fallback en cascada, solo cuando no existe nodo consolidador:

```js
{{ (() => {
  try { const v = $('Variante A').item.json.session_id; if (v !== undefined && v !== null) return v; } catch {}
  try { const v = $('Variante B').item.json.session_id; if (v !== undefined && v !== null) return v; } catch {}
  return null;
})() }}
```

#### N6. Idempotencia

| Regla | Por qué existe |
|---|---|
| Todo workflow con trigger de evento identifica cada evento con una clave única del origen (ej. `message_id` de WhatsApp) y descarta los repetidos con el nodo **Remove Duplicates** (**Operation:** Remove Items Processed in Previous Executions; **Keep Items Where:** Value Is New; **Value to Dedupe On:** la clave única). | Los orígenes reenvían eventos; sin esta regla, un reenvío duplica respuestas, issues o registros. |
| Toda escritura que se pueda reejecutar usa UPSERT con la clave única, nunca INSERT. | Un reintento con INSERT crea duplicados en la base de datos. |
| Antes de crear algo en un sistema externo que no tiene UPSERT (issue, mensaje, correo), el workflow verifica si ya existe para esa clave. | Reintentar la creación duplica el efecto externo, que no se puede deshacer. |

#### N7. Manejo de errores

Los tres niveles son obligatorios; no son alternativas.

| Nivel | Mecanismo | Cuándo |
|---|---|---|
| Global | **Workflow Settings → Error Workflow** apuntando a `Polaria - Error Handler` | Siempre, salvo en el propio Error Handler |
| Por nodo | **Settings → On Error → Continue (using error output)** con la salida de error conectada | Nodos cuyo fallo se puede recuperar en el mismo flujo |
| Controlado | Nodo **Stop and Error** con mensaje claro | Cuando el flujo detecta una condición inválida |

| Regla | Por qué existe |
|---|---|
| El Error Handler notifica a `polo.alertas@polaria.tech`, nunca al correo personal de una persona. Mientras esa dirección no exista, notifica a `polo@polaria.tech`. El Responsable Técnico tiene acceso a la dirección que se use. | Un correo personal deja de recibir alertas cuando la persona cambia de rol. |
| El Error Handler envía con una credencial de la cuenta `polo`, nombrada por su función (ej. `Polo Alertas`), nunca con la cuenta de una persona; ningún documento copia su ID. | Una credencial atada a una cuenta personal deja de funcionar cuando esa persona sale o cambia su contraseña. |
| La notificación incluye: nombre del workflow, nodo que falló, mensaje de error completo, URL de la ejecución y hora. | Con eso se diagnostica sin depender del historial de ejecuciones, que puede haber expirado. |
| La salida de error de un nodo con **Continue (using error output)** siempre va conectada a algo; nunca queda suelta. | Una salida de error suelta convierte el fallo en silencio. |
| Toda salida de un nodo If o Switch va conectada, o el nodo lleva nota que explica por qué el flujo termina ahí. | Una rama sin conectar descarta datos sin que nadie lo note. |
| Todo HTTP Request tiene **Settings → Retry On Fail** activo con máximo 3 intentos, salvo que su nota explique por qué no se reintenta (ej. una escritura que no es idempotente). | Aplica la primera fila de la tabla de abajo sin depender de que alguien lo recuerde; es la parte de esa tabla que se puede verificar en el JSON. |

| Error | Qué hacer |
|---|---|
| Timeout, 502, 503 | Reintentar con espera creciente, máximo 3 intentos |
| 429 (rate limit) | Nodo Wait con el valor del header `Retry-After` |
| 401 | No reintentar; notificar de inmediato |
| 400 | No reintentar; el problema es el payload |
| Salida de LLM inválida | Reintentar con un prompt más simple; si falla 2 veces, enviar a revisión manual |

#### N8. Seguridad

| Regla | Por qué existe |
|---|---|
| Todo webhook que recibe datos desde fuera exige autenticación (**Header Auth**, **Basic Auth** o **JWT Auth** del nodo Webhook), o verifica la firma del origen cuando el origen la envía (ej. Meta). | Una URL de webhook sin autenticación la puede llamar cualquiera que la conozca. |
| Toda clave, token o contraseña vive en el gestor de credenciales de n8n; nunca en un nodo Edit Fields, en una expresión, en un nodo Code ni en una nota. | Lo que está en un nodo queda en el JSON exportado, en git y en el historial de ejecuciones. |
| El pin data de pruebas usa datos inventados, nunca datos reales de usuarios. | El pin data se guarda dentro del workflow y viaja al JSON exportado y a git (N9). |
| Las notas de nodo y la descripción del workflow no contienen datos personales ni secretos. | Son visibles para cualquiera con acceso al workflow y al repo. |
| Un nodo que ejecuta comandos o toca archivos (Execute Command, SSH, FTP, Read/Write Files from Disk y similares) o un nodo de comunidad lleva nota que justifica por qué se usa. | La auditoría de seguridad de n8n los marca como riesgo: pueden ejecutar código o leer archivos del servidor. |
| Un query SQL recibe los valores por **Query Parameters** (`$1`, `$2`), nunca con expresiones `{{ }}` dentro del texto del query. | Una expresión dentro del query permite inyección SQL; la auditoría de seguridad de n8n lo marca como riesgo. |

#### N9. Versionado en git

| Regla | Por qué existe |
|---|---|
| Cada workflow tiene su JSON en `workflows/` del repo del proyecto, con el nombre del workflow en minúsculas y guiones (ej. `workflows/rag-indexar-manual-de-usuario-supabase.json`). | Git es el único historial que no depende del plan de n8n y permite comparar versiones. |
| El mismo día de cada publicación, quien publicó exporta el JSON (menú del workflow → **Download**), reemplaza el archivo en `workflows/` y hace commit. | Si el JSON del repo no coincide con lo publicado, git deja de servir como respaldo. |
| El commit y la entrada del `CHANGELOG.md` del proyecto citan el `versionId` publicado. | Relaciona cada cambio de git con la versión exacta de n8n. |

#### N10. Entornos

| Regla | Por qué existe |
|---|---|
| Nunca se edita directamente un workflow publicado en producción. Los cambios se construyen y prueban en una copia de desarrollo y después se pasan a producción. La forma concreta depende del perfil (P5). | Un error a medio editar en producción lo sufren los usuarios reales. |

#### N11. Pruebas

| Regla | Por qué existe |
|---|---|
| Antes de publicar, el workflow se ejecuta al menos con el camino feliz y con un caso de error, usando pin data o la URL de test del webhook. | Un workflow que nunca corrió completo falla por primera vez frente a un usuario. |
| Cada caso probado queda como pin data en la copia de desarrollo, y la entrada del `CHANGELOG.md` lista los casos ejecutados y su resultado. | Permite repetir las mismas pruebas en el próximo cambio y deja evidencia verificable. |
| Toda salida de un LLM se valida contra la estructura esperada (parser estructurado o nodo If) antes de escribirla en una base de datos o enviarla a un sistema externo. | Una salida malformada rompe los nodos siguientes sin error visible. |

#### N12. Documentación

| Regla | Por qué existe |
|---|---|
| Todo nodo que alguien ajeno tardaría más de 10 segundos en entender lleva nota en **Notes**. Siempre: expresiones con lógica condicional, SQL con JOIN o varias condiciones, decisiones de diseño y configuraciones no intuitivas (`alwaysOutputData`, **On Error**). | La lógica no obvia se olvida, también para quien la escribió. |
| La descripción del workflow tiene: qué hace en una línea, `Trigger:`, `Output:`, `Proyecto:` y `Ejecuciones/mes estimadas:` (P2). | Permite entender el workflow y su costo sin abrirlo. |
| Todo workflow en producción tiene su documento técnico en `docs/` del repo del proyecto, según la Guía de Documentación. | El documento es lo que permite mantenerlo a quien no lo construyó. |

#### N13. Anti-patrones que no cubren las reglas anteriores

| Anti-patrón | Qué hacer |
|---|---|
| Loop sin condición de salida explícita | Toda iteración tiene una condición de corte |
| Revisar solo el status code HTTP | Verificar el status code y también la estructura del body (un `200` puede traer un error) |
| Workflow que lee `$json` en un nodo donde convergen varias ramas | Referenciar el nodo por nombre o consolidar antes (N5) |
| Nodos deshabilitados o sin conexión de entrada que quedan en el canvas | Borrarlos antes de publicar; el historial de versiones y git conservan lo anterior |

### 4.2 Perfil n8n Cloud, plan Starter (vigente)

El plan Starter incluye 2.500 ejecuciones al mes, guarda el historial de ejecuciones 1 día y no tiene entornos, integración con git, API pública ni auditoría de seguridad. Estas reglas compensan esos límites.

| # | Regla | Por qué existe |
|---|---|---|
| P1 | Para el consumo del plan, cuentan: cada disparo de un Schedule (aunque no encuentre nada que procesar) y cada request que recibe un webhook publicado. No cuentan: sub-workflows, el Error Handler ni ejecuciones manuales. | Sin saber qué cuenta, no se puede estimar el consumo. |
| P2 | La descripción de cada workflow con trigger propio declara sus ejecuciones al mes estimadas (disparos por día × 30, o eventos esperados por mes). El Responsable Técnico revisa el consumo real en el panel de administración de n8n Cloud el primer día hábil de cada mes; si el total supera el 80 % del plan, revisa primero los workflows con más consumo. | Superar el límite detiene los workflows de producción. |
| P3 | Un Schedule usa la frecuencia más baja que el negocio acepte, justificada en la descripción. Si el origen puede avisar por webhook y los eventos son menos que los disparos del Schedule, se usa webhook. | Cada disparo de Schedule cuesta una ejecución aunque no haya trabajo. |
| P4 | La lógica reutilizable o pesada va en sub-workflows. | Los sub-workflows no consumen ejecuciones del plan: modularizar no cuesta. |
| P5 | Entornos: la copia de desarrollo se llama igual que la de producción más ` - DEV`, lleva el tag `desarrollo` y nunca se publica; se prueba solo con ejecuciones manuales. Para pasar a producción: descargar el JSON de la copia DEV, importarlo en el workflow de producción (menú del workflow → **Import from File**), verificar las credenciales de cada nodo y publicar. Después se aplica N9. | Starter no tiene entornos; las ejecuciones manuales no cuentan para el plan. |
| P6 | Como el historial dura 1 día, el Error Handler envía la información completa de N7 en la propia notificación, sin depender de que el enlace a la ejecución siga vivo. | Un error de un viernes ya no tiene ejecución que revisar el lunes. |
| P7 | Como Starter no tiene API ni auditoría de seguridad, la verificación de N8 se hace sobre el JSON exportado, dentro de los Criterios de aceptación. | Es el único punto donde se puede revisar la seguridad de forma sistemática en este plan. |

## Criterios de aceptación

**Antes de publicar** — sobre el JSON exportado de la copia de desarrollo y los archivos del repo:

| # | Criterio | Falla si… |
|---|---|---|
| 1 | Nombre del workflow | No sigue el formato de N1 o una de sus excepciones (N4, P5), contiene "y", o contiene una versión. |
| 2 | Tags | Falta el tag de entorno o el de proyecto, o la copia DEV no lleva el tag `desarrollo` (P5). |
| 3 | Nodos | Algún nodo conserva un nombre por defecto; un sub-nodo de agente no lleva el nombre de su agente o no está conectado por el canal AI; o un agente lee campos de un nodo que no es su Edit Fields preparador. |
| 4 | Campos | Algún campo creado por Polaria (Edit Fields, Code, parser) no está en `snake_case`, no está en inglés o lleva prefijo de tipo. |
| 5 | Estructura de entrada | En un workflow con trigger de evento no hay Preparar Payload después del trigger, o un nodo posterior lee el payload crudo. |
| 6 | Referencias de sesión | Algún nodo referencia una variante de nodo de sesión a secas, en vez del consolidador o del fallback de N5. |
| 7 | Idempotencia | Un workflow con trigger de evento no tiene Remove Duplicates por clave única; una escritura reejecutable usa INSERT; o se crea algo en un sistema externo sin verificar antes si existe. |
| 8 | Error Workflow | **Error Workflow** no apunta a `Polaria - Error Handler`. |
| 9 | Error Handler | La notificación no va a la dirección de alertas de N7, sale con la credencial de una cuenta personal, o le falta alguno de los datos de N7. |
| 10 | Salidas de error y ramas | Algún nodo con **Continue (using error output)** tiene la salida de error sin conectar, o una salida de If o Switch queda sin conectar y sin nota. |
| 11 | Webhooks | Un webhook que recibe datos desde fuera no tiene autenticación ni verificación de firma. |
| 12 | Secretos y datos personales | Aparece una clave, token o contraseña fuera del gestor de credenciales, o una nota o descripción contiene datos personales. |
| 13 | Pin data | El pin data contiene datos reales de usuarios. |
| 14 | Pruebas | La entrada del `CHANGELOG.md` no lista al menos el camino feliz y un caso de error ejecutados. |
| 15 | Salidas de LLM | Una salida de LLM se escribe o envía sin validar su estructura. |
| 16 | Loops | Una iteración no tiene condición de corte explícita. |
| 17 | Documentación | Falta la descripción con los 5 campos de N12 (4 en sub-workflows y en el Error Handler, que no declaran ejecuciones), un sub-workflow no dice qué recibe y qué devuelve, o falta el documento técnico en `docs/`. |
| 18 | Consumo (perfil Starter) | Un Schedule no justifica su frecuencia en la descripción. |
| 19 | Nodos de riesgo | Un nodo que ejecuta comandos o toca archivos, o un nodo de comunidad, no tiene nota que lo justifique (N8). |
| 20 | SQL con expresiones | Un query SQL lleva expresiones `{{ }}` en vez de Query Parameters (N8). |
| 21 | Nodos sueltos | Queda un nodo deshabilitado o sin conexión de entrada (N13). |
| 22 | Reintentos HTTP | Un HTTP Request no tiene Retry On Fail con máximo 3 intentos y su nota no explica por qué (N7). |

**Después de publicar** — el mismo día:

| # | Criterio | Falla si… |
|---|---|---|
| 23 | Git | El `versionId` del JSON en `workflows/` no coincide con el que muestra n8n para la versión publicada, el archivo no sigue el nombre de N9, o el commit y el `CHANGELOG.md` no citan ese `versionId`. |

Aplicación: el criterio 8 no aplica al propio Error Handler y el criterio 9 solo aplica a él; los criterios 5 y 7 solo aplican a workflows con trigger de evento. Quedan fuera de la revisión, por no poder verificarse sobre el JSON, la tabla de reintentos de N7 (salvo el Retry On Fail de HTTP Request, criterio 22), las notas de nodo de N12 y P4.

## Dependencias

| Protocolo | Cuándo se activa |
|---|---|
| Protocolo de Construcción de Producto desde Cero | Paso 10: estos estándares son la base de la constitución de spec-kit de todo proyecto n8n. |
| Gate de Calidad N8N | Pasos 2 y 3: evalúa los Criterios de aceptación antes y después de publicar. |
| Guía de Documentación | N12: estructura del documento técnico en `docs/`. |
| Protocolo de Construcción de Agentes de IA en N8N | Cuando el workflow incluye agentes de IA. |

## Versión y revisión

v2.1 · aprobada el 24/09/2026 · Responsable Técnico · próxima revisión: al cambiar de plan o de hosting de n8n, o a los 6 meses de aprobada.

_Historial: v2.0 (24/09/2026) núcleo común, perfil Cloud Starter y 19 criterios. v2.1: el Paso 2 pasa al Gate de Calidad N8N; 4 criterios nuevos tomados de la auditoría de seguridad de n8n y de linters de workflows (nodos de riesgo, SQL con expresiones, nodos sueltos, reintentos HTTP); ramas If/Switch en el criterio 10; nodos con verbo en español (N2) y tag `desarrollo` de la copia DEV en el criterio 2; la entrada del `CHANGELOG.md` se escribe en el Paso 1; el Error Handler tiene repo propio (N4); el criterio de git pasa del 19 al 23._
