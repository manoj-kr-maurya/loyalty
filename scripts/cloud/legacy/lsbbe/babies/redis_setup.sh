#!/bin/bash

echo -e "\e[34mStarting Redis setup...\e[0m"

# Step 1: Install Redis
echo -e "\e[34mInstalling Redis server using apt package manager...\e[0m"
sudo apt-get install -y redis-server
if [ $? -eq 0 ]; then
    echo -e "\e[32mRedis installation completed successfully.\e[0m"
else
    echo -e "\e[31mError: Redis installation failed.\e[0m"
    exit 1
fi

# Step 2: Enable Redis to start at boot
echo -e "\e[34mEnabling Redis service to start on boot...\e[0m"
sudo systemctl enable redis-server.service
if [ $? -eq 0 ]; then
    echo -e "\e[32mRedis service is now enabled at boot.\e[0m"
else
    echo -e "\e[31mError: Failed to enable Redis service at boot.\e[0m"
    exit 1
fi

# Step 3: Enable Redis Append-Only File (AOF) for persistence
echo -e "\e[34mEnabling Redis Append-Only File (AOF) for data persistence...\e[0m"
sudo sed -i 's/# appendonly no/appendonly yes/' /etc/redis/redis.conf
if [ $? -eq 0 ]; then
    echo -e "\e[32mAppend-Only File (AOF) has been enabled in the Redis configuration.\e[0m"
else
    echo -e "\e[31mError: Failed to enable AOF in Redis configuration.\e[0m"
    exit 1
fi

# Step 4: Restart Redis to apply changes
echo -e "\e[34mRestarting Redis service to apply configuration changes...\e[0m"
sudo systemctl restart redis-server
if [ $? -eq 0 ]; then
    echo -e "\e[32mRedis service restarted successfully. Configuration changes applied.\e[0m"
else
    echo -e "\e[31mError: Failed to restart Redis service.\e[0m"
    exit 1
fi

echo -e "\e[32mRedis setup completed successfully!\e[0m"
