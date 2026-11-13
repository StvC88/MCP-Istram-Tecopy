# Exportación y revisión de RCEclass en IFC

El flujo aplica el perfil de clasificación de ISTRAM al árbol BIM, exporta
IFC4.3 ADD2 y comprueba los códigos contra el catálogo aprobado para el proyecto.

## En ISTRAM

1. Identificar el POL y el alcance del árbol BIM. Revisar ejes y tramos
   presentes antes de exportar.
2. En **BIM → Clases/Atributos**, cargar `RCEclass_ClasesIstram.fcv`. El perfil
   referencia los siete archivos FCT. Revisar las clases sin traducción en
   **Clasificación** y aplicar las clasificaciones al alcance elegido.
3. En **BIM → Propiedades**, importar `RCEclass_PSetsIstram.atf` y aplicar
   `RCE_CLA`. Revisar que las descripciones procedan de las tablas aplicadas.
4. En **BIM → Archivos**, elegir IFC4.3 ADD2, origen de coordenadas según el
   proyecto y un nombre nuevo de IFC. Verificar que ISTRAM indique que escribió
   el archivo.

Las tablas y plantillas se obtienen del protocolo del proyecto. La
[Orden Circular 5/2024](https://www.transportes.gob.es/carreteras/rceclass)
publica el sistema RCEclass.

## En el MCP

- `project_inspect` con `summary: true` devuelve un inventario paginado.
  `projectFile` restringe el análisis a un POL relativo a la carpeta del
  proyecto. Un archivo encontrado en la raíz se muestra como candidato
  pendiente de confirmar en ISTRAM.
- `ifc_rceclass_audit` compara los códigos de `RCE_CLA` con las asociaciones
  IFC y con los siete FCT del directorio indicado. También comprueba que
  exista una descripción para cada tabla usada. La cobertura y las muestras
  de códigos desconocidos ayudan a revisar las asignaciones que faltan.
  `requiredTables` selecciona las tablas obligatorias. El valor inicial del
  piloto es Funciones, Estados y Complejos. Ajustarlo a los requisitos del
  proyecto.
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
