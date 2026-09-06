# Compilación de la interfaz
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Imagen final: solo el servidor propio y la interfaz compilada
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache su-exec && mkdir -p /app/data
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
VOLUME ["/app/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
