# Instalar ISTRAM MCP en Codex para Windows

Guardar el repositorio en una ubicación permanente. El servidor registrado depende de esa carpeta; no usar una descarga temporal.

Desde la raíz del repositorio, con Node 22.14 o posterior y Python instalado:

```powershell
npm ci
npm run build
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python\requirements.txt
```

Si el Python disponible no incluye ensurepip, crear el entorno con `python -m venv --without-pip .venv` e instalar mediante un Python que sí tenga pip: `python -m pip --python .venv\Scripts\python.exe install -r python\requirements.txt`. Usar un entorno virtual real: una carpeta de paquetes con PYTHONPATH puede encontrar pywinauto sin cargar correctamente sus DLL de pywin32.

Sustituir las rutas de ejemplo por las de la instalación:

```powershell
codex mcp add istram --env ISTRAM_PATH=C:\Ispol --env ISTRAM_WORKSPACE=C:\ruta\MCP-Istram-Tecopy\.local\projects --env ISTRAM_PYTHON=C:\ruta\MCP-Istram-Tecopy\.venv\Scripts\python.exe -- node C:\ruta\MCP-Istram-Tecopy\dist\index.js
codex mcp get istram --json
```

Si una ruta tiene espacios, encerrarla entre comillas. La configuración de Codex se almacena en config.toml; no reemplazar otros servidores existentes. Iniciar una conversación nueva o reiniciar Codex si la conversación actual conserva el catálogo anterior.

Comprobar tools/list, worker_health y project_inspect. worker_health intenta importar las dependencias y presenta los errores reales, además de indicar si existe un perfil de adaptador. Que las dependencias estén disponibles no certifica acceso a la sesión ni ejecución nativa.

session_snapshot requiere acceso a los procesos y ventanas de la sesión interactiva de Windows. Un error de tasklist o del backend debe registrarse como fallo de inspección; no concluir que ISTRAM está cerrado.

Antes de modificar, crear una copia gestionada y abrir ISTRAM **en esa carpeta de trabajo** mediante su lanzador. Las acciones MCP de escritura y cálculo requieren el perfil de aceptación descrito en [ADAPTER.md](ADAPTER.md).

Referencia: [configuración MCP de Codex](https://developers.openai.com/codex/mcp).
