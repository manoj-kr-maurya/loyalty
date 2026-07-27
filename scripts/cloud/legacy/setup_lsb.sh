#!/bin/bash

# Ensure script is run as root
if [ "$(id -u)" -ne "0" ]; then
    echo -e "\e[31mError: This script must be run as root from root ~ (tilda directory) \e[0m"
    exit 1
fi

# Define flag files to indicate if the setup has already been completed
LSBBE_FLAG_FILE="/var/log/lsbbe_setup_complete"
BULLMQ_FLAG_FILE="/var/log/bullmq_setup_complete"

# Define project directories
LSBBE_DIR="$HOME/jas-loyalty-engine-micro"
BULLMQ_DIR="$HOME/jas-bullmq-micro"

# Get the server's IP address
SERVER_IP=$(hostname -I | awk '{print $1}')

# ---------------------------------------------------
# The Tale of Setup and Configuration
# ---------------------------------------------------

echo -e "\e[32mWelcome, brave sysadmin, to the grand adventure of setting up the LSBBE and Jas BullMQ microservices!\e[0m"
echo -e "\e[33mBefore we embark on this journey, let us make sure our path is clear.\e[0m"

# DNS Record Check
echo -e "\e[33mHave you updated your DNS records for \e[1mlsbbe.littlebitpositive.com\e[0m\e[33m to point to this IP address?\e[0m"
echo -e "\e[32mServer IP Address: \e[1m$SERVER_IP\e[0m"
read -p "Press [Enter] when you have updated your DNS records or if you wish to proceed anyway..."

# Check if the setup for lsbbe has already been completed
if [ -f "$LSBBE_FLAG_FILE" ]; then
    echo -e "\e[31mAh, it seems our lsbbe setup has already been completed. This server is not fit for a new adventure. Please start with a fresh one.\e[0m"
    exit 1
fi

# Check if the setup for jas-bullmq-micro has already been completed
if [ -f "$BULLMQ_FLAG_FILE" ]; then
    echo -e "\e[31mThe path for jas-bullmq-micro is already set. It appears this server is not our new playground. Kindly start afresh.\e[0m"
    exit 1
fi

# Check if project directories already exist
if [ -d "$LSBBE_DIR" ] || [ -d "$BULLMQ_DIR" ]; then
    echo -e "\e[31mThis server already holds the treasures of our projects! We cannot continue here. Please use a new server for this quest.\e[0m"
    exit 1
fi

echo -e "\e[32mOnward we go! First, let us prepare the land.\e[0m"

# System Setup
echo -e "\e[34mUpdating and upgrading the system to ensure our tools are sharp and ready...\e[0m"
sudo apt-get update -y && sudo apt-get upgrade -y

# Install necessary dependencies
echo -e "\e[34mGathering our supplies: installing Git, build tools, and curl...\e[0m"
sudo apt-get install -y git build-essential curl

# Set up SSH keygen if not already present
if [ ! -f ~/.ssh/id_rsa ]; then
    echo -e "\e[34mForging our SSH key... This will be our magical key to access GitHub repositories.\e[0m"
    ssh-keygen -t rsa -b 4096 -C "jaswindersingh11061998@example.com" -f ~/.ssh/id_rsa -N ""
    echo -e "\e[32mOur key is forged! Add this public key to your GitHub account to grant us access:\e[0m"
    cat ~/.ssh/id_rsa.pub
    read -p "Press [Enter] when you have performed this magical task..."
else
    echo -e "\e[32mSSH key already exists. Skipping key generation.\e[0m"
fi

# Install NVM (Node Version Manager)
echo -e "\e[34mSummoning NVM, our Node Version Manager. It will help us manage our Node.js versions effortlessly...\e[0m"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

# Source the updated bashrc file to apply changes
echo -e "\e[34mSourcing the updated .bashrc file...\e[0m"
source ~/.bashrc

# Install Node.js version 22.3.0
echo -e "\e[34mBringing forth Node.js version 22.3.0, a powerful tool for our tasks...\e[0m"
nvm install 22.3.0
nvm use 22.3.0
nvm alias default 22.3.0

# Verify Node.js installation
echo -e "\e[32mVerifying Node.js installation...\e[0m"
node -v
npm -v

# Install PM2 globally
echo -e "\e[34mInstalling PM2, our process manager to keep things running smoothly...\e[0m"
npm install -g pm2

# Install Redis
echo -e "\e[34mDeploying Redis, our trusty data store...\e[0m"
sudo apt-get install -y redis-server
sudo systemctl enable redis-server.service

# Enable Redis Append-Only File (AOF)
echo -e "\e[34mEnabling Redis's Append-Only File mode for reliable data storage...\e[0m"
sudo sed -i 's/# appendonly no/appendonly yes/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# --------------------------------------
# The First Mission: Setup jas-loyalty-engine-micro
# --------------------------------------

echo -e "\e[34mOur first mission is to set up the jas-loyalty-engine-micro service. Cloning the repository now...\e[0m"
git clone git@github.com:Singh1106/jas-loyalty-engine-micro.git
cd jas-loyalty-engine-micro

# Set up environment variables
echo -e "\e[34mThe environment variables are crucial for our journey. Please set them in your .bashrc or .zshrc file.\e[0m"
read -p "Press [Enter] after you have made the necessary changes..."

# Install dependencies and build the application
echo -e "\e[34mGathering magical dependencies and building the application...\e[0m"
npm install
npm run build

# Make the build and install dependencies
echo -e "\e[34mInstalling additional dependencies for the final build...\e[0m"
sudo npm run depsInstall

# Start the application with PM2
echo -e "\e[34mStarting our jas-loyalty-engine-micro application with PM2. This will keep our service running smoothly...\e[0m"
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Create the flag file to indicate completion
sudo touch "$LSBBE_FLAG_FILE"

echo -e "\e[32mMission accomplished! The LSBBE service is now live at: https://lsbbe.littlebitpositive.com.\e[0m"

# --------------------------------------
# The Second Mission: Setup jas-bullmq-micro
# --------------------------------------

echo -e "\e[34mNow for our second mission: setting up jas-bullmq-micro. Returning to the home directory...\e[0m"
cd ~

echo -e "\e[34mCloning the jas-bullmq-micro repository...\e[0m"
git clone git@github.com:Singh1106/jas-bullmq-micro.git
cd jas-bullmq-micro

# Set up environment variables
echo -e "\e[34mThe environment variables are crucial for our journey. Please set them in your .bashrc or .zshrc file.\e[0m"
read -p "Press [Enter] after you have made the necessary changes..."

# Install dependencies and build the application
echo -e "\e[34mInstalling dependencies and building the jas-bullmq-micro application...\e[0m"
npm install
npm run build

# Start the application with PM2
echo -e "\e[34mStarting the jas-bullmq-micro application with PM2...\e[0m"
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Create the flag file to indicate completion
sudo touch "$BULLMQ_FLAG_FILE"

echo -e "\e[32mSecond mission complete! The jas-bullmq-micro service is now running smoothly.\e[0m"

# Install Nginx
echo -e "\e[34mSetting up Nginx, our web server guardian...\e[0m"
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Obtain SSL certificate with Certbot
echo -e "\e[34mCalling upon Certbot to secure our domain with an SSL certificate...\e[0m"
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lsbbe.littlebitpositive.com

# Configure Nginx for your application
echo -e "\e[34mConfiguring Nginx to protect and serve our application...\e[0m"
sudo bash -c 'cat > /etc/nginx/sites-available/lsbbe.littlebitpositive.com << EOF
map "\$http_origin" \$cors {
  default "";
  "~^https?://lsbcus\.littlebitpositive\.com(:[0-9]+)?\$" "\$http_origin";
  "~^https?://lsborg\.littlebitpositive\.com(:[0-9]+)?\$" "\$http_origin";
  "~^https?://lsborg\.web\.app(:[0-9]+)?\$" "\$http_origin";
  "~^https?://lsbcus\.web\.app(:[0-9]+)?\$" "\$http_origin";
}
server {
    server_name lsbbe.littlebitpositive.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' "\$cors" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';

        # Handle OPTIONS preflight requests
        if (\$request_method = OPTIONS) {
            add_header 'Access-Control-Allow-Origin' "\$cors" always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Length' 0;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            return 204;
        }
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/lsbbe.littlebitpositive.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/lsbbe.littlebitpositive.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\$host = lsbbe.littlebitpositive.com) {
        return 301 https://\$host\$request_uri;
    } # managed by Certbot

    listen 80;
    server_name lsbbe.littlebitpositive.com;
    return 404; # managed by Certbot
}
EOF'

# Enable the Nginx configuration and reload
sudo ln -s /etc/nginx/sites-available/lsbbe.littlebitpositive.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo -e "\e[32mCongratulations, brave sysadmin! The setup is now complete. Your server is ready for action. If you need to run this script again, remember to start with a fresh server. Until next time, may your deployments be smooth and your bugs be few!\e[0m"