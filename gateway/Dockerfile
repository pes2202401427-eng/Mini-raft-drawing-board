FROM node:18

WORKDIR /app

# install deps
COPY gateway/package*.json ./
RUN npm install

# copy gateway code
COPY gateway/ ./

# 🔥 copy frontend INTO gateway container
COPY frontend/ ./frontend/

CMD ["node", "index.js"]