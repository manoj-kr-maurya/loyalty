#!/bin/bash

echo -e "\e[34mStarting PostgreSQL setup...\e[0m"

# Install PostgreSQL
echo -e "\e[34mInstalling PostgreSQL...\e[0m"
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Enable and start PostgreSQL service
echo -e "\e[34mEnabling and starting PostgreSQL service...\e[0m"
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Ask the admin for PostgreSQL credentials and database name
read -p "Enter PostgreSQL username: " PG_USER
read -sp "Enter PostgreSQL password: " PG_PASSWORD
echo
read -p "Enter the name for your PostgreSQL database: " PG_DATABASE

# Switch to the postgres user and set up the user and database
echo -e "\e[34mCreating PostgreSQL user and database...\e[0m"
sudo -u postgres psql <<EOF
CREATE USER $PG_USER WITH PASSWORD '$PG_PASSWORD';
CREATE DATABASE $PG_DATABASE;
GRANT ALL PRIVILEGES ON DATABASE $PG_DATABASE TO $PG_USER;
EOF

# Print the PostgreSQL connection URL and credentials for admin
PG_HOST="localhost"
PG_PORT="5432"
echo -e "\e[32mPostgreSQL setup is complete.\e[0m"
echo -e "\e[34mYou can connect to PostgreSQL using the following details:\e[0m"
echo -e "\e[32m---------------------------------------------\e[0m"
echo -e "\e[32mPostgreSQL Connection URL:\e[0m"
echo -e "\e[33mpostgresql://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DATABASE\e[0m"
echo -e "\e[32m---------------------------------------------\e[0m"
echo -e "\e[34mPostgreSQL is running on port $PG_PORT with the above credentials.\e[0m"
