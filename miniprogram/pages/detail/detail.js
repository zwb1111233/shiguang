const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    entry: null,
    shared: null,
    current: 0,
    deleted: false
  },

  onLoad(query) {
    this.id = Number(query.id || 0);
    if (query.shared) {
      // 好友打开的分享落地：本地没有数据，用分享参数渲染摘要卡
      let text = query.text || '';
      try { text = decodeURIComponent(text); } catch (err) { /* 已是明文 */ }
      this.setData({
        shared: {
          date: query.date || '',
          mood: query.mood || '',
          text
        }
      });
      wx.setNavigationBarTitle({ title: '来自好友的拾光' });
    }
  },

  onShow() {
    if (getApp().requireLock('pages/detail/detail')) return;
    this.setData({ tc: getApp().themeClass() });
    if (this.id) {
      const entry = store.getEntry(this.id);
      if (entry) {
        this.setData({ entry: store.decorate(entry) });
      } else if (!this.data.deleted) {
        util.toast('这条记录不存在或已删除');
        setTimeout(() => wx.navigateBack(), 600);
      }
    }
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current });
  },

  previewImage() {
    const e = this.data.entry;
    if (!e) return;
    const urls = e.media.filter(m => !m.isVideo).map(m => m.path);
    const cur = urls[this.data.current];
    if (urls.length) wx.previewImage({ urls, current: cur || urls[0] });
  },

  tapTag(e) {
    const tag = e.currentTarget.dataset.tag;
    getApp().openNotesWith({ tag });
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/compose/compose?id=${this.id}` });
  },

  confirmDelete() {
    util.haptic();
    wx.showModal({
      title: '删除这条记录？',
      content: '文字、照片和视频会一并删除，无法恢复',
      confirmText: '删除',
      confirmColor: '#e30000',
      success: res => {
        if (!res.confirm) return;
        store.removeEntry(this.id);
        this.setData({ deleted: true });
        util.toast('已删除');
        setTimeout(() => wx.navigateBack(), 500);
      }
    });
  },

  onShareAppMessage() {
    const e = this.data.entry;
    if (!e) return { title: '拾光 · 每日心情手账', path: '/pages/home/home' };
    return {
      title: `${util.fmtMD(e.date)}，${e.moodLabel || '记录'}的一天 · 拾光`,
      path: `/pages/detail/detail?shared=1&date=${e.date}&mood=${e.mood || ''}&text=${encodeURIComponent((e.text || '').slice(0, 160))}`,
      imageUrl: e.media.length ? e.media[0].path : undefined
    };
  }
});
