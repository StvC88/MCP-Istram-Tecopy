# Revisión de uso de ISTRAM para MCP-Istram-Tecopy

Fecha: 9 de octubre de 2026. Base examinada: `codex/istram-stable`, commit `4c7b86add90e62fa91f628e8de965f919517dcfb`, propuesta #1, versión candidata 0.2.0-rc.1.

El MCP tiene una base útil de consulta, gestión de copias y coordinación de operaciones. Para cubrir los usos investigados necesita modelos semánticos de proyecto/superficies/secciones y un adaptador nativo contrastado. Un catálogo de teclado, una edición de líneas y un IFC válido sintácticamente no demuestran que el flujo de diseño se ejecute correctamente.

Esta incorporación entrega la revisión funcional de 24 áreas y un catálogo que el cliente MCP puede consultar. También prepara lotes por listado de elementos y corrige dos fallos observados en recuperación y comunicación con el trabajador. La automatización nativa completa de las 24 áreas continúa pendiente de implementación y aceptación en ISTRAM.

## Qué se revisó y con qué profundidad

- Código TypeScript, trabajador Python, pruebas, arquitectura y criterios de aceptación de la rama de desarrollo. `main` solo enlaza la propuesta #1.
- [Canal de Alex Matos](https://www.youtube.com/@AlexMatosd/videos): inventario de los 120 vídeos presentes en la página. Cada vídeo queda asignado a un área del catálogo.
- Quince transcripciones automáticas contrastadas: terreno DWG/TTP, cubicación, taludes/fronteras, explanaciones multinivel, ferrocarril, cajón, tuberías, zanjas, revisión de diseño, replanteo, planos, BIM/CDE e intercambio con Infraworks. Se registran marcas temporales y conclusiones propias, sin redistribuir transcripciones.
- [Cuaderno solicitado](https://notebook.google.com/notebook/66dd8f87-9726-490d-a9ce-739b73aee639): acceso por MCP conseguido; título «ISTRAM Clases Chile». Gemini enumeró 13 fuentes y confirmó Clase 8 en una segunda consulta. Las síntesis se tratan como material secundario y las atribuciones originales aún necesitan contraste independiente.
- [Soluciones oficiales](https://istram.net/istram/caracteristicas/soluciones/): contraste del alcance general. No demuestra disponibilidad de una API de automatización.
- Texto «API DE ISTRAM» y captura aportados por el usuario: describen una aplicación Windows que modifica archivos asociados a un listado de elementos. Los resultados de más de 350 elementos en minutos son reportados por su autor, sin ensayo independiente.

La revisión cubre las áreas funcionales y las brechas del MCP; no es una revisión audiovisual íntegra de los 120 vídeos. Tres exportaciones de transcripción no estuvieron disponibles (túnel vectorial, muros por altura y ODT). Los otros 102 vídeos quedan a nivel de inventario. No se ha certificado ninguna receta ni ejecutado cambios en un proyecto ISTRAM real.

## Entregables y navegación

- [Contratos de las 24 capacidades](USAGE_CAPABILITIES.md): entradas, procedimiento, resultados, fallos, herramientas actuales y herramientas propuestas por área.
- [Evidencia y límites](USAGE_EVIDENCE.md): transcripciones contrastadas, tiempos, conclusiones y alcance de NotebookLM.
- [Catálogo JSON](research/usage-capabilities.json): mismos requisitos, niveles de evidencia y asignación de vídeos.
- [Inventario TSV](research/alex-matos-videos.tsv): títulos normalizados e identificadores originales de los 120 vídeos.
- Herramienta nueva `usage_capabilities` y recurso `istram://usage/capabilities`: permiten que la IA conozca alcance, faltantes y aceptación sin presentar propuestas como operaciones disponibles.
- [Edición por lotes](BATCH_EDIT.md): `project_prepare_batch`, manifiesto de elementos y tratamiento de archivos compartidos.

## Cobertura real de la base

Las 17 herramientas anteriores ofrecen diagnóstico de instalación, catálogo documental, inspección de referencias de proyecto, lectura parcial ALI/RAS/registros, mapeos IFC, copias/planes/aplicación/restauración, estado del trabajador, snapshot de sesión, seis acciones de recetas y validación IFC. Con `usage_capabilities` y `project_prepare_batch` son 19 herramientas y cuatro recursos.

`operation_start` solo admite `open_project`, `save`, `recalculate`, `bim_configure`, `bim_generate` y `bim_export`. Cada acción requiere receta local verificada. No existe un perfil certificado incluido. Sus argumentos actuales no expresan ejes, alternativas, sección, orden de superficies, alcance del árbol BIM, clases, valores de PSETs o esquema de exportación. Esas decisiones pueden quedar fijas en una receta local, pero no son todavía capacidades parametrizadas del MCP.

Los lectores conservan registros desconocidos y declaran `writeValidated:false`. Un archivo leído puede ayudar al diagnóstico; no acredita interpretación geométrica, compatibilidad de escritura, licencia ni cumplimiento normativo.

## Hallazgos de código

1. **Restauración bloqueada por falta de contexto.** `ProjectStore.restore` invocaba la guardia sin ruta ni cambios. El callback del servidor enviaba un `projectPath` ausente al trabajador, cuyo método `idle` necesita esa ruta para comprobar la copia. La prueba anterior usaba una guardia vacía y no detectaba el fallo. Se pasan ahora `plan.changes` y `root`; una prueba exige ese contexto y comprueba la restauración efectiva.
2. **Protocolo insuficientemente validado.** El puente no validaba el tipo de `ok` ni la forma de `result` y `error`: respuestas JSON incompletas podían considerarse resultados válidos o producir un error de protocolo ambiguo. La nueva decodificación comprueba el sobre y conserva los rechazos explícitos del trabajador. Las pruebas separan rechazo de adaptador, protocolo inválido y resultado nativo incierto.
3. **Aceptación IFC incompleta.** `ifc_validate` revisa esquema/reglas, unidades presentes, nombres de PSETs y, opcionalmente, crea geometría de productos que ya tienen representación. Un IFC con solo `IfcProject` puede resultar válido; los productos sin representación se omiten del chequeo geométrico. Tampoco verifica valores/tipos de propiedades, cantidades esperadas, CRS esperado, continuidad de alineaciones ni correspondencia con la selección de ISTRAM. El test IFC actual usa precisamente un proyecto sintético sin productos. Pendiente: contrato de aceptación específico por exportación, separado de validación de esquema.
4. **Dependencias y copias.** `project_inspect` avisa sobre referencias ausentes/externas; `project_copy` copia la carpeta y no resuelve esas dependencias automáticamente. Hace falta un manifiesto de dependencias completo y una política explícita para empaquetarlas antes de cualquier flujo nativo.
5. **Sesión y selección.** El snapshot recoge controles observables, pero no ofrece contexto semántico contrastado de módulos licenciados, grupo/alternativa, superficies, cálculo o árbol BIM. No debe sustituirse por el último proyecto del historial.

La corrección del puente mantiene un estado incierto para respuestas ilegibles o éxito seguido de salida anómala durante acciones nativas. El trabajador ya devuelve `OUTCOME_UNCERTAIN` cuando falla dentro de la receta tras posibles cambios UI; no se reintenta automáticamente.

## Dependencias funcionales que deben entrar en el contrato

**Edición por lotes de archivos.** La aplicación descrita por el usuario confirma una vía práctica para evitar cientos de cambios repetitivos en la interfaz. El MCP ahora recibe un listado explícito de hasta 1000 elementos y 10000 cambios de entrada, prepara una sola operación recuperable y conserva qué elemento solicita cada línea. Cambios idénticos sobre archivos compartidos se deduplican; cambios contradictorios se rechazan antes de crear el plan. La preparación no escribe archivos de diseño y la aplicación sigue exigiendo reglas de revisión/encoding por formato. Se permite preparar `.per` solo cuando su contenido pasa la lectura de texto; no se presume que toda extensión ISTRAM sea textual.

La prueba de 350 elementos usa un archivo sintético CFG con 350 líneas: verifica vista previa, aplicación, restauración y original intacto. No valida estructuras CEJ/PER/VOL reales, rendimiento de la aplicación aportada ni geometría dentro de ISTRAM. La siguiente incorporación útil es un importador del listado realmente exportado y reglas de parámetros/archivos basadas en muestras revisadas; no deben inferirse de la captura.

**Modelo de contexto.** Identidad exacta del proyecto, sesión, binario, módulos, eje/grupo/alternativa y ámbito PK. Añadir CRS horizontal/vertical, unidades y estado de cálculo con revisión de entradas. La operación debe rechazar identidad/versión o dependencias incorrectas antes de cambiar el modelo.

**Superficies y secciones.** Representar tipos y prioridad de superficies, contornos y líneas de ruptura, plantillas de sección, vectores, materiales, espesores y zonas de cálculo. Cambiar terreno/eje/rasante/sección debe invalidar resultados dependientes. Los tutoriales de tuberías y cajón muestran que el orden de superficies altera lo que se corta y se mide.

**Unidades y orientación.** Declarar PK/XYZ/anchos/espesores en m, áreas en m² y volúmenes en m³; distinguir pendientes en %, razón H:V y ángulos. Lado izquierdo/derecho depende del sentido del eje. Los parámetros K/Kv/radio deben conservar su definición y unidad conforme a la pantalla y norma aplicable.

**Normativa.** País, librería, edición, clase de vía, orografía y velocidades por tramo. La importación de XML no garantiza ese contexto. No incorporar los valores de ejemplo de un vídeo antiguo como límites normativos actuales.

**BIM.** Calcular, generar el modelo y registrar selección del árbol. Después configurar clases/tipos y propiedades, exportar con esquema y CRS comprobados y contrastar el resultado. Debe registrarse exactamente qué se espera exportar: objetos, representaciones, propiedades tipadas y cantidades. Una cinta dibujada usando la herramienta de tubos no debe clasificarse como tubería por el nombre interno de la herramienta.

**Entregables.** Listados, planos y replanteo deben corresponder a la misma revisión de cálculo. Verificar PK por hoja, escalas, numeración, superficie/código/lado en replanteo y nombres que eviten sobrescrituras. El paquete de intercambio lleva manifiesto y hashes; publicar o notificar en un CDE requiere una operación externa propia.

## Plan de implementación

P0 y P1/P2 son prioridades propuestas por este proyecto, no recomendaciones del fabricante.

1. **P0 — Contexto y vía admitida de automatización.** Contrastar con Buhodra versión, formatos, selectores y API/automatización soportada. Completar lectura original de las fuentes que sustenten cada receta. Obtener contexto y dependencias de la sesión. Salida: snapshot semántico cotejado con ISTRAM y prueba de consulta sin cambios.
2. **P0 — Primer flujo BIM.** Añadir parámetros tipados para ámbito, esquema, CRS, clases y propiedades. Validar un flujo mínimo en copia: abrir, modificar una entrada comprobada, guardar/reabrir, calcular, generar, exportar y aceptar. Salida: informe con objetos, geometría, propiedades y cantidades esperadas.
   Antes de ampliar recetas GUI, priorizar reglas revisadas de edición por lotes para los formatos textuales que correspondan al caso. El listado identifica elementos; un grafo de referencias determina archivos compartidos. Ambas vías necesitan comprobar guardado/reapertura, cálculo y resultados.
3. **P1 — Núcleo geométrico.** Implementar superficies/prioridades, ejes/rasantes, secciones/peraltes/firmes y reglas de invalidación. Incorporar taludes/fronteras, explanaciones y mediciones. Salida: resultados contrastados en PK normales y singulares, transiciones y bordes de contorno.
4. **P1 — Documentación y obra.** Planos, replanteo y revisión de trazado con librería/norma explicitadas. Salida: ficheros cotejados con pantalla, geometría y revisión de cálculo.
5. **P2 — Especialidades.** ODT/tuberías, ferrocarril, túneles/muros/estructuras, seguimiento, intercambio y visualización. Cada especialidad obtiene contrato y aceptación propia; no habilitarla por mera analogía con carretera.

Los nombres de herramientas sugeridos en el catálogo son propuestas. No se han añadido acciones nativas, atajos o selectores inventados para simular esas capacidades.

## Escenarios de aceptación a ejecutar en ISTRAM

1. Proyecto con referencias ausentes/externas: diagnosticar y bloquear flujo dependiente hasta resolverlas.
2. Proyecto equivocado, ejecutable diferente o módulo sin licencia: rechazo antes de modificación.
3. Dos superficies superpuestas: cambiar prioridad y comprobar cotas de perfiles en puntos de control.
4. Talud vectorial insuficiente: detectar que no alcanza el terreno y comprobar banquetas/transiciones.
5. Dos corredores: guardar/cargar/redefinir frontera y comprobar ausencia de solape antes y después de editarla.
6. Plataforma multinivel: contorno cerrado, corte/relleno y recorte del terreno sin huecos.
7. Eje con ecuación de PK y conexiones: conservar sentido, continuidad y estaciones referenciadas.
8. Diseño con distintas velocidades: informe por tramo usando edición de tablas expresamente elegida.
9. Rasante de tubería con salto: preservar segmento vertical y jerarquía de superficies; comprobar cotas de tapas y excavación.
10. Zanja multicapa: separar ductos, protecciones y cinta de advertencia en geometría, clases y mediciones.
11. Escape ferroviario: continuidad de ambos desvíos, sentido correcto y ausencia de doble balasto.
12. Cajón: superficies losa/muros con prioridad y descuento de terreno/cantidades correctos.
13. Túnel: transiciones, revestimiento y comparación de excavación por fase con tolerancias explícitas.
14. Cubicación: repetir con definición persistente y dos resoluciones; documentar método y diferencia en m³.
15. Planos: revisar PK, escalas y numeración en primera, intermedia y última hoja.
16. Replanteo: cotejar XYZ de distintos códigos/lados con puntos de control, evitando sobrescrituras.
17. BIM exportado por ámbito: exigir objetos y representaciones esperados; fallar si el IFC contiene solo el proyecto.
18. PSETs: verificar aplicabilidad por clase, nombres, tipos y valores; comprobar cantidades y CRS contra ISTRAM.
19. Reabrir, interrupción y repetición: conservar cambios, no duplicar operaciones y dejar resultado incierto hasta inspección cuando proceda.
20. Lote de al menos 350 elementos reales: resolver referencias, compartir/deduplicar cambios compatibles, rechazar conflictos, aplicar/recuperar y conciliar resultado nativo por elemento.

No hay tolerancias geométricas universales deducidas de los tutoriales. Deben fijarse por escenario/proyecto antes de contar una ejecución como correcta. Las veinte ejecuciones en dos sesiones reales de [ACCEPTANCE.md](ACCEPTANCE.md) siguen siendo requisito de la base, junto con revisión de geometría, cantidades y persistencia.

## Validación de esta incorporación

En Windows: `npm run typecheck`, compilación y 19 pruebas TypeScript correctas. Incluyen herramientas/recurso por stdio, búsqueda/paginación, trazabilidad de fuentes, regresión de restauración, decodificación de errores y lotes de 350 elementos con conflictos/aliases/binarios. Cuatro pruebas Python/IFC correctas con las dependencias fijadas del proyecto.

El primer intento TypeScript falló por permisos de renombrado en el temporal virtual del sandbox; con TEMP/TMP dentro del espacio de trabajo pasan todas las pruebas. Python necesitó dependencias locales y el mismo ajuste temporal. Esto documenta el entorno de pruebas y no prueba interoperabilidad nativa.

Pendientes: revisión audiovisual/original completa, recetas reales, sesiones ISTRAM, aceptación de geometría/cantidades/propiedades y acuerdo con el fabricante. Se conserva el estado candidato y los indicadores `fullVideoReviewComplete:false`, `nativeAcceptancePassed:false` y `nativeExecutionVerified:false`.
