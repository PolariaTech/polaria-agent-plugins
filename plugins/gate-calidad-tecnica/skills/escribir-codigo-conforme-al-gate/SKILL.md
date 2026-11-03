---
name: escribir-codigo-conforme-al-gate
description: Guía al asistente para que el código que escribe ya cumpla los 9 criterios del Gate de Calidad Técnica Pre-Merge de Polaria, antes de que lo revise el gate. Úsala SIEMPRE que vayas a escribir, modificar, corregir o refactorizar código de un repo de software de Polaria (una función, un endpoint, un componente, un bug, un hallazgo de auditoría), aunque el dev no mencione el gate ni los criterios — por ejemplo "agrega este endpoint", "arregla este bug", "implementa el ticket POL-X", "refactoriza este archivo", "corrige el hallazgo". No la uses para revisar un diff ya terminado ni para decidir si se puede hacer push (eso es `gate-calidad-tecnica-pre-merge-polaria`), ni para workflows de n8n (eso es `gate-calidad-n8n-polaria`), ni para escribir la validación de un formulario (eso es `validacion-formularios-polaria`).
---

# Skill: Escribir código conforme al gate

El gate revisa el cambio al final y rechaza si algún criterio falla. Esta skill hace que cada criterio se cumpla mientras escribes, para que el gate solo confirme. No emite veredictos: el veredicto lo da únicamente el revisor aislado del gate.

La definición de cada criterio (cuándo es `FAIL`) vive en la sección 6 de `../gate-calidad-tecnica-pre-merge-polaria/references/GATE_DE_CALIDAD_TECNICA_PRE_MERGE_v1.4.md` y, de forma ejecutable, en `agents/revisor-tecnico-pre-merge.md` del plugin. Léela antes de escribir código y no copies su texto aquí: si el gate cambia, esta skill sigue valiendo.

## Antes de escribir

1. Lee la sección 6 del documento indicado arriba y quédate con los 9 criterios.
2. Pregunta al dev el tipo del cambio si no lo sabes: Bug, feature o refactor. Si es Bug, el criterio 6 exige un test de regresión.
3. Si el cambio toca un formulario o un campo de formulario, detente y usa la skill `validacion-formularios-polaria`. El criterio 7 se cumple con ese protocolo, no con esta skill.

## Mientras escribes (un criterio, una regla)

1. **Nomenclatura (1):** nombra cada variable, función y parámetro por lo que contiene o hace. No uses `x`, `temp`, `data2`, `res`, `obj`. Un índice de bucle de una letra (`i`) es válido.
2. **Manejo de errores (2):** toda llamada a una API, query a base de datos o parsing de entrada externa lleva manejo explícito del error: qué pasa si falla y qué recibe quien llama. No dejes un `catch` vacío.
3. **Secretos (3):** ninguna llave, token, contraseña ni credencial en el código, ni siquiera de prueba. Léelos de una variable de entorno. Si necesitas una credencial nueva, usa la skill `nomenclatura-credenciales-polaria` para nombrarla.
4. **Código de debug (4):** no dejes `console.log`, `print`, `debugger`, `TODO borrar` ni código comentado o muerto. Si necesitas ver un valor mientras trabajas, bórralo antes de dar el cambio por terminado.
5. **Convenciones (5):** copia el estilo del archivo y del lenguaje donde escribes: comillas, punto y coma, orden de imports, nombres de archivos. Corre el formateador y el linter del repo si existen.
6. **Pruebas (6):** escribe la prueba en el mismo cambio que el código, no después. Si es un Bug, escribe primero el test que reproduce el error y comprueba que falla. Cada archivo JS/TS que escribas lleva su archivo de prueba junto a él (`precio.test.ts`) o en `__tests__/`, `tests/`, `test/` o `spec/`. Corre las pruebas del repo y conserva la salida real. Si el cambio no se puede automatizar, documenta una prueba manual con pasos y resultado.
7. **Formularios (7):** ya cubierto en «Antes de escribir», paso 3.
8. **Build (8):** antes de dar el cambio por terminado, corre el comando de build del repo. Las pruebas no revisan los tipos y el build sí. Después corre `git status` y comprueba que el build no dejó archivos versionados modificados.
9. **Tamaño y complejidad (9):** un archivo de código no pasa de 300 líneas (sin blancos ni comentarios), una función no pasa de 50 líneas ni de complejidad cognitiva 15. Si un archivo va a pasar del límite, créalo dividido desde el principio. Nunca agregues código a un archivo que ya pasa del límite: extrae a un archivo nuevo. Nunca edites `eslint-suppressions.json` para esconder un incumplimiento.

## El hook de aviso

El plugin trae un hook que, después de cada edición, avisa de los criterios 3, 4, 6 y 9 que se miden sin juicio. En el 6 solo comprueba que exista el archivo de prueba del archivo que editaste, no que lo cubra. Si el hook te devuelve un aviso:

1. Corrige exactamente lo que dice, en el mismo archivo, antes de seguir con otra cosa.
2. Si el aviso es de un secreto, no copies su valor a ninguna parte. Muévelo a una variable de entorno y dile al dev que debe rotar esa credencial.
3. Si crees que el aviso es un falso positivo, díselo al dev con la línea y el motivo. No lo ignores en silencio.

El hook solo avisa. Que no avise no significa que el código cumpla: los criterios 1, 2, 5 y 8 no los mide el hook, y del 6 solo mide que exista el archivo de prueba.

## Al terminar

1. Repasa los 9 criterios uno por uno contra lo que escribiste.
2. Dile al dev que el cambio está listo para el gate y que haga commit local. No hagas commit ni push por tu cuenta.
3. Indica que el siguiente paso es la skill `gate-calidad-tecnica-pre-merge-polaria`. No digas que el cambio «pasa el gate»: solo el revisor aislado puede decirlo.
