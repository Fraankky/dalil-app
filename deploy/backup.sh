#!/bin/sh
set -euo pipefail

DB_NAME="${DB_NAME:-dalil}"
DB_USER="${DB_USER:-dalil}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
ENCRYPT_KEY="${ENCRYPT_KEY:-}"

mkdir -p "$BACKUP_DIR"

pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILENAME"

if [ -n "$ENCRYPT_KEY" ]; then
    gpg --batch --yes --passphrase "$ENCRYPT_KEY" -c "$FILENAME"
    rm "$FILENAME"
    FILENAME="${FILENAME}.gpg"
fi

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz*" -mtime +14 -delete
echo "Backup: $FILENAME"