import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {offlineCachePlugin} from './build/offline.mts'
import {distributionPlugin} from './build/distribution.mjs'

// Hosts without response headers (GitHub Pages) get the Content-Security-Policy of public/_headers as a <meta> tag.
// frame-ancestors is dropped there: browsers ignore it in a meta tag. Enabled with META_CSP=1 (see .github/workflows/pages.yml).
function metaCsp(): Plugin {
  const policy = /Content-Security-Policy:\s*(.+)/.exec(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'))?.[1]
    ?.split(';').map(part => part.trim()).filter(part => part && !part.startsWith('frame-ancestors')).join('; ')
  if (!policy) throw new Error('No Content-Security-Policy found in public/_headers')
  return { name: 'meta-csp', transformIndexHtml: html => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`) }
}

process.env.MIDI_STUDIO_DISTRIBUTION=JSON.stringify({modules:['tc-electronic-fireworx-editor'],mode:'standalone',library:true})

export default defineConfig({
  // Relative asset URLs: the same build works at a domain root (GitHub Pages, Cloudflare) and under any sub-path.
  base: './',
  build: {rollupOptions:{input:{site:fileURLToPath(new URL('./index.html',import.meta.url)),editor:fileURLToPath(new URL('./editor/index.html',import.meta.url))}}},
  plugins: [distributionPlugin(),react(), ...(process.env.META_CSP === '1' ? [metaCsp()] : []),offlineCachePlugin()],
  server: {
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 500 },
  },
})
