#!/bin/bash
# Setup script for PostgreSQL replication monitoring

# Install required packages
sudo apt-get update
sudo apt-get install -y postgresql-client mailutils netcat cron

# Create monitor script
cat > /tmp/postgres_monitor.sh << 'EOF'
#!/bin/bash
# Robust PostgreSQL replication monitoring script with email alerts

# Configuration
EMAIL="jswork98@gmail.com"
PRIMARY_IP="10.0.0.153"
PRIMARY_PORT="5432"
CRITICAL_LAG_SECONDS=300  # 5 minutes
WARNING_LAG_SECONDS=60    # 1 minute
LOG_FILE="/var/log/postgres_monitor.log"

# Ensure log file exists and is writable
touch "$LOG_FILE" 2>/dev/null || sudo touch "$LOG_FILE"
[ ! -w "$LOG_FILE" ] && sudo chmod 644 "$LOG_FILE"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

send_alert() {
  SUBJECT="$1"
  MESSAGE="$2"
  
  log "ALERT: $SUBJECT - $MESSAGE"
  
  # Send email using mail command
  echo "$MESSAGE" | mail -s "PostgreSQL Monitor: $SUBJECT" "$EMAIL"
}

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
  send_alert "CRITICAL: PostgreSQL is not running" "PostgreSQL service is not running on standby server $(hostname). Please investigate immediately."
  exit 2
fi

# Check if this is a standby server
IS_STANDBY=$(sudo -u postgres psql -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' \n')

if [ "$IS_STANDBY" != "t" ]; then
  send_alert "WARNING: Server not in recovery mode" "Server $(hostname) is not in recovery mode. It might have been promoted to primary or recovery is broken."
  exit 1
fi

# Check replication lag
LAG_QUERY="SELECT CASE WHEN pg_last_xact_replay_timestamp() IS NULL THEN 999999 ELSE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int END;"
DELAY=$(sudo -u postgres psql -t -c "$LAG_QUERY" 2>/dev/null | tr -d ' \n')

# Check if we got a valid number
if ! [[ "$DELAY" =~ ^[0-9]+$ ]]; then
  log "ERROR: Failed to get valid replication lag. Got: '$DELAY'"
  send_alert "CRITICAL: Cannot determine replication lag" "Failed to calculate replication lag on $(hostname)."
  exit 2
fi

# Check connectivity to primary
if ! timeout 5 nc -z "$PRIMARY_IP" "$PRIMARY_PORT" &>/dev/null; then
  send_alert "CRITICAL: Cannot connect to primary server" "Standby server $(hostname) cannot connect to primary at $PRIMARY_IP:$PRIMARY_PORT"
  exit 2
fi

# Check replication status based on lag
if [ "$DELAY" -gt "$CRITICAL_LAG_SECONDS" ]; then
  send_alert "CRITICAL: Excessive replication lag" "Replication lag is ${DELAY} seconds on $(hostname), which exceeds critical threshold of $CRITICAL_LAG_SECONDS seconds."
  exit 2
elif [ "$DELAY" -gt "$WARNING_LAG_SECONDS" ]; then
  send_alert "WARNING: Significant replication lag" "Replication lag is ${DELAY} seconds on $(hostname), which exceeds warning threshold of $WARNING_LAG_SECONDS seconds."
  exit 1
else
  log "OK: Replication lag is ${DELAY} seconds"
  exit 0
fi
EOF

# Make script executable and move to system location
sudo mv /tmp/postgres_monitor.sh /home/ubuntu/postgres_monitor.sh
sudo chmod +x /home/ubuntu/postgres_monitor.sh

# Configure email settings
sudo debconf-set-selections <<< "postfix postfix/mailname string $(hostname)"
sudo debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"
sudo apt-get install -y postfix

# Set up hourly cron job
CRON_ENTRY="0 * * * * /home/ubuntu/postgres_monitor.sh"
(crontab -l 2>/dev/null || echo "") | grep -v "postgres_monitor.sh" | { cat; echo "$CRON_ENTRY"; } | crontab -

echo "PostgreSQL replication monitoring has been set up."
echo "The script will run every hour and send alerts to jswork98@gmail.com"
echo "You can test it immediately by running: sudo /home/ubuntu/postgres_monitor.sh"