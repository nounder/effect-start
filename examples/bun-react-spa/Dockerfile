FROM oven/bun:1 as builder

WORKDIR /app

# Copy package.json first
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/out ./out

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Expose the port
EXPOSE 3000

# Start the application
CMD ["bun", "out/server/server.js"]
