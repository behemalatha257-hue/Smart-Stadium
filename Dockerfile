# Use official lightweight Node.js image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (only production)
RUN npm ci --only=production

# Copy application source files
COPY . .

# Expose server port (Cloud Run defaults to 8080)
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Start application server
CMD [ "node", "server.js" ]
