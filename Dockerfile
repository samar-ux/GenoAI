FROM node:22-slim
WORKDIR /app
COPY backend/package*.json backend/
RUN npm --prefix backend ci --omit=dev
COPY backend backend
COPY frontend frontend
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 3000
CMD ["node", "backend/server.js"]
