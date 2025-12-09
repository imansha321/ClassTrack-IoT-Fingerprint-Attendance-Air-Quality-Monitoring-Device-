# Stage 1 - Build TS
FROM node:18-alpine AS builder

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y libssl1.1

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build   # must compile TypeScript

# Stage 2 - Run JS
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Only copy built JS + node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5000
CMD ["node", "dist/index.js"]
