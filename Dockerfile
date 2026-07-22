FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 7860
EXPOSE 8092
ENV PORT=7860
CMD ["npm", "start"]
