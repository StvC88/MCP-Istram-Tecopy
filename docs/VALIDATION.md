# Validación de la base

Comprobación local del 9 de octubre de 2026, Windows, Node 24.18.1 y Python 3.14.6.

- npm ci: dependencias instaladas; auditoría npm sin vulnerabilidades reportadas en esa ejecución.
- npm run typecheck: correcto.
- npm test: 11 pruebas correctas.
- Python unittest: 4 pruebas correctas con las dependencias declaradas.

Las pruebas cubren codificación, lectura estricta, evidencia de versión, mapeos IFC, referencias del proyecto, límites de rutas, cambios recuperables, operaciones y comunicación MCP. El modelo IFC de prueba es sintético.

IfcOpenShell 0.9.0 necesita pytest para evaluar reglas EXPRESS/WHERE; esa dependencia se incluye en requirements.txt. Durante la prueba emitió un ResourceWarning interno sin fallar.

CI verifica Ubuntu/Windows con Node 22/24 y Python 3.12. Consultar [GitHub Actions](https://github.com/StvC88/MCP-Istram-Tecopy/actions) para el resultado asociado al commit revisado.

Pendientes: sesión/proyecto activo, recetas nativas, cálculo vial, configuración y generación BIM, exportación real y aceptación supervisada. Esta base permanece candidata.
