# Use the specified Node.js version
FROM node:22.3.0

# Install wait-for-it script
RUN apt-get update && apt-get install -y wget
RUN wget -O /usr/local/bin/wait-for-it.sh https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN npm run db

# Use wait-for-it script to wait for PostgreSQL before running migrations
CMD ["/bin/sh", "-c", "/usr/local/bin/wait-for-it.sh postgres:5432 -t 60 -- npm run migrate-deploy && npm run build && npm start"]