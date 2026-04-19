FROM ghcr.io/vade-app/vade-runtime:latest

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node tsconfig.json tsconfig.node.json ./
COPY --chown=node:node mcp ./mcp

ENV VADE_MCP_TRANSPORT=sse
ENV VADE_MCP_HTTP_PORT=8080
ENV VADE_LIBRARY_PATH=/home/node/.vade/library
ENV NODE_ENV=production

EXPOSE 8080

CMD ["tsx", "mcp/index.ts"]
