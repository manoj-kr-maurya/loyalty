#!/bin/bash

# Set the project path
PROJECT_PATH=~/jas-loyalty-engine-micro/

# Function to check if the PM2 application is running
check_pm2_running() {
  if ! pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "Error: $PM2_APP_NAME is not running on PM2. Please start the $PM2_APP_NAME service first."
    exit 1
  fi
}

# Function to handle environment variable update
update_env() {
  if [ "$ENV_UPDATE" == "yes" ]; then
    echo "Environment update requested."
    echo "I hope you have already updated the env variables as we will reload PM2 with the update-env flag."
    RELOAD_FLAGS="--update-env"
  else
    echo "No environment update requested."
    echo "PM2 will be reloaded without updating environment variables."
    RELOAD_FLAGS=""
  fi
}

# Function to pull the latest changes from the selected branch
pull_latest_changes() {
  echo "Pulling the latest changes from the branch '$BRANCH_NAME'..."
  git -C "$PROJECT_PATH" fetch origin

  # Check if the branch is behind
  local status=$(git -C "$PROJECT_PATH" status -uno | grep 'Your branch is behind')
  if [ -n "$status" ]; then
    git -C "$PROJECT_PATH" pull origin "$BRANCH_NAME"
  else
    echo "No new changes to pull. Still running the pipeline again."
  fi
}

# Function to get the latest commit hash from the repository
get_latest_commit_hash() {
  git -C "$PROJECT_PATH" rev-parse HEAD
}

# Function to get the currently running commit hash from PM2
get_running_commit_hash() {
  pm2 show "$PM2_APP_NAME" | grep "commit" | awk '{print $4}'
}

# Function to check if the commit hashes are the same
check_commit_hashes() {
  latest_commit=$(get_latest_commit_hash)
  running_commit=$(get_running_commit_hash)

  if [ "$latest_commit" == "$running_commit" ]; then
    echo "The latest commit is already running on $PM2_APP_NAME. No need to redeploy."
    exit 0
  fi
}

# Function to install dependencies and build the project
install_deps_and_build() {
  cd "$PROJECT_PATH" || exit
  echo "Installing dependencies..."
  npm run depsInstall

  echo "Building the project..."
  npm run build
}

# Function to reload the PM2 application
reload_pm2_app() {
  echo "Reloading $PM2_APP_NAME with PM2..."
  pm2 reload ecosystem.config.js $RELOAD_FLAGS
}

# Function to check the current branch and handle branch switch
check_and_switch_branch() {
  current_branch=$(git -C "$PROJECT_PATH" rev-parse --abbrev-ref HEAD)
  echo "Current branch: $current_branch"

  if [ -z "$BRANCH_NAME" ]; then
    read -p "Do you want to switch branches? (yes/no): " switch_branch
    if [ "$switch_branch" == "yes" ]; then
      read -p "Enter the branch name to switch to (default is 'main'): " input_branch
      BRANCH_NAME=${input_branch:-main}
      echo "Switching to branch '$BRANCH_NAME'..."
      git -C "$PROJECT_PATH" checkout "$BRANCH_NAME"
      git -C "$PROJECT_PATH" pull origin "$BRANCH_NAME"
    else
      BRANCH_NAME=$current_branch
      echo "Staying on branch '$BRANCH_NAME'."
    fi
  else
    echo "Switching to branch '$BRANCH_NAME'..."
    git -C "$PROJECT_PATH" checkout "$BRANCH_NAME"
    git -C "$PROJECT_PATH" pull origin "$BRANCH_NAME"
  fi

  # Set PM2_APP_NAME based on the branch
  if [ "$BRANCH_NAME" == "main" ]; then
    PM2_APP_NAME="lsbbe_prod"
  else
    PM2_APP_NAME="lsbbe_dev"
  fi
  echo "PM2 application name set to: $PM2_APP_NAME"
}

# Parse parameters
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --branch) BRANCH_NAME="$2"; shift ;;
    --env) ENV_UPDATE="$2"; shift ;;
    *) echo "Unknown parameter passed: $1"; exit 1 ;;
  esac
  shift
done

# Main script
echo "Starting manual CI/CD process..."

# Step 1: Check the current branch and handle branch switch
check_and_switch_branch

# Step 2: Check if the PM2 application is running
check_pm2_running

# Step 3: Handle environment update if provided
update_env

# Step 4: Pull the latest changes from the selected branch
pull_latest_changes

# Step 5: Check if the latest commit is already running
check_commit_hashes

# Step 6: Install dependencies and build the project
install_deps_and_build

# Step 7: Reload the PM2 application
reload_pm2_app

echo "CI/CD process completed successfully."