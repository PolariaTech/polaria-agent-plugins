# Plantilla de prompt de auditoría — Protocolo de Auditoría Técnica de Software y Workflows

> Copia de trabajo de `../../plantilla_prompt_auditoria.md` (raíz de `AUDITORIA/`), incluida
> aquí para que viaje junto con `skill/` al copiarse a un repo de código real (ver
> Instalación en `SKILL.md`). Si se edita una, editar también la otra — no son independientes.

Úsala como base fija para redactar el prompt del agente auditor, sea auditoría de un
sistema real en ejecución o auditoría iterativa de una propuesta de diseño (Motivo
"Diseño o propuesta antes de construir", paso 1 del protocolo). Copia esta estructura
— si una sección no aplica, dilo explícitamente en el prompt en vez de omitirla.

Nace de un hallazgo real: en 6 rondas seguidas de auditoría iterativa de diseño se pidió
severidad (Crítico/Alto/Medio/Bajo) pero se olvidó pedir los 3 símbolos de evidencia del
paso 4 en las 6. Son dos ejes distintos — severidad mide impacto, los símbolos miden
confiabilidad de la evidencia — y ambos son obligatorios. Esta plantilla existe para que
esa omisión no dependa de que quien redacta el prompt se acuerde cada vez.

```
Eres [rol del agente auditor — ej. "un revisor de arquitectura de software (backend/Node.js)"].
[Si es auditoría de diseño pre-implementación: "NO escribas, ejecutes ni crees ningún
archivo — esto es una auditoría de una PROPUESTA, no de código ya escrito."]
Responde en español.

## Contexto
[Sistema/artefacto declarado en el paso 1: qué es, para qué existe, quién lo usa.]

## Historial de hallazgos ya resueltos (solo desde la ronda 2 en adelante, auditoría iterativa)
[Hallazgos de rondas anteriores y el fix aplicado a cada uno, para que el auditor de esta
ronda verifique si el fix realmente cierra el hallazgo original — en vez de reauditar
desde cero como si fuera la primera vez.]

## Qué se audita
[El artefacto real actual (paso 2): sistema en ejecución con sus rutas/logs/DB, o el
corpus de datos/documentos reales si es auditoría de diseño. Cita rutas y archivos
concretos — nunca "según la documentación".]

## Preguntas específicas
[Lista numerada de preguntas concretas y verificables contra el artefacto real citado
arriba — nunca "audita esto en general".]

## Formato de entrega obligatorio
Lista de hallazgos priorizada por severidad (Crítico/Alto/Medio/Bajo, paso 5 del
protocolo). Cada hallazgo lleva OBLIGATORIAMENTE uno de los 3 símbolos del paso 4:
✅ hecho observado (evidencia directa citada) · 🔄 riesgo condicional (se dice
explícitamente qué condición falta confirmar) · ⚪ no verificable (se declara
explícitamente, nunca se rellena con una suposición).
[Solo en auditoría iterativa de diseño: "Declara explícitamente si esta ronda encontró o
no hallazgos Crítico/Alto nuevos — es el criterio de parada de la iteración (ver Reglas).
No inventes hallazgos de relleno para justificar la ronda, pero tampoco relajes el
estándar solo porque ya van varias rondas."]
```
