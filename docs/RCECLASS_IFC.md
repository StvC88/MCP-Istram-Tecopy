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
