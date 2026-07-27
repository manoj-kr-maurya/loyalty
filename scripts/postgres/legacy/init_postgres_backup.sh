#!/bin/bash
# Optimized setup script for PostgreSQL standby server with Docker primary
# Variables with Docker host IP and settings
DOCKER_HOST_IP="10.0.0.153"  # Change this to your Docker host IP
PRIMARY_PORT="5432"          # The port you've mapped for PostgreSQL in Docker
REPLICATION_USER="replicator"
REPLICATION_PASSWORD="@mdRx560x"
PG_VERSION="16"

# Install PostgreSQL
echo "Installing PostgreSQL ${PG_VERSION}..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y postgresql-${PG_VERSION} postgresql-client-${PG_VERSION}

# Stop PostgreSQL service - using the correct service name format
echo "Stopping PostgreSQL service..."
sudo systemctl stop postgresql@${PG_VERSION}-main

# Clear existing data directory
echo "Clearing existing data directory..."
sudo rm -rf /var/lib/postgresql/${PG_VERSION}/main/*

# Verify connection to Docker PostgreSQL before taking backup
echo "Verifying connection to primary PostgreSQL in Docker..."
if ! PGPASSWORD="$REPLICATION_PASSWORD" psql -h $DOCKER_HOST_IP -p $PRIMARY_PORT -U $REPLICATION_USER -c "SELECT version();" databasename; then
    echo "ERROR: Cannot connect to PostgreSQL in Docker container. Check:"
    echo "1. Docker container is running"
    echo "2. Port $PRIMARY_PORT is properly mapped"
    echo "3. PostgreSQL is configured to accept connections from this IP"
    echo "4. pg_hba.conf allows replication connections"
    exit 1
fi

# Take base backup from primary
echo "Taking base backup from primary server in Docker..."
sudo -u postgres PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
  -h $DOCKER_HOST_IP \
  -p $PRIMARY_PORT \
  -U $REPLICATION_USER \
  -D /var/lib/postgresql/${PG_VERSION}/main \
  -Fp \
  -Xs \
  -P \
  -v

# Create standby.signal file
echo "Creating standby.signal file..."
sudo -u postgres touch /var/lib/postgresql/${PG_VERSION}/main/standby.signal

# Configure standby server with optimized settings
echo "Configuring standby server..."
sudo -u postgres tee /var/lib/postgresql/${PG_VERSION}/main/postgresql.auto.conf > /dev/null << EOF
# STANDBY SERVER CONFIGURATION
listen_addresses = '*'
port = 5432
hot_standby = on
max_standby_streaming_delay = 30s  # Allow more delay for better query performance
hot_standby_feedback = on          # Prevent vacuum from removing rows standby needs
# PRIMARY CONNECTION SETTINGS
primary_conninfo = 'host=${DOCKER_HOST_IP} port=${PRIMARY_PORT} user=${REPLICATION_USER} password=${REPLICATION_PASSWORD} application_name=standby1'
recovery_target_timeline = 'latest'
# PERFORMANCE SETTINGS FOR STANDBY
shared_buffers = 512MB
work_mem = 64MB
maintenance_work_mem = 512MB
EOF

# Secure the password in the config
echo "Setting proper permissions on configuration files..."
sudo chmod 600 /var/lib/postgresql/${PG_VERSION}/main/postgresql.auto.conf
sudo chown postgres:postgres /var/lib/postgresql/${PG_VERSION}/main/postgresql.auto.conf

# Make sure data directory has correct permissions
sudo chown -R postgres:postgres /var/lib/postgresql/${PG_VERSION}/main

# Start PostgreSQL service with the correct service name
echo "Starting PostgreSQL service..."
sudo systemctl start postgresql@${PG_VERSION}-main

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start (30 seconds)..."
sleep 30

# Check if PostgreSQL is running
echo "Checking if PostgreSQL service is running..."
if sudo systemctl is-active --quiet postgresql@${PG_VERSION}-main; then
    echo "PostgreSQL service is running."
else
    echo "WARNING: PostgreSQL service is not running. Checking logs..."
    sudo tail -n 50 /var/log/postgresql/postgresql-${PG_VERSION}-main.log
fi

# Verify replication is working
echo "Verifying replication status..."
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"
sudo -u postgres psql -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_delay;"

echo "PostgreSQL standby server setup completed!"