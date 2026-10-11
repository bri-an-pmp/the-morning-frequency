import { defineConfig } from 'vite';

// Relative paths so the same build works on GitHub Pages (a subfolder) and inside the iOS app
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
