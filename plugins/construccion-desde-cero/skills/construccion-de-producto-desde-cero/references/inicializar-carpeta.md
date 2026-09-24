# Inicializar la carpeta del proyecto (Paso 9)

Procedimiento literal del Paso 9 de `PROTOCOLO_DE_CONSTRUCCION_DE_PRODUCTO_DESDE_CERO_v1.1.md`. Usa `catalogo-inicializacion.md` para saber qué aplica según el medio. Síguelo en orden, del punto 1 al 9, y no te saltes la confirmación del punto 2. "Responsable" es el Responsable de la iniciativa.

## 1. Datos de entrada

Ya los tienes del Brief de los Pasos 1 a 8, que hasta ahora vive en la conversación (la carpeta todavía no existe). No los vuelvas a preguntar:

- Nombre de la iniciativa, problema, audiencia e hipótesis (Paso 1).
- Editor declarado: Claude o Cursor (Paso 1).
- Recursos de origen: specs, documentos, JSON de workflows, enlaces (Paso 1).
- Medio (Paso 5): software o n8n, con o sin componente de IA. Si es n8n, su tamaño según la sección 1 del catálogo.
- MVP, "Not Doing" y métrica (Paso 8).

Pregunta solo lo que falte:

1. Ruta de la carpeta del proyecto. Si no existe, se crea. Nombre en MAYÚSCULAS con `_` (convención de las carpetas de Polaria, ej. `D:\WORK\POLARIA\N8N\VALIDACION_FORMULARIOS`), salvo que el Responsable indique otro.
2. URL del repo remoto en GitHub, si ya existe. Si no, se anota como pendiente en el punto 5.

## 2. Mostrar el plan de la carpeta y esperar confirmación

Con el catálogo, arma y muéstrale al Responsable, en un solo mensaje:

- El árbol de carpetas que vas a crear (sección 6 del catálogo), solo con lo que aplica a este medio y este editor.
- Los plugins que vas a habilitar (sección 3).
- Los protocolos que aplican (sección 2).
- Los puntos de documentación que se crean ahora y los que quedan marcados para después (sección 5).

Espera su confirmación explícita antes de crear cualquier archivo.

**Si la carpeta ya existe y tiene archivos:** lista lo que ya hay. NUNCA sobrescribas un archivo existente: solo creas lo que falta, y si un archivo existente debería cambiar (ej. un `README.md` que ya está), le propones el cambio al Responsable.

## 3. Crear la base

1. Crea la carpeta si no existe y ejecuta `git init` dentro de ella.
2. Crea `.gitignore` con, como mínimo: `.env`, `.env.*` (menos `.env.example`), `node_modules/`, `.claude/settings.local.json`, y los archivos de sistema operativo (`.DS_Store`, `Thumbs.db`).
3. Crea `docs/brief.md` con el Brief completo de los Pasos 1 a 8, tal como quedó aprobado, incluida su sección "Recursos de origen".
4. Si el medio es n8n, crea `workflows/` con un archivo vacío `.gitkeep` adentro: git no guarda carpetas vacías, y sin él la carpeta desaparece del primer commit si todavía no hay workflows.

## 4. Instalar spec-kit

1. Ejecuta el comando de inicialización de la sección 4 del catálogo, con `--integration` según el editor. Lleva `--force` porque la carpeta ya tiene los archivos del punto 3; por eso solo se ejecuta después de la confirmación del punto 2. spec-kit no borra archivos que ya existen: agrega los suyos (`.specify/`, las skills o comandos `speckit-*`).
2. Ejecuta `specify extension add bug` y `specify extension add assess`.
3. Verifica que existan `.specify/` y `.specify/extensions.yml` con `bug` y `assess`, y que `CLAUDE.md` y `.claude/settings.json`, si ya existían, conserven su contenido.

**Si Windows bloquea `specify.exe`** (mensaje de Device Guard o de Control de aplicaciones): usa el respaldo con el Python de la herramienta de la sección 4 del catálogo, con los mismos argumentos.

**Si `specify` no está instalado, o el respaldo tampoco corre:** dile al Responsable el error exacto y la [guía oficial de instalación](https://github.com/github/spec-kit), anota el pendiente en el punto 5 y sigue con los puntos 5 a 9. El Paso 10 del protocolo no puede empezar hasta resolverlo.

## 5. Configurar el editor y los plugins

**Siempre:** crea `AGENTS.md` con estas secciones, con contenido real y sin texto de plantilla:

- **Qué es este proyecto:** 2-3 líneas sacadas del Brief.
- **Medio y editor:** los del Brief.
- **Protocolos que aplican:** la lista de la sección 2 del catálogo para este medio, con una línea de cuándo entra cada uno.
- **Dónde está cada cosa:** `docs/brief.md`, `docs/CHECKLIST_DOCUMENTACION.md`, `docs/adr/`, `specs/`, y `workflows/` si es n8n.
- **Reglas del proyecto:** las Reglas de Construcción desde Cero que siguen vigentes durante la construcción (sección 5 del protocolo: nada se construye con inconsistencias abiertas de `/speckit.analyze`, el MVP declara qué queda fuera, una sola herramienta de IA).
- **Pendientes de instalación:** una línea por cada cosa que no quedó lista, con el paso del protocolo que la cierra:
  - spec-kit, si falló el punto 4 → se cierra antes del Paso 10.
  - Repo remoto, si no existe todavía → se cierra antes del primer `push` (Paso 13).
  - Proyecto de Linear, si no se crea en el punto 8 → se cierra en el Paso 12.
  - Plugins de Cursor, si el editor es Cursor (lista abajo) → se cierra antes del Paso 10.
  - `versionamiento-polaria`, mientras no tenga plugin → se cierra en el Paso 15.

**Si el editor es Claude:**

1. Crea `CLAUDE.md` con una sola línea: `@AGENTS.md`.
2. Crea `.claude/settings.json` con el marketplace y los plugins de la sección 3 del catálogo que aplican:

```json
{
  "extraKnownMarketplaces": {
    "polaria-agent-plugins": {
      "source": { "source": "github", "repo": "PolariaTech/polaria-agent-plugins" }
    }
  },
  "enabledPlugins": {
    "gate-calidad-tecnica@polaria-agent-plugins": true,
    "auditoria-tecnica@polaria-agent-plugins": true,
    "gestion-linear@polaria-agent-plugins": true
  }
}
```

   Si el medio es n8n: cambia `gate-calidad-tecnica` por `"gate-calidad-n8n@polaria-agent-plugins": true`, y deja también `gate-calidad-tecnica` solo si el repo tendrá código además de `workflows/` (sección 3 del catálogo). Agrega `"validacion-formularios@polaria-agent-plugins": true` solo si el catálogo dice que aplica. Si el archivo ya existe, agrega estas claves sin borrar las que tenga.
3. Dile al Responsable que el marketplace y los plugins se activan cuando cada persona abre la carpeta en Claude Code y confía en ella ("trust"). Hasta entonces no se cargan.

**Si el editor es Cursor:**

1. No crees `CLAUDE.md` ni `.claude/settings.json`: Cursor lee `AGENTS.md`.
2. Cursor no tiene un archivo del repo que declare plugins: se instalan desde su interfaz (Dashboard → Plugins & MCPs → Team Marketplaces), eligiendo alcance de proyecto. Escribe la lista de plugins de la sección 3 del catálogo en "Pendientes de instalación" de `AGENTS.md` y díselo al Responsable.

## 6. Documentación inicial

Solo lo que la sección 5 del catálogo marca como "Al inicializar":

1. **`README.md`:** nombre del proyecto, descripción (del Brief), estado (`En construcción — iniciativa de Construcción desde Cero`) y la sección "Documentación relacionada" con enlaces a lo que existe en `docs/`. Las secciones de instalación, variables y ejecución NO se escriben todavía: se agregan cuando exista el plan (Paso 11).
2. **`docs/CHECKLIST_DOCUMENTACION.md`:** la tabla de los 21 puntos de la sección 5 del catálogo con tres columnas: punto, "Aplica" (Sí / No, con el motivo si es No, según el medio) y "Estado" (`Hecho` para los creados en este paso, `Pendiente` para el resto). Encabezado: "Checklist de la Guía de Documentación Extendida v2.0 — la mantiene `doc-updater`".
3. **`docs/adr/0001-medio-de-construccion.md`:** formato ADR de la guía (punto 9) con la decisión del Paso 5: medio elegido, por qué, alternativas descartadas y riesgos declarados en el Brief. Estado: Aceptado. El stack NO va aquí: se decide en el plan (Paso 11) y se registra en su propio ADR.
4. **`docs/glosario.md`:** solo si el Brief o los recursos traen términos del negocio. Tabla término / significado, solo con los términos que aparecen en esas fuentes.
5. **`llms.txt`:** título, una línea de descripción y un enlace por cada documento que ya existe. Nada que todavía no exista.

## 7. Recursos de origen

Los recursos ya están listados en "Recursos de origen" de `docs/brief.md` (punto 3). Aquí solo:

- **JSON de workflows (n8n):** cópialos a `workflows/` y actualiza su ruta en "Recursos de origen" a la nueva.
- **Specs o documentos de requisitos:** no se copian a `specs/`; el Paso 11 los usa como entrada de `/speckit.specify` desde su ruta original.
- **Otros documentos** (diagramas, notas): se quedan donde están. Solo se copian al repo si el Responsable lo pide, y en ese caso actualizas su ruta.

## 8. Linear (opcional)

Ofrece crear el proyecto en Linear con la skill `linear-crear-proyecto` del plugin `gestion-linear`. Confirma con el Responsable antes, porque es visible para el equipo. Si no lo quiere ahora, déjalo en "Pendientes de instalación" de `AGENTS.md`.

## 9. Primer commit y verificación

1. Si el Responsable dio la URL del remoto en el punto 1, ejecuta `git remote add origin <url>`. NUNCA hagas `push` en este paso.
2. Muéstrale al Responsable el árbol final (`git status` y la lista de archivos creados).
3. Con su confirmación, haz el primer commit local: `Inicializar proyecto <nombre> (Construcción desde Cero, Paso 9)`.
4. Verifica el criterio de salida del Paso 9 del protocolo y dile al Responsable qué quedó listo y qué quedó en "Pendientes de instalación", con el paso que cierra cada uno.
