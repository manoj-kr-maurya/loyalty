#!/bin/bash

# --------------------------------------
# Script Description
# --------------------------------------

echo -e "\e[32m=============================================================\e[0m"
echo -e "\e[32m|               LSBBE Monolithic Setup Script              |\e[0m"
echo -e "\e[32m=============================================================\e[0m"
echo -e "\e[34mThis script will set up a Node.js-based monolithic (LSBBE) for the LittleBitPositive platform.\e[0m"
echo -e "\e[33mPlease ensure this server meets the following requirements before proceeding:\e[0m"
echo -e "\e[32m1. The server is a clean and fresh \e[1mUbuntu\e[0m \e[32minstallation (preferably a new VPS).\e[0m"
echo -e "\e[32m2. The server has no prior installations of Node.js, Nginx, Redis, or PM2.\e[0m"
echo -e "\e[32m3. You have root or sudo access to the server.\e[0m"
echo -e "\e[34mThe script will:\e[0m"
echo -e "\e[32m1. Install Git, build-essential tools, Nginx, Redis, Node.js, and PM2.\e[0m"
echo -e "\e[32m2. Clone the LSBBE repository from GitHub using SSH and set up environment variables via a .env file.\e[0m"
echo -e "\e[32m3. Build and run the LSBBE microservice using PM2 (1).\e[0m"
echo -e "\e[32m4. Set up Nginx as a reverse proxy with SSL using Let's Encrypt for the given subdomain.\e[0m"
echo -e "\e[33mImportant: The subdomain must be provided as an argument when running the script.\e[0m"
echo -e "\e[33mExample: ./script.sh <subdomain> [nodejs_version]\e[0m"
echo -e "\e[34mOnce you proceed, DNS records for the subdomain must point to this server's IP address for SSL to work.\e[0m"
echo -e "\e[32m=============================================================\e[0m"

# Confirm with the user before proceeding
read -p "Do you wish to proceed with the setup? (yes/no): " confirmation
if [[ "$confirmation" != "yes" ]]; then
    echo -e "\e[31mSetup aborted by the user.\e[0m"
    exit 1
fi

# Check if subdomain is provided
if [ -z "$1" ]; then
    echo -e "\e[31mError: You must provide the subdomain as an argument.\e[0m"
    echo "Usage: $0 <subdomain> [nodejs_version]"
    exit 1
fi

SUBDOMAIN="$1"
NODE_VERSION="${2:-22.3.0}"
# Function to prompt user for permission and execute a command
execute_with_permission() {
    local message="$1"
    local command="$2"
    
    echo -e "\e[34mStarting: $message...\e[0m"
    read -p "Do you wish to proceed with this step? (yes/no): " user_confirmation
    if [[ "$user_confirmation" == "yes" ]]; then
        eval "$command"
        if [ $? -ne 0 ]; then
            echo -e "\e[31mError occurred during: $message. Exiting.\e[0m"
            echo "Running cleanup script"
            bash -i ./cleanup_lsb_be.sh
            exit 1
        fi
    else
        echo -e "\e[33mSkipping: $message.\e[0m"
    fi
}

# Run each script in order with user confirmation
execute_with_permission "Checking requirements" "bash -i ./babies/check_requirements.sh \"$SUBDOMAIN\" \"$NODE_VERSION\""
execute_with_permission "Setting up system" "bash -i ./babies/system_setup.sh"
execute_with_permission "Installing Node.js and PM2" "bash -i ./babies/nodejs_setup.sh \"$NODE_VERSION\""
execute_with_permission "Setting up Redis" "bash -i ./babies/redis_setup.sh"
execute_with_permission "Setting up Postgres" "bash -i ./babies/postgres_setup.sh"
execute_with_permission "Cloning and setting up the repository" "bash -i ./babies/repo_setup.sh"
execute_with_permission "Setting up Nginx as a reverse proxy with SSL" "bash -i ./babies/nginx_setup.sh \"$SUBDOMAIN\""

echo -e "\e[32mLSBBE setup is complete. Your service is up and running!\e[0m"
