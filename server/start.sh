#!/usr/bin/env bash
# Arranca el servidor Flask si no esta corriendo.
# Se invoca automaticamente en cada inicio del Codespace (postStartCommand).
cd "$(dirname "$0")" || exit 1

if pgrep -f "app.py" > /dev/null; then
  echo "Flask ya esta corriendo en el puerto 4000."
else
  nohup python3 app.py > /tmp/flask.log 2>&1 &
  sleep 1
  echo "Flask iniciado en el puerto 4000."
fi
