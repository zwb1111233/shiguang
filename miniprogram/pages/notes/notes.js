const store = require('../../utils/store');
const util = require('../../utils/util');

const PAGE_SIZE = 20;

Page({
  data: {
    tc: '',
    colW: 347,
    filter: { date: '', tag: '', mmdd: '', q: '' },
    chips: [],
    wf: { left: [], right: [] },
    total: 0,
    shown: 0,
    loading: true
  },

  onLoad(query) {
    this.full = store.listEntries();
    this.filter = {
      date: query.date || '',
      tag: query.tag || '',
      mmdd: query.mmdd || '',
      q: ''
    };
    this.limit = PAGE_SIZE;
    this.setData({ colW: getApp().colW() });
  },

  onShow() {
    if (getApp().requireLock('pages/notes/notes')) return;
    this.setData({ tc: getApp().themeClass() });
    // 消费其它页面（日历/详情/首页）带来的筛选
    const pending = getApp().globalData.pendingNotesFilter;
    if (pending) {
      getApp().globalData.pendingNotesFilter = null;
      this.filter = { date: '', tag: '', mmdd: '', q: '', ...pending };
      this.limit = PAGE_SIZE;
    }
    this.full = store.listEntries();
    this.render();
  },

  onPullDownRefresh() {
    this.full = store.listEntries();
    this.limit = PAGE_SIZE;
    this.render();
    wx.stopPullDownRefresh();
    util.haptic();
  },

  onReachBottom() {
    if (this.data.shown >= this.data.total) return;
    this.limit += PAGE_SIZE;
    this.render();
  },

  buildChips() {
    const f = this.filter;
    const chips = [];
    if (f.date) chips.push({ key: 'date', label: `日期：${util.fmtMD(f.date)} ✕` });
    if (f.mmdd) chips.push({ key: 'mmdd', label: `那年今天：${f.mmdd.replace('-', '月')}日 ✕` });
    if (f.tag) chips.push({ key: 'tag', label: `# ${f.tag} ✕` });
    if (f.q) chips.push({ key: 'q', label: `搜索：${f.q} ✕` });
    return chips;
  },

  render() {
    const list = this.full.filter(e => {
      const f = this.filter;
      if (f.date && e.date !== f.date) return false;
      if (f.tag && !e.tags.includes(f.tag)) return false;
      if (f.mmdd && !(e.date.slice(5) === f.mmdd && e.date.slice(0, 4) < String(new Date().getFullYear()))) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        if (!(e.text.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)))) return false;
      }
      return true;
    });
    const shown = list.slice(0, this.limit).map(store.decorate);
    this.setData({
      wf: util.waterfalls(shown, this.data.colW),
      total: list.length,
      shown: shown.length,
      chips: this.buildChips(),
      loading: false
    });
  },

  onSearchInput(e) {
    clearTimeout(this._t);
    const q = e.detail.value.trim();
    this._t = setTimeout(() => {
      this.filter.q = q;
      this.limit = PAGE_SIZE;
      this.render();
    }, 250);
  },

  clearChip(e) {
    const key = e.currentTarget.dataset.key;
    this.filter[key] = '';
    this.limit = PAGE_SIZE;
    this.render();
    util.haptic();
  },

  goCompose() { wx.navigateTo({ url: '/pages/compose/compose' }); },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },
  onShareAppMessage() {
    return { title: '拾光 · 我的手账', path: '/pages/notes/notes' };
  }
});
