FROM node:20.19.1-bookworm-slim

# Ephemeral today; backed by a Fly volume once storage-abstraction lands.
RUN mkdir -p /home/node/.vade/library/canvases \
             /home/node/.vade/library/entities \
    && chown -R node:node /home/node/.vade

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node tsconfig.json tsconfig.node.json tsconfig.mcp.build.json ./
COPY --chown=node:node mcp ./mcp

# Precompile the MCP server so boot doesn't pay tsx's JIT-transpile
# cost — matters on Fly where the startup probe has a short grace
# period.
RUN npx tsc -p tsconfig.mcp.build.json \
    && npm prune --omit=dev \
    && npm cache clean --force

ENV VADE_MCP_TRANSPORT=sse
ENV VADE_MCP_HTTP_PORT=8080
ENV VADE_LIBRARY_PATH=/home/node/.vade/library
ENV NODE_ENV=production
ENV VITE_BRIDGE_URL=wss://mcp.vade-app.dev/canvas

EXPOSE 8080

CMD ["node", "dist-mcp/index.js"]
