/* ============ 拾光 · 前端逻辑 ============ */
(() => {
'use strict';

// ---------- 小工具 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad2 = n => String(n).padStart(2, '0');
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtMD(ds) { const p = ds.split('-'); return `${Number(p[1])}月${Number(p[2])}日`; }
function fmtFullCN(ds) { const p = ds.split('-'); return `${p[0]}年${Number(p[1])}月${Number(p[2])}日`; }
function yearSuffix(ds) { return ds.slice(0, 4) !== String(new Date().getFullYear()) ? ` · ${ds.slice(0, 4)}` : ''; }
function fmtTime(iso) { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function weekdayCN(ds) { return '星期' + '日一二三四五六'.charAt(new Date(ds + 'T12:00:00').getDay()); }
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  if (res.status === 401) { showLockScreen(); throw new Error('已锁定'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败，请重试');
  return data;
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

function openModal({ title, sub, bodyHTML = '', okText = '确定', cancelText = '取消', danger = false, onOk }) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal fade-in" role="dialog" aria-modal="true">
    <h3>${esc(title)}</h3>
    ${sub ? `<p class="modal-sub">${esc(sub)}</p>` : ''}
    <div class="modal-body">${bodyHTML}</div>
    <div class="modal-actions">
      <button class="btn" data-cancel type="button">${esc(cancelText)}</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok type="button">${esc(okText)}</button>
    </div>
  </div>`;
  $('#modalRoot').appendChild(mask);
  const close = () => mask.remove();
  mask.addEventListener('click', e => { if (e.target === mask || e.target.closest('[data-cancel]')) close(); });
  mask.querySelector('[data-ok]').addEventListener('click', async () => {
    try {
      await onOk?.(mask);
      close();
    } catch (err) { toast(err.message || '操作失败'); }
  });
  mask.querySelector('input')?.focus();
  return { close };
}

// ---------- 图标 ----------
const S = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  home: S('<path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 9.8V20h13V9.8"/>'),
  book: S('<path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M9 3.5v17"/>'),
  calendar: S('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  chart: S('<path d="M4 20h16"/><path d="M7 20v-6M12 20V7M17 20v-9"/>'),
  sliders: S('<path d="M4 8h6.6M15.4 8H20"/><circle cx="13" cy="8" r="2.2"/><path d="M4 16h2.6M11.4 16H20"/><circle cx="9" cy="16" r="2.2"/>'),
  search: S('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  moon: S('<path d="M20 13.5A8 8 0 1 1 10.5 4a6.6 6.6 0 0 0 9.5 9.5z"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'),
  lock: S('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  camera: S('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.2"/>'),
  video: S('<rect x="3.5" y="6" width="12.5" height="12" rx="2.5"/><path d="M16 10.5 20.5 8v8L16 13.5"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  x: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevronL: S('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  chevronR: S('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  refresh: S('<path d="M20.5 11A8.5 8.5 0 1 0 19 16.8"/><path d="M21 4v5.5h-5.5"/>'),
  share: S('<path d="M12 14.5V4"/><path d="M8.5 7.5 12 4l3.5 3.5"/><path d="M7 11H5.8A1.8 1.8 0 0 0 4 12.8v6.4A1.8 1.8 0 0 0 5.8 21h12.4a1.8 1.8 0 0 0 1.8-1.8v-6.4A1.8 1.8 0 0 0 18.2 11H17"/>'),
  link: S('<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7l-1.2 1.2"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.2-1.2"/>'),
  trash: S('<path d="M4.5 7h15"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/>'),
  download: S('<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  check: S('<path d="M5 12.5 10 17.5 19 7"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  image: S('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17.5 10 12l3.5 3.5L17 12l2.5 2.5"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  flame: S('<path d="M12 3.5s5.5 4.3 5.5 9a5.5 5.5 0 0 1-11 0c0-1.9.9-3.5 1.9-4.9.5 1 1.3 1.8 2.3 2.3C10.3 7.9 11 5.4 12 3.5z"/>')
};
function icon(name) { return ICONS[name] || ''; }
function mountIcons(root) {
  $$('i[data-icon]', root || document).forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}

// ---------- 常量 ----------
const MOODS = {
  happy: { emoji: '😊', label: '开心', color: '#ff9f0a' },
  love: { emoji: '🥰', label: '幸福', color: '#ff6482' },
  calm: { emoji: '😌', label: '平静', color: '#0a84ff' },
  tired: { emoji: '😪', label: '疲惫', color: '#bf5af2' },
  sad: { emoji: '😢', label: '低落', color: '#5e5ce6' },
  angry: { emoji: '😤', label: '烦躁', color: '#ff453a' }
};
const QUOTES = [
  { t: '生活中只有一种英雄主义，就是在认清生活的真相之后依然热爱生活。', a: '罗曼·罗兰' },
  { t: '你若爱，生活哪里都可爱。你若恨，生活哪里都可恨。', a: '丰子恺' },
  { t: '一定要爱着点什么，恰似草木对光阴的钟情。', a: '汪曾祺' },
  { t: '世界以痛吻我，要我报之以歌。', a: '泰戈尔' },
  { t: '人生如逆旅，我亦是行人。', a: '苏轼' },
  { t: '从前的日色变得慢，车、马、邮件都慢，一生只够爱一个人。', a: '木心' },
  { t: '对未来的真正慷慨，是把一切献给现在。', a: '加缪' },
  { t: '凡是过往，皆为序章。', a: '莎士比亚' },
  { t: '愿你一生温暖纯良，不舍爱与自由。', a: '高晓松' },
  { t: '人间烟火气，最抚凡人心。', a: '《一日禅》' },
  { t: '热爱可抵岁月漫长。', a: '佚名' },
  { t: '慢慢来，比较快。', a: '佚名' },
  { t: '生活不是等待暴风雨过去，而是学会在雨中翩翩起舞。', a: '维维安·格林' },
  { t: '把每一个平凡的日子过好，就是不平凡。', a: '佚名' },
  { t: '日子是过以后，不是过从前。', a: '刘震云' },
  { t: '我们终此一生，就是要摆脱他人的期待，找到真正的自己。', a: '《无声告白》' },
  { t: '月光还是少年的月光，九州一色还是李白的霜。', a: '余光中' },
  { t: '不必行色匆匆，不必光芒四射，只需做你自己。', a: '弗吉尼亚·伍尔夫' },
  { t: '生活的理想，就是为了理想的生活。', a: '张闻天' },
  { t: '今天所有的混乱与芜杂，都是求进步的必经过程。', a: '胡适' }
];

const APP = { settings: null, wallpapers: { builtin: [], custom: [] }, booted: false };

// ---------- 主题 & 壁纸 ----------
function themePref() { return localStorage.getItem('sg_theme') || 'auto'; }
function isDark() {
  const p = themePref();
  return p === 'dark' || (p === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function wallpaperById(id) {
  if (!id) return null;
  const { builtin, custom } = APP.wallpapers;
  return custom.find(w => w.id === id) || builtin.find(w => w.id === id) || null;
}
function applyWallpaper() {
  const id = isDark() ? APP.settings?.wallpaperDark : APP.settings?.wallpaperLight;
  const wp = wallpaperById(id);
  const layer = $('#wallpaperLayer');
  if (wp) {
    layer.style.backgroundImage = `url("${wp.url}")`;
    document.body.classList.add('has-wallpaper');
  } else {
    layer.style.backgroundImage = 'none';
    document.body.classList.remove('has-wallpaper');
  }
}
function applyTheme() {
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
  $('#btnTheme').innerHTML = icon(isDark() ? 'sun' : 'moon');
  applyWallpaper();
  $$('#view .seg[data-seg="theme"] button').forEach(b => b.classList.toggle('on', b.dataset.v === themePref()));
}

// ---------- 锁屏 ----------
function showLockScreen() {
  $('#lockScreen').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#lockErr').hidden = true;
  $('#lockPass').value = '';
  setTimeout(() => $('#lockPass').focus(), 60);
}
async function tryUnlock() {
  const btn = $('#btnUnlock');
  btn.disabled = true;
  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: $('#lockPass').value })
    });
    if (!res.ok) throw new Error('密码不正确');
    $('#lockScreen').hidden = true;
    document.body.style.overflow = '';
    APP.booted = false;
    await boot();
    toast('欢迎回来 👋');
  } catch (err) {
    const card = $('.lock-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    $('#lockErr').hidden = false;
  } finally { btn.disabled = false; }
}

// ---------- 路由 ----------
const routes = {};
let currentView = 'home';
function route() {
  if (!APP.booted) return;
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, qs] = raw.split('?');
  const view = routes[name] ? name : 'home';
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  $$('#mainNav a').forEach(a => a.classList.toggle('active', a.dataset.nav === view));
  const v = $('#view');
  v.innerHTML = '';
  currentView = view;
  Promise.resolve(routes[view](v, query)).catch(err => {
    if (err.message === '已锁定') return;
    v.innerHTML = `<div class="empty-tip"><span class="big">😵</span>${esc(err.message || '加载失败，请刷新重试')}</div>`;
  });
  window.scrollTo({ top: 0 });
}

// ---------- 记录卡片 ----------
function skeletonCards(n = 6) {
  return Array.from({ length: n }, () =>
    `<div class="ecard skel-card" aria-hidden="true"><span class="skel skel-media"></span><span class="skel skel-line"></span><span class="skel skel-line"></span><span class="skel skel-line w60"></span></div>`
  ).join('');
}

function entryCardHTML(e) {
  const m = MOODS[e.mood];
  let mediaHTML = '';
  const cover = e.media[0];
  if (cover) {
    const inner = cover.kind === 'image'
      ? `<img src="${cover.url}" alt="" loading="lazy" decoding="async">`
      : `<video src="${cover.url}#t=0.1" preload="metadata" muted playsinline></video><span class="vplay"><span>${icon('play')}</span></span>`;
    mediaHTML = `<span class="ecover">${inner}${e.media.length > 1 ? `<span class="ecount">${e.media.length} 个文件</span>` : ''}</span>`;
  }
  return `<article class="ecard fade-in" data-id="${e.id}" role="button" tabindex="0" aria-label="打开这条记录">
    ${mediaHTML}
    <div class="ebody">
      <div class="emeta">${m ? `<span class="emood">${m.emoji}</span>` : ''}<span>${fmtMD(e.date)}${yearSuffix(e.date)} · ${fmtTime(e.created_at)}</span></div>
      ${e.text ? `<p class="etext">${esc(e.text)}</p>` : ''}
      ${e.tags.length ? `<div class="etags">${e.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
  </article>`;
}
function emptyTip(text) {
  return `<div class="empty-tip"><span class="big">🌤️</span>${esc(text)}</div>`;
}
function bindCardClick(container) {
  container.addEventListener('click', e => {
    const card = e.target.closest('.ecard');
    if (card) openDetail(Number(card.dataset.id));
  });
  container.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('ecard')) {
      e.preventDefault();
      openDetail(Number(e.target.dataset.id));
    }
  });
}

// ---------- 首页 ----------
routes.home = async function (view) {
  view.innerHTML = `
  <div class="hero">
    <p class="hero-eyebrow">${greeting()} · 欢迎回到拾光</p>
    <h1>今天也要，<br><span class="grad">好好生活。</span></h1>
    <p class="hero-sub" id="homeSub">${fmtFullCN(todayStr())} · ${weekdayCN(todayStr())}</p>
  </div>
  <section class="home-grid fade-in">
    <div class="card quote-card">
      <div class="quote-head">
        <span class="badge-glass">今日一言</span>
        <button class="btn-glass" id="quoteShuffle" type="button">${icon('refresh')}换一句</button>
      </div>
      <blockquote id="quoteText"></blockquote>
      <p class="quote-author" id="quoteAuthor"></p>
    </div>
    <div class="stat-stack" id="statStack"></div>
  </section>
  <section class="card composer fade-in" id="composer"></section>
  <section id="thatdaySec" class="fade-in" style="margin-bottom:46px"></section>
  <section class="fade-in" style="margin-bottom:46px">
    <h2 class="section-title">最近的记录<a class="title-more" href="#/notes">查看全部 →</a></h2>
    <div class="masonry" id="recentGrid"></div>
  </section>
  <section class="fade-in">
    <h2 class="section-title">历史上的今天</h2>
    <div class="hist-grid" id="histGrid"></div>
    <p class="hist-src" id="histSrc"></p>
  </section>`;

  // 今日一言：按日期轮换
  const dayIdx = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5) % QUOTES.length;
  let qi = dayIdx;
  const renderQuote = () => {
    $('#quoteText').textContent = QUOTES[qi].t;
    $('#quoteAuthor').textContent = `—— ${QUOTES[qi].a}`;
  };
  renderQuote();
  $('#quoteShuffle').addEventListener('click', () => {
    const qb = $('#quoteText'), qa = $('#quoteAuthor');
    qb.style.opacity = '0';
    qa.style.opacity = '0';
    setTimeout(() => {
      qi = (qi + 1) % QUOTES.length;
      renderQuote();
      qb.style.opacity = '1';
      qa.style.opacity = '1';
    }, 180);
  });

  renderComposer($('#composer'));
  // 先铺骨架屏，数据到了再替换
  $('#recentGrid').innerHTML = skeletonCards();

  const [stats, recent, thatday, hist] = await Promise.all([
    api('/api/stats'),
    api('/api/entries?limit=8'),
    api('/api/thatday').catch(() => ({ groups: [] })),
    api('/api/onthisday').catch(() => ({ events: [], source: 'none' }))
  ]);

  renderStats(stats);
  const grid = $('#recentGrid');
  grid.innerHTML = recent.items.length ? recent.items.map(entryCardHTML).join('') : emptyTip('还没有记录，从上面的「记录今天」开始吧 ✍️');
  bindCardClick(grid);

  if (stats.todayCount === 0) {
    $('#homeSub').innerHTML = `${fmtFullCN(todayStr())} · ${weekdayCN(todayStr())} · <span style="color:var(--blue)">今天还没有记录，写点什么吧</span>`;
  }

  // 那年今天
  const tsec = $('#thatdaySec');
  if (thatday.groups.length) {
    tsec.innerHTML = `<h2 class="section-title">那年今天 · ${thatday.mmdd.replace('-', '月') + '日'}</h2>
      <div class="year-scroll">${thatday.groups.map(g => `
        <div class="card year-card">
          <h4>${g.year} 年的今天</h4>
          ${g.list.slice(0, 3).map(e => `
            <div class="td-item" data-id="${e.id}" role="button" tabindex="0" style="cursor:pointer;margin-bottom:10px">
              <div class="emeta">${MOODS[e.mood] ? `<span class="emood">${MOODS[e.mood].emoji}</span>` : ''}<span>${fmtMD(e.date)} · ${fmtTime(e.created_at)}</span></div>
              ${e.text ? `<p class="etext" style="-webkit-line-clamp:3">${esc(e.text)}</p>` : '<p class="etext" style="color:var(--sub)">(照片/视频)</p>'}
            </div>`).join('')}
          ${g.list.length > 3 ? `<p style="color:var(--sub);font-size:13px">还有 ${g.list.length - 3} 条…</p>` : ''}
        </div>`).join('')}</div>`;
    $$('.td-item', tsec).forEach(el => {
      el.addEventListener('click', () => openDetail(Number(el.dataset.id)));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') openDetail(Number(el.dataset.id)); });
    });
  }

  // 历史上的今天
  const hg = $('#histGrid');
  if (hist.events.length) {
    hg.innerHTML = hist.events.map(ev => `
      <div class="hist-item"><div class="hyear">${ev.year}</div><p>${esc(ev.text)}</p></div>`).join('');
    $('#histSrc').textContent = hist.source === 'wikipedia' ? '数据来源：维基百科「历史上的今天」· 每天自动更新' : '当前离线或网络受限，展示的是内置事件数据';
  } else {
    hg.innerHTML = `<div class="hist-item"><div class="hyear">🕰️</div><p>今天的历史事件暂时没有获取到，明天再来看看。</p></div>`;
  }
};

function renderStats(stats) {
  const el = $('#statStack');
  if (!el) return;
  el.innerHTML = `
    <div class="card stat-mini"><span class="ico bg-orange">${icon('flame')}</span><div><b>${stats.streak}<span style="font-size:13px;font-weight:600"> 天</span></b><span>连续记录中</span></div></div>
    <div class="card stat-mini"><span class="ico bg-pink">${icon('book')}</span><div><b>${stats.entries}</b><span>累计 ${stats.entries} 篇 · 覆盖 ${stats.days} 天</span></div></div>
    <div class="card stat-mini"><span class="ico bg-blue">${icon('image')}</span><div><b>${stats.photos + stats.videos}</b><span>照片 ${stats.photos} 张 · 视频 ${stats.videos} 个</span></div></div>`;
}

// ---------- 发布模块 ----------
function renderComposer(container) {
  const files = [];
  let picked = '';
  container.innerHTML = `
    <div class="composer-top">
      <h2 class="composer-q">记录今天</h2>
      <input type="date" id="cDate" class="date-input" value="${todayStr()}" max="${todayStr()}" aria-label="记录日期">
    </div>
    <div class="moods" id="cMoods" role="group" aria-label="选择心情">
      ${Object.entries(MOODS).map(([k, m]) => `<button type="button" class="mood-pill" data-mood="${k}" aria-pressed="false">${m.emoji} ${m.label}</button>`).join('')}
    </div>
    <textarea id="cText" maxlength="5000" rows="4" aria-label="正文" placeholder="此刻的心情、发生的事、想说的话……&#10;小技巧：正文里写 #标签，发布后自动归类"></textarea>
    <div class="thumbrow" id="cThumbs"></div>
    <div class="upload-progress" id="cProg" hidden><div></div></div>
    <p class="form-err" id="cErr" hidden></p>
    <div class="composer-bar">
      <div class="attach">
        <button type="button" class="btn-sec" id="cImgBtn">${icon('camera')}照片</button>
        <button type="button" class="btn-sec" id="cVidBtn">${icon('video')}视频</button>
        <input type="file" id="cImgInput" accept="image/*" multiple hidden>
        <input type="file" id="cVidInput" accept="video/*" hidden>
        <span class="attach-hint">照片会自动压缩 · 支持一个视频</span>
      </div>
      <div class="composer-actions">
        <span class="charcount" id="cCount">0 字</span>
        <button type="button" class="btn btn-primary" id="cPublish">${icon('check')}发布</button>
      </div>
    </div>`;

  const ta = $('#cText');
  const autogrow = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 340) + 'px';
  };
  ta.addEventListener('input', () => { $('#cCount').textContent = `${ta.value.length} 字`; autogrow(); });
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('#cPublish').click(); }
  });

  $('#cMoods').addEventListener('click', e => {
    const b = e.target.closest('.mood-pill');
    if (!b) return;
    const same = picked === b.dataset.mood;
    $$('.mood-pill', $('#cMoods')).forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    picked = same ? '' : b.dataset.mood;
    if (!same) { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }
  });

  function renderThumbs() {
    const row = $('#cThumbs');
    row.innerHTML = '';
    files.forEach((f, i) => {
      const el = document.createElement('span');
      el.className = 'thumb';
      if (f.kind === 'image') {
        const im = document.createElement('img');
        im.src = f.url;
        im.alt = '待发布照片';
        el.appendChild(im);
      } else {
        el.innerHTML = `${icon('video')}`;
        el.title = f.file.name;
      }
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'thumb-x';
      x.innerHTML = icon('x');
      x.setAttribute('aria-label', '移除附件');
      x.addEventListener('click', () => { files.splice(i, 1); renderThumbs(); });
      el.appendChild(x);
      row.appendChild(el);
    });
    mountIcons(row);
  }

  async function addImages(list) {
    for (const f of list) {
      if (files.filter(x => x.kind === 'image').length >= 12) { toast('一次最多 12 张照片'); break; }
      const processed = await shrinkImage(f);
      files.push({ kind: 'image', file: processed, url: URL.createObjectURL(processed) });
    }
    renderThumbs();
  }
  $('#cImgBtn').addEventListener('click', () => $('#cImgInput').click());
  $('#cVidBtn').addEventListener('click', () => $('#cVidInput').click());
  $('#cImgInput').addEventListener('change', e => { addImages([...e.target.files]); e.target.value = ''; });
  $('#cVidInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) {
      const idx = files.findIndex(x => x.kind === 'video');
      if (idx >= 0) files.splice(idx, 1);
      files.push({ kind: 'video', file: f, url: null });
      renderThumbs();
    }
    e.target.value = '';
  });

  $('#cPublish').addEventListener('click', async () => {
    const text = ta.value.trim();
    const err = $('#cErr');
    if (!text && files.length === 0) {
      err.textContent = '写点什么，或者添加照片/视频吧';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const fd = new FormData();
    fd.append('text', text);
    if (picked) fd.append('mood', picked);
    fd.append('date', $('#cDate').value || todayStr());
    const btn = $('#cPublish');
    const prog = $('#cProg');
    btn.disabled = true;
    prog.hidden = false;
    try {
      await postForm('/api/entries', fd, p => { prog.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
      ta.value = '';
      $('#cCount').textContent = '0 字';
      picked = '';
      $$('.mood-pill', $('#cMoods')).forEach(x => x.classList.remove('on'));
      files.forEach(f => f.url && URL.revokeObjectURL(f.url));
      files.length = 0;
      renderThumbs();
      prog.hidden = true;
      prog.firstElementChild.style.width = '0';
      toast('已发布 ✓');
      refreshHomeData();
      ta.style.height = '';
    } catch (e2) {
      err.textContent = e2.message;
      err.hidden = false;
      prog.hidden = true;
    } finally { btn.disabled = false; }
  });
}

async function refreshHomeData() {
  if (currentView !== 'home') return;
  try {
    const [stats, recent] = await Promise.all([api('/api/stats'), api('/api/entries?limit=8')]);
    renderStats(stats);
    const grid = $('#recentGrid');
    if (grid) {
      grid.innerHTML = recent.items.length ? recent.items.map(entryCardHTML).join('') : emptyTip('还没有记录，从上面的「记录今天」开始吧 ✍️');
    }
  } catch { /* 静默 */ }
}

function postForm(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else if (xhr.status === 401) { showLockScreen(); reject(new Error('已锁定')); }
      else reject(new Error(data.error || '发布失败'));
    };
    xhr.onerror = () => reject(new Error('网络错误，请重试'));
    xhr.send(form);
  });
}

async function shrinkImage(file) {
  if (!/^image\//.test(file.type) || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 2400;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 2 * 1024 * 1024) { bitmap.close?.(); return file; }
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.87));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}

// ---------- 手账（瀑布流） ----------
routes.notes = async function (view, query) {
  const filters = {};
  if (query.date) filters.date = query.date;
  if (query.tag) filters.tag = query.tag;
  if (query.q) filters.q = query.q;
  if (query.mmdd) filters.mmdd = query.mmdd;
  let offset = 0;
  let total = 0;

  view.innerHTML = `
    <div style="padding:40px 0 6px"><h2 class="section-title" style="margin-bottom:0">我的手账</h2></div>
    <div class="filter-bar" id="notesFilter"></div>
    <div class="masonry" id="notesGrid"></div>
    <div class="load-more" id="notesMore" hidden><button class="btn" id="btnMore" type="button">加载更多</button></div>`;

  function renderFilter() {
    const bar = $('#notesFilter');
    const chips = [];
    if (filters.date) chips.push(['date', `日期：${fmtMD(filters.date)}${yearSuffix(filters.date)}`]);
    if (filters.mmdd) chips.push(['mmdd', `那年今天：${filters.mmdd.replace('-', '月')}日`]);
    if (filters.tag) chips.push(['tag', `# ${filters.tag}`]);
    if (filters.q) chips.push(['q', `搜索：${filters.q}`]);
    bar.innerHTML = (chips.length
      ? chips.map(([k, label]) => `<button class="chip" data-clear="${k}" type="button">${esc(label)} ✕</button>`).join('')
      : '<span class="chip">全部记录</span>')
      + `<span style="margin-left:auto;color:var(--sub);font-size:13px" id="notesCount"></span>`;
    $$('button[data-clear]', bar).forEach(b => b.addEventListener('click', () => {
      delete filters[b.dataset.clear];
      location.hash = '#/notes';
    }));
  }

  async function load(reset) {
    if (reset) {
      offset = 0;
      renderFilter();
      $('#notesGrid').innerHTML = skeletonCards();
    }
    const p = new URLSearchParams({ limit: '24', offset: String(offset) });
    if (filters.date) p.set('date', filters.date);
    if (filters.tag) p.set('tag', filters.tag);
    if (filters.q) p.set('q', filters.q);
    if (filters.mmdd) { p.set('sameDay', '1'); p.set('mmdd', filters.mmdd); }
    const data = await api('/api/entries?' + p.toString());
    total = data.total;
    offset += data.items.length;
    const grid = $('#notesGrid');
    if (offset === data.items.length && reset) {
      grid.innerHTML = data.items.length
        ? data.items.map(entryCardHTML).join('')
        : emptyTip('这里还空空的，去首页记录点什么吧');
    } else {
      grid.insertAdjacentHTML('beforeend', data.items.map(entryCardHTML).join(''));
    }
    $('#notesCount').textContent = `共 ${total} 条`;
    $('#notesMore').hidden = offset >= total;
    mountIcons(grid);
  }

  $('#btnMore').addEventListener('click', () => load(false));
  bindCardClick($('#notesGrid'));
  await load(true);
};

// ---------- 日历 ----------
routes.calendar = async function (view, query) {
  const now = new Date();
  let y = Number(query.year) || now.getFullYear();
  let m = Number(query.month) || now.getMonth() + 1;

  view.innerHTML = `
    <div style="padding:40px 0 6px"><h2 class="section-title" style="margin-bottom:0">心情日历</h2></div>
    <div class="card">
      <div class="cal-head">
        <div class="cal-title" id="calTitle"></div>
        <div class="cal-nav">
          <button class="iconbtn" id="calPrev" type="button" aria-label="上一个月">${icon('chevronL')}</button>
          <button class="btn" id="calToday" type="button">今天</button>
          <button class="iconbtn" id="calNext" type="button" aria-label="下一个月">${icon('chevronR')}</button>
        </div>
      </div>
      <div class="cal-weekrow">${['日', '一', '二', '三', '四', '五', '六'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid" id="calGrid"></div>
      <div class="cal-legend" id="calLegend"></div>
    </div>`;

  $('#calLegend').innerHTML = Object.entries(MOODS).map(([k, mo]) =>
    `<span><i style="background:${mo.color}"></i>${mo.emoji} ${mo.label}</span>`).join('');

  async function loadCal() {
    $('#calTitle').textContent = `${y} 年 ${m} 月`;
    const data = await api(`/api/calendar?year=${y}&month=${m}`);
    const byDate = new Map(data.days.map(d => [d.date, d]));
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = todayStr();
    let html = '';
    for (let i = 0; i < first.getDay(); i++) html += '<span class="cal-day blank"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${pad2(m)}-${pad2(d)}`;
      const info = byDate.get(key);
      const mo = info && info.mood && MOODS[info.mood];
      html += `<button class="cal-day${key === today ? ' today' : ''}${info ? ' has-records' : ''}" data-date="${key}" type="button" aria-label="${key}${info ? `，${info.n} 条记录` : ''}">
        <span class="d">${d}</span>
        ${mo ? `<span class="cal-dots"><i style="background:${mo.color}"></i>${info.n > 1 ? `<span class="more">×${info.n}</span>` : ''}</span>` : '<span></span>'}
      </button>`;
    }
    $('#calGrid').innerHTML = html;
    $$('#calGrid .cal-day[data-date]').forEach(b => b.addEventListener('click', () => {
      location.hash = `#/notes?date=${b.dataset.date}`;
    }));
  }

  $('#calPrev').addEventListener('click', () => { m--; if (m < 1) { m = 12; y--; } loadCal(); });
  $('#calNext').addEventListener('click', () => { m++; if (m > 12) { m = 1; y++; } loadCal(); });
  $('#calToday').addEventListener('click', () => { const d = new Date(); y = d.getFullYear(); m = d.getMonth() + 1; loadCal(); });
  await loadCal();
};

// ---------- 年度报告 ----------
routes.report = async function (view) {
  view.innerHTML = `
    <div style="padding:40px 0 6px"><h2 class="section-title" style="margin-bottom:0">年度报告</h2></div>
    <div class="filter-bar"><span id="reportYearPick"></span><span style="color:var(--sub);font-size:13px" id="reportNote"></span></div>
    <div id="reportBody"><div class="empty-tip"><span class="big">📊</span>正在生成…</div></div>`;

  const { years } = await api('/api/years');
  const cur = String(new Date().getFullYear());
  const all = [...new Set([cur, ...years])];
  const pick = $('#reportYearPick');
  const sel = document.createElement('select');
  sel.className = 'date-input';
  sel.setAttribute('aria-label', '选择年份');
  sel.innerHTML = all.map(y => `<option value="${y}">${y} 年</option>`).join('');
  pick.appendChild(sel);

  async function loadReport(year) {
    const r = await api(`/api/report?year=${year}`);
    const body = $('#reportBody');
    if (!r.entries) {
      body.innerHTML = emptyTip(`${year} 年还没有记录，写下的每一天都会汇入这里`);
      $('#reportNote').textContent = '';
      return;
    }
    $('#reportNote').textContent = r.firstDate ? `从 ${fmtMD(r.firstDate)} 开始，你写了 ${r.words} 个字` : '';
    const moodCount = r.moods.reduce((s, x) => s + x.n, 0);
    const maxMood = Math.max(...r.moods.map(x => x.n), 1);
    const maxMonth = Math.max(...r.monthly.map(x => x.n), 1);
    const monthMap = new Map(r.monthly.map(x => [Number(x.m), x.n]));
    body.innerHTML = `
      <div class="report-cards">
        <div class="card report-card"><b>${r.entries}<small>篇</small></b><span>这一年写下的记录</span></div>
        <div class="card report-card"><b>${r.days}<small>天</small></b><span>被认真记录的日子</span></div>
        <div class="card report-card"><b>${r.words}<small>字</small></b><span>累计写下的文字</span></div>
        <div class="card report-card"><b>${r.longestStreak}<small>天</small></b><span>最长连续记录 · 照片 ${r.photos} · 视频 ${r.videos}</span></div>
      </div>
      <div class="report-grid">
        <div class="card">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:14px">心情分布</h3>
          ${moodCount ? r.moods.sort((a, b) => b.n - a.n).map(x => {
            const mo = MOODS[x.mood];
            const pct = Math.round(x.n / moodCount * 100);
            return `<div class="bar-row">
              <span class="lbl">${mo ? `${mo.emoji} ${mo.label}` : '未选心情'}</span>
              <span class="track"><span class="fill" style="width:${Math.round(x.n / maxMood * 100)}%;background:${mo ? mo.color : 'var(--sub)'}"></span></span>
              <span class="val">${pct}%</span></div>`;
          }).join('') : '<p style="color:var(--sub);font-size:14px">这一年还没选过心情</p>'}
        </div>
        <div class="card">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:14px">每月记录</h3>
          <div class="month-bars">${Array.from({ length: 12 }, (_, i) => {
            const n = monthMap.get(i + 1) || 0;
            return `<div class="mb"><div class="bar" style="height:${Math.round(n / maxMonth * 100)}%" title="${i + 1}月：${n} 条"></div><span class="m">${i + 1}</span></div>`;
          }).join('')}</div>
        </div>
      </div>
      ${r.topTags.length ? `<div class="card" style="margin-top:18px">
        <h3 style="font-size:18px;font-weight:700;margin-bottom:14px">最常出现的标签</h3>
        <div class="tag-cloud">${r.topTags.map(t => `<span class="chip"><b>#${esc(t.tag)}</b>&nbsp;${t.n} 次</span>`).join('')}</div>
      </div>` : ''}`;
  }

  sel.addEventListener('change', () => loadReport(sel.value));
  await loadReport(sel.value);
};

// ---------- 设置 ----------
routes.settings = async function (view) {
  let wpMode = 'light';
  view.innerHTML = `
    <div style="padding:40px 0 6px"><h2 class="section-title" style="margin-bottom:0">设置</h2></div>
    <div class="settings-stack">
      <div class="card">
        <div class="set-row">
          <div><h4>外观</h4><p>浅色、深色，或跟随系统自动切换</p></div>
          <div class="seg" data-seg="theme">
            <button type="button" data-v="auto">跟随系统</button>
            <button type="button" data-v="light">浅色</button>
            <button type="button" data-v="dark">深色</button>
          </div>
        </div>
        <div style="margin-top:28px">
          <div class="set-row"><div><h4>壁纸</h4><p>分别为浅色与深色模式挑选背景，也可以上传自己的照片</p></div></div>
          <div class="seg wp-tabs" data-wptab style="margin-bottom:16px">
            <button type="button" data-mode="light" class="on">浅色壁纸</button>
            <button type="button" data-mode="dark">深色壁纸</button>
          </div>
          <div class="wp-grid" id="wpGrid"></div>
          <input type="file" id="wpFile" accept="image/*" hidden>
        </div>
      </div>
      <div class="card">
        <div class="set-row">
          <div><h4>隐私锁</h4><p id="lockStateText"></p></div>
          <div style="display:flex;gap:10px">
            <button class="btn" id="btnChangeLock" type="button" hidden>修改密码</button>
            <button class="btn btn-primary" id="btnToggleLock" type="button">开启</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="set-row">
          <div><h4>数据</h4><p>全部记录都保存在本机，可随时导出备份</p></div>
          <button class="btn" id="btnExport" type="button">${icon('download')}导出 JSON</button>
        </div>
      </div>
      <div class="card" style="color:var(--sub);font-size:13.5px">
        <h4 style="color:var(--text);font-size:16px;font-weight:600;margin-bottom:8px">关于拾光</h4>
        拾光 v1.0 · 每日心情手账<br>
        文字、照片与视频保存在你自己电脑的 shiguang 文件夹里，不经过任何第三方服务器。
      </div>
    </div>`;

  $$('#view [data-seg="theme"] button').forEach(b => b.addEventListener('click', () => {
    localStorage.setItem('sg_theme', b.dataset.v);
    applyTheme();
  }));

  function renderWpGrid() {
    const grid = $('#wpGrid');
    const current = wpMode === 'light' ? APP.settings.wallpaperLight : APP.settings.wallpaperDark;
    const list = [
      ...APP.wallpapers.builtin.filter(w => w.mode === wpMode),
      ...APP.wallpapers.custom
    ];
    let html = `<button class="wp-item wp-none${current ? '' : ' on'}" type="button" data-id="" aria-label="不使用壁纸">无壁纸</button>`;
    for (const w of list) {
      html += `<button class="wp-item${current === w.id ? ' on' : ''}" type="button" data-id="${esc(w.id)}" style="background-image:url('${w.url}')" aria-label="${esc(w.name)}">
        ${w.id.startsWith('c:') ? `<span class="wp-del" data-del="${esc(w.id)}" title="删除这张壁纸">${icon('trash')}</span>` : ''}
        <span class="wp-check">${icon('check')}</span>
        <span class="wp-name">${esc(w.name)}</span>
      </button>`;
    }
    html += `<button class="wp-item wp-none" type="button" id="wpUpload" aria-label="上传自定义壁纸">${icon('plus')}<span style="font-size:13px">上传壁纸</span></button>`;
    grid.innerHTML = html;
    mountIcons(grid);
  }

  $('#wpGrid').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      openModal({
        title: '删除这张壁纸？', okText: '删除', danger: true, cancelText: '取消',
        onOk: async () => {
          await api(`/api/wallpapers/${encodeURIComponent(del.dataset.del)}`, { method: 'DELETE' });
          APP.wallpapers.custom = APP.wallpapers.custom.filter(w => w.id !== del.dataset.del);
          const cur = wpMode === 'light' ? APP.settings.wallpaperLight : APP.settings.wallpaperDark;
          if (cur === del.dataset.del) {
            if (wpMode === 'light') APP.settings.wallpaperLight = ''; else APP.settings.wallpaperDark = '';
            await api('/api/settings', { method: 'PUT', body: wpMode === 'light' ? { wallpaperLight: '' } : { wallpaperDark: '' } });
          }
          renderWpGrid();
          applyWallpaper();
          toast('已删除');
        }
      });
      return;
    }
    if (e.target.closest('#wpUpload')) { $('#wpFile').click(); return; }
    const item = e.target.closest('.wp-item[data-id]');
    if (!item) return;
    const id = item.dataset.id || '';
    await api('/api/settings', { method: 'PUT', body: wpMode === 'light' ? { wallpaperLight: id } : { wallpaperDark: id } });
    if (wpMode === 'light') APP.settings.wallpaperLight = id; else APP.settings.wallpaperDark = id;
    // 选哪个模式的壁纸，就切到哪个模式，让用户立刻看到效果
    const wantDark = wpMode === 'dark';
    if (id && isDark() !== wantDark) localStorage.setItem('sg_theme', wantDark ? 'dark' : 'light');
    renderWpGrid();
    applyTheme();
    applyWallpaper();
    toast(id ? '壁纸已应用 ✓' : '已恢复默认背景');
  });

  $('#wpFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.append('wallpaper', f);
    toast('正在上传壁纸…');
    try {
      const res = await api('/api/wallpapers', { method: 'POST', body: fd });
      APP.wallpapers.custom.push(res.item);
      await api('/api/settings', { method: 'PUT', body: wpMode === 'light' ? { wallpaperLight: res.item.id } : { wallpaperDark: res.item.id } });
      if (wpMode === 'light') APP.settings.wallpaperLight = res.item.id; else APP.settings.wallpaperDark = res.item.id;
      const wantDark = wpMode === 'dark';
      if (isDark() !== wantDark) localStorage.setItem('sg_theme', wantDark ? 'dark' : 'light');
      renderWpGrid();
      applyTheme();
      applyWallpaper();
      toast('壁纸已应用 ✓');
    } catch (err) { toast(err.message); }
  });

  $$('#view [data-wptab] button').forEach(b => b.addEventListener('click', () => {
    wpMode = b.dataset.mode;
    $$('#view [data-wptab] button').forEach(x => x.classList.toggle('on', x === b));
    renderWpGrid();
  }));

  function updateLockUI() {
    const on = APP.settings.lockEnabled;
    $('#lockStateText').textContent = on ? '已开启 · 每次打开网站需要输入密码' : '未开启 · 任何人打开网站都能查看';
    $('#btnToggleLock').textContent = on ? '关闭' : '开启';
    $('#btnToggleLock').classList.toggle('btn-primary', !on);
    $('#btnChangeLock').hidden = !on;
    $('#btnLockNow').hidden = !on;
  }

  $('#btnToggleLock').addEventListener('click', () => {
    if (!APP.settings.lockEnabled) {
      openModal({
        title: '开启隐私锁', sub: '设置一个 4-8 位数字密码，之后打开网站需要输入',
        okText: '开启并锁定',
        bodyHTML: `<input type="password" name="pass" inputmode="numeric" maxlength="8" placeholder="输入 4-8 位数字密码" autocomplete="new-password">
                   <input type="password" name="pass2" inputmode="numeric" maxlength="8" placeholder="再输入一次确认" autocomplete="new-password">`,
        onOk: async mask => {
          const p1 = mask.querySelector('[name=pass]').value;
          const p2 = mask.querySelector('[name=pass2]').value;
          if (p1 !== p2) throw new Error('两次输入的密码不一样');
          await api('/api/lock', { method: 'PUT', body: { enable: true, passcode: p1 } });
          APP.settings.lockEnabled = true;
          updateLockUI();
          toast('隐私锁已开启 🔒');
        }
      });
    } else {
      openModal({
        title: '关闭隐私锁', sub: '输入当前密码确认关闭',
        okText: '关闭隐私锁', danger: true,
        bodyHTML: `<input type="password" name="pass" inputmode="numeric" maxlength="8" placeholder="当前密码" autocomplete="off">`,
        onOk: async mask => {
          await api('/api/lock', { method: 'PUT', body: { enable: false, passcode: mask.querySelector('[name=pass]').value } });
          APP.settings.lockEnabled = false;
          updateLockUI();
          toast('隐私锁已关闭');
        }
      });
    }
  });

  $('#btnChangeLock').addEventListener('click', () => {
    openModal({
      title: '修改隐私密码', sub: '输入旧密码和新密码',
      okText: '确认修改',
      bodyHTML: `<input type="password" name="old" inputmode="numeric" maxlength="8" placeholder="当前密码" autocomplete="off">
                 <input type="password" name="pass" inputmode="numeric" maxlength="8" placeholder="新密码（4-8 位数字）" autocomplete="new-password">
                 <input type="password" name="pass2" inputmode="numeric" maxlength="8" placeholder="再输入一次新密码" autocomplete="new-password">`,
      onOk: async mask => {
        const p1 = mask.querySelector('[name=pass]').value;
        const p2 = mask.querySelector('[name=pass2]').value;
        if (p1 !== p2) throw new Error('两次输入的新密码不一样');
        await api('/api/lock', { method: 'PUT', body: { enable: true, oldPasscode: mask.querySelector('[name=old]').value, passcode: p1 } });
        toast('密码已修改 ✓');
      }
    });
  });

  $('#btnExport').addEventListener('click', () => { location.href = '/api/export'; });

  updateLockUI();
  renderWpGrid();
  applyTheme();
};

// ---------- 详情浮层 ----------
let curEntry = null;
let ndIndex = 0;

async function openDetail(id) {
  let entry;
  try { entry = await api(`/api/entries/${id}`); }
  catch (err) { toast(err.message); return; }
  curEntry = entry;
  ndIndex = 0;
  const ov = $('#detailOverlay');
  $('#noteDetail').innerHTML = detailHTML(entry);
  mountIcons($('#noteDetail'));
  renderDetailFoot();
  ov.hidden = false;
  document.body.style.overflow = 'hidden';
  bindDetailNav();
}

function closeDetail() {
  $('#detailOverlay').hidden = true;
  document.body.style.overflow = '';
  curEntry = null;
}

function detailHTML(e) {
  const m = MOODS[e.mood];
  const slides = e.media.map((md, i) => md.kind === 'image'
    ? `<div class="nd-slide${i === 0 ? ' on' : ''}"><img src="${md.url}" alt="照片 ${i + 1}"></div>`
    : `<div class="nd-slide${i === 0 ? ' on' : ''}"><video src="${md.url}" controls playsinline preload="metadata"></video></div>`).join('');
  return `
  <div class="nd-media" id="ndMedia">
    ${slides || `<div class="nd-slide on" style="background:var(--surface-2)"><div style="color:var(--sub);font-size:15px">这条记录没有照片和视频</div></div>`}
    ${e.media.length > 1 ? `
      <button class="nd-nav prev" type="button" aria-label="上一张">${icon('chevronL')}</button>
      <button class="nd-nav next" type="button" aria-label="下一张">${icon('chevronR')}</button>
      <span class="nd-counter" id="ndCounter">1 / ${e.media.length}</span>` : ''}
  </div>
  <div class="nd-body">
    <div class="nd-date-row">
      <div><span class="nd-date">${fmtFullCN(e.date)}</span><span class="nd-weekday">${weekdayCN(e.date)}</span></div>
      ${m ? `<span class="mood-chip" style="background:${m.color}">${m.emoji} ${m.label}</span>` : ''}
    </div>
    <p class="nd-text">${esc(e.text)}</p>
    ${e.tags.length ? `<div class="nd-tags">${e.tags.map(t => `<button class="chip" data-tag="${esc(t)}" type="button">#${esc(t)}</button>`).join('')}</div>` : ''}
    <div class="nd-foot" id="ndFoot"></div>
  </div>`;
}

function bindDetailNav() {
  const media = $('#ndMedia');
  const total = curEntry?.media.length || 0;
  const show = i => {
    if (!total) return;
    ndIndex = (i + total) % total;
    $$('.nd-slide', media).forEach((s, idx) => {
      s.classList.toggle('on', idx === ndIndex);
      const v = s.querySelector('video');
      if (v && idx !== ndIndex) v.pause();
    });
    const counter = $('#ndCounter');
    if (counter) counter.textContent = `${ndIndex + 1} / ${total}`;
  };
  const prev = $('.nd-nav.prev', media);
  const next = $('.nd-nav.next', media);
  if (prev) prev.addEventListener('click', () => show(ndIndex - 1));
  if (next) next.addEventListener('click', () => show(ndIndex + 1));
  media.querySelectorAll('.nd-slide').forEach((s, idx) => {
    s.addEventListener('click', ev => { if (ev.target.tagName !== 'VIDEO') show(idx + 1); });
  });
}

function renderDetailFoot() {
  const e = curEntry;
  const foot = $('#ndFoot');
  if (!foot || !e) return;
  if (!e.share_id) {
    foot.innerHTML = `<div class="share-row">
      <button class="btn btn-primary" id="dShare" type="button">${icon('share')}分享给好友</button>
      <button class="btn btn-danger" id="dDelete" type="button">${icon('trash')}删除</button>
    </div>`;
  } else {
    const url = `${location.origin}/s/${e.share_id}`;
    foot.innerHTML = `
      <p style="font-size:13px;color:var(--sub);margin-bottom:10px">分享已开启，把链接发给好友，打开就能看到这条记录：</p>
      <div class="share-link">
        <input readonly value="${esc(url)}" aria-label="分享链接" onclick="this.select()">
        <button class="btn btn-primary" id="dCopy" type="button">${icon('link')}复制</button>
      </div>
      <div class="share-row" style="margin-top:14px">
        ${navigator.share ? `<button class="btn" id="dSysShare" type="button">${icon('share')}系统分享</button>` : ''}
        <button class="btn" id="dCard" type="button">${icon('image')}生成图片卡片</button>
        <button class="btn" id="dStopShare" type="button">停止分享</button>
        <button class="btn btn-danger" id="dDelete" type="button">${icon('trash')}删除</button>
      </div>`;
  }
  mountIcons(foot);

  const bind = (id2, fn) => { const el = $(id2, foot); if (el) el.addEventListener('click', fn); };
  bind('#dShare', async () => {
    const res = await api(`/api/entries/${e.id}/share`, { method: 'POST' });
    e.share_id = res.share_id;
    renderDetailFoot();
    toast('分享已开启，快把链接发给好友吧');
  });
  bind('#dCopy', async () => {
    const url = `${location.origin}/s/${e.share_id}`;
    try { await navigator.clipboard.writeText(url); toast('链接已复制 ✓'); }
    catch {
      const input = $('.share-link input', foot);
      if (input) { input.select(); document.execCommand('copy'); toast('链接已复制 ✓'); }
    }
  });
  bind('#dSysShare', () => {
    navigator.share({ title: `拾光 · ${fmtMD(e.date)}`, text: (e.text || '来自拾光的记录').slice(0, 120), url: `${location.origin}/s/${e.share_id}` }).catch(() => {});
  });
  bind('#dCard', () => makeShareImage(e));
  bind('#dStopShare', async () => {
    await api(`/api/entries/${e.id}/share`, { method: 'DELETE' });
    e.share_id = null;
    renderDetailFoot();
    toast('已停止分享，链接立即失效');
  });
  bind('#dDelete', () => {
    openModal({
      title: '删除这条记录？', sub: '文字、照片和视频会一并删除，无法恢复',
      okText: '删除', danger: true,
      onOk: async () => {
        await api(`/api/entries/${e.id}`, { method: 'DELETE' });
        closeDetail();
        toast('已删除');
        route();
      }
    });
  });
  foot.querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => {
    closeDetail();
    location.hash = `#/notes?tag=${encodeURIComponent(b.dataset.tag)}`;
  }));
}

// ---------- 分享图片卡片 ----------
function rr2d(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawCover(ctx, im, x, y, w, h, r) {
  ctx.save();
  rr2d(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / im.width, h / im.height);
  const iw = im.width * s, ih = im.height * s;
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}
function wrapText(ctx, text, maxW, maxLines) {
  const out = [];
  let truncated = false;
  for (const para of String(text || '').split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        out.push(cur);
        cur = ch;
        if (out.length >= maxLines) { truncated = true; break; }
      } else cur += ch;
    }
    if (truncated) break;
    out.push(cur);
    if (out.length >= maxLines) { truncated = true; break; }
  }
  if (truncated && out.length === maxLines) {
    out[maxLines - 1] = out[maxLines - 1].replace(/.{2}$/, '') + '…';
  }
  return out;
}
async function makeShareImage(e) {
  const W = 1080, PAD = 76;
  const m = MOODS[e.mood];
  const imgs = (await Promise.all(
    e.media.filter(x => x.kind === 'image').slice(0, 4).map(x => new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = x.url;
    }))
  )).filter(Boolean);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontA = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.font = `400 30px ${fontA}`;
  const lines = e.text ? wrapText(ctx, e.text, W - PAD * 2, 10) : [];
  const headerH = 150;
  const textH = lines.length ? lines.length * 48 + 36 : 0;
  let mediaH = 0, mediaLayout = null;
  const innerW = W - PAD * 2;
  if (imgs.length === 1) { mediaH = 560; mediaLayout = [[0, PAD, PAD, innerW, 560]]; }
  else if (imgs.length === 2) { mediaH = 380; mediaLayout = [[0, PAD, PAD, (innerW - 20) / 2, 380], [1, PAD + (innerW - 20) / 2 + 20, PAD, (innerW - 20) / 2, 380]]; }
  else if (imgs.length === 3) { mediaH = 300; mediaLayout = imgs.map((_, i) => [i, PAD + i * ((innerW - 40) / 3), PAD, (innerW - 40) / 3, 300]); }
  else if (imgs.length === 4) {
    mediaH = 500;
    const cw = (innerW - 20) / 2, ch = (500 - 20) / 2;
    mediaLayout = [[0, PAD, PAD, cw, ch], [1, PAD + cw + 20, PAD, cw, ch], [2, PAD, PAD + ch + 20, cw, ch], [3, PAD + cw + 20, PAD + ch + 20, cw, ch]];
  }
  const footH = 118;
  const H = Math.round(headerH + textH + (mediaH ? mediaH + 42 : 0) + footH);
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = '#ffffff';
  rr2d(ctx, 0, 0, W, H, 48);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.08)';
  ctx.lineWidth = 2;
  rr2d(ctx, 1, 1, W - 2, H - 2, 47);
  ctx.stroke();

  ctx.fillStyle = '#1d1d1f';
  ctx.font = `700 46px ${fontA}`;
  ctx.fillText(`${fmtMD(e.date)}${yearSuffix(e.date)}`, PAD, 92);
  ctx.font = `400 24px ${fontA}`;
  ctx.fillStyle = '#86868b';
  ctx.fillText(weekdayCN(e.date), PAD + ctx.measureText('00').width + 180, 92);
  if (m) {
    ctx.font = '38px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(m.emoji, W - PAD - 150, 96);
    ctx.font = `600 26px ${fontA}`;
    ctx.fillStyle = m.color;
    ctx.fillText(m.label, W - PAD - 96, 94);
  }
  ctx.strokeStyle = 'rgba(0,0,0,.09)';
  ctx.beginPath();
  ctx.moveTo(PAD, headerH - 24);
  ctx.lineTo(W - PAD, headerH - 24);
  ctx.stroke();

  let y = headerH + 10;
  if (lines.length) {
    ctx.fillStyle = '#1d1d1f';
    ctx.font = `400 30px ${fontA}`;
    lines.forEach((ln, i) => ctx.fillText(ln, PAD, y + 40 + i * 48));
    y += textH;
  }
  if (mediaLayout) {
    y += 22;
    for (const [idx, x2, y2, w2, h2] of mediaLayout) drawCover(ctx, imgs[idx], x2, y + y2 - PAD, w2, h2, 26);
    y += mediaH;
  }
  const grad = ctx.createLinearGradient(PAD, 0, PAD + 180, 0);
  grad.addColorStop(0, '#0090f7');
  grad.addColorStop(0.5, '#a259ff');
  grad.addColorStop(1, '#ff5e8a');
  ctx.fillStyle = grad;
  ctx.font = `700 30px ${fontA}`;
  ctx.fillText('拾光', PAD, H - 44);
  ctx.fillStyle = '#86868b';
  ctx.font = `400 24px ${fontA}`;
  ctx.fillText('· 每日心情手账', PAD + 74, H - 44);

  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `拾光-${e.date}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
  toast('分享卡片已生成，正在下载');
}

// ---------- 搜索浮层 ----------
function bindSearchOverlay() {
  const so = $('#searchOverlay');
  const input = $('#searchInput');
  const results = $('#searchResults');
  const close = () => { so.hidden = true; document.body.style.overflow = ''; };
  $('#btnSearch').addEventListener('click', async () => {
    so.hidden = false;
    document.body.style.overflow = 'hidden';
    input.value = '';
    results.innerHTML = `<div class="empty-tip" style="padding:40px 20px"><span class="big">🔍</span>输入关键词，找回来的时光</div>`;
    input.focus();
    try {
      const { tags } = await api('/api/tags');
      $('#searchTags').innerHTML = tags.slice(0, 12).map(t =>
        `<button class="chip" data-q="${esc(t.tag)}" type="button">#${esc(t.tag)} <b style="color:var(--blue)">${t.n}</b></button>`).join('');
    } catch { $('#searchTags').innerHTML = ''; }
  });
  $$('[data-close-search]', so).forEach(el => el.addEventListener('click', close));
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value.trim()), 300);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(input.value.trim()); });
  $('#searchTags').addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (b) { input.value = b.dataset.q; runSearch(b.dataset.q); }
  });
  bindCardClick(results);
  async function runSearch(q) {
    if (!q) {
      results.innerHTML = `<div class="empty-tip" style="padding:40px 20px"><span class="big">🔍</span>输入关键词，找回来的时光</div>`;
      return;
    }
    results.innerHTML = '<div class="empty-tip" style="padding:40px 20px">搜索中…</div>';
    try {
      const data = await api(`/api/entries?q=${encodeURIComponent(q)}&limit=24`);
      results.innerHTML = data.items.length
        ? data.items.map(entryCardHTML).join('')
        : `<div class="empty-tip" style="padding:40px 20px"><span class="big">🍃</span>没有找到和「${esc(q)}」相关的记录</div>`;
      mountIcons(results);
    } catch (err) { results.innerHTML = `<div class="empty-tip">${esc(err.message)}</div>`; }
  }
}

// ---------- 启动 ----------
async function boot() {
  if (APP.booted) return;
  const [settings, wallpapers] = await Promise.all([api('/api/settings'), api('/api/wallpapers')]);
  APP.settings = settings;
  APP.wallpapers = wallpapers;
  APP.booted = true;
  applyTheme();
  $('#btnLockNow').hidden = !settings.lockEnabled;
  route();
}

function init() {
  mountIcons(document);
  $('#btnTheme').innerHTML = icon('moon');

  // 图片加载完成后淡入
  document.addEventListener('load', e => {
    if (e.target.tagName === 'IMG') e.target.classList.add('ld');
  }, true);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref() === 'auto') applyTheme();
  });
  $('#btnTheme').addEventListener('click', () => {
    localStorage.setItem('sg_theme', isDark() ? 'light' : 'dark');
    applyTheme();
  });
  $('#btnLockNow').addEventListener('click', async () => {
    await fetch('/api/lockout', { method: 'POST' });
    APP.booted = false;
    showLockScreen();
  });
  $('#btnUnlock').addEventListener('click', tryUnlock);
  $('#lockPass').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });

  $$('[data-close-detail]').forEach(el => el.addEventListener('click', closeDetail));
  bindSearchOverlay();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#detailOverlay').hidden) closeDetail();
      else if (!$('#searchOverlay').hidden) {
        $('#searchOverlay').hidden = true;
        document.body.style.overflow = '';
      }
    }
    if (!$('#detailOverlay').hidden && curEntry && curEntry.media.length > 1) {
      if (e.key === 'ArrowLeft') $('.nd-nav.prev')?.click();
      if (e.key === 'ArrowRight') $('.nd-nav.next')?.click();
    }
  });

  window.addEventListener('hashchange', route);

  (async () => {
    try {
      const st = await fetch('/api/state').then(r => r.json());
      if (st.locked) { applyTheme(); showLockScreen(); }
      else await boot();
    } catch {
      $('#view').innerHTML = '<div class="empty-tip"><span class="big">📡</span>连不上服务器——请确认已在 shiguang 文件夹里运行 node server.js</div>';
    }
  })();
}

init();
})();
