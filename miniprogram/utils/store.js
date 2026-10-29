// ============ 拾光 · 本地数据层 ============
// 全部数据保存在小程序本地：Storage 存结构化数据，媒体文件拷贝到用户目录持久化。
const FS = wx.getFileSystemManager();
const MEDIA_DIR = `${wx.env.USER_DATA_PATH}/sg-media`;

// ---------- 媒体文件 ----------
function ensureMediaDir() {
  try { FS.accessSync(MEDIA_DIR); } catch (e) { FS.mkdirSync(MEDIA_DIR, true); }
}
function extOf(p) {
  const m = /\.(\w+)$/.exec(p || '');
  return m ? m[1].toLowerCase() : 'jpg';
}
function saveMediaFile(tempPath) {
  ensureMediaDir();
  const name = `m_${Date.now()}_${Math.floor(Math.random() * 1e4)}.${extOf(tempPath)}`;
  try {
    FS.copyFileSync(tempPath, `${MEDIA_DIR}/${name}`);
    return name;
  } catch (e) { return null; }
}
function mediaPath(name) { return `${MEDIA_DIR}/${name}`; }
function removeMediaFile(name) {
  if (!name) return;
  try { FS.unlinkSync(mediaPath(name)); } catch (e) { /* 忽略 */ }
}

// ---------- 记录 CRUD ----------
function readEntries() {
  try { return wx.getStorageSync('sg_entries') || []; } catch (e) { return []; }
}
function writeEntries(list) { wx.setStorageSync('sg_entries', list); }

function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function extractTags(text, incoming) {
  const set = new Set();
  (Array.isArray(incoming) ? incoming : []).forEach(t => {
    const s = String(t || '').replace(/["\\]/g, '').trim().slice(0, 20);
    if (s) set.add(s);
  });
  const re = /#([^#\s,，。;；、!！?？]+)/g;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    const s = m[1].replace(/["\\]/g, '').trim().slice(0, 20);
    if (s) set.add(s);
  }
  return [...set].slice(0, 12);
}

// media 项：{ id, type: 'image'|'video', file, poster, w, h }
// 新增项传入 { type, tempPath, posterTempPath, w, h }
function persistMedia(items) {
  ensureMediaDir();
  return items.map(it => ({
    id: Date.now() + Math.floor(Math.random() * 1e6) + Math.floor(Math.random() * 1e3),
    type: it.type,
    file: saveMediaFile(it.tempPath),
    poster: it.posterTempPath ? saveMediaFile(it.posterTempPath) : null,
    w: it.w || 0,
    h: it.h || 0
  })).filter(it => it.file);
}

function addEntry({ date, mood, text, media }) {
  const list = readEntries();
  const entry = {
    id: Date.now(),
    date: date || todayStr(),
    createdAt: Date.now(),
    mood: mood || '',
    text: (text || '').trim(),
    tags: extractTags(text),
    media: persistMedia(media || [])
  };
  if (!entry.text && entry.media.length === 0) return null;
  list.push(entry);
  writeEntries(list);
  return entry;
}

function updateEntry(id, { date, mood, text, keepIds, newMedia }) {
  const list = readEntries();
  const idx = list.findIndex(e => e.id === id);
  if (idx < 0) return null;
  const entry = list[idx];
  const keep = Array.isArray(keepIds) ? keepIds : entry.media.map(m => m.id);
  entry.media.forEach(m => {
    if (!keep.includes(m.id)) { removeMediaFile(m.file); removeMediaFile(m.poster); }
  });
  const kept = entry.media.filter(m => keep.includes(m.id));
  const added = persistMedia(newMedia || []);
  list[idx] = {
    ...entry,
    date: date || entry.date,
    mood: mood !== undefined ? mood : entry.mood,
    text: text !== undefined ? String(text).trim() : entry.text,
    tags: extractTags(text !== undefined ? text : entry.text),
    media: kept.concat(added)
  };
  writeEntries(list);
  return list[idx];
}

function removeEntry(id) {
  const list = readEntries();
  const entry = list.find(e => e.id === id);
  if (!entry) return false;
  entry.media.forEach(m => { removeMediaFile(m.file); removeMediaFile(m.poster); });
  writeEntries(list.filter(e => e.id !== id));
  return true;
}

function getEntry(id) { return readEntries().find(e => e.id === id) || null; }

// 给记录补充展示字段（日期文案、心情 emoji、媒体绝对路径）
function decorate(e) {
  const { MOODS, fmtMD } = require('./util');
  const year = e.date.slice(0, 4);
  const cur = String(new Date().getFullYear());
  const media = (e.media || []).map(m => ({
    id: m.id,
    type: m.type,
    isVideo: m.type === 'video',
    path: m.type === 'image' ? mediaPath(m.file) : (m.poster ? mediaPath(m.poster) : ''),
    videoPath: m.type === 'video' ? mediaPath(m.file) : '',
    w: m.w, h: m.h
  }));
  return {
    ...e,
    dateText: `${fmtMD(e.date)}${year !== cur ? ' · ' + year : ''}`,
    fullDateText: e.date,
    weekday: require('./util').weekdayCN(e.date),
    moodEmoji: MOODS[e.mood] ? MOODS[e.mood].emoji : '',
    moodLabel: MOODS[e.mood] ? MOODS[e.mood].label : '',
    moodColor: MOODS[e.mood] ? MOODS[e.mood].color : '',
    media
  };
}

function listEntries(filter = {}) {
  let list = readEntries();
  if (filter.date) list = list.filter(e => e.date === filter.date);
  if (filter.tag) list = list.filter(e => e.tags.includes(filter.tag));
  if (filter.mmdd) list = list.filter(e => e.date.slice(5) === filter.mmdd && e.date.slice(0, 4) < String(new Date().getFullYear()));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter(e => e.text.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)));
  }
  list.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1)));
  return list;
}

// ---------- 统计 ----------
function stats() {
  const list = readEntries();
  const days = new Set(list.map(e => e.date));
  const words = list.reduce((s, e) => s + e.text.length, 0);
  let photos = 0, videos = 0;
  list.forEach(e => e.media.forEach(m => (m.type === 'image' ? photos++ : videos++)));
  const today = todayStr();
  const dates = [...days].sort();
  let streak = 0;
  const d = new Date();
  if (!dates.includes(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (dates.includes(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return {
    entries: list.length,
    days: days.size,
    words,
    photos,
    videos,
    todayCount: list.filter(e => e.date === today).length,
    streak
  };
}

function calendarMonth(y, m) {
  const mark = `${y}-${pad2(m)}-`;
  const map = {};
  readEntries().forEach(e => {
    if (e.date.startsWith(mark)) {
      if (!map[e.date]) map[e.date] = { n: 0, mood: e.mood };
      map[e.date].n++;
      map[e.date].mood = e.mood || map[e.date].mood;
    }
  });
  return map;
}

function thatday() {
  const now = new Date();
  const mmdd = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const groups = {};
  readEntries().forEach(e => {
    if (e.date.slice(5) === mmdd && e.date.slice(0, 4) < String(now.getFullYear())) {
      (groups[e.date.slice(0, 4)] = groups[e.date.slice(0, 4)] || []).push(e);
    }
  });
  return Object.keys(groups).sort((a, b) => b - a).map(year => ({ year, list: groups[year] }));
}

function report(year) {
  const mark = `${year}-`;
  const list = readEntries().filter(e => e.date.startsWith(mark));
  const moodCount = {};
  const monthCount = {};
  const tagCount = {};
  let words = 0, photos = 0, videos = 0;
  const dates = new Set();
  list.forEach(e => {
    dates.add(e.date);
    words += e.text.length;
    if (e.mood) moodCount[e.mood] = (moodCount[e.mood] || 0) + 1;
    monthCount[Number(e.date.slice(5, 7))] = (monthCount[Number(e.date.slice(5, 7))] || 0) + 1;
    e.tags.forEach(t => (tagCount[t] = (tagCount[t] || 0) + 1));
    e.media.forEach(m => (m.type === 'image' ? photos++ : videos++));
  });
  const sorted = [...dates].sort();
  let longest = 0, run = 0, prev = null;
  sorted.forEach(ds => {
    run = prev && (new Date(ds) - new Date(prev)) === 86400000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = ds;
  });
  const topTags = Object.entries(tagCount).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n).slice(0, 12);
  return {
    entries: list.length,
    days: dates.size,
    words, photos, videos,
    moods: moodCount,
    monthly: monthCount,
    topTags,
    longestStreak: longest,
    firstDate: sorted[0] || null
  };
}

function allTags() {
  const counter = {};
  readEntries().forEach(e => e.tags.forEach(t => (counter[t] = (counter[t] || 0) + 1)));
  return Object.entries(counter).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n).slice(0, 30);
}

function years() {
  const set = new Set(readEntries().map(e => e.date.slice(0, 4)));
  set.add(String(new Date().getFullYear()));
  return [...set].sort((a, b) => b - a);
}

// ---------- 设置 & 隐私锁 ----------
function getSettings() {
  try { return Object.assign({ theme: 'auto', lockEnabled: false, lockHash: '', lockSalt: '', bgImage: '' }, wx.getStorageSync('sg_settings') || {}); }
  catch (e) { return { theme: 'auto', lockEnabled: false, lockHash: '', lockSalt: '', bgImage: '' }; }
}
function setSettings(patch) {
  wx.setStorageSync('sg_settings', Object.assign(getSettings(), patch));
}
// 轻量散列（个人隐私锁用途，非密码学级别）
function hashPass(code, salt) {
  const str = `${salt}::${code}::shiguang`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
function setLock(passcode) {
  const salt = String(Math.floor(Math.random() * 1e9));
  setSettings({ lockEnabled: true, lockSalt: salt, lockHash: hashPass(passcode, salt) });
}
function checkLock(passcode) {
  const s = getSettings();
  return s.lockEnabled && hashPass(passcode, s.lockSalt) === s.lockHash;
}
function clearLock() {
  setSettings({ lockEnabled: false, lockHash: '', lockSalt: '' });
}

// ---------- 导出 / 清空 ----------
function exportJSON() {
  const rows = readEntries().map(e => ({
    date: e.date, createdAt: new Date(e.createdAt).toISOString(), mood: e.mood, text: e.text, tags: e.tags
  }));
  const path = `${wx.env.USER_DATA_PATH}/shiguang-export-${todayStr()}.json`;
  FS.writeFileSync(path, JSON.stringify({ app: '拾光', exported_at: new Date().toISOString(), entries: rows }, null, 2), 'utf8');
  return path;
}
function clearAll() {
  readEntries().forEach(e => e.media.forEach(m => { removeMediaFile(m.file); removeMediaFile(m.poster); }));
  wx.removeStorageSync('sg_entries');
}

module.exports = {
  mediaPath, addEntry, updateEntry, removeEntry, getEntry, listEntries, decorate,
  stats, calendarMonth, thatday, report, allTags, years,
  getSettings, setSettings, setLock, checkLock, clearLock,
  exportJSON, clearAll, todayStr, saveMediaFile
};
