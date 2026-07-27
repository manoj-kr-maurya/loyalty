#!/bin/bash
# Script to monitor logical replication status between primary and standby PostgreSQL

# Configuration
PRIMARY_HOST="10.0.0.153"
PRIMARY_PORT="5432"
PRIMARY_USER="replicator"
PRIMARY_PASSWORD="@mdRx560x"
PRIMARY_DB="databasename"

STANDBY_HOST="10.0.0.162"
STANDBY_PORT="5432"
STANDBY_USER="postgres"
STANDBY_PASSWORD="postgres"  # Update this to your standby postgres password
STANDBY_DB="databasename"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to check if PostgreSQL is running
check_postgres_running() {
    local host=$1
    local port=$2
    local user=$3
    local pass=$4
    local db=$5
    
    if PGPASSWORD="${pass}" psql -h "${host}" -p "${port}" -U "${user}" -d "${db}" -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}PostgreSQL is running at ${host}:${port}${NC}"
        return 0
    else
        echo -e "${RED}ERROR: Cannot connect to PostgreSQL at ${host}:${port}${NC}"
        return 1
    fi
}

# Check primary server
echo "Checking primary PostgreSQL server..."
if ! check_postgres_running "${PRIMARY_HOST}" "${PRIMARY_PORT}" "${PRIMARY_USER}" "${PRIMARY_PASSWORD}" "${PRIMARY_DB}"; then
    echo "Primary server check failed. Exiting."
    exit 1
fi

# Check standby server
echo "Checking standby PostgreSQL server..."
if ! check_postgres_running "${STANDBY_HOST}" "${STANDBY_PORT}" "${STANDBY_USER}" "${STANDBY_PASSWORD}" "${STANDBY_DB}"; then
    echo "Standby server check failed. Exiting."
    exit 1
fi

# Check publication status on primary
echo -e "\n${YELLOW}Publication status on primary:${NC}"
PGPASSWORD="${PRIMARY_PASSWORD}" psql -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" -U "${PRIMARY_USER}" -d "${PRIMARY_DB}" -c "SELECT * FROM pg_publication;"

# Check subscription status on standby
echo -e "\n${YELLOW}Subscription status on standby:${NC}"
PGPASSWORD="${STANDBY_PASSWORD}" psql -h "${STANDBY_HOST}" -p "${STANDBY_PORT}" -U "${STANDBY_USER}" -d "${STANDBY_DB}" -c "SELECT subname, subenabled, subconninfo, subslotname, subsynccommit FROM pg_subscription;"

# Check detailed subscription status
echo -e "\n${YELLOW}Detailed subscription status:${NC}"
PGPASSWORD="${STANDBY_PASSWORD}" psql -h "${STANDBY_HOST}" -p "${STANDBY_PORT}" -U "${STANDBY_USER}" -d "${STANDBY_DB}" -c "SELECT * FROM pg_stat_subscription;"

# Check table count differences to verify data synchronization
echo -e "\n${YELLOW}Checking table counts to verify synchronization:${NC}"

# Get list of tables from primary
tables=$(PGPASSWORD="${PRIMARY_PASSWORD}" psql -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" -U "${PRIMARY_USER}" -d "${PRIMARY_DB}" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';")

# Check count for each table
for table in $tables; do
    primary_count=$(PGPASSWORD="${PRIMARY_PASSWORD}" psql -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" -U "${PRIMARY_USER}" -d "${PRIMARY_DB}" -t -c "SELECT COUNT(*) FROM ${table};" | tr -d ' ')
    standby_count=$(PGPASSWORD="${STANDBY_PASSWORD}" psql -h "${STANDBY_HOST}" -p "${STANDBY_PORT}" -U "${STANDBY_USER}" -d "${STANDBY_DB}" -t -c "SELECT COUNT(*) FROM ${table} 2>/dev/null;" | tr -d ' ')
    
    if [ "$primary_count" = "$standby_count" ]; then
        echo -e "Table ${table}: ${GREEN}Synchronized${NC} (${primary_count} rows)"
    else
        echo -e "Table ${table}: ${RED}NOT synchronized${NC} (Primary: ${primary_count}, Standby: ${standby_count})"
    fi
done

echo -e "\n${YELLOW}Replication monitoring completed.${NC}"
