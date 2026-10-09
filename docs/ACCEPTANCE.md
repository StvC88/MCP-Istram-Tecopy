# Criterios de aceptación real

CI sintética verifica software y protocolo. No certifica la interoperabilidad nativa ni la corrección del diseño vial.

1. Obtener acceso a las fuentes indicadas y documentar cada receta con fuente y versión.
2. Inspeccionar controles reales; definir guardia de proyecto, ventanas permitidas y postcondiciones de cada acción.
3. Preparar una carretera de prueba con terreno, ejes, rasante, sección y dependencias resueltas.
4. Ejecutar veinte flujos correctos desde un cliente MCP, en dos sesiones de ISTRAM como mínimo.
5. Cada flujo debe modificar eje/rasante/sección, guardar, reabrir y comprobar persistencia, recalcular, configurar clases/PSETs, generar BIM y exportar IFC4X3.
6. Validar geometría, alineaciones, unidades, PSETs y georreferenciación. Comparar cantidades con ISTRAM usando tolerancias expresas del proyecto.
7. Probar falta de licencia, pérdida de foco, diálogo inesperado, interrupción, resultado incierto y repetición de solicitudes.
8. Comprobar hashes originales y ausencia de duplicaciones.

Cada informe local debe contener: runId, clientConnection, nativeSessionIds, engineeringAssertionsPassed, versión/hash del ejecutable, perfil, entradas, hashes antes/después, tiempos, resultado de cada paso, validación IFC, tolerancias, discrepancias y success. Conservar capturas cuando aporten evidencia, sin publicarlas.

Solo promover el perfil a verified y publicar versión estable tras cumplir todos los puntos. Si el diseño geométrico no se ha contrastado, la prueba no cuenta como éxito.


El evaluador scripts/acceptance.mjs ejecuta veinte escenarios distribuidos en dos conexiones MCP; estas conexiones no demuestran por sí solas sesiones distintas de ISTRAM. Cada escenario exige apertura, recálculo, guardado, cierre normal, reapertura, BIM y cierre final. El trabajador asigna un nuevo identificador nativo en cada apertura. No termina el proceso automáticamente.

Formato del escenario: sourcePath, sourceReviewComplete, nativeGeometryReviewComplete, excludeDirectories opcional y steps (tool, arguments y assertions). Variables: {projectId}, {projectPath} y {runId}. Cada solicitud modificadora debe usar projectId `{projectId}` y requestId derivado del runId; las acciones nativas tienen requestId distintos. El evaluador espera las operaciones y guarda informes privados; los resultados se revisan antes de habilitar el perfil.

Una assertion tiene `path` de una propiedad del resultado y `equals`, `min` o `closeTo` con `tolerance` explícita. Tras reabrir se debe leer un ALI dentro de `{projectPath}` y contrastar al menos `elements.0.length` con longitud esperada y tolerancia. Añadir coordenadas y parámetros, rasante, sección, cantidades y persistencia según el proyecto; el requisito mínimo no certifica todos esos aspectos.

El paso `ifc_validate` debe seguir a `bim_export`, usar el mismo outputFile dentro de la copia, geometry true, expectedSchema IFC4X3 y PSETs requeridos. Se exigen assertions `valid` equals true y `geometry.length` min 1. Añadir expectativas de unidades, CRS, productos y propiedades con los nuevos argumentos IFC. Un archivo vacío o una medición de otro proyecto no cuentan como aceptación.

La certificación no se deduce automáticamente del contador de ejecuciones. Se revisan además los informes de geometría, cantidades, persistencia y los dos identificadores reales de sesión ISTRAM.
