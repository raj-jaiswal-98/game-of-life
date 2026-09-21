/**
 * Vite configuration for the Game of Life frontend.
 *
 * Dev  (`npm run dev`):
 *   - Serves frontend/index.html with TypeScript hot-module-reload at http://localhost:5173
 *   - publicDir points at Spring Boot's static dir so /css/styles.css is available
 *   - /api/* requests are proxied to Spring Boot at http://localhost:8080
 *
 * Build (`npm run build`):
 *   - Bundles frontend/src/app.ts as an IIFE into src/main/resources/static/js/app.js
 *   - copyPublicDir: false — Spring Boot owns its own static assets; Vite must not overwrite them
 */
import { defineConfig } from 'vite';

export default defineConfig({
  // During dev, serve static assets (CSS, fonts, images) from Spring Boot's static dir
  publicDir: '../src/main/resources/static',

  build: {
    // Write the compiled bundle into Spring Boot's existing js/ folder
    outDir: '../src/main/resources/static/js',
    // Never wipe the whole folder — Spring Boot may have other files there
    emptyOutDir: false,
    // Do NOT copy publicDir contents on build; Spring Boot already serves them
    copyPublicDir: false,
    rollupOptions: {
      input: 'src/app.ts',
      output: {
        // Keep the same filename so index.html needs no changes
        entryFileNames: 'app.js',
        // IIFE: no module loader needed, just a self-invoking browser script
        format: 'iife',
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
