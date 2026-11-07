#!/usr/bin/env bash

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"

POSTGRES_DB="${POSTGRES_DB:-research}"
POSTGRES_USER="${POSTGRES_USER:-research}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql"

echo "Creating PostgreSQL backup..."
echo "Database: $POSTGRES_DB"
echo "Output:   $BACKUP_FILE"

if ! docker compose exec -T postgres \
  pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  > "$BACKUP_FILE"; then

    echo
    echo "ERROR: PostgreSQL backup failed."
    echo "Removing incomplete backup: $BACKUP_FILE"

    rm -f "$BACKUP_FILE"
    exit 1
fi

echo
echo "Backup completed successfully."
echo "File: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
