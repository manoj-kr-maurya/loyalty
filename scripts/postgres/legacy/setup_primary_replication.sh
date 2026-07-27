#!/bin/bash
# Minimal script for setting up logical replication publication

# Check if the script has been run before by looking for a marker file
MARKER_FILE="/var/lib/postgresql/data/.replication_setup_complete"
if [ -f "$MARKER_FILE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Replication setup already completed. Skipping."
  exit 0
fi

# Function to print status messages
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Get database connection parameters from environment variables
# These should already be set in the container environment from docker-compose
# Adding fallbacks for safety
PG_USER="${POSTGRES_USER:-postgres}"
PG_PASSWORD="${POSTGRES_PASSWORD:-password}"
PG_DB="${POSTGRES_DB:-postgres}"
# For scripts running in docker-entrypoint-initdb.d, postgres is available on localhost
PG_HOST="localhost"
PG_PORT="5432"

# Debug information
log "Database connection parameters:"
log "POSTGRES_USER: $POSTGRES_USER"
log "POSTGRES_PASSWORD: ********" # Don't log actual password
log "POSTGRES_DB: $POSTGRES_DB"
log "Using connection: psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"

# Wait for PostgreSQL to be ready (it should be since this script runs at init time, but let's be extra safe)
log "Waiting for PostgreSQL to be fully ready..."
for i in {1..30}; do
  if pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" >/dev/null 2>&1; then
    log "PostgreSQL is ready!"
    break
  fi
  log "Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

log "Checking for existing publication..."

# Check if publication exists
pub_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT count(*) FROM pg_publication WHERE pubname = 'pub_all';")
pub_exists=$(echo $pub_exists | tr -d ' ')

# Create publication only if it doesn't exist
if [ "$pub_exists" -eq "0" ]; then
  log "Creating publication for all tables..."
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "
  CREATE PUBLICATION pub_all FOR ALL TABLES WITH (publish = 'insert,update,delete,truncate');
  "
  log "Publication 'pub_all' created successfully"
else
  log "Publication 'pub_all' already exists"
fi

# Create a marker file to indicate this script has run successfully
touch "$MARKER_FILE"
log "Created marker file: $MARKER_FILE"

log "Replication publication setup complete"