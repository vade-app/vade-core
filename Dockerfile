FROM node:20.19.1-bookworm-slim

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
ENV VADE_LIBRARY_DRIVER=cloud
ENV VADE_LIBRARY_API_URL=https://vade-app.dev/library
ENV NODE_ENV=production
ENV VITE_BRIDGE_URL=wss://mcp.vade-app.dev/canvas

EXPOSE 8080

CMD ["node", "dist-mcp/index.js"]
