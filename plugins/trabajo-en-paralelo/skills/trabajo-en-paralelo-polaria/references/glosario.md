# Glosario: qué significa cada término, aviso y código del plugin

Úsalo cuando un mensaje del plugin, un hook o un comando muestre algo que no entiendes, y para explicárselo al dev con palabras simples. Cada fila dice qué significa y qué hacer. Si agregas un término, un aviso o un código nuevo al plugin, agrégalo aquí en la misma tarea.

## 1. Tickets

| Término | Significado |
| -- | -- |
| `POL-X` (por ejemplo `POL-370`) | Issue de Linear. Su estado lo cambia `gestion-linear`. |
| `REQ-NNN` (por ejemplo `REQ-012`) | Fila de la pestaña `Requerimientos` del Sheet de requerimientos. Su Estado y su Asignado los cambia este plugin (`sheet-requerimientos.md`). |
| `Sin ticket: <motivo>` | Trabajo que todavía no tiene ningún ticket. Solo se usa en la descripción del PR. |
| Tipo del ticket | `Feature` (función nueva), `Improvement` (mejora de algo que ya existe), `Bug` (falla) o `Administrative` (permisos, usuarios o configuración de cuentas). |

## 2. Estados

Los estados del Sheet y los de Linear, y cuál equivale a cuál, están en la tabla de `sheet-requerimientos.md` (sección "Estados"). No los copies a otro lado.

## 3. El reclamo

| Término | Significado |
| -- | -- |
| Reclamo | Aviso público de que un dev va a editar ciertos archivos para un ticket. Vive en el archivo `CLAIM.md` de la rama. |
| `CLAIM.md` | Archivo en la raíz de la rama del ticket. Solo lo escriben `paralelo.js reclamar`, `paralelo.js liberar` y `paralelo.js autorizar`. Su formato está en `formato-reclamo.md`. |
| `ACTIVO` | Valor de `**Estado:**` dentro del `CLAIM.md`: el reclamo está vigente. Para liberar se borra el archivo. |
| Zona | Un archivo exacto que el dev va a tocar (`src/a.ts`) o una función de un archivo (`src/a.ts#miFuncion`). Nunca una carpeta, salvo la excepción `--permitir-carpetas`. |
| Compartido | Archivo que casi todos los tickets tocan (por ejemplo `package.json`). Se cambia lo mínimo y se avisa. |
| Confianza | Número del 1 al 100: qué tan probable es que el diff final quede dentro de las zonas y los compartidos declarados. Cómo se calcula: `estimacion-de-zonas.md`. |
| Reclamar | Crear el `CLAIM.md`, commitearlo y publicar la rama. Comando: `paralelo.js reclamar`. |
| Liberar | Borrar el `CLAIM.md` con un commit y publicarlo. Se hace antes de crear el PR. Comando: `paralelo.js liberar`. |
| Ampliar o autorizar | Agregar archivos al `CLAIM.md` ya publicado. Solo lo puede hacer el dev, en su terminal: `paralelo.js autorizar <ruta>`. |
| Caché de reclamos | Copia local de los `CLAIM.md` de las ramas remotas. La llena `paralelo.js importar-claims` y la leen los hooks. |
| `origin/main` | Rama principal del remoto. El reclamo solo cubre archivos que existen ahí. Un archivo que `origin/main` no tiene se crea sin reclamar. |
| Prefijo de rama | Primera parte del nombre de la rama (`dani`, `lucho`, `mauro`). Sale de `git config user.name`, nunca del usuario del sistema operativo. Comando: `paralelo.js prefijo`. |

## 4. Avisos de choque

| Aviso | Significado | Qué hacer |
| -- | -- | -- |
| `SOLAPE` | Un archivo que quieres reclamar está dentro de la zona reclamada por otra rama. | Detente. Ofrece coordinar con esa persona o tomar otro ticket. |
| `SOLAPE EN COMPARTIDO` | El choque es solo en un archivo compartido. | Sigue y menciónalo al dev. |
| `CONFLICTO REAL` | Otra rama cambió las mismas líneas. | Dile de qué rama y archivos se trata. No resuelvas el conflicto. |
| `MISMO ARCHIVO` | Otra rama toca el mismo archivo, en líneas distintas. | Avisa y sugiere coordinar pronto. |
| `ARCHIVOS DENTRO DE UNA ZONA RECLAMADA` | Alguien cambió archivos dentro de lo que reclamaste. | Avisa y sugiere coordinar con esa persona. |
| `ARCHIVOS PROPIOS FUERA DE LO QUE ... RECLAMÓ` | Editaste archivos que no están en tu `CLAIM.md`. | Ve al Modo E de la skill `trabajo-en-paralelo-polaria`. |

## 5. Códigos de salida de `paralelo.js`

| Código | Significado | Qué hacer |
| -- | -- | -- |
| `0` | Salió bien. | Sigue. |
| `1` | El dev canceló la pregunta de `autorizar`. | No se cambió nada. |
| `2` | Error de uso: falta un argumento o una ruta no es válida. | Lee el mensaje y corrige el argumento. |
| `3` | Choca con el reclamo de otra rama. | Vuelve a cruzar; si el choque sigue, ofrece coordinar o tomar otro ticket. |
| `4` | Falta una terminal interactiva (solo `autorizar`). | Pídele al dev que lo ejecute él en su terminal. |
| `5` | El commit quedó, pero el push falló. | Dile el error. Los demás no ven el reclamo hasta que la rama se publique. |
| `6` | Hay cambios sin guardar en la rama actual. | Dile cuáles son y que los guarde con un commit antes. No los descartes. |
| `7` | La rama actual tiene un reclamo activo de otro ticket. | Pregunta una vez si ese trabajo terminó o queda pausado. |
| `8` | No se pudo determinar el prefijo de la rama. | Pregunta el nombre del dev una vez, o que agregue su primer nombre en `scripts/prefijos.json`. |

## 6. Comandos de `paralelo.js`

| Comando | Para qué sirve |
| -- | -- |
| `sincronizar` | `git fetch` y descarga de cambios nuevos solo si es seguro. Siempre sale con código 0. |
| `importar-claims` | Llena la caché con los `CLAIM.md` de las ramas remotas. |
| `estado` | Muestra qué hay en la caché y qué tan vieja es. |
| `comparar --zonas "..."` | Cruza las zonas que se piensa reclamar con los reclamos ajenos. Solo lee: no escribe nada. |
| `solapes` | Compara la rama actual contra las ramas y los reclamos de los demás. |
| `prefijo` | Imprime el prefijo de rama del dev. |
| `iniciar-rama <rama>` | Cambia a la rama del ticket en el mismo proyecto. |
| `reclamar` | Crea y publica el reclamo. |
| `autorizar <ruta>` | Amplía el reclamo. Solo el dev, en su terminal. |
| `liberar [--volver]` | Borra el reclamo; con `--volver` regresa a la rama principal. |
| `base` | Imprime la rama principal. |

## 7. Flujo de inicio de un ticket

| Término | Significado |
| -- | -- |
| Carpeta de evidencias | `TMP/evidencias/<ID>/` en la raíz del repo: las imágenes y los enlaces que acompañan al ticket, copiados para encontrarlos fácil. |
| `TMP/` | Carpeta local de trabajo, fuera de git (se agrega a `.git/info/exclude`). Guarda las evidencias y los planes pendientes. |
| Plan guardado | Archivo `TMP/<ID>-plan.md` con la causa, los archivos y el plan de un ticket que no se pudo reclamar. Plantilla: `iniciar-ticket-polaria/references/plantilla-plan.md`. |
| Subagente de investigación | Agente aparte, de solo lectura, que busca la causa en el código, en n8n o en Supabase y devuelve una hipótesis. No edita ni ejecuta nada que cambie algo. Las herramientas permitidas están en `iniciar-ticket-polaria/references/fuentes-solo-lectura.md`. |
| Plan Mode (Claude Code) / Plan (Cursor) | Modo en que el asistente solo lee y propone un plan, sin editar ni ejecutar cambios. |
| Cambio trivial | Cambio de solo texto, títulos, nombres o estilos, en un único archivo y sin tocar lógica. No lleva plan. |

## 8. Variable de entorno

| Nombre | Significado |
| -- | -- |
| `POLARIA_PARALELO_MODO=bloquear` | Hace que los avisos de zona ajena y de push bloqueen en vez de solo avisar. El rechazo de escribir fuera del propio `CLAIM.md` es siempre bloqueante, sin esta variable. |
