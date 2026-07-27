#!/bin/bash

echo -e "\e[34mStarting repository setup for LSBBE...\e[0m"

echo -e "\e[34mChanging directory to root for LSBBE...\e[0m"

cd $HOME

# Step 1: Clone the jas-loyalty-engine-micro repository
echo -e "\e[34mCloning the jas-loyalty-engine-micro repository from GitHub...\e[0m"
git clone git@github.com:Singh1106/jas-loyalty-engine-micro.git
if [ $? -eq 0 ]; then
    echo -e "\e[32mRepository cloned successfully.\e[0m"
else
    echo -e "\e[31mError: Failed to clone the repository. Please check your GitHub SSH key setup.\e[0m"
    exit 1
fi

# Navigate into the cloned repository
cd jas-loyalty-engine-micro || { echo -e "\e[31mError: Failed to navigate into the project directory.\e[0m"; exit 1; }

# Step 2: Create the .env file
echo -e "\e[34mCreating .env file for environment variables...\e[0m"
touch .env
if [ $? -eq 0 ]; then
    echo -e "\e[32m.env file created. Please open it and populate it with the required environment variables.\e[0m"
    echo -e "\e[33mEnvironment variables such as database connection strings, API keys, and other sensitive configurations should be added here.\e[0m"
    vi .env
    read -p "Press [Enter] once the .env file is populated and saved..."
else
    echo -e "\e[31mError: Failed to create .env file. Exiting setup.\e[0m"
    exit 1
fi

# Step 3: Install dependencies and build the project
echo -e "\e[34mInstalling Node.js dependencies via npm...\e[0m"
npm install
if [ $? -eq 0 ]; then
    echo -e "\e[32mDependencies installed successfully.\e[0m"
else
    echo -e "\e[31mError: Failed to install dependencies. Please check your network connection or npm setup.\e[0m"
    exit 1
fi

echo -e "\e[34mBuilding the application...\e[0m"
npm run build
if [ $? -eq 0 ]; then
    echo -e "\e[32mApplication built successfully.\e[0m"
else
    echo -e "\e[31mError: Failed to build the application. Please check the build configuration.\e[0m"
    exit 1
fi

# Step 4: Start the application using PM2
echo -e "\e[34mStarting the LSBBE service with PM2...\e[0m"
pm2 start ecosystem.config.js
if [ $? -eq 0 ]; then
    echo -e "\e[32mLSBBE service started successfully using PM2.\e[0m"
else
    echo -e "\e[31mError: Failed to start the service with PM2. Please check PM2 configuration.\e[0m"
    exit 1
fi

# Set PM2 to start on boot
echo -e "\e[34mSetting PM2 to start on system boot...\e[0m"
pm2 startup
pm2 save
if [ $? -eq 0 ]; then
    echo -e "\e[32mPM2 is now configured to restart the service on system boot.\e[0m"
else
    echo -e "\e[31mError: Failed to configure PM2 startup. Manual intervention might be required.\e[0m"
fi

# Step 5: Mark setup completion
echo -e "\e[34mMarking the setup as complete...\e[0m"
sudo touch "$LSBBE_FLAG_FILE"
if [ $? -eq 0 ]; then
    echo -e "\e[32mSetup completion flag created. This server is now marked as fully set up.\e[0m"
else
    echo -e "\e[31mError: Failed to mark the setup as complete.\e[0m"
fi

echo -e "\e[32mRepository setup for LSBBE is complete.\e[0m"
