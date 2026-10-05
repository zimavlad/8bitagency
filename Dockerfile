FROM node:22-slim AS build
WORKDIR /app
# Coolify ставить NODE_ENV=production ще на збірці — без --include=dev не встановиться vite.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Chromium для NotebookLM (notebooklm-mcp через patchright): браузер і системні бібліотеки до нього.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx patchright install --with-deps chromium && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
EXPOSE 3000
VOLUME /data
CMD ["node", "build/index.js"]
