FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./

# Install dependencies
# NOTE: Remember to run `bun install` locally to generate correct lockfile
RUN bun install --frozen-lockfile --production

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["bun", "start"]
