#!/bin/bash

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print status messages
log() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to prompt for information
prompt() {
  local prompt_text="$1"
  local default_value="$2"
  local result

  if [ -n "$default_value" ]; then
    read -p "${prompt_text} [${default_value}]: " result
    result="${result:-$default_value}"
  else
    read -p "${prompt_text}: " result
  fi

  echo "$result"
}

# Welcome message
clear
log "PostgreSQL Standby Server Setup Script"
log "This script will set up a PostgreSQL standby server with logical replication"
log "It will dump schema and data from the primary server and restore it locally"
echo ""

# First install PostgreSQL and required tools
log "Installing PostgreSQL 16 and needed tools..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-16 postgresql-client-16 postgresql-16-repack

# Collect information about the primary server
log "Please provide information about your PRIMARY PostgreSQL server:"
PRIMARY_HOST=$(prompt "Primary server IP address")
PRIMARY_PORT=$(prompt "Primary server PostgreSQL port" "5432")
PRIMARY_DB=$(prompt "Primary database name")
PRIMARY_USER=$(prompt "Primary database username for replication")
PRIMARY_PASSWORD=$(prompt "Primary database password for replication")
PRIMARY_ADMIN_USER=$(prompt "Primary database admin username (with dump privileges)" "postgres")
PRIMARY_ADMIN_PASSWORD=$(prompt "Primary database admin password")

# Collect information about the standby server setup
log "Please provide information for the STANDBY server setup:"
STANDBY_DB=$(prompt "Standby database name" "$PRIMARY_DB")
STANDBY_USER=$(prompt "Standby database owner username")
STANDBY_PASSWORD=$(prompt "Standby database owner password")

# Subscription details
SUBSCRIPTION_NAME=$(prompt "Subscription name" "sub_from_primary")
SLOT_NAME=$(prompt "Replication slot name" "$SUBSCRIPTION_NAME")
PUBLICATION_NAME=$(prompt "Publication name on primary" "pub_all")

# Confirm settings
echo ""
log "Please review the following settings:"
echo "Primary Server: $PRIMARY_HOST:$PRIMARY_PORT"
echo "Primary Database: $PRIMARY_DB"
echo "Primary Admin User: $PRIMARY_ADMIN_USER"
echo "Primary Replication User: $PRIMARY_USER"
echo "Standby Database: $STANDBY_DB"
echo "Standby Database Owner: $STANDBY_USER"
echo "Subscription Name: $SUBSCRIPTION_NAME"
echo "Replication Slot Name: $SLOT_NAME"
echo "Publication Name: $PUBLICATION_NAME"
echo ""

read -p "Proceed with these settings? (y/n): " confirm
if [[ $confirm != [yY] ]]; then
  log_error "Setup aborted by user"
  exit 1
fi

# Configure PostgreSQL
log "Configuring PostgreSQL for replication..."
sudo tee /etc/postgresql/16/main/conf.d/replication.conf > /dev/null << EOF
# Replication settings
listen_addresses = '*'
wal_level = logical
max_replication_slots = 10
max_logical_replication_workers = 4
max_worker_processes = 10
max_sync_workers_per_subscription = 4
EOF

# Configure pg_hba.conf to allow remote connections
log "Configuring pg_hba.conf..."
sudo tee -a /etc/postgresql/16/main/pg_hba.conf > /dev/null << EOF

# Allow connections for replication
host    all             all             0.0.0.0/0               scram-sha-256
EOF

# Restart PostgreSQL
log "Restarting PostgreSQL..."
sudo systemctl restart postgresql

# Wait for PostgreSQL to start
sleep 5

# Create database and user
log "Creating database and user..."
sudo -u postgres psql << EOF
CREATE DATABASE $STANDBY_DB;
CREATE USER $STANDBY_USER WITH PASSWORD '$STANDBY_PASSWORD';
ALTER DATABASE $STANDBY_DB OWNER TO $STANDBY_USER;
EOF

# Verify publication exists on primary server
log "Checking if publication exists on primary server..."
PUBLICATION_EXISTS=$(PGPASSWORD=$PRIMARY_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $PRIMARY_USER -d $PRIMARY_DB -t -c "SELECT COUNT(*) FROM pg_publication WHERE pubname = '$PUBLICATION_NAME';")
PUBLICATION_EXISTS=$(echo $PUBLICATION_EXISTS | tr -d '[:space:]')

if [ "$PUBLICATION_EXISTS" = "0" ]; then
  log_error "Publication '$PUBLICATION_NAME' does not exist on the primary server."
  log "Please create a publication on the primary server using the following command:"
  echo "CREATE PUBLICATION $PUBLICATION_NAME FOR ALL TABLES;"
  read -p "Press Enter to continue after you've created the publication on the primary server..."
  
  # Check again after user confirmation
  PUBLICATION_EXISTS=$(PGPASSWORD=$PRIMARY_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $PRIMARY_USER -d $PRIMARY_DB -t -c "SELECT COUNT(*) FROM pg_publication WHERE pubname = '$PUBLICATION_NAME';")
  PUBLICATION_EXISTS=$(echo $PUBLICATION_EXISTS | tr -d '[:space:]')
  
  if [ "$PUBLICATION_EXISTS" = "0" ]; then
    log_error "Publication still not found. Setup cannot continue without a valid publication."
    exit 1
  fi
fi

log_success "Publication '$PUBLICATION_NAME' exists on primary server"

# Dump schema from primary server
log "Dumping schema from primary server..."
PGPASSWORD=$PRIMARY_ADMIN_PASSWORD pg_dump -h $PRIMARY_HOST -p $PRIMARY_PORT -U $PRIMARY_ADMIN_USER -d $PRIMARY_DB --schema-only -f /tmp/schema.sql

if [ $? -ne 0 ]; then
  log_error "Failed to dump schema from primary server"
  exit 1
fi

log_success "Schema dumped successfully"

# Restore schema to standby server
log "Restoring schema to standby server..."
sudo -u postgres psql -d $STANDBY_DB -f /tmp/schema.sql

if [ $? -ne 0 ]; then
  log_error "Failed to restore schema to standby server"
  exit 1
fi

log_success "Schema restored successfully"

# Dump data from primary server (without large data tables or in batches)
log "Dumping data from primary server..."
# This only dumps table data, not schema, views, functions, etc.
PGPASSWORD=$PRIMARY_ADMIN_PASSWORD pg_dump -h $PRIMARY_HOST -p $PRIMARY_PORT -U $PRIMARY_ADMIN_USER -d $PRIMARY_DB --data-only -f /tmp/data.sql

if [ $? -ne 0 ]; then
  log_error "Failed to dump data from primary server"
  exit 1
fi

log_success "Data dumped successfully"

# Restore data to standby server
log "Restoring data to standby server..."
sudo -u postgres psql -d $STANDBY_DB -f /tmp/data.sql

if [ $? -ne 0 ]; then
  log_error "Failed to restore data to standby server"
  exit 1
fi

log_success "Data restored successfully"

# Create the subscription with copy_data = false since we already have the data
log "Creating subscription to primary server..."
sudo -u postgres psql -d "$STANDBY_DB" << EOF
CREATE SUBSCRIPTION $SUBSCRIPTION_NAME 
CONNECTION 'host=$PRIMARY_HOST port=$PRIMARY_PORT dbname=$PRIMARY_DB user=$PRIMARY_USER password=$PRIMARY_PASSWORD' 
PUBLICATION $PUBLICATION_NAME 
WITH (copy_data = false, slot_name = '$SLOT_NAME');
EOF

if [ $? -eq 0 ]; then
  log_success "Subscription created successfully with copy_data = false"
else
  log_error "Failed to create subscription. Check PostgreSQL logs for details:"
  echo "sudo tail -f /var/log/postgresql/postgresql-16-main.log"
  exit 1
fi

# Check subscription status
log "Checking subscription status..."
sudo -u postgres psql -d "$STANDBY_DB" -c "SELECT subname, subenabled FROM pg_subscription;"
sudo -u postgres psql -d "$STANDBY_DB" -c "SELECT * FROM pg_stat_subscription;"

log_success "PostgreSQL standby server setup complete!"
log "Schema and data have been copied from the primary server and replication is now active."
log "To check replication status, run:"
echo "sudo -u postgres psql -d $STANDBY_DB -c \"SELECT * FROM pg_stat_subscription;\""
echo ""
log "To test replication, make a change on the primary and check if it appears on the standby."
echo ""
log "IMPORTANT: You may need to grant additional permissions to the replication user on the primary server"
log "If you encounter permission issues, run this on the primary server:"
echo "GRANT SELECT ON ALL TABLES IN SCHEMA public TO $PRIMARY_USER;"