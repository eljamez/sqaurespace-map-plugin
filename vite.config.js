import { defineConfig } from 'vite';

// Build the map plugin from dev.html so root index.html can be the GitHub Pages landing.
export default defineConfig({
  build: {
    rollupOptions: {
      input: 'dev.html',
    },
  },
});
