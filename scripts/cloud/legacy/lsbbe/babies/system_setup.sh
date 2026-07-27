#!/bin/bash

echo -e "\e[34mStarting system update and upgrade...\e[0m"

# Step 1: Update and upgrade the system packages
echo -e "\e[34mUpdating package lists and upgrading installed packages...\e[0m"
sudo apt-get update -y && sudo apt-get upgrade -y
if [ $? -eq 0 ]; then
    echo -e "\e[32mSystem update and upgrade completed successfully.\e[0m"
else
    echo -e "\e[31mError: Failed to update or upgrade system packages. Please check your network connection or package sources.\e[0m"
    exit 1
fi

# Step 2: Install essential tools (Git, build-essential, curl)
echo -e "\e[34mInstalling Git, build-essential (compilation tools), and curl...\e[0m"
sudo apt-get install -y git build-essential curl
if [ $? -eq 0 ]; then
    echo -e "\e[32mGit, build tools, and curl installed successfully.\e[0m"
else
    echo -e "\e[31mError: Failed to install essential tools. Please check the system package manager.\e[0m"
    exit 1
fi

# Step 3: Set up SSH keys (if not already present)
echo -e "\e[34mChecking for existing SSH key...\e[0m"
if [ ! -f ~/.ssh/id_rsa ]; then
    echo -e "\e[34mNo existing SSH key found. Generating a new SSH key...\e[0m"
    ssh-keygen -t rsa -b 4096 -C "jaswindersingh11061998@example.com" -f ~/.ssh/id_rsa -N ""
    if [ $? -eq 0 ]; then
        echo -e "\e[32mSSH key generated successfully.\e[0m"
        echo -e "\e[34mPlease add the following public SSH key to your GitHub account for repository access:\e[0m"
        cat ~/.ssh/id_rsa.pub
        read -p "Press [Enter] once the SSH key is added to GitHub..."
    else
        echo -e "\e[31mError: Failed to generate SSH key.\e[0m"
        exit 1
    fi
else
    echo -e "\e[32mAn existing SSH key was found. Skipping key generation.\e[0m"
fi

echo -e "\e[32mSystem setup is complete!\e[0m"
