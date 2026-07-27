#!/bin/bash

# Set the Node.js version you want to install
NODE_VERSION="22.3.0"  # You can change this to your desired version

echo -e "\e[34mStarting Node.js and PM2 setup...\e[0m"

# Step 1: Install NVM (Node Version Manager)
echo -e "\e[34mInstalling NVM (Node Version Manager)...\e[0m"
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    git clone https://github.com/nvm-sh/nvm.git "$NVM_DIR"
    cd "$NVM_DIR"
    git checkout `git describe --abbrev=0 --tags --match "v[0-9]*" $(git rev-list --tags --max-count=1)`
fi

# Load NVM
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verify NVM installation
if ! command -v nvm &> /dev/null; then
    echo -e "\e[31mError: NVM is not available. Installation may have failed.\e[0m"
    exit 1
fi

echo -e "\e[32mNVM installed successfully.\e[0m"

# Step 2: Install and configure Node.js
echo -e "\e[34mInstalling Node.js version $NODE_VERSION...\e[0m"
nvm install "$NODE_VERSION"

if [ $? -ne 0 ]; then
    echo -e "\e[31mError: Failed to install Node.js version $NODE_VERSION.\e[0m"
    exit 1
fi

nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

# Step 3: Update PATH for the current script
echo -e "\e[34mUpdating PATH for the current script...\e[0m"
export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"

# Verify Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "\e[31mError: Node.js is not available in PATH. Installation may have failed.\e[0m"
    exit 1
fi

# Check Node.js and npm versions
echo -e "\e[34mVerifying Node.js and npm installations...\e[0m"
node_version=$(node -v)
npm_version=$(npm -v)
echo -e "\e[32mNode.js version: $node_version\e[0m"
echo -e "\e[32mnpm version: $npm_version\e[0m"

# Step 4: Install PM2 (Process Manager)
echo -e "\e[34mInstalling PM2 (Process Manager for Node.js)...\e[0m"
npm install -g pm2

if [ $? -ne 0 ]; then
    echo -e "\e[31mError: PM2 installation failed.\e[0m"
    exit 1
fi

echo -e "\e[32mPM2 installed successfully.\e[0m"

echo -e "\e[32mNode.js and PM2 setup is complete!\e[0m"
echo -e "\e[33mNode.js and npm are now available for use in this script.\e[0m"

# You can now use Node.js and npm in the rest of your script
# For example:
# node -e "console.log('Node.js is working!')"
# npm -v