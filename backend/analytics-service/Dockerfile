# =============================================================================
# Encore Analytics Service - Docker Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Multi-stage build for optimized production image
# -----------------------------------------------------------------------------

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY src/ ./src/
COPY types/ ./types/

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production stage
# -----------------------------------------------------------------------------

FROM node:18-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3003
ENV USER=analytics
ENV GROUP=analytics
ENV UID=1001
ENV GID=1001

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    tzdata

# Create non-root user
RUN addgroup -g $GID $GROUP && \
    adduser -D -u $UID -G $GROUP -s /bin/sh $USER

# Set working directory
WORKDIR /app

# Change ownership of the app directory
RUN chown -R $USER:$GROUP /app

# Switch to non-root user
USER $USER

# Copy built application from builder stage
COPY --from=builder --chown=$USER:$GROUP /app/dist ./dist
COPY --from=builder --chown=$USER:$GROUP /app/node_modules ./node_modules
COPY --from=builder --chown=$USER:$GROUP /app/package*.json ./

# Create necessary directories
RUN mkdir -p storage/reports storage/temp logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Expose port
EXPOSE $PORT

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# -----------------------------------------------------------------------------
# Stage 3: Development stage
# -----------------------------------------------------------------------------

FROM node:18-alpine AS development

# Set environment variables
ENV NODE_ENV=development
ENV PORT=3003

# Install development dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p storage/reports storage/temp logs

# Expose port
EXPOSE $PORT

# Expose debug port
EXPOSE 9229

# Start development server with hot reload
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Stage 4: Testing stage
# -----------------------------------------------------------------------------

FROM development AS testing

# Set test environment
ENV NODE_ENV=test

# Run tests
RUN npm run test

# Run linting
RUN npm run lint

# Run type checking
RUN npm run typecheck

# Generate test coverage
RUN npm run test:coverage

# -----------------------------------------------------------------------------
# Build arguments and labels
# -----------------------------------------------------------------------------

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Labels for metadata
LABEL maintainer="Encore Team <dev@encore.com>" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="encore-analytics" \
      org.label-schema.description="Encore Analytics Service" \
      org.label-schema.url="https://encore.com" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/encore/analytics-service" \
      org.label-schema.vendor="Encore" \
      org.label-schema.version=$VERSION \
      org.label-schema.schema-version="1.0"

# -----------------------------------------------------------------------------
# Usage Examples:
# -----------------------------------------------------------------------------
#
# Build production image:
# docker build --target production -t encore-analytics:latest .
#
# Build development image:
# docker build --target development -t encore-analytics:dev .
#
# Build with build args:
# docker build \
#   --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
#   --build-arg VCS_REF=$(git rev-parse --short HEAD) \
#   --build-arg VERSION=$(git describe --tags --always) \
#   --target production \
#   -t encore-analytics:latest .
#
# Run production container:
# docker run -d \
#   --name analytics-service \
#   -p 3003:3003 \
#   --env-file .env \
#   encore-analytics:latest
#
# Run development container:
# docker run -d \
#   --name analytics-dev \
#   -p 3003:3003 \
#   -p 9229:9229 \
#   -v $(pwd):/app \
#   -v /app/node_modules \
#   --env-file .env.development \
#   encore-analytics:dev
#
# -----------------------------------------------------------------------------