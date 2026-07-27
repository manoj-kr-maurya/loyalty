#!/bin/bash

# Define the path to the prometheus.yml file
CONFIG_FILE=$(pwd)/non-service-conf-files/prometheus.yml

# Check if the prometheus.yml file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: prometheus.yml file not found in the current directory."
  exit 1
fi

# Stop and remove any existing Prometheus container
docker stop prometheus || true
docker rm prometheus || true

# Run the Prometheus container
docker run -d \
  --name prometheus \
  -p 9091:9090 \
  -v "$CONFIG_FILE":/etc/prometheus/prometheus.yml \
  prom/prometheus

# Check if the container is running
if docker ps --format '{{.Names}}' | grep -q prometheus; then
  echo "Prometheus container is running successfully."
else
  echo "Failed to start Prometheus container."
  exit 1
fi