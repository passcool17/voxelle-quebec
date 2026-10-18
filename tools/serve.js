// Petit serveur statique pour les tests (les modules ES ne marchent pas en file://).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
module.exports = function serve(port = 8765) {
  const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  return new Promise(res => s.listen(port, () => res(s)));
};
if (require.main === module) module.exports(+process.argv[2] || 8765).then(() => console.log('http://localhost:' + (+process.argv[2] || 8765)));
