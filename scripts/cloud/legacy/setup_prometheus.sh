#!/bin/bash

# Variables
PROMETHEUS_VERSION="2.47.0"
NODE_EXPORTER_VERSION="1.6.0"
PROMETHEUS_USER="prometheus"
PROMETHEUS_GROUP="prometheus"
PROMETHEUS_YML="/etc/prometheus/prometheus.yml"
PROMETHEUS_BIN="/usr/local/bin/prometheus"
NODE_EXPORTER_BIN="/usr/local/bin/node_exporter"

# Functions
download_and_install() {
    local version=$1
    local url=$2
    local install_dir=$3

    if [ ! -f "${install_dir}/${url}" ]; then
        wget "https://github.com/prometheus/${url}/releases/download/v${version}/${url}-${version}.linux-amd64.tar.gz"
        tar xvf "${url}-${version}.linux-amd64.tar.gz"
        sudo cp "${url}-${version}.linux-amd64/${url}" "${install_dir}"
        rm -rf "${url}-${version}.linux-amd64"
        rm "${url}-${version}.linux-amd64.tar.gz"
    else
        echo "${url} is already installed."
    fi
}

setup_service() {
    local service_name=$1
    local binary_path=$2
    local user=$3

    if systemctl list-units --full -all | grep -Fq "${service_name}.service"; then
        echo "${service_name} service is already set up."
    else
        sudo tee /etc/systemd/system/${service_name}.service <<EOF
[Unit]
Description=Prometheus ${service_name}
After=network.target

[Service]
User=${user}
ExecStart=${binary_path}
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl enable ${service_name}
        sudo systemctl start ${service_name}
    fi
}

update_prometheus_config() {
    local api_key=$1

    if grep -q "remote_write" ${PROMETHEUS_YML}; then
        echo "Prometheus configuration is already updated."
    else
        sudo tee ${PROMETHEUS_YML} <<EOF
# Global configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Scrape configurations
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

# Remote write configuration
remote_write:
  - url: https://prometheus-prod-26-prod-ap-south-0.grafana.net/api/prom/push
    basic_auth:
      username: 1208877
      password: ${api_key}
EOF

        sudo systemctl restart prometheus
    fi
}

# Main Script
echo "Starting installation of Prometheus and Node Exporter..."

# Install Prometheus
echo "Checking Prometheus installation..."
download_and_install "${PROMETHEUS_VERSION}" "prometheus" "/usr/local/bin"

# Install Node Exporter
echo "Checking Node Exporter installation..."
download_and_install "${NODE_EXPORTER_VERSION}" "node_exporter" "/usr/local/bin"

# Setup Prometheus service
echo "Setting up Prometheus service..."
setup_service "prometheus" "${PROMETHEUS_BIN}" "${PROMETHEUS_USER}"

# Setup Node Exporter service
echo "Setting up Node Exporter service..."
setup_service "node_exporter" "${NODE_EXPORTER_BIN}" "${PROMETHEUS_USER}"

# Get API key from user
read -sp "Enter your Grafana Cloud API Key: " GRAFANA_API_KEY
echo

# Update Prometheus configuration
echo "Updating Prometheus configuration..."
update_prometheus_config "${GRAFANA_API_KEY}"

# Firewall configuration
echo "Configuring UFW..."
if ! sudo ufw status | grep -q '9090/tcp'; then
    sudo ufw allow 9090/tcp
fi
if ! sudo ufw status | grep -q '9100/tcp'; then
    sudo ufw allow 9100/tcp
fi

# Status check
echo "Checking service status..."
sudo systemctl status prometheus
sudo systemctl status node_exporter

echo "Installation and configuration completed successfully!"
