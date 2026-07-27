#!/bin/bash

# Check if script is run as root
if [ "$(id -u)" -ne "0" ]; then
    echo -e "\e[31mError: This script must be run as root from root ~ (tilda directory) \e[0m"
    exit 1
fi

# Check if subdomain is provided
if [ -z "$1" ]; then
    echo -e "\e[31mError: You must provide the subdomain as an argument.\e[0m"
    echo "Usage: $0 <subdomain> [nodejs_version]"
    exit 1
fi

SUBDOMAIN="$1.littlebitpositive.com"
NODE_VERSION="${2:-22.3.0}"
LSBBE_FLAG_FILE="/var/log/lsbbe_setup_complete"
LSBBE_DIR="$HOME/jas-loyalty-engine-micro"
SERVER_IP=$(hostname -I | awk '{print $1}')

# Check if setup is already completed
if [ -f "$LSBBE_FLAG_FILE" ]; then
    echo -e "\e[31mThe LSBBE setup has already been completed on this server. Please start with a fresh one.\e[0m"
    exit 1
fi

# Check if project directory already exists
if [ -d "$LSBBE_DIR" ]; then
    echo -e "\e[31mThe LSBBE project already exists on this server. Please use a fresh server.\e[0m"
    exit 1
fi

echo -e "\e[32mServer IP Address: \e[1m$SERVER_IP\e[0m"
read -p "Press [Enter] when the DNS records are updated or if you wish to proceed anyway..."

# Export variables for use in other scripts
export SUBDOMAIN NODE_VERSION LSBBE_FLAG_FILE LSBBE_DIR SERVER_IP
