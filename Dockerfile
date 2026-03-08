FROM node:18-alpine

# Cria diretorio da aplicacao
WORKDIR /source

# Instala dependencias primeiro (melhora o cache do Docker)
COPY package*.json ./
RUN npm install

# Copia o resto do codigo
COPY . .

# Cria pasta para o upload do banco de dados (Volume compartilhado Coolify)
RUN mkdir -p /source/data

# Expõe a porta
EXPOSE 3000

# Inicia o servidor Node
CMD ["node", "server.js"]
