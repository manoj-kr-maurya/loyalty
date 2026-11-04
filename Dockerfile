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

# Compile TypeScript during the image build, not at container start.
# Building inside the 512Mi runtime container OOMs before the server binds a port.
RUN npm run build

# Use wait-for-it script to wait for dependencies before starting
# Note: PostgreSQL is hosted on Supabase (cloud), so we don't wait for a local postgres container.
# If you have other services to wait for (e.g., Redis), add them here.
CMD ["/bin/sh", "-c", "npm run migrate-deploy && npm start"]