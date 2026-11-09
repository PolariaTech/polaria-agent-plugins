# Fuentes de investigación en solo lectura: código, n8n y Supabase

Se usa en el Paso 3 de `iniciar-ticket-polaria`. La regla es una sola: durante la investigación no se cambia nada fuera de la carpeta `TMP/`. Lo que no esté en las listas de permitidas de este archivo queda prohibido, aunque el cliente lo ofrezca. Los nombres de herramienta pueden variar según el cliente (Claude Code, Cursor, Claude.ai): usa la herramienta equivalente que haga lo mismo.

## 1. Qué fuentes entran

1. Entran las fuentes que el ticket menciona: el repo (api o web), un workflow de n8n, o una tabla, una función o un log de Supabase.
2. Si el ticket no deja claro cuáles, pregúntale al dev una sola vez: "¿Investigo solo el código, o también n8n o Supabase?".
3. Si entra n8n o Supabase, pregunta qué instancia o proyecto es y si es producción. Dile al dev que vas a consultar solo en lectura.
4. Lanza un subagente de solo lectura por cada fuente, todos al mismo tiempo. Cada uno devuelve el formato del Paso 3 y, al final, una sección "Fuentes consultadas" con cada herramienta que usó y, en Supabase, el texto exacto de cada consulta SQL.

## 2. Código (repo api o web)

Solo lectura del árbol de trabajo: Glob, Grep y Read. Sin editar, crear ni borrar archivos.

## 3. n8n

Permitidas:

| Herramienta | Para qué |
| -- | -- |
| `search_workflows` | Encontrar el workflow por nombre o etiqueta. |
| `get_workflow_details` | Ver los nodos y las conexiones. |
| `get_workflow_history`, `get_workflow_version`, `get_workflow_versions_diff` | Ver cuándo y qué cambió. |
| `search_workflow_executions`, `get_workflow_execution` | Ver ejecuciones pasadas y dónde fallaron. |
| `get_instance_context`, `search_nodes`, `get_node_types` | Contexto de la instancia y de los nodos. |

Prohibidas, sin excepción: `execute_workflow`, `test_workflow`, `publish_workflow`, `unpublish_workflow`, `update_workflow`, `create_workflow_from_code`, `archive_workflow`, `restore_workflow_version`, `move_workflows_to_folder`, `install_community_node`, y cualquier herramienta de datos de tablas que agregue, cambie o borre filas. `execute_workflow` y `test_workflow` están prohibidas porque corren el workflow de verdad y pueden enviar mensajes o cambiar datos.

## 4. Supabase

Permitidas:

| Herramienta | Para qué |
| -- | -- |
| `list_tables`, `list_migrations`, `list_extensions` | Ver la estructura. |
| `get_advisors`, `query_logs` | Ver avisos de seguridad y rendimiento, y logs. |
| `list_edge_functions`, `get_edge_function` | Leer el código de las funciones. |
| `search_docs` | Documentación. |
| `execute_sql` | Solo consultas `SELECT`. Reglas abajo. |

Reglas de `execute_sql`:
- La consulta empieza con `SELECT` o `WITH ... SELECT`. Si lleva `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `COPY` o una llamada a una función que escribe, no la ejecutes.
- Cuenta o filtra por ID. Nunca vuelques tablas completas ni columnas con datos personales (nombres, correos, teléfonos, documentos).
- Siempre con `LIMIT`, máximo 20 filas.
- Si el proyecto es producción, dile al dev el texto de la consulta antes de ejecutarla.

Prohibidas, sin excepción: `apply_migration`, `deploy_edge_function`, `create_edge_function_secret`, `create_branch`, `merge_branch`, `reset_branch`, `rebase_branch`, `delete_branch`, `create_project`, `pause_project`, `restore_project`, y cualquier otra que cree, cambie o borre algo.

## 5. Datos y secretos

- NUNCA copies a `TMP/evidencias/` ni al plan un secreto, una llave, una contraseña o datos personales. Reemplázalos por `<oculto>`.
- Si una consulta o un log devuelve datos personales, resume lo que necesitas (por ejemplo "3 filas con el campo vacío") y no pegues las filas.

## 6. Lo que no cubre el reclamo

El `CLAIM.md` solo reclama archivos del repo.
- Las migraciones de Supabase son archivos del repo (por ejemplo `supabase/migrations/...`): se reclaman como cualquier otro archivo.
- Un workflow de n8n vive en la instancia, no en el repo, y no se puede reclamar. Si el plan cambia un workflow, escríbelo en el plan como "workflow de n8n: <nombre>" y dile al dev que avise a su equipo antes de editarlo, porque nada impide que otra persona lo edite al mismo tiempo.
