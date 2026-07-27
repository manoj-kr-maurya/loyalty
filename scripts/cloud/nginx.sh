#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored text
print_color() {
    local color=$1
    local text=$2
    echo -e "${color}${text}${NC}"
}

# Function to load environment variables
load_env() {
    ENV_FILE_PATH="../.env"
    
    # Check if .env file exists
    if [ -f "$ENV_FILE_PATH" ]; then
        print_color $GREEN "\n.env file found at $ENV_FILE_PATH"
        print_color $YELLOW "Would you like to view the contents of the .env file? (y/n)"
        read view_env
        if [ "$view_env" = "y" ] || [ "$view_env" = "Y" ]; then
            print_color $GREEN "\n=== .env Contents ==="
            cat "$ENV_FILE_PATH"
            echo
        fi
    else
        print_color $RED "\nWarning: .env file not found at $ENV_FILE_PATH"
        print_color $YELLOW "Please ensure you have a valid .env file before proceeding."
        print_color $YELLOW "Would you like to continue anyway? (y/n)"
        read continue
        if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
            print_color $RED "Setup aborted. Please create a .env file and try again."
            exit 1
        fi
    fi
    
    ENVIRONMENT="${ENVIRONMENT:-dev}"
    DOMAIN="${ENVIRONMENT}.lsbbe.littlebitpositive.com"
    DOCKER_APP_PORT="${PORT:-3003}"
}

# Pre-flight checks function
preflight_checks() {
    print_color $YELLOW "\n=== Pre-flight Checks ==="
    echo "1. Domain name to be configured: $DOMAIN"
    echo "2. Application port: $DOCKER_APP_PORT"
    echo "3. Environment: $ENVIRONMENT"
    echo "4. Environment file path: $ENV_FILE_PATH"
    echo "5. DNS records are set up for $DOMAIN pointing to this server’s IP: $(hostname -I | awk '{print $1}')"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "6. You have a valid email address for SSL certificate"
        echo "7. Domain’s DNS is properly propagated"
    fi

    print_color $YELLOW "\nHave you verified all requirements? (y/n)"
    read verify
    
    if [ "$verify" != "y" ] && [ "$verify" != "Y" ]; then
        print_color $RED "Setup aborted. Please meet all requirements and try again."
        exit 1
    fi
}

# Package installation function
install_packages() {
    print_color $GREEN "\n=== Installing Required Packages ==="
    sudo apt update
    sudo apt install -y nginx certbot python3-certbot-nginx
}

# Firewall configuration function
configure_firewall() {
    print_color $GREEN "\n=== Configuring Firewall ==="
    sudo ufw allow 'Nginx Full'
    sudo ufw reload
}

# Nginx configuration function for single instance
configure_nginx() {
    print_color $GREEN "\n=== Configuring Nginx ==="
    NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
    
    # Directly route to the app running on port 3003
    sudo bash -c "cat > $NGINX_CONFIG" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src * data: 'unsafe-eval' 'unsafe-inline'" always;

    location / {
        proxy_pass http://localhost:$DOCKER_APP_PORT;
        proxy_http_version 1.1;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
}

# SSL configuration function
configure_ssl() {
    print_color $GREEN "\n=== Configuring SSL ==="
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m jaswindersingh11061998@gmail.com
    sudo systemctl enable certbot.timer
}

# Nginx test and restart function
test_and_restart() {
    print_color $GREEN "\n=== Testing and Restarting Nginx ==="
    sudo nginx -t
    if [ $? -ne 0 ]; then
        print_color $RED "Nginx configuration test failed. Please check for errors."
        exit 1
    fi
    sudo systemctl restart nginx
}

# Main menu function
show_menu() {
    while true; do
        print_color $GREEN "\n=== Nginx Setup Menu ==="
        echo "1. Run all steps"
        echo "2. Install packages only"
        echo "3. Configure firewall only"
        echo "4. Configure Nginx only"
        echo "5. Configure SSL only"
        echo "6. Test and restart Nginx only"
        echo "7. Exit"
        
        read -p "Select an option (1-7): " choice
        
        case $choice in
            1)
                preflight_checks
                install_packages
                configure_firewall
                configure_nginx
                configure_ssl
                test_and_restart
                break
                ;;
            2)
                preflight_checks
                install_packages
                ;;
            3)
                preflight_checks
                configure_firewall
                ;;
            4)
                preflight_checks
                configure_nginx
                test_and_restart
                ;;
            5)
                preflight_checks
                configure_ssl
                ;;
            6)
                test_and_restart
                ;;
            7)
                print_color $YELLOW "Exiting..."
                exit 0
                ;;
            *)
                print_color $RED "Invalid option. Please try again."
                ;;
        esac
    done
}

# Main execution
load_env
show_menu

print_color $GREEN "\nSetup complete!"
echo "Your application should be available at http://$DOMAIN and https://$DOMAIN (if SSL is configured)."
