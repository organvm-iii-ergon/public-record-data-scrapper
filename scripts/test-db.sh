#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="public-records-test-db"
IMAGE="postgres:16-alpine"
HOST_PORT="${TEST_DB_PORT:-5434}"
DB_NAME="${TEST_DB_NAME:-ucc_intelligence_test}"
DB_USER="${TEST_DB_USER:-postgres}"
DB_PASSWORD="${TEST_DB_PASSWORD:-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_PATH="${TEST_DB_SCHEMA_PATH:-${SCRIPT_DIR}/../database/migrations/001_initial_schema.sql}"

usage() {
  cat <<'USAGE'
Usage: scripts/test-db.sh <start|stop|status|reset>

Commands:
  start   Start the local Postgres test DB container (or report if running)
  stop    Stop the container if running
  status  Show container status
  reset   Stop/remove container, recreate, and apply schema

Environment overrides:
  TEST_DB_PORT, TEST_DB_NAME, TEST_DB_USER, TEST_DB_PASSWORD, TEST_DB_SCHEMA_PATH
USAGE
}

status() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "running"
    return 0
  fi
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "stopped"
    return 0
  fi
  echo "absent"
  return 0
}

start() {
  local state
  state="$(status)"

  if [[ "$state" == "running" ]]; then
    echo "Test DB container already running: ${CONTAINER_NAME}"
    return 0
  fi

  if [[ "$state" == "stopped" ]]; then
    echo "Starting existing container: ${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}" >/dev/null
  else
    echo "Creating and starting container: ${CONTAINER_NAME}"
    docker run -d \
      --name "${CONTAINER_NAME}" \
      -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
      -e POSTGRES_USER="${DB_USER}" \
      -e POSTGRES_DB="${DB_NAME}" \
      -p "${HOST_PORT}:5432" \
      "${IMAGE}" >/dev/null
  fi

  echo "Test DB ready at: postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${HOST_PORT}/${DB_NAME}"
}

stop() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping container: ${CONTAINER_NAME}"
    docker stop "${CONTAINER_NAME}" >/dev/null
    echo "stopped"
    return 0
  fi
  echo "not running"
}

wait_for_db() {
  local retries=30
  local count=0

  until docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" >/dev/null 2>&1; do
    count=$((count + 1))
    if [[ $count -ge $retries ]]; then
      echo "Test DB did not become ready in time"
      return 1
    fi
    sleep 1
  done
}

apply_schema() {
  if [[ ! -f "${SCHEMA_PATH}" ]]; then
    echo "Schema file not found: ${SCHEMA_PATH}"
    return 1
  fi

  docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${SCHEMA_PATH}"
}

reset() {
  echo "Resetting test DB container: ${CONTAINER_NAME}"
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null
  fi

  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_DB="${DB_NAME}" \
    -p "${HOST_PORT}:5432" \
    "${IMAGE}" >/dev/null

  wait_for_db
  apply_schema

  echo "Test DB reset complete"
  echo "Test DB ready at: postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${HOST_PORT}/${DB_NAME}"
}

cmd="${1:-}"
case "$cmd" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  reset) reset ;;
  *) usage; exit 1 ;;
esac
