#!/usr/bin/env bash

set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-research}"

SOURCE_DB="m5_backup_source_$$"
RESTORE_DB="m5_backup_restore_$$"
TEMP_BACKUP_DIR="$(mktemp -d)"

cleanup() {
    echo
    echo "Cleaning up disaster-recovery test..."

    docker compose exec -T postgres \
      psql -U "$POSTGRES_USER" -d postgres \
      -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$SOURCE_DB\";" \
      >/dev/null || true

    docker compose exec -T postgres \
      psql -U "$POSTGRES_USER" -d postgres \
      -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";" \
      >/dev/null || true

    rm -rf "$TEMP_BACKUP_DIR"
}

trap cleanup EXIT

echo "Creating isolated source database: $SOURCE_DB"

docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres \
  -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$SOURCE_DB\";" \
  >/dev/null

echo "Creating verification data..."

docker compose exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$SOURCE_DB" \
  -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE TABLE m5_backup_check (
    id INTEGER PRIMARY KEY,
    message TEXT NOT NULL
);

INSERT INTO m5_backup_check (id, message)
VALUES (1, 'M5 disaster recovery verification');
SQL

echo "Creating backup..."

BACKUP_DIR="$TEMP_BACKUP_DIR" \
POSTGRES_DB="$SOURCE_DB" \
POSTGRES_USER="$POSTGRES_USER" \
./scripts/backup-postgres.sh

BACKUP_FILE="$(
  find "$TEMP_BACKUP_DIR" \
    -maxdepth 1 \
    -type f \
    -name "${SOURCE_DB}_*.sql" \
    | head -n1
)"

if [[ -z "$BACKUP_FILE" ]]; then
    echo "ERROR: Backup file was not created."
    exit 1
fi

echo
echo "Restoring backup into: $RESTORE_DB"

RESTORE_DB="$RESTORE_DB" \
POSTGRES_USER="$POSTGRES_USER" \
./scripts/restore-postgres.sh "$BACKUP_FILE"

echo
echo "Verifying restored data..."

RECOVERED_MESSAGE="$(
  docker compose exec -T postgres \
    psql \
    -U "$POSTGRES_USER" \
    -d "$RESTORE_DB" \
    -Atc \
    "SELECT message FROM m5_backup_check WHERE id = 1;"
)"

EXPECTED_MESSAGE="M5 disaster recovery verification"

if [[ "$RECOVERED_MESSAGE" != "$EXPECTED_MESSAGE" ]]; then
    echo "ERROR: Restored data does not match expected value."
    echo "Expected: $EXPECTED_MESSAGE"
    echo "Actual:   $RECOVERED_MESSAGE"
    exit 1
fi

echo
echo "PostgreSQL backup and restore verification PASSED."
echo "Recovered message: $RECOVERED_MESSAGE"
