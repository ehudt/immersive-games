import { defineConfig, type Plugin } from 'vite';
import { createReadStream, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WASM_SRC = resolve(fileURLToPath(new URL('.', import.meta.url)), 'node_modules/@mediapipe/tasks-vision/wasm');
const WASM_URL = '/mediapipe/wasm/';

/**
 * Serves the MediaPipe WASM runtime from node_modules (dev) and copies it into
 * the build output, so the game never depends on a third-party CDN at runtime
 * and the runtime version always matches the installed JS package.
 */
function mediapipeWasm(): Plugin {
  let outDir = 'dist';
  return {
    name: 'mediapipe-wasm',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const idx = url.indexOf(WASM_URL);
        if (idx === -1) return next();
        const file = join(WASM_SRC, url.slice(idx + WASM_URL.length));
        if (!file.startsWith(WASM_SRC) || !existsSync(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dest = join(outDir, WASM_URL);
      mkdirSync(dest, { recursive: true });
      for (const f of readdirSync(WASM_SRC)) copyFileSync(join(WASM_SRC, f), join(dest, f));
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [mediapipeWasm()],
  server: { host: true },
  build: { chunkSizeWarningLimit: 1500 },
});
