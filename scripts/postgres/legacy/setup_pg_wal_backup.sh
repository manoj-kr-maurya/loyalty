#!/bin/bash

# ========================================================================
# PostgreSQL WAL Archive Uploader for Backblaze B2 (for sudoers)
# 
# Purpose: Continuously uploads PostgreSQL WAL archive files to Backblaze B2
#          for point-in-time recovery with proper folder structure.
#
# Usage: Run as a sudoer (not as root), typically from cron every minute
# ========================================================================

set -e  # Exit on error
set -o pipefail  # Exit if any command in a pipeline fails

# ------------------------------------------------------------------------
# ENVIRONMENT VARIABLES
# ------------------------------------------------------------------------

ENVIRONMENT=${ENVIRONMENT:-"stage"}  # "stage" or "prod"
CONTAINER_NAME=${CONTAINER_NAME:-"lsbbe_postgres"}
BACKUP_DIR=${BACKUP_DIR:-"/backup"}
B2_BUCKET_NAME=${B2_BUCKET_NAME:-"your-b2-bucket-name"}
B2_APP_KEY_ID=${B2_APP_KEY_ID:-"your-app-key-id"}
B2_APP_KEY=${B2_APP_KEY:-"your-app-key"}

# ------------------------------------------------------------------------
# DERIVED VARIABLES
# ------------------------------------------------------------------------

# Use date format: YYYY-MM-DD
DATE_FORMAT=$(date +%Y-%m-%d)
B2_FOLDER="${ENVIRONMENT}/${DATE_FORMAT}"
WAL_CONTAINER_DIR="/backup/wal_archive"
WAL_HOST_DIR="${BACKUP_DIR}/wal_archive"
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

# Function to check if a WAL file is newer than the last successful backup
is_wal_file_needed() {
    local wal_file="$1"
    
    # If no successful backup has been recorded, assume all files are needed
    if [ ! -f "${START_WAL_FILE}" ]; then
        return 0  # true in bash
    fi
    
    local start_wal=$(cat "${START_WAL_FILE}")
    local start_timeline="${start_wal:0:8}"
    local start_logseg="${start_wal:8:16}"
    
    # Extract timeline and logseg from the WAL filename
    local filename=$(basename "${wal_file}")
    if [[ ! ${filename} =~ ^[0-9A-F]{24}$ ]]; then
        # Not a WAL file, assume needed
        return 0
    fi
    
    local wal_timeline="${filename:0:8}"
    local wal_logseg="${filename:8:16}"
    
    # Compare timelines and log segments
    if [[ "${wal_timeline}" > "${start_timeline}" ]]; then
        # Belongs to a newer timeline, needed
        return 0
    elif [[ "${wal_timeline}" == "${start_timeline}" ]]; then
        if [[ "${wal_logseg}" > "${start_logseg}" ]] || [[ "${wal_logseg}" == "${start_logseg}" ]]; then
            return 0
        else
            return 1
        fi
    else
        # Older timeline, not needed
        return 1
    fi
}

# Function to get the appropriate B2 folder for the current WAL file
get_appropriate_b2_folder() {
    local wal_file="$1"
    local default_folder="${ENVIRONMENT}/${DATE_FORMAT}"
    
    # If no backup marker exists, use today's folder
    if [ ! -f "${START_WAL_FILE}" ]; then
        echo "${default_folder}"
        return
    fi
    
    local start_wal=$(cat "${START_WAL_FILE}")
    local backup_date="${start_wal:0:4}-${start_wal:4:2}-${start_wal:6:2}"
    echo "${ENVIRONMENT}/${backup_date}"
}

# ------------------------------------------------------------------------
# MAIN SCRIPT
# ------------------------------------------------------------------------

# Ensure backup directories exist
sudo mkdir -p ${BACKUP_DIR} ${WAL_HOST_DIR}
sudo chown -R $(whoami) ${BACKUP_DIR}  # Ensure the user owns the directory

log_message "Starting WAL archive upload for ${ENVIRONMENT} environment"

# Create last upload marker if it doesn't exist
if [ ! -f "${WAL_UPLOAD_MARKER}" ]; then
    touch "${WAL_UPLOAD_MARKER}"
    log_message "Created new WAL upload marker"
fi

# ------------------------------------------------------------------------
# B2 CLI SETUP
# ------------------------------------------------------------------------

# Ensure B2 CLI is installed
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
# WAL FILE PROCESSING
# ------------------------------------------------------------------------

# Create temporary directory for WAL files
TEMP_WAL_DIR=$(mktemp -d)
log_message "Created temporary directory for WAL processing: ${TEMP_WAL_DIR}"

# Copy WAL files from container to host
log_message "Copying WAL files from container to host"
sudo docker cp ${CONTAINER_NAME}:${WAL_CONTAINER_DIR}/. ${WAL_HOST_DIR}/ || {
    log_message "WARNING: Failed to copy WAL files from container to host. Container may not have any new WAL files."
}

# Fix permissions on the WAL files - this is critical!
log_message "Fixing permissions on WAL files"
sudo chown -R $(whoami):$(whoami) ${WAL_HOST_DIR}
sudo chmod -R 644 ${WAL_HOST_DIR}
sudo find ${WAL_HOST_DIR} -type d -exec chmod 755 {} \; 2>/dev/null || true

# Filter and prepare WAL files for upload
log_message "Filtering WAL files newer than the last upload marker"
new_files_count=0
total_size=0

WAL_FILES_LIST=$(mktemp)
sudo find ${WAL_HOST_DIR} -type f -newer "${WAL_UPLOAD_MARKER}" -exec ls -la {} \; | awk '{print $NF}' > ${WAL_FILES_LIST}
log_message "Found $(wc -l < ${WAL_FILES_LIST}) potentially new WAL files"

while read -r wal_file; do
    if [ -z "${wal_file}" ]; then
        continue
    fi
    
    filename=$(basename "${wal_file}")
    
    # Skip non-WAL files
    if [[ ! ${filename} =~ ^[0-9A-F]{24}$ ]]; then
        continue
    fi
    
    # Check if this WAL file is needed
    if is_wal_file_needed "${wal_file}"; then
        sudo cp "${wal_file}" "${TEMP_WAL_DIR}/"
        sudo chown $(whoami):$(whoami) "${TEMP_WAL_DIR}/${filename}"
        
        new_files_count=$((new_files_count+1))
        file_size=$(sudo stat -c %s "${wal_file}" 2>/dev/null || echo "0")
        total_size=$((total_size+file_size))
    fi
done < ${WAL_FILES_LIST}

rm -f ${WAL_FILES_LIST}

if [ ${new_files_count} -eq 0 ]; then
    log_message "No new WAL files to upload"
    rm -rf "${TEMP_WAL_DIR}"
    exit 0
fi

log_message "Found ${new_files_count} new WAL files to upload (${total_size} bytes)"

# ------------------------------------------------------------------------
# UPLOAD WAL FILES TO B2
# ------------------------------------------------------------------------

# Upload WAL files to B2 with appropriate folder structure
for wal_file in $(find ${TEMP_WAL_DIR} -type f | sort); do
    filename=$(basename "${wal_file}")
    
    # Determine which B2 folder this WAL file belongs to
    appropriate_folder=$(get_appropriate_b2_folder "${filename}")
    b2_path="${appropriate_folder}/wal_archive/${filename}"
    
    log_message "Uploading WAL file: ${filename} to ${appropriate_folder}/wal_archive/"
    b2 file upload ${B2_BUCKET_NAME} "${wal_file}" "${b2_path}" || {
        log_message "ERROR: Failed to upload WAL file: ${filename}"
        # Continue with other files
    }
done

# Update last upload timestamp
touch "${WAL_UPLOAD_MARKER}"
log_message "Updated WAL upload marker timestamp"

# Clean up temporary directory
rm -rf "${TEMP_WAL_DIR}"
log_message "Cleaned up temporary WAL directory"

# ------------------------------------------------------------------------
# WAL FILE CLEANUP
# ------------------------------------------------------------------------

# Clean up old WAL files from container that are older than last backup
if [ -f "${START_WAL_FILE}" ]; then
    log_message "Cleaning up old WAL files from container"
    
    start_wal=$(cat "${START_WAL_FILE}")
    start_timeline="${start_wal:0:8}"
    start_logseg="${start_wal:8:16}"
    
    # Get list of WAL files in the container
    container_wal_list="${BACKUP_DIR}/container_wal_files.txt"
    sudo docker exec ${CONTAINER_NAME} find ${WAL_CONTAINER_DIR} -type f -name '[0-9A-F]*' > "${container_wal_list}" 2>/dev/null || {
        log_message "WARNING: Could not list WAL files in container"
        touch "${container_wal_list}"  # Create empty file to avoid errors below
    }
    
    # Process each file in the container
    cleanup_count=0
    while read -r wal_file; do
        if [ -z "${wal_file}" ]; then
            continue
        fi
        
        filename=$(basename "${wal_file}")
        
        # Skip non-WAL files
        if [[ ! ${filename} =~ ^[0-9A-F]{24}$ ]]; then
            continue
        fi
        
        wal_timeline="${filename:0:8}"
        wal_logseg="${filename:8:16}"
        
        # Check if the WAL is from the same timeline and older than the start WAL
        if [[ "${wal_timeline}" == "${start_timeline}" ]]; then
            if [[ "${wal_logseg}" < "${start_logseg}" ]]; then
                # Delete the file from the container
                log_message "Deleting old WAL file from container: ${filename} (older than base backup)"
                sudo docker exec ${CONTAINER_NAME} rm "${wal_file}" 2>/dev/null || {
                    log_message "WARNING: Failed to delete old WAL file from container: ${filename}"
                }
                
                # Also delete from host if it exists
                if [ -f "${WAL_HOST_DIR}/${filename}" ]; then
                    sudo rm "${WAL_HOST_DIR}/${filename}" 2>/dev/null || {
                        log_message "WARNING: Failed to delete old WAL file from host: ${filename}"
                    }
                fi
                
                cleanup_count=$((cleanup_count+1))
            fi
        fi
    done < "${container_wal_list}"
    
    log_message "Cleaned up ${cleanup_count} old WAL files"
    rm -f "${container_wal_list}"
fi

log_message "WAL archive upload completed successfully"