#!/usr/bin/env bash

set -euo pipefail

BACKUP_FILE="${1:-}"
RESTORE_DB="${RESTORE_DB:-research_restore_test}"
POSTGRES_USER="${POSTGRES_USER:-research}"
PRIMARY_DB="${POSTGRES_DB:-research}"

if [[ -z "$BACKUP_FILE" ]]; then
    echo "Usage: $0 <backup-file.sql>"
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "ERROR: Backup file does not exist: $BACKUP_FILE"
    exit 1
fi

# The restore drops and recreates RESTORE_DB, so it must never point at the
# live database (whatever POSTGRES_DB names it) or a system database.
if [[ "$RESTORE_DB" == "research" || "$RESTORE_DB" == "$PRIMARY_DB" ]]; then
    echo "ERROR: Refusing to restore directly into the primary research database."
    echo "Use a temporary restore database for verification."
    exit 1
fi

case "$RESTORE_DB" in
    postgres | template0 | template1)
        echo "ERROR: Refusing to restore into system database '$RESTORE_DB'."
        exit 1
        ;;
esac

echo "Preparing restore test database: $RESTORE_DB"

docker compose exec -T postgres \
  psql \
  -U "$POSTGRES_USER" \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";"

docker compose exec -T postgres \
  psql \
  -U "$POSTGRES_USER" \
  -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$RESTORE_DB\";"

echo "Restoring backup..."

docker compose exec -T postgres \
  psql \
  -U "$POSTGRES_USER" \
  -d "$RESTORE_DB" \
  -v ON_ERROR_STOP=1 \
  < "$BACKUP_FILE"

echo
echo "Restore completed successfully."
echo "Restored database: $RESTORE_DB"
