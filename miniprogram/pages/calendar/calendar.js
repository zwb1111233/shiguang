const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    year: 0,
    month: 0,
    title: '',
    grid: [],
    legend: [],
    today: ''
  },

  onLoad() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      today: util.todayStr(),
      legend: util.MOOD_LIST.map(m => ({ key: m.key, emoji: m.emoji, label: m.label, color: m.color }))
    });
  },

  onShow() {
    if (getApp().requireLock('pages/calendar/calendar')) return;
    this.setData({ tc: getApp().themeClass() });
    this.render();
  },

  render() {
    const { year, month } = this.data;
    this.setData({ title: `${year} 年 ${month} 月` });
    const map = store.calendarMonth(year, month);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push({ blank: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${util.pad2(month)}-${util.pad2(d)}`;
      const info = map[key];
      const mood = info && info.mood && util.MOODS[info.mood];
      grid.push({
        day: d,
        date: key,
        isToday: key === this.data.today,
        has: !!info,
        count: info ? info.n : 0,
        dotColor: mood ? mood.color : '',
        emoji: mood ? mood.emoji : ''
      });
    }
    this.setData({ grid });
  },

  prevMonth() {
    util.haptic();
    let { year, month } = this.data;
    month--; if (month < 1) { month = 12; year--; }
    this.setData({ year, month });
    this.render();
  },
  nextMonth() {
    util.haptic();
    let { year, month } = this.data;
    month++; if (month > 12) { month = 1; year++; }
    this.setData({ year, month });
    this.render();
  },
  backToday() {
    const now = new Date();
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
    this.render();
  },

  openDay(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    getApp().openNotesWith({ date });
  },
  onShareAppMessage() {
    return { title: '拾光 · 心情日历', path: '/pages/calendar/calendar' };
  }
});
