# Contrato del adaptador de Windows

El perfil es configuración local confiable suministrada por el responsable de la instalación. La IA no puede crear perfiles a través de las herramientas MCP. No incluir rutas personales ni evidencias privadas en GitHub.

Campos: status (candidate o verified), binarySha256, projectGuard y actions. Un perfil verified requiere evidence.runs: al menos 20 registros correctos, en dos sesiones, con reportSha256.

Cada receta contiene arguments para abrir ISTRAM, steps y artifacts relativos a la copia. Las acciones aceptadas son open_project, save, recalculate, bim_configure, bim_generate y bim_export. No se incluyen nombres de botones o atajos inventados.

Cada paso incluye window (selector pywinauto), selector (control), kind (invoke, set_text, wait, verify_text), value opcional, timeout opcional y allowedWindows. El texto puede usar projectPath, projectFile y outputPath como variables entre llaves.

projectGuard debe identificar un control cuyo valor confirme la ruta completa del proyecto cargado; no basta con un título genérico "ISTRAM". Se debe verificar también después de open_project.

Postcondiciones: una comprobación explícita de texto y, cuando corresponda, artefactos nuevos o modificados. Una comprobación visual genérica no certifica un recálculo. La exportación BIM se valida además con ifc_validate.

La inspección session_snapshot sirve para obtener selectores reales. Ejecutar el evaluador de aceptación solo con recetas ya revisadas, en copias, con la sesión supervisada. El modo candidato debe permanecer ausente de las variables del cliente de IA.

No hay un perfil certificado incluido. El motor rechaza recetas ausentes, evidencia incompleta y hash de ejecutable diferente.

La escritura requiere además writableFormats: por extensión, encoding, revisionPattern y linePattern. Ambos textos de cada cambio deben coincidir con la regla revisada. No declarar reglas universales que admitan cualquier línea. Estas reglas comprueban forma y revisión; la geometría se comprueba en ISTRAM y en la aceptación.
