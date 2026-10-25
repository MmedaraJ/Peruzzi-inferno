import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// One id per build, so a phone holding an old copy can notice a newer deploy (see src/lib/version.ts).
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12) || Date.now().toString(36);
const versionFile = () => ({
  name: 'version-json',
  generateBundle(this: any) { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) }); },
  configureServer(server: any) { server.middlewares.use('/version.json', (_req: any, res: any) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ build: BUILD_ID })); }); },
});

// The two faces every page's headings are set in (Marcellus, and its small caps), asked for with the page itself rather
// than once the page has been laid out, so headings don't appear in a stand-in font and then change.
const preloadFonts = () => ({
  name: 'preload-fonts',
  transformIndexHtml: {
    order: 'post' as const,
    handler(_html: string, ctx: any) {
      const files = Object.keys(ctx.bundle || {}).filter((f) => /\/marcellus(-sc)?-latin-400-normal-[\w-]+\.woff2$/.test(f));
      return files.map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' }, injectTo: 'head' as const }));
    },
  },
});

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), versionFile(), preloadFonts()],
  // /q/, /a/ and /t/ are the shared links: the API answers them with a link preview, then sends the browser on into the app
  server: { host: true, proxy: { '/api': 'http://localhost:4000', '^/q/': 'http://localhost:4000', '^/a/': 'http://localhost:4000', '^/t/': 'http://localhost:4000' } },
  // tiny shared pieces are folded into the chunks that use them rather than fetched on their own
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900, rollupOptions: { output: { experimentalMinChunkSize: 8000 } } },
});
