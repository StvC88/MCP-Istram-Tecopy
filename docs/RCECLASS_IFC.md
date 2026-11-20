# Exportación y revisión de RCEclass en IFC

El flujo aplica el perfil de clasificación de ISTRAM al árbol BIM, exporta
IFC4.3 ADD2 y comprueba los códigos contra el catálogo aprobado para el proyecto.

## En ISTRAM

1. Identificar el POL en su carpeta de trabajo e inspeccionar sus referencias
   CEJ, VOL, LON, EDM y DAR. Comparar los ejes de proyecto con las ramas que
   aparecen bajo **Obra**. Excluir de la exportación los IFC de prueba
   importados en la misma sesión.
2. En **BIM → Clases/Atributos**, cargar `RCEclass_ClasesIstram.fcv`. El perfil
   referencia los siete archivos FCT. Revisar las clases sin traducción en
   **Clasificación** y aplicar las clasificaciones al alcance elegido.
3. En **BIM → Propiedades**, importar `RCEclass_PSetsIstram.atf` y aplicar
   `RCE_CLA`. Revisar que las descripciones procedan de las tablas aplicadas.
4. En **BIM → Archivos**, elegir IFC4.3 ADD2, origen de coordenadas según el
   proyecto y un nombre nuevo de IFC. En las opciones de exportación, activar
   **Exportar alineaciones** si la entrega incluye el eje y comprobar sus
   segmentos en el IFC. Verificar que ISTRAM indique que escribió el archivo.

El tutorial RCEclass para ISTRAM recomienda filtrar las clases al proyecto
actual, guardar el FCV de trabajo y aplicar Complejos al final por selección
cuando dependa del tramo. Regenerar geometría puede restablecer valores
aplicados anteriormente. Las tablas requeridas se fijan en el anejo BIM
aplicable. El piloto comprueba Funciones, Estados y Complejos.

Las tablas y plantillas se obtienen del protocolo del proyecto. La
[Orden Circular 5/2024](https://www.transportes.gob.es/carreteras/rceclass)
publica el sistema RCEclass.

## Carga del modelo antes de exportar

- En el menú contextual de **Obra**, usar **Cargar geometría y propiedades
  del proyecto en archivos .b1m** para intentar recuperar la geometría
  existente. Confirmar las ramas resultantes. Si el árbol sigue parcial,
  reabrir el POL desde su carpeta de trabajo, seleccionar **Obra** y ejecutar
  **BIM → Generación → Generar Proyecto**. Revisar cada aviso por eje. La
  ayuda de ISTRAM indica que el recálculo del eje puede invalidar su B1M.
- Revisar **Control de generación** para confirmar que se incluyan los
  objetos de la tabla DAR, los objetos lineales y las estructuras cuando
  procedan. Confirmar barandas y defensas como objetos con geometría en
  Virtual 3D y revisar sus clases, incluidos nombres de origen como
  barandilla, bionda y pretil. La presencia de una clase en el FCV por sí
  sola indica que existe un mapeo para esa clase.
- Cargar la cartografía EDM y su definición SUP desde **Control → Control
  de superficies cartográficas**. Comprobar el terreno en Virtual 3D y
  revisar la geometría de la superficie en el IFC. El SUP define qué datos
  intervienen en la superficie. Para intercambiar una malla, usar la
  triangulación existente del proyecto o generarla desde una fuente
  topográfica verificada, con su extensión y sus cotas contrastadas.
- Referencias de la ayuda instalada: `OL_BIM.html`, `OL_BIM_opciones.html`,
  `EDM_control_entidades.html` y `EDM_topografia.html`.

## En el MCP

- `project_inspect` con `summary: true` devuelve un inventario paginado.
  `projectFile` restringe el análisis a un POL relativo a la carpeta del
  proyecto. `modelLoadEvidence` informa de ejes con registros de alzado, B1M
  no vacíos, candidatos de terreno y VOL no legibles. Las advertencias
  detalladas señalan el archivo y la línea de cada referencia. Los archivos
  localizados en otra carpeta del proyecto figuran como candidatos pendientes
  de confirmar en la sesión nativa.
- `ifc_rceclass_audit` compara los códigos de `RCE_CLA` con las asociaciones
  IFC y con los siete FCT del directorio indicado. También comprueba que
  exista una descripción para cada tabla usada. La cobertura y las muestras
  de códigos desconocidos ayudan a revisar las asignaciones que faltan.
  `requiredTables` selecciona las tablas obligatorias. El valor inicial del
  piloto es Funciones, Estados y Complejos. Ajustarlo a los requisitos del
  proyecto.
- `rceclass_profile_inspect` revisa FCV 3.70/3.80 contra los FCT antes de abrir
  el exportador. Pasar las clases exactas de ISTRAM para enfocar la revisión.
  Los códigos ambiguos del catálogo quedan visibles para resolverlos con la
  fuente aprobada.
- `ifc_validate` comprueba esquema, geometría, unidades y CRS.
- Si existe una receta local verificada, `operation_start` acepta
  `rceclassAudit` junto con `action: "bim_export"` y `outputFile`.
  `operation_status` devuelve la exportación y el resultado de la auditoría.
  La auditoría usa el hash del artefacto que verificó la receta. Revisar
  `result.rceclassAudit.status` y `result.rceclassAudit.valid` antes de
  aceptar el IFC. La instalación del piloto empleó una exportación asistida
  desde la interfaz.

Con el servidor compilado y un Python con IfcOpenShell, el siguiente comando
ejecuta ambas comprobaciones por MCP. Devuelve código 1 cuando el informe
contiene incumplimientos.

```powershell
npm run build
node scripts/check-rceclass-ifc.mjs "modelo.ifc" "directorio-con-los-siete-fct" "informe-nuevo.json"
```

La auditoría verifica cobertura y coherencia de códigos. La asignación
semántica de cada clase de ingeniería sigue requiriendo revisión del proyecto.

## Eje, PK y punto base

`ifc_validate` admite `minAlignments` y el objeto `dgcLocation`. El ejemplo
[ifc-dgc-validation.json](../examples/ifc-dgc-validation.json) añade un CRS
esperado y tres PK. El resultado `dgcLocation` indica cobertura de `DGC_LOC`,
datum vertical, norte declarado y contraste del punto oficial. Para validar
el punto base, pasar su GlobalId IFC, Este, Norte, cota y tolerancia a
`surveyControl`, además del datum documentado en `expectedVerticalDatum`.
Los PK de replanteo y el punto base oficial tienen funciones distintas.

Si ISTRAM escribe un `IfcAlignment` con las curvas vacías, la herramienta
`ifc_istram_alignment_prepare` admite informes de un mismo eje con segmentos
rectos en ALI y rasante de gradientes constantes en RAS. Comprueba longitudes
y límites de PK, conserva el GlobalId del eje y escribe un IFC nuevo con
planta, rasante e hitos 3D. El intervalo y la altura de los hitos se
configuran en metros. Copia los PK de usuario existentes a `DGC_LOC` para los
elementos del eje con datos completos. Usar informes de la misma revisión
del modelo y validar el archivo generado. Los ejes con clotoides, curvas
verticales o ecuaciones de PK requieren un flujo específico.

El apartado 4.3 y el apéndice de información alfanumérica del anejo BIM de
la DGC describen la geolocalización y las propiedades `DGC_LOC`. Para
Península, contrastar ETRS89/UTM, altimetría oficial y la base cartográfica
con la documentación de levantamiento. [OC 1/2025](https://cdn.transportes.gob.es/portal-web-transportes/carreteras/normativa_tecnica/01_normativa_general_carreteras/oc_1-2025_requisitos_bim_firmada.pdf)
y [Real Decreto 1071/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-15822).
# Comprobación de geometría por clase

En `ifc_validate`, `requiredSurfaceGeometry` permite exigir un número mínimo de productos con caras trianguladas por clase IFC y, si procede, por `PredefinedType`. Por ejemplo, para exigir un terreno y una barandilla en un proyecto donde ambos están modelados:

```json
{"requiredSurfaceGeometry":[{"entityType":"IfcGeographicElement","predefinedType":"TERRAIN","minimum":1},{"entityType":"IfcRailing","minimum":1}]}
```

El informe `surfaceCoverage` registra los productos encontrados y cuántos tienen caras. Se deben elegir las clases según el FCV aprobado y contrastar los recuentos con el inventario del proyecto. Un mínimo de uno comprueba presencia, no continuidad ni cobertura total.
## Control por teclado y revisión de obra en IFC

En la instalación de Istram consultada, `lib/comandos.cfg` contiene el diccionario de teclado. La ayuda instalada menciona, por ejemplo, el comando `Spixe` en **Preferencias**. La ventana de Virtual 3D inspeccionada mediante `session_snapshot` mostró el visor y sus controles; la inspección no identificó un campo de consola para ejecutar la exportación IFC.

1. Consultar varios códigos en una sola llamada a `istram_command_catalog` con `{"exactCodes":["n","m","V2D","V3D","pk","BS","bs"]}`. La respuesta conserva el código original e indica cuáles faltan en la instalación. En el diccionario revisado, `n` cuenta elementos, `m` encuadra, `V2D` y `V3D` cambian de vista y `pk` va a un PK. `BS` busca símbolos y `bs` los borra. Un código encontrado sigue necesitando el módulo y el foco correctos. Para descubrir un código por descripción, usar `query`.
2. Inspeccionar el POL activo con `project_inspect`. Resolver las referencias LON de los VOL y contrastar los ejes previstos con los B1M guardados. Comprobar las clases del perfil activo con `rceclass_profile_inspect`. El lector admite las secciones de clasificación comprobadas en FCV 3.70, 3.80 y 4.00. Un hueco vacío en la tabla de una familia queda pendiente si el BEP exige esa tabla.
3. En Istram, seleccionar la raíz del proyecto en el árbol BIM. Al reabrir la aplicación, comprobar el formato en **BIM → Archivos**, los volúmenes, el fichero único y los parámetros de alineación. El diccionario instalado carece de una orden identificada para reproducir este diálogo completo. Para reducir clics, reutilizar el control activo cuando una receta local haya verificado su identidad y su resultado.
4. Ejecutar `ifc_delivery_inventory` con `filePath`. Lee el IFC una vez y devuelve por grupo el total y cuántos tienen representación. En la revisión de obra de Massalavés se obtuvieron 48 ejes, 207 cortes, 96 rellenos, 20 defensas y cero objetos de terreno natural. Estos recuentos solo son referencia de ese proyecto.
5. Para una entrega de obra sin MDT, usar `excludeNaturalTerrain: true` en `ifc_validate`. La regla detecta la pareja `IfcGeographicElement.TERRAIN`. Las superficies excavadas, los desmontes y los terraplenes siguen dentro del alcance. Revisar también terrenos exportados en clases genéricas cotejando el inventario nativo. Usar `requiredSurfaceGeometry` para exigir caras por grupo y comprobar las relaciones nativas y el esquema. Para RCEclass, pasar a `ifc_rceclass_audit` las tablas que exige el BEP; en Massalavés son 01 Funciones, 02 Estados y 05 Complejos. Contrastar por separado las entidades y tipos IFC con el mapeo explícito de la tabla Funciones.

### Ensayo de barandillas después de reiniciar Istram

La ventana del lanzador y el editor son procesos distintos. Tras iniciar el editor, verificar tanto la carpeta de la copia como el POL visible en Obra lineal. Registrar la reserva de módulos y la recuperación del CEJ. Las referencias de una familia pueden aparecer en los registros de marcas viales del VOL aunque la representación BIM sea una barandilla tridimensional. Cruzar el tipo de línea, la sección, el eje, los PK y el GUID antes de modificarla.

La herramienta `ifc_railing_variant` genera una variante de un IFC existente a partir de GUID explícitos y un desplazamiento vertical en metros. Admite la disposición de tres travesaños rectangulares observada en IFC4X3_ADD2 con unidades en metros. Comprueba el patrón de cada sección, la independencia de las caras y el uso exclusivo de la malla. Mantiene la posición de los postes, los GUID y el resto de las representaciones. La operación entrega un archivo nuevo y devuelve el número de secciones y vértices afectados. No llama al motor nativo de Istram ni asigna por sí misma clasificaciones.

En Massalavés se prepararon secciones locales en la copia del proyecto y se aplicó una variante IFC equivalente en intención: elevar 5 cm el travesaño intermedio. La regeneración nativa requiere demostrar que el nuevo B1M procede de la sección editada. Una caché persistida, una ventana abierta o un IFC escrito por una biblioteca externa no acreditan ese paso. La operación nativa del MCP devolvió `ADAPTER_REQUIRED`.

Para el cliente JS de este repositorio, el tiempo de espera es el segundo argumento de `callTool(params, {timeout})`. Las escrituras de modelos grandes pueden superar el minuto. El destino se publica tras terminar la escritura temporal. En Windows se usa el renombrado que falla si ya existe el destino. Para aceptar una variante, reabrirla, comparar por GUID cada malla original y resultante, y auditar por separado las propiedades RCE_CLA y las asociaciones exigidas por el BEP. Cronometrar el flujo nativo por separado antes de comparar tiempos.
La llamada MCP de prueba tardó 151 segundos para 79 secciones por lado. El posprocesado de clasificación y la reapertura son tiempos adicionales. No se dispone de una medición manual comparable.

En la prueba nativa posterior al reinicio, Generar Proyecto llegó al eje 6 y mostró un aviso de longitudinal ausente antes del eje ensayado. Registrar el texto del aviso obtenido por session_snapshot; aceptar el mensaje no acredita que se haya recuperado esa rasante. En la variante IFC reabierta se verificaron 395 vértices desplazados y 2.244 caras por barandilla, con la malla de los postes intacta.

### Materiales de firme en IFC 4.3 ADD2

`ifc_road_materials` audita un IFC exportado y puede escribir una nueva entrega. La tabla 01 identifica la función de la capa. La 03 identifica sus materiales. En `RCE_CLA_03_Codigo_Materiales` y `RCE_CLA_03_Descripcion_Materiales`, el manual prescribe el mismo orden y el separador punto y coma seguido de espacio para varios valores. Véanse las páginas 24 y 36 del [manual distribuido con RCEclass](https://www.transportes.gob.es/carreteras/rceclass).

Pasar `filePath`, la carpeta de tablas FCT en `catalogDirectory` y las reglas confirmadas para el proyecto. Un ejemplo de dos reglas es:

```json
[
  {"family":"BBTM-11B","functionCode":"F_FIR_10_05_10","materialCodes":["M_CMM_35_30","M_CPR_50_30"]},
  {"family":"ZA","functionCode":"F_FIR_05_05","materialCodes":["M_CMM_35_40"]}
]
```

Cada regla exige coincidencia literal de la familia IFC (`ObjectType`) y de la función en el Pset y en su referencia. La segunda regla requiere una subbase identificada como ZA. Un relleno de zahorra tiene otra función. Confirmar la correspondencia de nombres con la sección tipo, el perfil FCV y las especificaciones de la mezcla en cada proyecto.

1. Omitir `outputPath` para previsualizar coincidencias, discrepancias y familias pendientes. Con `rules: []` se obtiene un inventario sin reglas de proyecto.
2. Para asociar también materiales que el IFC ya declara correctamente en tabla 03, indicar `useExistingTable03: true`. El MCP comprueba códigos, descripciones, referencias de clasificación y función. Esta comprobación acredita la coherencia del fichero. La especificación del proyecto acredita la composición.
3. Indicar una ruta IFC nueva para escribir. El MCP asocia un `IfcMaterial` para un solo material o un `IfcMaterialConstituentSet` para una mezcla, vincula los materiales a sus referencias de catálogo y conserva las clases IFC de los productos. Las fracciones requieren datos de dosificación independientes. Los conflictos con materiales preexistentes o propiedades compartidas se incluyen en el resultado para revisión.
4. Reabrir el resultado con las mismas reglas y sin destino. Revisar `verified`, los conflictos, las familias sin regla y el recuento de elementos con material. El perfil FCV de Istram debe revisarse por separado para reproducir la asignación en una futura exportación nativa.

En la prueba de Massalavés, el IFC de partida contenía 1.764 elementos y 457 declaraciones de tabla 03. Ningún elemento tenía una asociación IFC de material. Al reabrir la entrega se verificaron las 457 declaraciones existentes y 177 capas de firme adicionales. Las 944 mallas trianguladas conservaron sus índices de caras y sus coordenadas. Quedaron 1.130 elementos sin asociación de material. La regla de subbase ZA tuvo cero coincidencias. Las 69 ocurrencias S-C y las 57 de z.a. relleno carecían de función en el IFC. La clasificación de esas capas requiere contrastar la sección tipo con el proyecto nativo.

### Estado de la regeneración nativa al 20 de noviembre de 2026

En `MASS_06N.pol`, el volumen del eje 6 solicita `MASS_02-6.lon` y el del eje 26 (VIAL-04) solicita `MASS6-26.lon`. Istram mostró ambos avisos al generar el proyecto. El archivo `MASS_06-26.vol` conserva datos de rasante entre los PK 0 y 20 y referencia por separado el longitudinal externo. El eje 26 también figura en el IFC revisado. El paquete original de 742 entradas revisado carecía de archivos LON.

La comprobación de materiales se realizó sobre la exportación existente. La regeneración nativa completa queda pendiente de recuperar ambos longitudinales o de que el responsable del trazado confirme que las referencias han quedado obsoletas. Tras resolverlas, generar desde la raíz del proyecto y contrastar de nuevo los ejes, los sólidos y los materiales.
