#!/bin/sh
set -e
echo "Running alembic upgrade head..."
alembic upgrade head
echo "Starting gunicorn..."
exec "$@"