# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Copy Dash assets (from your local repo) into final /usr/share/nginx/html/assets/
# 👇 Add this line
COPY ./apps/frontend/public/assets /usr/share/nginx/html/assets

# Production stage - use Nginx to serve static files and proxy API/tiles
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8077
EXPOSE 8077

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8077/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
