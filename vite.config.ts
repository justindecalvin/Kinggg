import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-heal missing index.html if not committed to repo root
const indexPath = path.resolve(__dirname, 'index.html');
const fallbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stanbax Schools Ibadan</title>
    <meta name="description" content="Official portal and learning platform for Stanbax Schools Ibadan, featuring academic programs, faculty, student testimonials, and admissions." />
    <meta property="og:title" content="Stanbax Schools Ibadan" />
    <meta property="og:description" content="Official portal and learning platform for Stanbax Schools Ibadan, featuring academic programs, faculty, student testimonials, and admissions." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Nunito:wght@600;700;800&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-slate-50 text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

try {
  if (!fs.existsSync(indexPath)) {
    const pub = path.resolve(__dirname, 'public/index.html');
    const src = path.resolve(__dirname, 'src/index.html');
    if (fs.existsSync(pub)) {
      fs.copyFileSync(pub, indexPath);
    } else if (fs.existsSync(src)) {
      fs.copyFileSync(src, indexPath);
    } else {
      fs.writeFileSync(indexPath, fallbackHtml, 'utf-8');
    }
  }
} catch (e) {
  console.warn('Could not auto-generate index.html:', e);
}

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      rollupOptions: {
        input: {
          main: indexPath,
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

