# Detección de stack y traducción de los niveles

Referencia de la skill `validacion-formularios-polaria` (Pasos 2 y 3). El protocolo no fija tecnologías; este archivo dice cómo encontrar la del repo y cómo se traduce cada nivel en las librerías conocidas.

## 1. Detectar el stack de cada capa

Haz esto por cada capa (Front, Back, BD) que el schema marque y que viva en **este** repo. Detente en la primera señal clara.

1. **Formularios, DTOs o modelos que ya existen en el repo.** Busca cómo validan hoy (ej. `grep -rl "z.object(" src`, `grep -rl "@IsNotEmpty\|@IsString" src`, `schema.prisma`, `models.py`). Si al menos un formulario existente usa una librería, esa es la del repo. Esta señal pesa más que las dependencias: una librería puede estar instalada y no usarse.
2. **Manifiesto de dependencias.** `package.json` (`dependencies` y `devDependencies`), `pyproject.toml`, `requirements.txt`, `composer.json`, `go.mod`, `Gemfile`. Busca las librerías de la tabla de la sección 2 o sus equivalentes.
3. **Sin señal clara, o dos candidatas para la misma capa** (ej. Zod y Yup, ambas en uso): pregúntale al dev cuál usar. NUNCA elijas tú.

Además identifica:
- **Runner de pruebas:** el script `test` de `package.json`, la configuración de `pytest`, etc.
- **Tokens de color:** el archivo de estilos globales o el tema del sistema de diseño (ej. `globals.css`, `tailwind.config.*`, `theme.ts`) y los tokens para warning, danger y el estado de extracción IA (teal).

Resultado: una línea por capa que le muestras al dev para que la confirme, por ejemplo `Front: Zod + react-hook-form · Back: class-validator · BD: Prisma · Pruebas: Jest`. Las capas que viven en otro repo se marcan `(otro repo)`.

## 2. Traducción de los niveles en librerías conocidas

Una fila es un ejemplo, no una obligación: si el repo usa otra librería, aplica el mismo nivel con su equivalente.

| Nivel | Qué construir | Ejemplos por librería |
|---|---|---|
| 1. Tipo y formato (Front) | Restringir el input mientras se escribe, además de validarlo al enviar | Atributos HTML5 (`type`, `inputMode`, `pattern`, `min`, `max`, `step`, `required`) + un `onChange`/`onKeyDown` que descarta el carácter inválido. El schema de la librería (Zod `z.number().int()`, Yup `number().integer()`) repite el tipo. |
| 2. Interacción (Front) | Orden de tabulación, foco automático, deshabilitados fuera del tab, modal y confirmaciones | `tabIndex` en el orden de la Tabla 2 y `disabled` real (o `tabIndex={-1}`) en los deshabilitados; `ref.focus()` en el momento del schema; en el modal, desactivar el cierre por clic afuera si hay cambios (ej. Radix `onPointerDownOutside={e => e.preventDefault()}`, MUI `onClose` ignorando `backdropClick`). |
| 3. Reglas de negocio (Front) | Obligatorios, límites y dependencias; validar al salir del campo y al enviar | Zod `.min()`, `.max()`, `.refine()`/`.superRefine()` para dependencias entre campos; Yup `.min()`, `.test()`, `.when()`; react-hook-form `mode: "onBlur"` y `setFocus` en el primer error; `aria-invalid` + `aria-describedby` en el campo con error. |
| 4. Backend (Back) | Repetir las reglas de los Niveles 1 y 3 en el servidor | NestJS: DTO con `class-validator` (`@IsInt`, `@Min`, `@IsNotEmpty`, `@ValidateIf`, validador propio para dependencias) + `class-transformer` + `ValidationPipe`. Express: el mismo schema Zod/Joi en un middleware. Python: Pydantic (FastAPI) o serializers (Django REST). El mensaje de cada decorador es el del schema. |
| 5. Base de datos (BD) | Tipo de columna, `NOT NULL`, unicidad y restricciones | Prisma: tipos, `?` solo si es opcional, `@unique`; lo que Prisma no cubre (ej. `CHECK (precio > 0)`) va en una migración SQL versionada. Drizzle/TypeORM: en la definición de la tabla o en la migración. Django: `unique=True`, `CheckConstraint`. |

**Prueba de contrato** (sección 7 del protocolo): una prueba por campo con más de una capa que lleve el mismo valor límite al schema del Front, al validador del Back y (si aplica) a una inserción de prueba en la BD, y verifique que las tres coinciden. Si el Front y el Back viven en repos distintos, cada repo prueba su capa contra el mismo valor límite del schema.

## 3. Stack actual de Polaria (ejemplo de referencia, 23/09/2026)

| Capa | Repo | Librerías |
|---|---|---|
| Front | `polaria-wms-web` (Next.js) | Zod |
| Back | `polaria-wms-api` (NestJS) | class-validator + class-transformer |
| BD | `polaria-wms-api` | Prisma sobre Postgres |

Tokens de color de `polaria-wms-web/src/app/globals.css` en esa fecha. Verifica que sigan igual antes de usarlos:

| Estado | Borde | Fondo |
|---|---|---|
| Discrepancia (warning) | `#F5A52459` | `#F5A5241F` |
| Error Nivel 3 (danger) | `#F8717159` (`border-polaria-danger-border`) | `#F871711F` (`bg-polaria-danger-bg`) |
| Extracción IA (teal) | `#00E5CC80` | `#00E5CC14` |
| Fondo general de inputs | — | `#F8F8F614` |
