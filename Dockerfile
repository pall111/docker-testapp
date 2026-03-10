FROM node:18-alpine

WORKDIR /testapp

# Copy package files first so npm install is cached unless dependencies change
COPY package.json ./

RUN npm install

# Copy remaining source files
COPY . .

CMD ["node", "server.js"]