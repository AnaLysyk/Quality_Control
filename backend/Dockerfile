FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional
COPY . .
EXPOSE 3334
ENV PORT=3334
CMD ["npx", "ts-node", "src/mock-server.ts"]
