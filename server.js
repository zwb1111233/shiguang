'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { db, getSetting, setSetting, ensureSecret, UPLOAD_DIR, MEDIA_DIR, WALLPAPER_UPLOAD_DIR } = require('./db');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// ---------------- 通用工具 ----------------
const MOOD_KEYS = ['happy', 'love', 'calm', 'tired', 'sad', 'angry'];

function pad(n) { return String(n).padStart(2, '0'); }
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime());
}

// 会话：HMAC 签名 cookie
function sign(v) { return crypto.createHmac('sha256', ensureSecret()).update(v).digest('hex'); }
function makeToken() { const ts = Date.now().toString(36); return `${ts}.${sign('auth:' + ts)}`; }
function checkToken(t) {
  if (typeof t !== 'string') return false;
  const i = t.indexOf('.');
  if (i < 1) return false;
  const ts = t.slice(0, i);
  const a = Buffer.from(sign('auth:' + ts));
  const b = Buffer.from(t.slice(i + 1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isAuthed(req) { return checkToken(parseCookies(req).sg_auth); }
function lockEnabled() { return !!getSetting('lock_hash', ''); }
function authGuard(req, res, next) {
  if (lockEnabled() && !isAuthed(req)) return res.status(401).json({ error: 'locked' });
  next();
}
function hashPasscode(passcode, salt) {
  return crypto.scryptSync(String(passcode), salt, 32).toString('hex');
}

// ---------------- 上传 ----------------
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, file.fieldname === 'wallpaper' ? WALLPAPER_UPLOAD_DIR : MEDIA_DIR);
  },
  filename(req, file, cb) {
    let ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10);
    if (!/^\.[a-z0-9]{1,9}$/.test(ext)) ext = file.fieldname === 'wallpaper' ? '.png' : '';
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 320 * 1024 * 1024, files: 16 },
  fileFilter(req, file, cb) {
    if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('只支持图片和视频文件'));
  }
});

// ---------------- 数据读取 ----------------
function attachMedia(rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const marks = ids.map(() => '?').join(',');
  const media = db.prepare(
    `SELECT id, entry_id, kind, file FROM media WHERE entry_id IN (${marks}) ORDER BY sort, id`
  ).all(...ids);
  const byEntry = new Map();
  for (const m of media) {
    if (!byEntry.has(m.entry_id)) byEntry.set(m.entry_id, []);
    byEntry.get(m.entry_id).push({ id: m.id, kind: m.kind, url: `/uploads/media/${m.file}` });
  }
  return rows.map(r => ({
    id: r.id,
    date: r.date,
    created_at: r.created_at,
    mood: r.mood,
    text: r.text,
    tags: JSON.parse(r.tags || '[]'),
    share_id: r.share_id,
    media: byEntry.get(r.id) || []
  }));
}

function extractTags(text, incoming) {
  const set = new Set();
  for (const t of Array.isArray(incoming) ? incoming : []) {
    const s = String(t).replace(/["\\]/g, '').trim().slice(0, 20);
    if (s) set.add(s);
  }
  const re = /#([^#\s,，。;；、!！?？]+)/g;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    const s = m[1].replace(/["\\]/g, '').trim().slice(0, 20);
    if (s) set.add(s);
  }
  return [...set].slice(0, 12);
}

// ---------------- 公开接口 ----------------
app.get('/api/state', (req, res) => {
  res.json({ lockEnabled: lockEnabled(), locked: lockEnabled() && !isAuthed(req) });
});

app.post('/api/unlock', (req, res) => {
  if (!lockEnabled()) return res.json({ ok: true });
  const hash = getSetting('lock_hash', '');
  const salt = getSetting('lock_salt', '');
  const code = String((req.body || {}).passcode || '');
  if (crypto.scryptSync(code, salt, 32).toString('hex') !== hash) {
    return res.status(403).json({ error: '密码不正确' });
  }
  res.setHeader('Set-Cookie', `sg_auth=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  res.json({ ok: true });
});

app.post('/api/lockout', (req, res) => {
  res.setHeader('Set-Cookie', 'sg_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

// ---------------- 需要解锁的接口 ----------------
app.get('/api/settings', authGuard, (req, res) => {
  res.json({
    lockEnabled: lockEnabled(),
    wallpaperLight: getSetting('wallpaper_light', ''),
    wallpaperDark: getSetting('wallpaper_dark', ''),
    customWallpapers: JSON.parse(getSetting('custom_wallpapers', '[]'))
  });
});

app.put('/api/settings', authGuard, (req, res) => {
  const b = req.body || {};
  if ('wallpaperLight' in b) setSetting('wallpaper_light', b.wallpaperLight || '');
  if ('wallpaperDark' in b) setSetting('wallpaper_dark', b.wallpaperDark || '');
  res.json({ ok: true });
});

// 隐私锁：开启 / 关闭 / 修改
app.put('/api/lock', authGuard, (req, res) => {
  const b = req.body || {};
  const enable = !!b.enable;
  if (enable) {
    const code = String(b.passcode || '');
    if (!/^\d{4,8}$/.test(code)) return res.status(400).json({ error: '密码需要是 4-8 位数字' });
    if (lockEnabled()) {
      const salt = getSetting('lock_salt', '');
      if (crypto.scryptSync(String(b.oldPasscode || ''), salt, 32).toString('hex') !== getSetting('lock_hash', '')) {
        return res.status(403).json({ error: '当前密码不正确' });
      }
    }
    const salt = crypto.randomBytes(8).toString('hex');
    setSetting('lock_salt', salt);
    setSetting('lock_hash', hashPasscode(code, salt));
    res.setHeader('Set-Cookie', `sg_auth=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
  } else {
    if (lockEnabled()) {
      const salt = getSetting('lock_salt', '');
      if (crypto.scryptSync(String(b.passcode || ''), salt, 32).toString('hex') !== getSetting('lock_hash', '')) {
        return res.status(403).json({ error: '密码不正确，无法关闭隐私锁' });
      }
    }
    setSetting('lock_hash', null);
    setSetting('lock_salt', null);
  }
  res.json({ ok: true, lockEnabled: lockEnabled() });
});

// ---------------- 记录 CRUD ----------------
app.get('/api/entries', authGuard, (req, res) => {
  const { q, tag, date, year, month, sameDay, limit, offset } = req.query;
  const conds = [];
  const params = [];
  if (q) { conds.push('(text LIKE ? OR tags LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (tag) { conds.push('tags LIKE ?'); params.push(`%"${String(tag).replace(/["\\]/g, '')}"%`); }
  if (date && isValidDate(date)) { conds.push('date = ?'); params.push(date); }
  if (year && /^\d{4}$/.test(year)) {
    if (month && /^\d{1,2}$/.test(month)) {
      conds.push("date LIKE ?"); params.push(`${year}-${pad(Number(month))}-%`);
    } else { conds.push('date LIKE ?'); params.push(`${year}-%`); }
  }
  if (sameDay === '1' && /^\d{2}-\d{2}$/.test(String(req.query.mmdd || ''))) {
    conds.push("substr(date, 6) = ? AND substr(date, 1, 4) < ?"); params.push(String(req.query.mmdd), String(new Date().getFullYear()));
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const lim = Math.min(Math.max(parseInt(limit) || 24, 1), 100);
  const off = Math.max(parseInt(offset) || 0, 0);
  const rows = db.prepare(
    `SELECT * FROM entries ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, lim, off);
  const total = db.prepare(`SELECT COUNT(*) n FROM entries ${where}`).get(...params).n;
  res.json({ items: attachMedia(rows), total });
});

app.get('/api/entries/:id', authGuard, (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到这条记录' });
  res.json(attachMedia([row])[0]);
});

app.post('/api/entries', authGuard, upload.array('files', 15), (req, res) => {
  const text = String(req.body.text || '').trim();
  const mood = MOOD_KEYS.includes(req.body.mood) ? req.body.mood : '';
  const date = isValidDate(req.body.date) ? req.body.date : localToday();
  let tags = [];
  try { tags = JSON.parse(req.body.tags || '[]'); } catch { tags = []; }
  tags = extractTags(text, tags);
  const files = req.files || [];
  if (!text && files.length === 0) return res.status(400).json({ error: '写点什么，或者添加照片/视频吧' });
  if (files.length > 13) return res.status(400).json({ error: '一次最多 12 张照片和 1 个视频' });

  const info = db.prepare(
    'INSERT INTO entries(date, created_at, mood, text, tags) VALUES(?, ?, ?, ?, ?)'
  ).run(date, new Date().toISOString(), mood, text, JSON.stringify(tags));
  const entryId = info.lastInsertRowid;
  const ins = db.prepare('INSERT INTO media(entry_id, kind, file, sort) VALUES(?, ?, ?, ?)');
  files.forEach((f, i) => ins.run(entryId, f.mimetype.startsWith('video/') ? 'video' : 'image', f.filename, i));
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(entryId);
  res.json(attachMedia([row])[0]);
});

app.delete('/api/entries/:id', authGuard, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '未找到这条记录' });
  const media = db.prepare('SELECT file FROM media WHERE entry_id = ?').all(id);
  for (const m of media) {
    const p = path.join(MEDIA_DIR, m.file);
    fs.promises.unlink(p).catch(() => {});
  }
  db.prepare('DELETE FROM media WHERE entry_id = ?').run(id);
  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------------- 分享 ----------------
app.post('/api/entries/:id/share', authGuard, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, share_id FROM entries WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '未找到这条记录' });
  let shareId = row.share_id;
  if (!shareId) {
    shareId = crypto.randomBytes(9).toString('base64url');
    db.prepare('UPDATE entries SET share_id = ? WHERE id = ?').run(shareId, id);
  }
  res.json({ ok: true, share_id: shareId, url: `/s/${shareId}` });
});

app.delete('/api/entries/:id/share', authGuard, (req, res) => {
  db.prepare('UPDATE entries SET share_id = NULL WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// 公开：分享页数据
app.get('/api/share/:shareId', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE share_id = ?').get(req.params.shareId);
  if (!row) return res.status(404).json({ error: '分享不存在或已被取消' });
  res.json(attachMedia([row])[0]);
});

// ---------------- 首页聚合 ----------------
app.get('/api/stats', authGuard, (req, res) => {
  const today = localToday();
  const total = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT date) days, COALESCE(SUM(LENGTH(text)),0) words FROM entries').get();
  const photos = db.prepare("SELECT COUNT(*) n FROM media WHERE kind='image'").get().n;
  const videos = db.prepare("SELECT COUNT(*) n FROM media WHERE kind='video'").get().n;
  const todayCount = db.prepare('SELECT COUNT(*) n FROM entries WHERE date = ?').get(today).n;
  const dates = db.prepare('SELECT DISTINCT date FROM entries ORDER BY date DESC').all().map(r => r.date);
  let streak = 0;
  const d = new Date();
  if (dates.includes(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)) {
    for (;;) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (dates.includes(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
  } else {
    d.setDate(d.getDate() - 1);
    for (;;) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (dates.includes(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
  }
  res.json({ entries: total.n, days: total.days, words: total.words, photos, videos, todayCount, streak });
});

app.get('/api/thatday', authGuard, (req, res) => {
  const now = new Date();
  const mmdd = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const rows = db.prepare(
    'SELECT * FROM entries WHERE substr(date, 6) = ? AND substr(date, 1, 4) < ? ORDER BY date DESC'
  ).all(mmdd, String(now.getFullYear()));
  const items = attachMedia(rows);
  const groups = new Map();
  for (const it of items) {
    const y = it.date.slice(0, 4);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(it);
  }
  res.json({ mmdd, groups: [...groups.entries()].map(([year, list]) => ({ year, list })) });
});

app.get('/api/calendar', authGuard, (req, res) => {
  const y = String(Number(req.query.year) || new Date().getFullYear());
  const m = pad(Number(req.query.month) || (new Date().getMonth() + 1));
  const rows = db.prepare(`
    SELECT date, COUNT(*) AS n,
      (SELECT mood FROM entries e2 WHERE e2.date = e.date ORDER BY e2.id DESC LIMIT 1) AS mood
    FROM entries e WHERE date LIKE ? GROUP BY date ORDER BY date
  `).all(`${y}-${m}-%`);
  res.json({ year: Number(y), month: Number(m), days: rows });
});

app.get('/api/years', authGuard, (req, res) => {
  const rows = db.prepare("SELECT DISTINCT substr(date,1,4) y FROM entries ORDER BY y DESC").all();
  res.json({ years: rows.map(r => r.y) });
});

app.get('/api/tags', authGuard, (req, res) => {
  const rows = db.prepare("SELECT tags FROM entries WHERE tags != '[]'").all();
  const counter = new Map();
  for (const r of rows) {
    for (const t of JSON.parse(r.tags || '[]')) counter.set(t, (counter.get(t) || 0) + 1);
  }
  const list = [...counter.entries()].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
  res.json({ tags: list.slice(0, 30) });
});

app.get('/api/report', authGuard, (req, res) => {
  const y = /^\d{4}$/.test(String(req.query.year)) ? String(req.query.year) : String(new Date().getFullYear());
  const like = `${y}-%`;
  const total = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT date) days, COALESCE(SUM(LENGTH(text)),0) words FROM entries WHERE date LIKE ?').get(like);
  const photos = db.prepare("SELECT COUNT(*) n FROM media WHERE kind='image' AND entry_id IN (SELECT id FROM entries WHERE date LIKE ?)").get(like).n;
  const videos = db.prepare("SELECT COUNT(*) n FROM media WHERE kind='video' AND entry_id IN (SELECT id FROM entries WHERE date LIKE ?)").get(like).n;
  const moods = db.prepare('SELECT mood, COUNT(*) n FROM entries WHERE date LIKE ? GROUP BY mood').all(like);
  const monthly = db.prepare("SELECT substr(date,6,2) m, COUNT(*) n FROM entries WHERE date LIKE ? GROUP BY m").all(like);
  const tagRows = db.prepare("SELECT tags FROM entries WHERE date LIKE ? AND tags != '[]'").all(like);
  const counter = new Map();
  for (const r of tagRows) for (const t of JSON.parse(r.tags || '[]')) counter.set(t, (counter.get(t) || 0) + 1);
  const topTags = [...counter.entries()].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n).slice(0, 12);
  const dates = db.prepare("SELECT DISTINCT date FROM entries WHERE date LIKE ? ORDER BY date").all(like).map(r => r.date);
  let longest = 0, run = 0, prev = null;
  for (const dstr of dates) {
    if (prev && (new Date(dstr) - new Date(prev)) === 86400000) run++; else run = 1;
    longest = Math.max(longest, run);
    prev = dstr;
  }
  const first = dates[0] || null;
  res.json({
    year: y, entries: total.n, days: total.days, words: total.words, photos, videos,
    moods, monthly, topTags, longestStreak: longest, firstDate: first
  });
});

app.get('/api/export', authGuard, (req, res) => {
  const rows = db.prepare('SELECT * FROM entries ORDER BY date, id').all().map(r => ({
    date: r.date, created_at: r.created_at, mood: r.mood, text: r.text, tags: JSON.parse(r.tags || '[]')
  }));
  res.setHeader('Content-Disposition', `attachment; filename="shiguang-export-${localToday()}.json"`);
  res.json({ app: '拾光', exported_at: new Date().toISOString(), entries: rows });
});

// ---------------- 历史上的今天 ----------------
const FALLBACK_EVENTS = {
  '01-01': [[1912, '中华民国宣布成立，孙中山就任临时大总统'], [1995, '世界贸易组织正式运作'], [1999, '欧元在欧盟部分国家正式启动']],
  '01-27': [[1756, '奥地利作曲家莫扎特在萨尔茨堡出生']],
  '02-14': [[1946, '世界上第一台通用电子计算机 ENIAC 在美国宾夕法尼亚大学公开展示']],
  '02-19': [[1473, '提出日心说的天文学家哥白尼在波兰出生']],
  '03-12': [[1925, '孙中山在北京逝世']],
  '03-14': [[1879, '物理学家爱因斯坦在德国乌尔姆出生'], [1883, '卡尔·马克思在伦敦逝世']],
  '04-15': [[1912, '泰坦尼克号在北大西洋撞上冰山后沉没']],
  '04-24': [[1970, '中国第一颗人造地球卫星“东方红一号”发射成功']],
  '05-01': [[1889, '第二国际巴黎大会通过决议，确定5月1日为国际劳动节'], [1931, '美国帝国大厦在纽约落成']],
  '05-05': [[1818, '卡尔·马克思在德国特里尔出生']],
  '05-12': [[2008, '四川汶川发生8.0级特大地震，全国展开大规模抗震救灾']],
  '06-01': [[1949, '国际民主妇女联合会确定6月1日为国际儿童节']],
  '07-01': [[1921, '中国共产党第一次全国代表大会在上海开幕'], [1997, '中国政府对香港恢复行使主权']],
  '07-07': [[1937, '卢沟桥事变爆发，中国全民族抗战开始']],
  '07-20': [[1969, '美国阿波罗11号宇航员阿姆斯特朗踏上月球表面']],
  '07-28': [[1976, '河北唐山发生7.8级大地震']],
  '08-01': [[1927, '南昌起义打响，中国人民解放军的前身由此诞生']],
  '08-08': [[2008, '第29届夏季奥林匹克运动会在北京开幕']],
  '09-03': [[1945, '中国人民抗日战争暨世界反法西斯战争取得胜利']],
  '09-10': [[1985, '中国确定每年9月10日为教师节']],
  '09-18': [[1931, '九一八事变爆发，日本侵占中国东北']],
  '09-25': [[2012, '中国第一艘航空母舰辽宁舰正式交接入列']],
  '10-01': [[1949, '中华人民共和国开国大典在北京天安门广场隆重举行'], [1955, '新疆维吾尔自治区成立'], [1960, '尼日利亚脱离英国殖民统治宣布独立']],
  '10-16': [[1964, '中国第一颗原子弹在罗布泊爆炸成功']],
  '10-24': [[1945, '联合国正式成立'], [1929, '纽约华尔街股市崩盘，史称“黑色星期四”'], [2007, '中国首颗绕月人造卫星嫦娥一号发射成功']],
  '10-28': [[1886, '自由女神像在纽约港落成揭幕'], [1918, '捷克斯洛伐克宣布独立，奥匈帝国走向解体'], [1962, '苏联宣布撤走部署在古巴的导弹，导弹危机落幕']],
  '11-09': [[1989, '柏林墙开放边境，东西德民众涌上街头']],
  '11-12': [[1866, '孙中山在广东香山出生']],
  '12-13': [[1937, '南京大屠杀开始，后成为中国国家公祭日']],
  '12-26': [[1893, '毛泽东在湖南湘潭韶山冲出生']]
};

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
}

app.get('/api/onthisday', authGuard, async (req, res) => {
  const mmdd = /^\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : localToday().slice(5);
  const now = new Date();
  const cacheKey = `${now.getFullYear()}-${mmdd}`;
  const cached = db.prepare('SELECT json, fetched_at FROM history_cache WHERE date = ?').get(cacheKey);
  if (cached) {
    const age = now.getTime() - cached.fetched_at;
    const parsed = JSON.parse(cached.json);
    // 维基数据缓存 12 小时；断网回退数据缓存 1 小时（避免每次请求都白等超时）
    const ttl = parsed.source === 'wikipedia' ? 12 * 3600 * 1000 : 3600 * 1000;
    if (age < ttl) return res.json({ ...parsed, mmdd });
  }
  try {
    const [m, d] = mmdd.split('-');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/zh/onthisday/selected/${m}/${d}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('bad status ' + r.status);
    const data = await r.json();
    const events = (data.selected || [])
      .map(e => ({ year: e.year, text: stripHtml(e.text) }))
      .filter(e => e.text)
      .sort((a, b) => a.year - b.year)
      .slice(0, 9);
    if (!events.length) throw new Error('empty');
    db.prepare('INSERT INTO history_cache(date, json, fetched_at) VALUES(?, ?, ?) ON CONFLICT(date) DO UPDATE SET json=excluded.json, fetched_at=excluded.fetched_at')
      .run(cacheKey, JSON.stringify({ source: 'wikipedia', events }), now.getTime());
    return res.json({ source: 'wikipedia', mmdd, events });
  } catch (err) {
    const fb = (FALLBACK_EVENTS[mmdd] || []).map(([year, text]) => ({ year, text }));
    if (fb.length) {
      db.prepare('INSERT INTO history_cache(date, json, fetched_at) VALUES(?, ?, ?) ON CONFLICT(date) DO UPDATE SET json=excluded.json, fetched_at=excluded.fetched_at')
        .run(cacheKey, JSON.stringify({ source: 'builtin', events: fb }), now.getTime());
      return res.json({ source: 'builtin', mmdd, events: fb });
    }
    return res.json({ source: 'none', mmdd, events: [] });
  }
});

// ---------------- 壁纸 ----------------
const BUILTIN_WALLPAPERS = [
  { id: 'dawn', name: '晨曦', mode: 'light', url: '/wallpapers/dawn.svg' },
  { id: 'mint', name: '薄荷', mode: 'light', url: '/wallpapers/mint.svg' },
  { id: 'sakura', name: '樱云', mode: 'light', url: '/wallpapers/sakura.svg' },
  { id: 'meadow', name: '晴野', mode: 'light', url: '/wallpapers/meadow.svg' },
  { id: 'inknight', name: '墨夜', mode: 'dark', url: '/wallpapers/inknight.svg' },
  { id: 'aurora', name: '极光', mode: 'dark', url: '/wallpapers/aurora.svg' },
  { id: 'deepsea', name: '深海', mode: 'dark', url: '/wallpapers/deepsea.svg' },
  { id: 'starry', name: '星野', mode: 'dark', url: '/wallpapers/starry.svg' }
];

function wallpaperList() {
  return { builtin: BUILTIN_WALLPAPERS, custom: JSON.parse(getSetting('custom_wallpapers', '[]')) };
}
function resolveWallpaper(id) {
  if (!id) return null;
  if (id.startsWith('c:')) {
    const list = JSON.parse(getSetting('custom_wallpapers', '[]'));
    const item = list.find(w => w.id === id);
    return item ? item.url : null;
  }
  const item = BUILTIN_WALLPAPERS.find(w => w.id === id);
  return item ? item.url : null;
}

app.get('/api/wallpapers', authGuard, (req, res) => res.json(wallpaperList()));

app.post('/api/wallpapers', authGuard, upload.single('wallpaper'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择一张图片' });
  const list = JSON.parse(getSetting('custom_wallpapers', '[]'));
  const item = { id: 'c:' + path.basename(req.file.filename), name: '我的壁纸 ' + (list.length + 1), url: '/uploads/wallpapers/' + req.file.filename };
  list.push(item);
  setSetting('custom_wallpapers', JSON.stringify(list));
  res.json({ ok: true, item });
});

app.delete('/api/wallpapers/:id', authGuard, (req, res) => {
  const id = req.params.id;
  const list = JSON.parse(getSetting('custom_wallpapers', '[]'));
  const item = list.find(w => w.id === id);
  if (!item) return res.status(404).json({ error: '未找到壁纸' });
  fs.promises.unlink(path.join(WALLPAPER_UPLOAD_DIR, path.basename(item.url))).catch(() => {});
  const next = list.filter(w => w.id !== id);
  setSetting('custom_wallpapers', JSON.stringify(next));
  if (getSetting('wallpaper_light', '') === id) setSetting('wallpaper_light', '');
  if (getSetting('wallpaper_dark', '') === id) setSetting('wallpaper_dark', '');
  res.json({ ok: true });
});

app.get('/api/wallpaper/resolve', authGuard, (req, res) => {
  res.json({ url: resolveWallpaper(String(req.query.id || '')) });
});

// ---------------- 静态资源 ----------------
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/s/:shareId', (req, res) => {
  res.sendFile('share.html', { root: path.join(__dirname, 'public') });
});

app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// multer 等错误兜底
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || '服务器开小差了' });
});

const PORT = Number(process.env.PORT) || 3000;
function openBrowser(url) {
  if (process.env.SG_NO_OPEN === '1') return;
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* 打不开浏览器不影响服务 */ }
}
function start(port) {
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  拾光 · 每日心情手账 已启动');
    console.log(`  请用浏览器打开 →  ${url}`);
    console.log('  关闭本窗口或按 Ctrl+C 即可停止');
    console.log('');
    openBrowser(url);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 3020) {
      console.log(`端口 ${port} 被占用，改用 ${port + 1} ...`);
      start(port + 1);
    } else {
      console.error('启动失败：', err.message);
      process.exit(1);
    }
  });
}
start(PORT);
