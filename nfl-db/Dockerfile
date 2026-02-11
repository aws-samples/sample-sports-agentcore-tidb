FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:20-slim

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source and build
COPY . ./
RUN npm run build

# Create non-root user and switch to it
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["npm", "start"]