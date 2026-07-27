#!/bin/bash

# ========================================================================
# PostgreSQL Base Backup and Backblaze B2 Upload Script (for sudoers)
# 
# Purpose: Creates a PostgreSQL base backup from a Docker container and
#          uploads it to Backblaze B2 with proper folder structure.
#
# Usage: Run as a sudoer (not as root)
# ========================================================================

set -e  # Exit on error
set -o pipefail  # Exit if any command in a pipeline fails

# ------------------------------------------------------------------------
# ENVIRONMENT CHECKS
# ------------------------------------------------------------------------

# Ensure the user is a sudoer but not running as root
if [ "$EUID" -eq 0 ]; then
    echo "ERROR: This script should not be run as root. Run it as a sudoer (without sudo)."
    exit 1
fi

# ------------------------------------------------------------------------
# ENVIRONMENT VARIABLES
# ------------------------------------------------------------------------

ENVIRONMENT=${ENVIRONMENT:-"stage"}           # "stage" or "prod"
CONTAINER_NAME=${CONTAINER_NAME:-"lsbbe_postgres"}
POSTGRES_USER=${POSTGRES_USER:-"username"}
BACKUP_DIR=${BACKUP_DIR:-"/backup"}
B2_BUCKET_NAME=${B2_BUCKET_NAME:-"your-b2-bucket-name"}
B2_APP_KEY_ID=${B2_APP_KEY_ID:-"your-app-key-id"}
B2_APP_KEY=${B2_APP_KEY:-"your-app-key"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-"4"}  

# ------------------------------------------------------------------------
# DERIVED VARIABLES
# ------------------------------------------------------------------------

# Use date format: YYYY-MM-DD
DATE_FORMAT=$(date +%Y-%m-%d)
B2_FOLDER="${ENVIRONMENT}/${DATE_FORMAT}"
BASE_BACKUP_DIR="${BACKUP_DIR}/basebackup"
TEMP_BACKUP_DIR="${BASE_BACKUP_DIR}/${DATE_FORMAT}"
LAST_BACKUP_MARKER="${BACKUP_DIR}/last_successful_backup_timestamp"
WAL_UPLOAD_MARKER="${BACKUP_DIR}/last_wal_upload_timestamp"
START_WAL_FILE="${BACKUP_DIR}/last_backup_start_wal_file"

# ------------------------------------------------------------------------
# FUNCTIONS
# ------------------------------------------------------------------------

# Logging function - outputs to stdout only (no file logging)
log_message() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1"
}

# Function to mark successful backup timestamp for WAL management
mark_successful_backup() {
    date +%Y%m%d%H%M%S > "${LAST_BACKUP_MARKER}"
    log_message "Marked successful base backup at $(cat ${LAST_BACKUP_MARKER})"
    
    # Reset the WAL upload marker to force the WAL uploader to consider all WAL files
    touch "${WAL_UPLOAD_MARKER}"
}

# ------------------------------------------------------------------------
# MAIN SCRIPT
# ------------------------------------------------------------------------

log_message "Starting PostgreSQL base backup for ${ENVIRONMENT} environment"

# Ensure backup directories exist
sudo mkdir -p ${BACKUP_DIR} ${BASE_BACKUP_DIR} ${TEMP_BACKUP_DIR}
sudo chown -R $(whoami) ${BACKUP_DIR}  # Ensure the user owns the directory
log_message "Created backup directories at ${TEMP_BACKUP_DIR}"

# ------------------------------------------------------------------------
# B2 CLI SETUP
# ------------------------------------------------------------------------

# Ensure pip is installed
if ! command -v pip &> /dev/null; then
    log_message "pip is not installed. Installing pip..."
    sudo apt-get update && sudo apt-get install -y python3-pip || { 
        log_message "ERROR: Failed to install pip"; 
        exit 1; 
    }
fi

# Install B2 CLI if not present
if ! command -v b2 &> /dev/null; then
    log_message "Installing B2 Command Line Tool"
    sudo pip install --upgrade b2 || { 
        log_message "ERROR: Failed to install B2 CLI"; 
        exit 1; 
    }
fi

log_message "Authenticating with Backblaze B2"
# Authenticate with B2 without printing credentials to console/logs
{
    # Redirect stdout and stderr to /dev/null to hide output that might contain credentials
    if ! b2 account authorize "${B2_APP_KEY_ID}" "${B2_APP_KEY}" > /dev/null 2>&1; then
        log_message "ERROR: Failed to authenticate with B2"
        exit 1
    fi
} > /dev/null 2>&1  # Extra redirection to ensure no leakage

log_message "Successfully authenticated with B2"

# ------------------------------------------------------------------------
# PREPARE BACKUP LOCATION
# ------------------------------------------------------------------------

# Clean backup directory for this run
log_message "Cleaning temporary backup directory"
sudo rm -rf ${TEMP_BACKUP_DIR}/*
sudo mkdir -p ${TEMP_BACKUP_DIR}

# ------------------------------------------------------------------------
# CREATE POSTGRESQL BASE BACKUP
# ------------------------------------------------------------------------

log_message "Creating PostgreSQL base backup in: ${TEMP_BACKUP_DIR}"

# Run pg_basebackup inside the container
sudo docker exec ${CONTAINER_NAME} bash -c "mkdir -p /tmp/basebackup" || {
    log_message "ERROR: Failed to create temporary directory in container"
    exit 1
}

# Execute pg_basebackup in the container
# -X fetch includes required WAL files in the backup
log_message "Executing pg_basebackup in container"
sudo docker exec ${CONTAINER_NAME} bash -c "pg_basebackup -U ${POSTGRES_USER} -D /tmp/basebackup -Ft -z -P -X fetch" || {
    log_message "ERROR: Failed to create PostgreSQL base backup!"
    exit 1
}

# Copy the base backup files from the container to the host
log_message "Copying base backup files from container to host"
sudo docker cp ${CONTAINER_NAME}:/tmp/basebackup/. ${TEMP_BACKUP_DIR}/ || {
    log_message "ERROR: Failed to copy base backup files from container to host"
    exit 1
}

# Remove the temporary backup files from the container
log_message "Cleaning up temporary files from container"
sudo docker exec ${CONTAINER_NAME} rm -rf /tmp/basebackup || {
    log_message "WARNING: Failed to remove temporary backup files from container"
    # Don't exit, as the main backup was copied successfully
}

# ------------------------------------------------------------------------
# FIX PERMISSIONS
# ------------------------------------------------------------------------

log_message "Setting correct permissions on backup files"
# Fix permissions on the backup files
sudo chown -R $(whoami):$(whoami) ${TEMP_BACKUP_DIR} || {
    log_message "ERROR: Failed to set correct owner on backup files"
    exit 1
}
sudo chmod -R 644 ${TEMP_BACKUP_DIR} || {
    log_message "ERROR: Failed to set file permissions on backup files"
    exit 1
}
sudo find ${TEMP_BACKUP_DIR} -type d -exec chmod 755 {} \; || {
    log_message "ERROR: Failed to set directory permissions on backup directories"
    exit 1
}

# ------------------------------------------------------------------------
# VERIFY BACKUP
# ------------------------------------------------------------------------

# Verify backup files exist
if [ -z "$(ls -A ${TEMP_BACKUP_DIR})" ]; then
    log_message "ERROR: Backup directory is empty!"
    exit 1
fi
log_message "Successfully verified backup files exist"

# ------------------------------------------------------------------------
# CREATE TARBALL
# ------------------------------------------------------------------------

# Create a tarball of the entire backup
# New naming: postgres_basebackup.tar.gz (no timestamp in filename)
TAR_FILE="${BACKUP_DIR}/postgres_basebackup.tar.gz"
log_message "Creating tarball of the backup: ${TAR_FILE}"
tar -czf ${TAR_FILE} -C ${BASE_BACKUP_DIR} ${DATE_FORMAT} || {
    log_message "ERROR: Failed to create tarball of backup"
    exit 1
}

# Fix permissions on tarball
sudo chown $(whoami):$(whoami) ${TAR_FILE} || {
    log_message "ERROR: Failed to set correct owner on tarball"
    exit 1
}

# Get the start WAL position for this backup
BACKUP_LABEL="${TEMP_BACKUP_DIR}/backup_label"
if [ -f "${BACKUP_LABEL}" ]; then
    # Extract the actual WAL filename from backup_label
    START_WAL=$(grep -oP "START WAL LOCATION: .*? \(file \K[0-9A-F]{24}\)" "${BACKUP_LABEL}" | tr -d ')')
    if [ -n "${START_WAL}" ]; then
        log_message "Backup start WAL file: ${START_WAL}"
        echo "${START_WAL}" > "${START_WAL_FILE}"
    else
        log_message "WARNING: Could not extract start WAL file from backup_label"
    fi
fi

# ------------------------------------------------------------------------
# UPLOAD TO B2
# ------------------------------------------------------------------------

# Upload tarball to B2 with new folder structure
log_message "Uploading tarball to Backblaze B2 in ${B2_FOLDER}/ folder"
b2 upload-file ${B2_BUCKET_NAME} ${TAR_FILE} "${B2_FOLDER}/postgres_basebackup.tar.gz" || {
    log_message "ERROR: Failed to upload tarball to B2"
    exit 1
}

# ------------------------------------------------------------------------
# CLEANUP LOCAL FILES
# ------------------------------------------------------------------------

# Delete local backup files after uploading
log_message "Cleaning up local backup files"
sudo rm -rf ${TEMP_BACKUP_DIR} || {
    log_message "WARNING: Failed to remove temporary backup directory"
}
sudo rm -f ${TAR_FILE} || {
    log_message "WARNING: Failed to remove tarball"
}

# ------------------------------------------------------------------------
# B2 BACKUP RETENTION (FOLDER-BASED CLEANUP)
# ------------------------------------------------------------------------

log_message "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days"
DELETE_DATE=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y-%m-%d)

# Get list of date folders in the environment directory
FOLDER_LIST=$(mktemp)
b2 ls --long "b2://${B2_BUCKET_NAME}/${ENVIRONMENT}/" > "${FOLDER_LIST}"

while read -r line; do
    if [[ $line =~ ${ENVIRONMENT}/([0-9]{4}-[0-9]{2}-[0-9]{2})/ ]]; then
        folder_date=${BASH_REMATCH[1]}
        
        if [[ "$folder_date" < "$DELETE_DATE" ]]; then
            log_message "Deleting entire backup folder: ${ENVIRONMENT}/${folder_date}/"
            
            # Delete all files in folder (including versions)
            b2 rm --recursive --versions "b2://${B2_BUCKET_NAME}/${ENVIRONMENT}/${folder_date}/" || {
                log_message "WARNING: Failed to delete folder: ${ENVIRONMENT}/${folder_date}/"
            }
        fi
    fi
done < "${FOLDER_LIST}"
rm -f "${FOLDER_LIST}"

# ------------------------------------------------------------------------
# WAL MANAGEMENT
# ------------------------------------------------------------------------

# Mark the backup as successful for WAL management
mark_successful_backup

log_message "PostgreSQL base backup completed successfully for ${ENVIRONMENT} environment"