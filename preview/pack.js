// Expo web çıktısını tek bir app.html'e gömer (simge yazı tipi ve görseller data: olarak)
// ve telefon çerçevesi sayfasını (index.html) yanına koyar.
const fs = require('fs');
const path = require('path');
const [dist, frame, out] = process.argv.slice(2);

const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const src = index.match(/<script src="([^"]+)"/)[1];
let bundle = fs.readFileSync(path.join(dist, src), 'utf8');

const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
bundle = bundle.replace(/"(\/assets\/[^"]+\.(png|jpg|ttf))"/g, (all, p) => {
  if (p.endsWith('.ttf') && !p.includes('/Ionicons.')) return all; // kullanılmayan simge setleri
  const file = path.join(dist, p);
  if (!fs.existsSync(file)) return all;
  return JSON.stringify(`data:${mime[path.extname(p)]};base64,${fs.readFileSync(file).toString('base64')}`);
});
bundle = bundle.replace(/<\/script/gi, '<\\/script');

const style = (index.match(/<style[^>]*>[\s\S]*?<\/style>/) || [''])[0];
const app = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ParentApp</title>
${style}
<style>html,body{background:#F5F6F8}</style>
</head>
<body>
<div id="root"></div>
<script>${bundle}</script>
</body>
</html>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'app.html'), app);
fs.copyFileSync(frame, path.join(out, 'index.html'));
console.log(`app.html ${(app.length / 1e6).toFixed(1)} MB`);
