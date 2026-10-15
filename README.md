# Taller Práctico — Tema 7: Transferencia de Archivos y Sincronización Asíncrona

**Facultad de Ingeniería y Arquitectura — Escuela Profesional de Ingeniería de Sistemas**
Curso: *APPS MÓVILES AVANZADAS*

Solución completa del taller:

1. **API backend en Flask** (pensada para GitHub Codespaces) que descarga un archivo grande y **soporta reanudación** mediante la cabecera HTTP `Range`.
2. **App en Expo / Snack** que muestra el **progreso** de la transferencia y permite **reanudar** la descarga.

---

## 📁 Estructura del proyecto

```
TallerTransferenciaArchivos/
├── server/
│   ├── app.py                  # Servidor Flask con descarga reanudable (Range)
│   ├── create_sample_file.py   # Genera large-sample-file.zip (20 MB)
│   └── requirements.txt        # Dependencias (Flask)
├── app/
│   └── App.js                  # App de Expo (progreso + reanudar)
├── .devcontainer/
│   └── devcontainer.json       # Configuración automática para Codespaces
└── README.md
```

---

## 🚀 Parte 1 — Servidor Flask en GitHub Codespaces

### 1.1 Subir el proyecto
Sube la carpeta `server/` (y opcionalmente `.devcontainer/`) a un repositorio de GitHub
y ábrelo en un **Codespace**. Si incluyes `.devcontainer/devcontainer.json`, Codespaces
instala Flask y crea el archivo de prueba automáticamente.

### 1.2 Instalar dependencias y crear el archivo de 20 MB
```bash
pip install -r server/requirements.txt
python server/create_sample_file.py
```
> Alternativa en Linux (Codespaces), equivalente a la indicada en la diapositiva:
> ```bash
> dd if=/dev/zero of=server/large-sample-file.zip bs=1M count=20
> ```

### 1.3 Levantar el servidor
```bash
python server/app.py
```
El servidor queda escuchando en `0.0.0.0:4000`.

### 1.4 Hacer público el puerto
En la pestaña **Ports** de Codespaces:
1. Busca el puerto **4000**.
2. Clic derecho → **Port Visibility** → **Public**.
3. Copia la URL generada (termina en `-4000.app.github.dev`).

Para **tus** nombres reales de dominio, en `app/App.js` reemplaza la constante:
```js
const FILE_URL = 'https://TU-CODESPACE-4000.app.github.dev/large-sample-file.zip';
```

### 1.5 Cómo funciona la reanudación
- El endpoint `GET /large-sample-file.zip` responde **200** con el archivo completo si no
  hay cabecera `Range` (agrega `Accept-Ranges: bytes`).
- Si el cliente envía `Range: bytes=<inicio>-`, responde **206 Partial Content** con
  `Content-Range`, `Content-Length` y el stream del fragmento pedido. Así el cliente
  retoma exactamente donde se quedó.

### 1.6 Prueba rápida del servidor (opcional)
```bash
# Archivo completo
curl -I http://localhost:4000/large-sample-file.zip

# Descarga parcial (últimos 1 MB) -> debe devolver 206
curl -I -H "Range: bytes=19922944-" http://localhost:4000/large-sample-file.zip
```

---

## 📱 Parte 2 — App en Expo (Snack)

1. Entra a <https://snack.expo.dev/> y crea un proyecto nuevo.
2. Reemplaza el contenido de `App.js` por el del archivo `app/App.js`.
3. Ajusta `FILE_URL` con la URL pública de tu Codespace.
4. Abre la app en tu celular con **Expo Go** (la API de `expo-file-system` funciona en
   dispositivos; en la vista web/preview puede no comportarse igual).
5. Botones disponibles:
   - **Iniciar Descarga** → descarga completa mostrando el porcentaje.
   - **Reanudar Descarga (Range)** → reanuda/continúa usando `Range`.
   - **Verificar Archivo en Celular** → comprueba si el ZIP existe y su tamaño.

---

## 🔗 Relación con el código de la diapositiva

| Diapositiva | Este proyecto |
|---|---|
| `def download_file()` | `@app.route("/large-sample-file.zip")` en `server/app.py` |
| `generate()` (streaming) | Igual, con `CHUNK_SIZE` de 64 KB |
| `Response(..., 206, ...)` | Igual, + cabeceras CORS |
| `App.js` (fragmentos) | Componente `App()` completo con `StyleSheet` |
| `dd if=/dev/zero ...` | `create_sample_file.py` (multiplataforma) |

**Mejoras sobre el ejemplo:** el tamaño real se obtiene con `os.path.getsize`
(evita descuadres de `Content-Range`), se valida el `Range` (416 si es inválido),
se agregan cabeceras CORS/preflight y el manejo del caso "aún no existe archivo local"
al reanudar.

---

## ✅ Entregable
- URL del Codespace con el puerto 4000 público y el archivo servido.
- Snack de la app mostrando el progreso y la reanudación funcionando.
