const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    isEdit: false,
    date: '',
    maxDate: '',
    moods: util.MOOD_LIST,
    picked: '',
    text: '',
    media: [],
    saving: false
  },

  onLoad(query) {
    this.id = Number(query.id || 0);
    const edit = this.id ? store.getEntry(this.id) : null;
    const media = [];
    if (edit) {
      store.decorate(edit).media.forEach(m => {
        media.push({
          mid: m.id,
          type: m.type,
          path: m.path,
          isVideo: m.isVideo
        });
      });
      this.setData({
        isEdit: true,
        date: edit.date,
        picked: edit.mood || '',
        text: edit.text,
        media
      });
      wx.setNavigationBarTitle({ title: '编辑记录' });
    } else {
      this.setData({ date: util.todayStr() });
    }
    this.setData({ maxDate: util.todayStr(), tc: getApp().themeClass() });
  },

  onShow() {
    if (getApp().requireLock('pages/compose/compose')) return;
  },

  pickMood(e) {
    util.haptic();
    const key = e.currentTarget.dataset.key;
    this.setData({ picked: this.data.picked === key ? '' : key });
  },

  onDate(e) { this.setData({ date: e.detail.value }); },
  onText(e) { this.setData({ text: e.detail.value }); },

  addImages() {
    const left = 12 - this.data.media.filter(m => !m.isVideo).length;
    if (left <= 0) return util.toast('最多 12 张照片');
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: res => {
        const add = res.tempFiles.map(f => ({
          type: 'image', tempPath: f.tempFilePath, path: f.tempFilePath,
          isVideo: false, w: f.width, h: f.height
        }));
        this.setData({ media: this.data.media.concat(add) });
        util.haptic();
      }
    });
  },

  addVideo() {
    if (this.data.media.some(m => m.isVideo)) return util.toast('一次只能带一个视频');
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 60,
      success: res => {
        const f = res.tempFiles[0];
        this.setData({
          media: this.data.media.concat([{
            type: 'video', tempPath: f.tempFilePath, path: f.thumbTempPath || '',
            posterTemp: f.thumbTempPath || '', isVideo: true, w: f.width, h: f.height
          }])
        });
        util.haptic();
      }
    });
  },

  removeMedia(e) {
    const idx = e.currentTarget.dataset.idx;
    const media = this.data.media.slice();
    media.splice(idx, 1);
    this.setData({ media });
  },

  async save() {
    if (this.data.saving) return;
    const { text, picked, date, media, isEdit } = this.data;
    if (!text.trim() && media.length === 0) return util.toast('写点什么，或添加照片/视频吧');
    this.setData({ saving: true });
    wx.showLoading({ title: isEdit ? '保存中…' : '发布中…', mask: true });
    try {
      if (isEdit) {
        const keepIds = media.filter(m => m.mid).map(m => m.mid);
        const newMedia = media.filter(m => !m.mid).map(m => ({
          type: m.type, tempPath: m.tempPath,
          posterTempPath: m.posterTemp || null, w: m.w, h: m.h
        }));
        store.updateEntry(this.id, { date, mood: picked, text, keepIds, newMedia });
      } else {
        store.addEntry({
          date, mood: picked, text,
          media: media.map(m => ({
            type: m.type, tempPath: m.tempPath,
            posterTempPath: m.posterTemp || null, w: m.w, h: m.h
          }))
        });
      }
      wx.hideLoading();
      util.haptic();
      util.toast(isEdit ? '已保存 ✓' : '已发布 ✓', 'success');
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      wx.hideLoading();
      util.toast('保存失败，请重试');
      this.setData({ saving: false });
    }
  }
});
