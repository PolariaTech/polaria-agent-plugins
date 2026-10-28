# Instalar el plugin gestion-linear o el conector de Google Sheets

Úsalo en el paso 2 del modo reclamar, cuando falta la herramienta que lee el ticket. Dale al dev los pasos de **su** herramienta (Claude Code o Cursor), en una lista numerada, y espera a que diga que terminó antes de seguir.

## Falta Linear: no hay ninguna herramienta de Linear en la sesión

Si el dev ya tiene el conector de Linear de claude.ai no hace falta instalar nada. Si no, necesita el plugin `gestion-linear`, que trae el MCP de Linear. Hace falta acceso de lectura al repo `PolariaTech/polaria-agent-plugins`, que los miembros de la organización ya tienen con `gh auth`.

**En Claude Code:**
1. Escribe `/plugin marketplace add PolariaTech/polaria-agent-plugins`.
2. Escribe `/plugin install gestion-linear@polaria-agent-plugins`.
3. Escribe `/mcp`, elige el servidor de Linear y autentícalo con la cuenta de Polaria.

**En Cursor** (requiere Cursor 2.5 o superior):
1. Abre el dashboard de Cursor y entra a Plugins & MCPs, luego a Team Marketplaces.
2. Si `polaria-agent-plugins` no aparece, haz clic en Add Marketplace, elige Import from Repo y pega `https://github.com/PolariaTech/polaria-agent-plugins`.
3. [POR CONFIRMAR: pasos para instalar `gestion-linear` desde ese marketplace]. Si el dev no sabe cómo, díselo así y pídele que lo haga como instala los demás plugins.
4. Abre Cursor Settings, entra a MCP y autentica Linear con la cuenta de Polaria.

## Falta Google Sheets: no hay ninguna herramienta de Google Sheets en la sesión

**En Cursor:**
1. Abre Cursor Settings desde el menú, o presiona Ctrl + coma.
2. Entra a Customize.
3. Escribe "Google Sheet" en la barra de búsqueda.
4. Haz clic en Add.
5. Haz clic en el conector para abrirlo.
6. Haz clic en Authenticate.
7. Elige la cuenta de Polaria.

**En Claude:**
1. Abre Settings desde el menú, o presiona Ctrl + coma.
2. Entra a Conectores.
3. Haz clic en Descubrir.
4. Escribe "Google Sheet" en la búsqueda y haz clic en el conector.
5. Haz clic en Conectar.
6. Si Google te pide elegir una cuenta, elige la cuenta de Polaria.

Si el dev no puede instalarlo en ese momento, que pegue la fila o la descripción del ticket en el chat y sigue desde ahí.

El conector se usa para **leer** el ticket y para cambiar únicamente el Estado (columna G) y el Asignado a (columna J) de la fila de un `REQ-NNN`, como dice `sheet-requerimientos.md`. Nunca llames a sus otras herramientas de escritura (agregar filas u hojas, borrar o limpiar celdas, cambiar otras columnas).
