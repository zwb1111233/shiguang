// ============ 通用工具 ============
const MOODS = {
  happy: { emoji: '😊', label: '开心', color: '#ff9f0a' },
  love: { emoji: '🥰', label: '幸福', color: '#ff6482' },
  calm: { emoji: '😌', label: '平静', color: '#0a84ff' },
  tired: { emoji: '😪', label: '疲惫', color: '#bf5af2' },
  sad: { emoji: '😢', label: '低落', color: '#5e5ce6' },
  angry: { emoji: '😤', label: '烦躁', color: '#ff453a' }
};
const MOOD_LIST = Object.keys(MOODS).map(k => ({ key: k, ...MOODS[k] }));

function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtMD(ds) { const p = ds.split('-'); return `${Number(p[1])}月${Number(p[2])}日`; }
function fmtFullCN(ds) { const p = ds.split('-'); return `${p[0]}年${Number(p[1])}月${Number(p[2])}日`; }
function weekdayCN(ds) { return '星期' + '日一二三四五六'.charAt(new Date(`${ds}T12:00:00`).getDay()); }
function fmtTime(ts) { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
function haptic() { try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* 忽略 */ } }
function toast(msg, icon) {
  wx.showToast({ title: msg, icon: icon || 'none', duration: 2000 });
}
// 瀑布流卡片高度估算（rpx）
function cardHeight(entry, colW) {
  let h = 0;
  if (entry.media.length && entry.media[0].w && entry.media[0].h) {
    const ratio = entry.media[0].h / entry.media[0].w;
    h += Math.max(240, Math.min(520, Math.round(colW * ratio)));
  } else if (entry.media.length) {
    h += 320;
  }
  if (entry.text) {
    const lines = Math.min(3, Math.ceil(entry.text.length / 15));
    h += lines * 40 + 20;
  }
  h += 120;
  return h;
}
// 把记录列表按估算高度分到两列，并给每条附上媒体展示高度 _mh（rpx）
function waterfalls(list, colW) {
  const left = [], right = [];
  let lh = 0, rh = 0;
  list.forEach(e => {
    const m = e.media[0];
    if (m && m.w && m.h) {
      e._mh = Math.max(240, Math.min(520, Math.round(colW * (m.h / m.w))));
    } else if (m) {
      e._mh = 320;
    } else {
      e._mh = 0;
    }
    const hh = cardHeight(e, colW);
    if (lh <= rh) { left.push(e); lh += hh; } else { right.push(e); rh += hh; }
  });
  return { left, right };
}

module.exports = { MOODS, MOOD_LIST, pad2, todayStr, fmtMD, fmtFullCN, weekdayCN, fmtTime, greeting, haptic, toast, cardHeight, waterfalls };
