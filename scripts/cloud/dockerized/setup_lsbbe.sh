#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[SETUP] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Function to display menu
show_menu() {
    clear
    echo "================================================================"
    echo "                 Server Setup Configuration Menu                "
    echo "================================================================"
    echo "Select the components you want to set up (space-separated numbers):"
    echo ""
    echo "1) SSH Key Setup & GitHub Configuration"
    echo "2) Repository Clone"
    echo "3) Branch Selection"
    echo "4) Environment (.env) File Setup"
    echo "5) Docker Installation"
    echo "6) UFW Firewall Configuration"
    echo "7) Start Application"
    echo "8) Install & Configure Node Exporter"
    echo "9) Run All Steps"
    echo "0) Exit"
    echo ""
    echo "Example: '1 2 4' will only run SSH setup, repo clone, and env setup"
    echo "================================================================"
}

# Check if we're in the app directory
ensure_app_directory() {
    if [ ! -d "app" ]; then
        print_error "App directory not found. Please run repository setup first."
        exit 1
    fi
    
    # Change to app directory if we're not in it
    if [[ ! $(pwd) == */app ]]; then
        cd app || {
            print_error "Failed to change to app directory"
            exit 1
        }
    fi
}

install_node_exporter() {
    print_step "Installing Node Exporter..."
    
    # Download latest version of Node Exporter
    NODE_EXPORTER_VERSION="1.9.0"
   wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-arm64.tar.gz
    
    # Extract and install
    tar -xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-arm64.tar.gz
    sudo mv node_exporter-${NODE_EXPORTER_VERSION}.linux-arm64/node_exporter /usr/local/bin/
    rm -rf node_exporter-${NODE_EXPORTER_VERSION}.linux-arm64*

    # Create systemd service
    sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=ubuntu
Group=ubuntu
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9100
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # Enable & Start Node Exporter
    sudo systemctl daemon-reload
    sudo systemctl enable node_exporter
    sudo systemctl start node_exporter

    # Ensure UFW allows Node Exporter (if UFW is enabled)
    if sudo ufw status | grep -q "Status: active"; then
        sudo ufw allow 9100/tcp
        print_success "UFW rule added: Allow Node Exporter on port 9100"
    fi

    print_success "Node Exporter installation completed! Metrics available at: http://localhost:9100/metrics"
}

setup_ssh() {
    print_step "Checking for existing SSH keys..."
    
    SSH_DIR="$HOME/.ssh"
    mkdir -p "$SSH_DIR"
    
    existing_keys=($(ls $SSH_DIR/*.pub 2>/dev/null))
    
    if [ ${#existing_keys[@]} -eq 0 ]; then
        print_step "No existing SSH keys found. Creating new key..."
        read -p "Enter your email for the SSH key: " email
        ssh-keygen -t ed25519 -C "$email"
        selected_key="$HOME/.ssh/id_ed25519.pub"
    else
        echo "Found existing SSH keys:"
        for i in "${!existing_keys[@]}"; do
            echo "[$i] ${existing_keys[$i]}"
        done
        echo "[n] Create new key"
        
        read -p "Select an option: " selection
        
        if [ "$selection" = "n" ]; then
            read -p "Enter your email for the SSH key: " email
            ssh-keygen -t ed25519 -C "$email"
            selected_key="$HOME/.ssh/id_ed25519.pub"
        else
            selected_key="${existing_keys[$selection]}"
        fi
    fi
    
    print_step "Here's your public SSH key. Add this to your GitHub account:"
    echo "----------------------------------------------------------------"
    cat "$selected_key"
    echo "----------------------------------------------------------------"
    
    read -p "Press Enter once you've added the SSH key to GitHub..."
    
    print_step "Testing GitHub SSH connection..."
    ssh -T git@github.com
}

setup_repository() {
    read -p "Enter your GitHub repository SSH URL: " repo_url
    
    print_step "Cloning repository..."
    git clone "$repo_url" app
    
    if [ $? -ne 0 ]; then
        print_error "Failed to clone repository"
        exit 1
    fi
    
    print_success "Repository cloned successfully"
}

setup_branch() {
    ensure_app_directory
    
    print_step "Available branches:"
    git branch -r
    
    read -p "Enter the branch name you want to checkout (e.g., dev): " branch_name
    
    print_step "Checking out branch: $branch_name..."
    git checkout $branch_name
    
    if [ $? -ne 0 ]; then
        print_error "Failed to checkout branch: $branch_name"
        exit 1
    fi
    
    print_success "Successfully checked out branch: $branch_name"
}

install_docker() {
    print_step "Installing Docker and Docker Compose..."
    
    sudo apt-get update
    
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    sudo mkdir -m 0755 -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    sudo usermod -aG docker $USER
    
    print_success "Docker installation completed"
}

configure_ufw() {
    print_step "Configuring UFW firewall..."
    
    sudo apt-get install -y ufw
    
    sudo ufw allow 22/tcp
    sudo ufw allow 3003/tcp
    
    sudo ufw --force enable
    
    print_success "UFW configuration completed"
}

setup_env() {
    ensure_app_directory
    
    print_step "Setting up .env file..."
    print_warning "Please open a new terminal window and SSH into this server"
    echo "Current server details:"
    echo "IP Address: $(curl -s ifconfig.me)"
    echo "Username: $USER"
    echo ""
    print_warning "In the new terminal, paste your .env file content and save it"
    echo "You can use: nano .env"
    echo ""
    
    while true; do
        read -p "Have you created the .env file? (yes/no): " env_response
        if [ "$env_response" = "yes" ]; then
            if [ -f ".env" ]; then
                print_success ".env file detected!"
                break
            else
                print_error "No .env file found in app directory. Please create it first."
            fi
        fi
        print_warning "Please create the .env file before continuing..."
    done
}

start_application() {
    ensure_app_directory
    
    print_step "Starting the application..."
    sudo docker compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Application started successfully!"
    else
        print_error "Failed to start application"
    fi
}

# Main execution function
run_selected_steps() {
    local selections=("$@")

    # Install git if needed for repository operations
    if [[ " ${selections[@]} " =~ " 2 " ]] || [[ " ${selections[@]} " =~ " 9 " ]]; then
        sudo apt-get update
        sudo apt-get install -y git
    fi

    for selection in "${selections[@]}"; do
        case $selection in
            1) setup_ssh ;;
            2) setup_repository ;;
            3) setup_branch ;;
            4) setup_env ;;
            5) install_docker ;;
            6) configure_ufw ;;
            7) start_application ;;
            8) install_node_exporter ;;  # New Node Exporter setup
            9)  # Run all steps
                setup_ssh
                setup_repository
                setup_branch
                setup_env
                install_docker
                configure_ufw
                install_node_exporter  # New step included
                start_application
                ;;
            0)
                print_success "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid option: $selection"
                ;;
        esac
    done
}

# Main script execution
main() {
    if ! grep -q "Ubuntu" /etc/os-release; then
        print_error "This script is designed for Ubuntu. Exiting..."
        exit 1
    fi
    
    show_menu
    
    read -p "Enter your selections (space-separated numbers): " -a selections
    
    if [[ " ${selections[@]} " =~ " 0 " ]]; then
        print_success "Exiting..."
        exit 0
    fi
    
    print_step "Starting selected components..."
    run_selected_steps "${selections[@]}"
    
    print_success "Selected setup steps completed!"
}

main