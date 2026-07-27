#!/bin/bash

# Set the project path
PROJECT_PATH=~/jas-bullmq-micro/

# Function to check if lsbbe_dev is running on PM2
check_pm2_running() {
if ! pm2 list | grep -q 'lsbbe_bullds'; then
echo "Error: lsbbe_bullds is not running on PM2. Please start the lsbbe_bullds service first."
exit 1
fi
}

# Function to pull the latest changes from the main branch
pull_latest_changes() {
echo "Pulling the latest changes from the main branch..."
git -C $PROJECT_PATH fetch origin
local status=$(git -C $PROJECT_PATH status -uno | grep 'Your branch is behind')

if [ -n "$status" ]; then
git -C $PROJECT_PATH checkout main
git -C $PROJECT_PATH pull origin main
else
echo "No new changes to pull."
fi
}

# Function to get the latest commit hash from the repository
get_latest_commit_hash() {
git -C $PROJECT_PATH rev-parse HEAD
}

# Function to get the currently running commit hash from PM2
get_running_commit_hash() {
pm2 show lsbbe_bullds | grep "commit" | awk '{print $4}'
}

# Function to check if the commit hashes are the same
check_commit_hashes() {
latest_commit=$(get_latest_commit_hash)
running_commit=$(get_running_commit_hash)

if [ "$latest_commit" == "$running_commit" ]; then
echo "The latest commit is already running on lsbbe. No need to redeploy."
exit 0
fi
}

# Function to install dependencies and build the project
install_deps_and_build() {
cd $PROJECT_PATH || exit
echo "Installing dependencies..."
npm install

echo "Building the project..."
npm run build
}

# Function to reload lsbbe_bullds with PM2
reload_lsbbe_bullds() {
echo "Reloading lsbbe_bullds with PM2..."
pm2 start ecosystem.config.js $RELOAD_FLAGS
}

# Main script
echo "Starting manual CI/CD process for lsbbe_bullds..."

# Step 1: Check if lsbbe_dev is running on PM2
check_pm2_running

# Step 2: Ask if there's an environment update and handle it
# update_env

# Step 3: Pull the latest changes from the main branch
pull_latest_changes

# Step 4: Check if the latest commit is already running
check_commit_hashes

# Step 5: Install dependencies and build the project
install_deps_and_build

# Step 6: Reload lsbbe using PM2
reload_lsbbe_bullds

echo "CI/CD process completed successfully."