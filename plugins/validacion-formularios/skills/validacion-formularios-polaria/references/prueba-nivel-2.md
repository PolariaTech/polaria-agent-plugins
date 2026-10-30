# Prueba automatizada del Nivel 2 (Paso 5)

Procedimiento para verificar el Nivel 2 de un formulario con el runner (`scripts/nivel2-runner.js`) en lugar del recorrido manual. El Nivel 2 es la tabulación, el foco, los campos deshabilitados, el modal, la confirmación de descarte y las advertencias de pre-llenado. Los Niveles 1, 3, 4 y 5 siguen en el checklist manual del Paso 5.

El runner genera los casos C1 a C8 desde el schema, los ejecuta en el navegador y devuelve un reporte. El veredicto de cada caso lo decide código, no tú. Nunca guarda datos: bloquea toda petición que modifique datos y el único cierre del formulario que hace es "descartar". En C7 y C8 también pulsa el botón de confirmar de la advertencia de pre-llenado, con esa guardia activa.

## Antes de empezar

- La aplicación del dev corre en `http://localhost:3001` (si el dev usa otro puerto, pregúntalo y úsalo en el punto 5).
- El MCP `playwright` del plugin responde (herramienta `browser_run_code_unsafe`). Si no está disponible, dile al dev que reinicie la sesión del editor para cargar el MCP y usa el checklist manual del Paso 5 mientras tanto.
- Node.js está instalado (lo exige el hook del plugin).

## Procedimiento

1. **Ubica el schema.** Usa `schemas/schema_<formulario>.md` de la copia de trabajo de este repo si existe; si no, el del repo de flujos (la misma búsqueda del Paso 1 de la skill). Anota de dónde salió: `working_copy` si es de este repo, `flujos` si es del repo de flujos.
2. **Obtén el JSON del schema** (formato 1.0 de `FORMATO_JSON_EXPORTACION_SCHEMAS_FORMULARIOS_v1.0.md`).
   - Si el schema es del repo de flujos y existe `public/docs/formularios/schemas-json/<nombre del schema>.json`, úsalo tal cual.
   - Si no existe, o si el schema es de la copia de trabajo de este repo, conviértelo: `node "<raíz del plugin>/skills/validacion-formularios-polaria/scripts/schema-a-json.mjs" <ruta del schema .md> .git/polaria-nivel2/<nombre del schema>.json`.
   - Si el conversor termina con error, muestra su mensaje al dev y sigue con el checklist manual del Paso 5. NUNCA armes el JSON a mano ni lo deduzcas del `.md`.
3. **Revisa la Tabla 4.** Lee `prueba_nivel_2` del JSON. Si es `null`, dile al dev que el schema no tiene Tabla 4 (rol, ruta, pasos para abrir, botones y localizadores), lista qué le falta y sigue con el checklist manual del Paso 5.
4. **Arma el código.** Desde la raíz del repo, corre:
   `node "<raíz del plugin>/skills/validacion-formularios-polaria/scripts/armar-codigo.mjs" --schema <ruta del JSON> --base-url http://localhost:3001 --production-url <URL de producción de la app> --schema-source <working_copy|flujos>`
   - Salida 0: imprime la ruta de un archivo dentro de `.git/`. Ese archivo lleva las credenciales: NUNCA lo abras, lo pegues en el chat ni lo copies al proyecto.
   - Salida 3: faltan las credenciales del rol. La salida lista los nombres de las variables. Pídele al dev el usuario y la contraseña de prueba de ese rol, recomiéndale guardarlas en su `.env` con esos nombres (git lo ignora), y repite el punto 4 con las variables en el entorno de ese comando. NUNCA las escribas tú en un archivo del repo ni las repitas en el chat.
   - Salida 1: error de uso o de lectura. Muestra el mensaje y detente.
5. **Ejecuta.** Llama a `browser_run_code_unsafe` del MCP `playwright` solo con el parámetro `filename` igual a la ruta impresa en el punto 4. NUNCA pases el contenido del archivo en `code`.
6. **Borra el archivo del código** apenas termine, haya salido bien o mal: `node "<raíz del plugin>/skills/validacion-formularios-polaria/scripts/armar-codigo.mjs" --borrar <ruta>`.
7. **Interpreta el reporte** (`verification_report`, JSON). Si `summary` es `could_not_validate`, muestra `environment_error.stage` y `environment_error.message` al dev y sigue con el checklist manual; no cuentes eso como PASS ni como FAIL.
8. **Muestra el checklist** con el formato de abajo. Copia `expected`, `observed` y `reason` tal cual, sin reescribirlos. No pegues `screenshot_png_base64`: di en cuál caso hay captura.
9. **Si hay algún FAIL:** el formulario "no pasa". NUNCA ofrezcas publicarlo como aprobado. Corrige según el Paso 3, repite el Paso 4 y vuelve a ejecutar esta prueba.
10. **Si todos los casos ejecutables pasan** (`summary` = `passes`): ofrece publicar el checklist con el del Paso 5, junto con la salida de las pruebas del Paso 4, en el issue de Linear del cambio (`save_comment` del MCP de Linear) o, si no hay issue, como texto para pegar en la descripción del PR. Publica solo después de la confirmación explícita del dev.

## Formato del checklist

```
### Nivel 2 automatizado — <form_name> (<form_id>)
Resultado: <passes | fails | could_not_validate> · Schema: <schema_source> (<schema_hash>) · Runner <runner_version> · <environment> <base_url> · <duration_ms> ms

| Caso | Campo | Resultado | Esperado | Observado / motivo |
|---|---|---|---|---|
| C1 | — | PASS | … | … |
| C2 | codigo | NO EJECUTABLE | … | <reason> |
```

`result`: `pass` = PASS, `fail` = FAIL, `not_executable` = NO EJECUTABLE. Los casos NO EJECUTABLE no cuentan como PASS: el dev los recorre a mano en el checklist del Paso 5.

## Qué hace el runner y qué no

- Abre el formulario con los `pasos_abrir` de la Tabla 4, solo con datos del schema. Si falta un dato (localizador, botón, valor de prueba, registro), el caso queda NO EJECUTABLE con el dato faltante.
- C7 y C8 hacen clic en Guardar solo para provocar la advertencia; mientras dura ese intento aborta toda petición que no sea de lectura. Si la aplicación guardara sin advertir, la petición no sale y el caso queda en FAIL.
- Rechaza cualquier `--base-url` que empiece con la URL de producción.
- Nunca incluye las credenciales en el reporte.
