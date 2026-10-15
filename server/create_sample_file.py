#!/usr/bin/env python
# =============================================================
#  Crea el archivo de prueba "large-sample-file.zip" (20 MB)
#  Equivalente en Linux a:
#      dd if=/dev/zero of=large-sample-file.zip bs=1M count=20
# =============================================================

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_PATH = os.path.join(BASE_DIR, "large-sample-file.zip")
FILE_SIZE = 20 * 1024 * 1024  # 20 MB
CHUNK = 1024 * 1024           # 1 MB

with open(FILE_PATH, "wb") as f:
    remaining = FILE_SIZE
    while remaining > 0:
        block = min(CHUNK, remaining)
        f.write(b"\0" * block)
        remaining -= block

print(f"Archivo creado: {FILE_PATH} ({os.path.getsize(FILE_PATH)} bytes)")
