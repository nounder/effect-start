FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=production

# Copy package.json first
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["bun", "start"]
