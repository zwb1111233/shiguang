const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    years: [],
    year: '',
    report: null,
    moodRows: [],
    monthBars: [],
    maxMonth: 1,
    hasData: false
  },

  onLoad() {
    const years = store.years();
    this.setData({ years, year: years[0] });
  },

  onShow() {
    if (getApp().requireLock('pages/report/report')) return;
    this.setData({ tc: getApp().themeClass() });
    this.render();
  },

  render() {
    const r = store.report(this.data.year);
    const totalMood = Object.values(r.moods).reduce((s, n) => s + n, 0);
    const maxMood = Math.max(...Object.values(r.moods), 1);
    const moodRows = Object.entries(r.moods)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => {
        const m = util.MOODS[key];
        return {
          label: m ? `${m.emoji} ${m.label}` : '未选心情',
          color: m ? m.color : '#8e8e93',
          n,
          pct: totalMood ? Math.round(n / totalMood * 100) : 0,
          width: Math.round(n / maxMood * 100)
        };
      });
    const monthMap = r.monthly;
    const maxMonth = Math.max(...Object.values(monthMap), 1);
    const monthBars = Array.from({ length: 12 }, (_, i) => ({
      m: i + 1,
      n: monthMap[i + 1] || 0,
      height: Math.round((monthMap[i + 1] || 0) / maxMonth * 100)
    }));
    this.setData({
      report: r,
      moodRows,
      monthBars,
      maxMonth,
      hasData: r.entries > 0
    });
  },

  pickYear(e) {
    this.setData({ year: this.data.years[Number(e.detail.value)] });
    this.render();
  },
  onShareAppMessage() {
    return { title: '拾光 · 年度报告', path: '/pages/report/report' };
  }
});
