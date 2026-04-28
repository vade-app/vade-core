import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

function resolveCommitSha(): string {
  const fromEnv =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA
  if (fromEnv) return fromEnv.slice(0, 7)

  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .slice(0, 7)
  } catch {
    return 'dev'
  }
}

// VADE_NO_CF=1 skips the Cloudflare Vite plugin — useful when no
// `wrangler login` is available in the dev sandbox and only the
// static SPA + public assets are needed (e.g. the lineage canvas
// doesn't touch /library/*). Default behavior is unchanged.
const skipCloudflare = process.env.VADE_NO_CF === '1'

export default defineConfig({
  plugins: skipCloudflare ? [react()] : [react(), cloudflare()],
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(resolveCommitSha()),
  },
  server: {
    host: true,
    port: 5173,
  },
})
