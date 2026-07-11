#!/bin/sh
set -e

echo "Waiting for database..."
for i in $(seq 1 30); do
  python -c "import psycopg2, os; psycopg2.connect(os.environ['DATABASE_URL_SYNC'])" && break
  echo "  attempt $i/30..."
  sleep 2
done

echo "Running alembic upgrade head..."
alembic upgrade head
echo "Starting gunicorn..."
exec "$@"