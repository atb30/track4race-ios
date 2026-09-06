#!/bin/sh
set -eu

# El volumen puede crearse como root en el VPS; cedemos sus permisos al proceso.
mkdir -p /app/data
chown -R node:node /app/data
exec su-exec node node server/index.mjs
