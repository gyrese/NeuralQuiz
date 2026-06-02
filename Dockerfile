# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

# Copier package.json et installer les dépendances
COPY client/package*.json ./
RUN npm ci

# Définir l'argument de build pour la clé Google Maps
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Copier le code source et compiler
COPY client/ ./
RUN npm run build

# --- Stage 2: Final Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# Définir l'environnement de production
ENV NODE_ENV=production
ENV PORT=3005

# Copier package.json du serveur et installer les dépendances de production
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copier le reste du serveur
COPY server/ ./server/

# Copier le build du frontend depuis le builder
COPY --from=frontend-builder /app/client/dist ./client/dist

# S'assurer que le dossier uploads et data existent
RUN mkdir -p server/uploads server/data

EXPOSE 3005

# Lancer l'application
CMD ["node", "server/index.js"]
