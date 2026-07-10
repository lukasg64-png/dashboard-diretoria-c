FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860
CMD ["node", "server.js"]
