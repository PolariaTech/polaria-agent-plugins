# Plantilla del plan guardado y reglas de la carpeta TMP

Esta plantilla se usa solo cuando el plan no se puede seguir: `paralelo.js reclamar` sale con código 3, hay un solape que el dev no resuelve, o el dev decide pausar el ticket. Los términos están explicados en `../../trabajo-en-paralelo-polaria/references/glosario.md`.

## Preparar la carpeta TMP

1. Comprueba si existe la carpeta `TMP/` en la raíz del repo.
2. Si no existe, pregúntale al dev una sola vez: "¿Creo la carpeta TMP/ para guardar las evidencias y los planes? No se sube a git." No la crees hasta que responda que sí.
3. Si el dev responde que sí, crea `TMP/`.
4. Obtén la ruta del archivo de exclusión local con `git rev-parse --git-path info/exclude`.
5. Si esa ruta no contiene una línea que sea exactamente `TMP/`, agrega esa línea al final. No edites `.gitignore`: es un archivo del repo y no debe cambiar por esto.
6. Si el dev responde que no, no guardes nada en disco: muestra el plan en el chat y dile que no quedó guardado.

## Carpeta de evidencias

- Ruta: `TMP/evidencias/<ID>/`, con el ID del ticket tal cual (`POL-370`, `REQ-012`).
- Cada imagen se guarda como `<ID>-01.png`, `<ID>-02.png` y así en orden, con su extensión real.
- Si no puedes guardar una copia de una imagen, crea `TMP/evidencias/<ID>/enlaces.md` con una línea por imagen: el enlace original y qué muestra. Los enlaces de imágenes de Linear expiran en minutos: di en `enlaces.md` que pueden no abrirse más.
- Al terminar la lectura del ticket, dile al dev la ruta completa de la carpeta, en una línea.

## Plantilla de `TMP/<ID>-plan.md`

```markdown
# Plan guardado de <ID>

**Fecha:** AAAA-MM-DD
**Rama base:** <resultado de `paralelo.js base`>
**Por qué se guardó:** <una frase: choque con el reclamo de <ID ajeno> en <archivos>, o el dev pausó el ticket>
**Evidencias:** <ruta de la carpeta de evidencias, o "no hay">

## Qué pide el ticket
<dos o tres frases>

## Causa encontrada (o dónde implementar, si es un Feature)
<hipótesis, con archivo:línea y la confianza declarada por el subagente>

## Archivos que se iban a tocar
- `ruta/exacta/uno.ts`
- `ruta/exacta/dos.ts#funcion`

## Plan
<los pasos del plan aprobado, en orden>

## Para retomar
1. Ejecuta `paralelo.js sincronizar`.
2. Comprueba que la causa y los archivos siguen siendo válidos contra `origin/main`.
3. Vuelve a cruzar con `paralelo.js comparar` antes de reclamar.
```

## Retomar un plan guardado

1. Al empezar un ticket, busca `TMP/<ID>-plan.md`. Si existe, léelo y muéstrale al dev su fecha y su "Por qué se guardó".
2. Pregunta una sola vez si lo reutiliza o investiga de nuevo.
3. Si lo reutiliza, repite la comprobación del punto "Para retomar" antes de usarlo. Si algo cambió, dilo y investiga de nuevo solo esa parte.
