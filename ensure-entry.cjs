const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const targetIndex = path.join(rootDir, 'index.html');

const htmlContent = `<!doctype html>
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
</html>
`;

try {
  if (!fs.existsSync(targetIndex)) {
    const candidates = [
      path.join(rootDir, 'public', 'index.html'),
      path.join(rootDir, 'src', 'index.html'),
    ];
    let found = false;
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        fs.copyFileSync(cand, targetIndex);
        console.log(`[Auto-Heal] Restored index.html from ${cand}`);
        found = true;
        break;
      }
    }
    if (!found) {
      fs.writeFileSync(targetIndex, htmlContent, 'utf-8');
      console.log('[Auto-Heal] Created index.html at root');
    }
  } else {
    console.log('[Auto-Heal] index.html verified at root');
  }

  // Also ensure backup copies in public/ and src/
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir) && !fs.existsSync(path.join(publicDir, 'index.html'))) {
    fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent, 'utf-8');
  }
  const srcDir = path.join(rootDir, 'src');
  if (fs.existsSync(srcDir) && !fs.existsSync(path.join(srcDir, 'index.html'))) {
    fs.writeFileSync(path.join(srcDir, 'index.html'), htmlContent, 'utf-8');
  }
} catch (err) {
  console.warn('[Auto-Heal] Non-fatal check warning:', err.message);
}
