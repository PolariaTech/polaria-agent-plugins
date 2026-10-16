---
name: nomenclatura-credenciales-polaria
description: 'Pone nombre a cualquier credencial nueva de un aplicativo de Polaria o de un cliente siguiendo el Protocolo de Nomenclatura de Credenciales, y dice dónde registrarla. Úsala SIEMPRE antes de crear una cuenta de usuario, una cuenta de prueba o demo, una API key, un token, una credencial en n8n, una variable de entorno con un secreto o una cuenta de servicio, aunque no se mencione el protocolo. Ejemplos: "crea un usuario de prueba para el operador", "necesito una cuenta demo para mostrarle el WMS al cliente", "agrega la credencial de Supabase en n8n", "genera una API key de OpenAI para Nara", "configura la variable de entorno de Postgres en Vercel", "¿cómo le pongo a esta credencial?". No la uses para crear la cuenta de una persona real (usa el correo que ella proporciona), para cambiar la contraseña de una cuenta que ya existe ni para auditar el manejo de secretos de un repo (eso es `auditoria-tecnica-polaria`).'
---

# Nomenclatura de credenciales — Polaria

Fuente de verdad: el protocolo `PROTOCOLO_NOMENCLATURA_CREDENCIALES_v1.0.md` (en el plugin: `references/PROTOCOLO_NOMENCLATURA_CREDENCIALES_v1.0.md`; en el repo de metodología: la carpeta superior a `skill/`). Esta skill no copia sus tablas: las aplica tal cual. Si el documento y esta skill difieren, manda el documento.

## Paso 1 — Identificar el tipo

Clasifica la credencial en uno de los 3 tipos de la tabla del Paso 1 del protocolo: prueba o demo dentro de un cliente real, prueba o demo en un entorno de prueba, o key/token/n8n/cuenta de servicio. Si la cuenta es de una persona real (del equipo de Polaria o del cliente), el protocolo no aplica: dile al usuario que esa cuenta se crea con el correo que la persona proporciona y no sigas con los demás pasos. Si es de prueba o demo y no queda claro si el cliente es real o también de prueba, PREGUNTA. Si la solicitud no deja claro el tipo (ej. "crea un usuario para el operador" sin decir si es real o de prueba), PREGUNTA antes de seguir. NUNCA lo supongas: una cuenta de prueba tratada como real, o al revés, es justo el error que el protocolo evita.

## Paso 2 — Slug

Si el nombre lleva aplicativo o cliente, pide al usuario que confirme el slug del Registro de slugs (Google Sheet en la carpeta de credenciales de Drive), o léelo con el MCP de Google Drive si está disponible. Si el slug no existe, propón uno con la regla de slugs de la sección 4 del protocolo y pide que lo agreguen al registro. NUNCA inventes ni abrevies un slug sin confirmarlo.

## Paso 3 — Armar el nombre

Aplica el formato del Paso 1 y las reglas por segmento del Paso 3 del protocolo. Muestra al usuario el nombre propuesto y en una línea qué significa cada segmento antes de crear nada.

- Si la plataforma no acepta guiones (variables de entorno de Vercel o Railway), aplica la excepción de la sección 5: mayúsculas y guion bajo.
- Si estás renombrando una credencial que ya existe, aplica la Excepción 1 de la sección 5 (credencial con nombre antiguo) y el Rollback del protocolo.

## Paso 4 — Crear

Crea la credencial solo después de que el usuario confirme el nombre, y con ese nombre exacto.

## Paso 5 — Recordar dónde registrarla

Di al usuario dónde se registra según la tabla del Paso 5 del protocolo.

- NUNCA escribas el valor de una key, token o contraseña real en el chat, en un archivo del repo, en un Google Sheet ni en un documento. Fuera de la plataforma donde se usa, solo va en el `.xlsx` cifrado de la carpeta de credenciales. Solo el Responsable Metodología tiene su contraseña: recuérdale al usuario que se la entregue en persona o en una llamada.
- NUNCA pongas un secreto dentro del código: DEBE leerse de una variable de entorno.

## Restricciones

- Cuentas de prueba y demo: `prueba` y `demo` SIEMPRE en palabra completa.
- NUNCA un dominio ajeno o inventado (`@test.com`, `@gmail.com`): SIEMPRE el dominio del aplicativo.
- El aplicativo NUNCA envía correos a cuentas de prueba o demo. Si ves código que lo hace, avísalo.
