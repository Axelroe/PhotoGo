// PhotoGo loader. Kept deliberately small: it picks which copy of the app to run (the one in the
// bundle, or a newer one the auto-updater downloaded), starts it, and checks for the next update.
// Everything else lives in app.js, which is itself updatable.
const { app, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.setName('PhotoGo');
// keep the original data folder so settings and recent folders survive the rename
app.setPath('userData', path.join(app.getPath('appData'), '照片浏览器'));

const UPD = path.join(app.getPath('userData'), 'updates');
const STATE = path.join(UPD, 'state.json');
const FILES_OK = /^[A-Za-z0-9._-]+$/;

const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

// a downloaded copy is used only if every file is present and matches the checksum in its manifest
function verified(dir) {
  const m = readJSON(path.join(dir, 'manifest.json'));
  if (!m || !m.version || !m.files || !m.files['app.js'] || !m.files['index.html']) return null;
  for (const [name, sum] of Object.entries(m.files)) {
    if (!FILES_OK.test(name)) return null;
    try { if (sha256(fs.readFileSync(path.join(dir, name))) !== sum) return null; } catch { return null; }
  }
  return m;
}

const state = readJSON(STATE, {});            // { current, bad: [], booting }
state.bad = state.bad || [];
// the previous launch of a downloaded copy never reached its window: stop using that copy
if (state.booting) { state.bad.push(state.booting); if (state.current === state.booting) delete state.current; delete state.booting; writeJSON(STATE, state); }

let active = { dir: __dirname, version: app.getVersion(), bundled: true };
if (state.current && !state.bad.includes(state.current) && cmp(state.current, app.getVersion()) > 0) {
  const dir = path.join(UPD, state.current);
  if (verified(dir)) active = { dir, version: state.current, bundled: false };
}

function start(target) {
  if (!target.bundled) { state.booting = target.version; writeJSON(STATE, state); }
  require(path.join(target.dir, 'app.js')).start({
    dir: target.dir, version: target.version,
    onReady: () => { if (state.booting) { delete state.booting; writeJSON(STATE, state); } },
  });
}
try { start(active); }
catch (e) {
  if (active.bundled) throw e;
  state.bad.push(active.version); delete state.current; delete state.booting; writeJSON(STATE, state);
  active = { dir: __dirname, version: app.getVersion(), bundled: true };
  start(active);
}

// ---- update check: download the newer version in the background, use it from the next launch ----
async function get(url) {
  const r = await net.fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function checkForUpdate() {
  const cfg = readJSON(path.join(__dirname, 'update-config.json'), {});
  if (!cfg.url || process.env.PHOTOGO_NO_UPDATE) return;
  const base = (process.env.PHOTOGO_UPDATE_URL || cfg.url).replace(/\/$/, '');
  const m = JSON.parse((await get(base + '/manifest.json?t=' + Date.now())).toString('utf8'));
  if (!m.version || !m.files || cmp(m.version, active.version) <= 0 || state.bad.includes(m.version)) return;
  if (m.minLoader && cmp(m.minLoader, app.getVersion()) > 0) return;     // needs a newer installed app
  const dir = path.join(UPD, m.version);
  if (!verified(dir)) {
    const tmp = path.join(UPD, 'tmp-' + m.version + '-' + process.pid);
    fs.mkdirSync(tmp, { recursive: true });
    for (const [name, sum] of Object.entries(m.files)) {
      if (!FILES_OK.test(name)) throw new Error('bad file name ' + name);
      const buf = await get(base + '/' + name + '?v=' + m.version);
      if (sha256(buf) !== sum) throw new Error('checksum mismatch ' + name);
      fs.writeFileSync(path.join(tmp, name), buf);
    }
    writeJSON(path.join(tmp, 'manifest.json'), m);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
  }
  state.current = m.version; writeJSON(STATE, state);
  // tidy: keep only the copy in use and the new one
  for (const d of fs.readdirSync(UPD)) {
    if (d !== 'state.json' && d !== m.version && d !== active.version) fs.rmSync(path.join(UPD, d), { recursive: true, force: true });
  }
  const { response } = await dialog.showMessageBox({
    type: 'info', buttons: ['立即重启', '稍后'], defaultId: 0, cancelId: 1,
    message: 'PhotoGo ' + m.version + ' 已下载', detail: (m.notes ? m.notes + '\n\n' : '') + '重新打开后生效。',
  });
  if (response === 0) { app.relaunch(); app.quit(); }
}
app.whenReady().then(() => setTimeout(() => checkForUpdate().catch(e => console.error('update check failed:', e.message)), 4000));
