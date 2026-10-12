import { defineConfig } from 'vite';

// Content Security Policy for the built site: the page may only run its own code, and may only
// talk to itself and to Claude's API. If anything ever slipped untrusted code into the page, the
// browser would refuse to run it or send data anywhere else. (Not used by the dev server, which
// needs inline scripts for live reload.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self' blob: https://api.anthropic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const securityHeaders = {
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">`);
  },
};

// Relative paths so the same build works on GitHub Pages (a subfolder) and inside the iOS app
export default defineConfig({
  base: './',
  plugins: [securityHeaders],
  build: { outDir: 'dist', emptyOutDir: true },
});
