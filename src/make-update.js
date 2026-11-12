// usage: node make-update.js <version> <outDir> [notes]  -> writes the files + manifest.json to publish
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [version, out, notes] = process.argv.slice(2);
const files = ['app.js', 'index.html', 'splash.html', 'splash-art.jpg', 'splash-icon.png'];
fs.mkdirSync(out, { recursive: true });
const m = { version, minLoader: '2.3.0', notes: notes || '', files: {} };
for (const f of files) { const b = fs.readFileSync(path.join(__dirname, f)); fs.writeFileSync(path.join(out, f), b);
  m.files[f] = crypto.createHash('sha256').update(b).digest('hex'); }
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2));
console.log('wrote', out, version);
