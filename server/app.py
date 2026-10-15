# =============================================================
#  Taller Practico - Tema 7
#  Transferencia de Archivos y Sincronizacion Asincrona
#
#  Servidor backend en Flask que permite:
#    - Descargar un archivo grande.
#    - Reanudar la descarga mediante la cabecera HTTP "Range".
#
#  Facultad de Ingenieria y Arquitectura
#  Escuela Profesional de Ingenieria de Sistemas
#  Curso: APPS MOVILES AVANZADAS
# =============================================================

import os

from flask import Flask, Response, request, send_file, abort

app = Flask(__name__)

# -------------------------------------------------------------
#  Configuracion
# -------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FILE_NAME = "large-sample-file.zip"                     # Nombre del archivo
FILE_PATH = os.path.join(BASE_DIR, FILE_NAME)           # Ruta real del archivo
FILE_SIZE = 20 * 1024 * 1024                            # Tamano esperado: 20 MB

CHUNK_SIZE = 64 * 1024                                  # 64 KB por bloque del stream


def total_size():
    """Tamano real del archivo (cae en FILE_SIZE si aun no existe)."""
    return os.path.getsize(FILE_PATH) if os.path.exists(FILE_PATH) else FILE_SIZE


# -------------------------------------------------------------
#  CORS: permite consumir la API desde Snack Expo (web y nativo)
# -------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Range, Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Expose-Headers"] = (
        "Content-Range, Content-Length, Accept-Ranges"
    )
    return response


# -------------------------------------------------------------
#  Endpoint de descarga (completa o parcial / reanudable)
# -------------------------------------------------------------
@app.route("/large-sample-file.zip", methods=["GET", "OPTIONS"])
def download_file():
    # Preflight de CORS
    if request.method == "OPTIONS":
        return ("", 204)

    if not os.path.exists(FILE_PATH):
        abort(404, "El archivo no existe. Ejecuta create_sample_file.py primero.")

    size = total_size()
    range_header = request.headers.get("Range", None)

    # ---- 1) Descarga completa (sin cabecera Range) ----
    if not range_header:
        response = send_file(FILE_PATH, mimetype="application/zip")
        response.headers["Accept-Ranges"] = "bytes"
        return response

    # ---- 2) Descarga parcial (reanudacion) ----
    try:
        byte_range = range_header.replace("bytes=", "").split("-")
        start = int(byte_range[0]) if byte_range[0] else 0
        end = int(byte_range[1]) if byte_range[1] else size - 1
    except ValueError:
        abort(400, "Invalid Range header")

    # Ajuste y validacion de limites
    if start >= size:
        resp = Response(status=416)
        resp.headers["Content-Range"] = f"bytes */{size}"
        return resp

    end = min(end, size - 1)
    length = (end - start) + 1

    # Generador que envia el archivo en bloques (streaming)
    def generate():
        with open(FILE_PATH, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk_size = min(CHUNK_SIZE, remaining)
                data = f.read(chunk_size)
                if not data:
                    break
                yield data
                remaining -= len(data)

    # 206 = Partial Content
    response = Response(
        generate(),
        206,
        mimetype="application/zip",
        direct_passthrough=True,
    )
    response.headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Content-Length"] = str(length)
    return response


# -------------------------------------------------------------
#  Endpoint de estado (util para verificar que el servidor vive)
# -------------------------------------------------------------
@app.route("/")
def index():
    return {
        "status": "ok",
        "file": FILE_NAME,
        "size_bytes": total_size(),
        "resumable": True,
    }


if __name__ == "__main__":
    # host 0.0.0.0 es obligatorio en Codespaces para exponer el puerto
    app.run(host="0.0.0.0", port=4000)
