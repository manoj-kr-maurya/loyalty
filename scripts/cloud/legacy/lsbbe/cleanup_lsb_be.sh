#!/bin/bash

# Ensure script is run as root
if [ "$(id -u)" -ne "0" ]; then
    echo -e "\e[31mError: This script must be run as root\e[0m"
    exit 1
fi

source ~/.bashrc

# Function to prompt user for each task
prompt_user() {
    local task_description="$1"
    local task_command="$2"
    
    echo -e "\n\e[34m$task_description\e[0m"
    read -p "Do you want to proceed with this task? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        eval "$task_command"
    else
        echo "Skipping this task."
    fi
}

# Define variables
SUBDOMAIN="$1.littlebitpositive.com"
LSBBE_DIR="$HOME/jas-loyalty-engine-micro"
LSBBE_FLAG_FILE="/var/log/lsbbe_setup_complete"

echo -e "\e[31mWARNING: This script will attempt to reverse the LSBBE setup and return the server to its initial state.\e[0m"
echo -e "\e[31mYou will be prompted before each task.\e[0m"

# PM2 processes
prompt_user "Stop and remove PM2 processes" "pm2 delete all && pm2 save && pm2 unstartup systemd"

# jas-loyalty-engine-micro directory
prompt_user "Remove jas-loyalty-engine-micro directory" "rm -rf \"$LSBBE_DIR\""

# Node.js and NVM
prompt_user "Uninstall Node.js and NVM" "nvm deactivate && nvm uninstall 22.3.0 && rm -rf \"$HOME/.nvm\" && sed -i '/NVM_DIR/d' \"$HOME/.bashrc\""

# Redis
prompt_user "Uninstall Redis" "sudo apt-get remove --purge -y redis-server && sudo apt-get autoremove -y"

# Nginx configuration and SSL certificates
prompt_user "Remove Nginx configuration and SSL certificates" "sudo rm -f \"/etc/nginx/sites-available/$SUBDOMAIN\" \"/etc/nginx/sites-enabled/$SUBDOMAIN\" && sudo certbot delete --cert-name \"$SUBDOMAIN\""

# Nginx and Certbot
prompt_user "Uninstall Nginx and Certbot" "sudo apt-get remove --purge -y nginx certbot python3-certbot-nginx && sudo apt-get autoremove -y"

# Flag file
prompt_user "Remove the LSBBE setup flag file" "sudo rm -f \"$LSBBE_FLAG_FILE\""

# SSH key (optional)
prompt_user "Remove SSH key (Warning: This may affect other services)" "rm -f \"$HOME/.ssh/id_rsa\" \"$HOME/.ssh/id_rsa.pub\""

# Clean up apt cache
prompt_user "Clean up apt cache" "sudo apt-get clean"

echo -e "\n\e[32mCleanup process completed.\e[0m"
echo -e "\e[33mNote: Some system updates and installed packages may remain.\e[0m"
echo -e "\e[33mFor a completely fresh state, consider rebuilding the server from scratch.\e[0m"