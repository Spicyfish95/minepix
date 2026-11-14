import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root: 'src',
  clearScreen: false,
  server: {host: '127.0.0.1', port: 14200, strictPort: true},
  build: {
    target: 'chrome110',
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        capture: fileURLToPath(new URL('./src/capture.html', import.meta.url)),
        editor: fileURLToPath(new URL('./src/index.html', import.meta.url)),
        panel: fileURLToPath(new URL('./src/panel.html', import.meta.url))
      }
    }
  },
  worker: {format: 'es'}
});
