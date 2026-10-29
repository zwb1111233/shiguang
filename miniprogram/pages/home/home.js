const store = require('../../utils/store');
const util = require('../../utils/util');
const quotes = require('../../utils/quotes');
const onthisday = require('../../utils/onthisday');

Page({
  data: {
    tc: '',
    greeting: '',
    dateText: '',
    quote: { t: '', a: '' },
    stats: { streak: 0, entries: 0, days: 0, words: 0, photos: 0, videos: 0, todayCount: 0 },
    thatday: [],
    wf: { left: [], right: [] },
    hist: [],
    histSource: '',
    todayEmpty: false,
    colW: 347
  },

  onLoad() {
    this.setData({ colW: getApp().colW() });
  },

  onShow() {
    if (getApp().requireLock('pages/home/home')) return;
    this.setData({ tc: getApp().themeClass() });
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  refresh() {
    const today = util.todayStr();
    const qi = quotes.dailyIndex();
    const recent = store.listEntries().slice(0, 6).map(store.decorate);
    const stats = store.stats();
    const thatday = store.thatday().map(g => ({
      year: g.year,
      list: g.list.slice(0, 2).map(store.decorate)
    }));
    this.setData({
      greeting: util.greeting(),
      dateText: `${util.fmtFullCN(today)} · ${util.weekdayCN(today)}`,
      quote: quotes.QUOTES[qi],
      stats,
      todayEmpty: stats.todayCount === 0,
      thatday,
      wf: util.waterfalls(recent, this.data.colW)
    });
    onthisday.fetchOnthisday(res => {
      this.setData({ hist: res.events, histSource: res.source === 'wikipedia' ? '数据来自维基百科' : '离线模式 · 内置事件' });
    });
  },

  shuffleQuote() {
    util.haptic();
    const cur = this.data.quote.t;
    let next = quotes.QUOTES[Math.floor(Math.random() * quotes.QUOTES.length)];
    while (next.t === cur && quotes.QUOTES.length > 1) {
      next = quotes.QUOTES[Math.floor(Math.random() * quotes.QUOTES.length)];
    }
    this.setData({ quote: next });
  },

  goCompose() { wx.navigateTo({ url: '/pages/compose/compose' }); },
  goNotes() { wx.switchTab({ url: '/pages/notes/notes' }); },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },
  openThatday() {
    const mmdd = util.todayStr().slice(5);
    getApp().openNotesWith({ mmdd });
  },
  onShareAppMessage() {
    return { title: '拾光 · 把每一天都好好收藏', path: '/pages/home/home' };
  }
});
