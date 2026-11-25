# Plan de pruebas y mejora del MCP de Istram

**Documento previsto:** `docs/PLAN_PRUEBAS_DESEMPENO.md`
**Referencia:** MCP `v0.3.0-rc.1`, proyecto de Massalavés, exportación IFC 4.3 ADD2 y clasificación RCEclass.

## 1. Objetivo y criterio de éxito

Medir cuántos **minutos de intervención del técnico** hacen falta para pasar de un proyecto de Istram abierto a un IFC revisado. El cronómetro incluye preparar los datos, manejar Istram, responder a avisos, corregir errores y comprobar la entrega. El tiempo de cálculo de la máquina se registra aparte.

Como objetivo inicial, una mejora deberá reducir la **mediana del tiempo activo del técnico al menos un 20 %** frente al MCP publicado, mantener la tasa de entregas válidas y superar los controles de calidad del escenario. El 20 % es una meta propuesta para el piloto. También se informará del tiempo total hasta la entrega.

## 2. Cómo hacer una comparación reproducible

Comparar tres formas de ejecutar el mismo encargo: **operación manual en Istram**, **MCP publicado** y **MCP con la mejora candidata**.

- Usar la misma estación, versión de Istram, licencia, perfil de clasificación y estado inicial del proyecto. Identificar las entradas y el IFC de referencia mediante sus huellas digitales.
- Hacer una pasada de familiarización y **cinco repeticiones medidas por modalidad**. Alternar el orden para repartir el efecto del aprendizaje y de las cachés. Identificar por separado las pruebas que empiezan con Istram cerrado.
- Registrar por pasada la tarea, las versiones, los minutos activos, los minutos de espera, el tiempo total, los clics manuales y automatizados, los comandos de Istram, las llamadas MCP, los reintentos y el resultado de la validación.
- Clasificar cada pasada como **entrega válida**, **bloqueo detectado correctamente** o **fallo**. Publicar mediana y rango por escenario, junto con el número de intentos de cada clase. Un bloqueo rápido cuenta como acierto de diagnóstico y queda fuera del cálculo de tiempo de entrega.

## 3. Escenarios del piloto

| Escenario | Qué se prueba | Evidencia de aceptación |
|---|---|---|
| **Abrir e inventariar la obra** | Abrir la copia acordada de `MASS_06N.pol`, identificar la carpeta activa y contrastar los ejes del proyecto con el árbol BIM. | El informe distingue ejes definidos, geometría guardada y geometría comprobada en la sesión. |
| **Diagnosticar archivos ausentes** | Ejecutar la comprobación previa con la entrega conocida de Massalavés. | Detecta `MASS_02-6.lon` y `MASS6-26.lon`, identifica los ejes 6 y 26 y explica qué falta para regenerarlos. Medir tiempo hasta el diagnóstico y avisos repetidos que tuvo que atender el técnico. |
| **Modificar las barandillas del puente** | En la copia de ensayo, elevar 5 cm el travesaño intermedio de las dos barandillas identificadas. Medir por separado la edición nativa y la variante hecha sobre el IFC. | Para la vía nativa, reabrir la copia y demostrar que Istram regeneró la geometría a partir de la sección modificada. Para la vía IFC, comprobar por GUID el desplazamiento del travesaño y la conservación de los postes. |
| **Exportar la obra a IFC 4.3 ADD2** | Generar desde la raíz del proyecto y cronometrar hasta la reapertura y validación del archivo producido en esa pasada. | Contrastar con el inventario aprobado los cortes, rellenos, defensas, puente y firmes. Verificar la exclusión del terreno natural, los alineamientos, los PK, los hitos visibles en 3D y el punto base con su referencia espacial documentada. |
| **Asignar y auditar materiales** | Aplicar las reglas del catálogo a rodadura, capa intermedia, base y subbase. Incluir una familia con función ambigua. | Concordancia entre función de tabla 01, material de tabla 03 y asociación IFC. La subbase ZA se asigna cuando la función está acreditada. `S-C` y `z.a. relleno` quedan pendientes mientras falte esa evidencia. |
| **Recuperarse de un fallo** | Probar pérdida de foco, diálogo repetido, interrupción durante la escritura y repetición de una solicitud. | El técnico recibe el motivo y sabe desde qué paso retomar. La repetición conserva una única modificación y el sistema distingue una salida parcial de una entrega validada. |

El IFC de referencia permite empezar ya las pruebas de materiales y geometría. En él se verificaron **634 de 1.764 elementos con material IFC y RCEclass concordantes**, así como **944 mallas trianguladas**. Esos valores sirven para detectar regresiones sobre ese archivo concreto. La prueba positiva de regeneración nativa de Massalavés queda condicionada a recuperar los dos longitudinales o a documentar con el responsable de trazado que las referencias son obsoletas.

## 4. Cómo elegir y probar las mejoras

1. **Establecer la línea base.** Ejecutar los diagnósticos y pruebas existentes mediante `doctor`, `typecheck`, `npm test`, `test:python` y `smoke`. Revisar qué minutos del técnico se consumen en manejo, espera supervisada, recuperación de errores y validación. La medición histórica de 151 segundos corresponde únicamente a la variante IFC de barandillas.
2. **Atacar primero la mayor pérdida de tiempo activo.** Si predominan los avisos repetidos, probar la detección de dependencias antes de generar. Si predominan los clics, contrastar los comandos disponibles con el módulo y el foco reales de Istram. Si predominan las revisiones manuales, probar una auditoría por lotes que señale los elementos discrepantes.
3. **Evaluar un cambio cada vez.** Repetir los escenarios afectados sobre las mismas entradas. Rechazar la candidata si omite elementos, asigna materiales sin respaldo, altera geometría ajena al encargo o presenta un IFC anterior como resultado de la pasada.
4. **Registrar la decisión.** Conservar un informe por candidata con versión, escenario, tamaño de muestra, tiempo activo antes y después, tiempo total, entregas válidas, incidencias y decisión de adoptar o descartar. Para habilitar automatización nativa, ejecutar además el protocolo de aceptación existente de **20 pasadas** y conservar la evidencia de las sesiones de Istram, la reapertura y el IFC generado.

El resultado de cada ciclo será una decisión verificable: **qué cambio ahorró tiempo al técnico, cuánto ahorró y cómo se comprobó la calidad de la entrega**.
