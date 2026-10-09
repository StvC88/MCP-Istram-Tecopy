# Alcance

Referencia indicada por el usuario: [Soluciones de ISTRAM](https://istram.net/istram/caracteristicas/soluciones/), consultada el 9 de octubre de 2026. Complemento: [Características](https://istram.net/istram/caracteristicas/).

## Áreas del producto

La documentación oficial contempla cartografía digital, superficies, Virtual 3D, GIS y obra lineal. En obra lineal incluye carreteras, ferrocarriles, tuberías, canales, túneles y rehabilitación; también diseño, mediciones, planos y control de construcción.

BIM es un requisito transversal: configuración de modelos, clasificación, propiedades, exportación y validación.

## Orden de desarrollo propuesto

1. Sesión y proyecto: identidad, versión, módulos disponibles, consultas y archivos.
2. Modelos y BIM: ajustes del proyecto, clasificación, propiedades, generación y exportación.
3. Obra lineal: ejes, rasantes, secciones, conexiones, cálculo y resultados.
4. Cartografía y superficies: intercambio de datos, coordenadas, terreno y consultas.
5. Especialidades y seguimiento: adaptar cada flujo al módulo y proyecto correspondiente.
6. GIS y Virtual 3D: incorporar operaciones comprobadas según las prioridades del fabricante.

El orden es una decisión del proyecto MCP, no una recomendación publicada por Buhodra.

## Cobertura actual

La [revisión de uso](USAGE_REVIEW.md) amplía el alcance en 24 contratos funcionales. Se inventariaron 120 vídeos y se contrastaron 15 transcripciones, con consultas al cuaderno solicitado y material aportado sobre edición por lotes. El catálogo `usage_capabilities` informa qué existe y qué está propuesto; no habilita las acciones nativas descritas. Ver [evidencia](USAGE_EVIDENCE.md).

Lectura parcial de datos de instalación, proyecto y formatos; copias y cambios recuperables; motor de recetas y validación IFC. Ningún flujo nativo completo está certificado.

El catálogo de teclado no cubre por sí solo todas las soluciones. Cada incorporación necesita procedimiento documentado, contrato de argumentos, módulos requeridos, resultado verificable y prueba de aceptación.

## Primer caso de revisión

Con la sesión activa: identificar proyecto y consultar datos. Después, sobre copia: comprobar configuración, recalcular, generar BIM, exportar y contrastar el resultado. El fabricante puede recomendar una vía de automatización y un orden diferentes.
