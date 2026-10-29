const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    theme: 'auto',
    lockEnabled: false,
    pass: '',
    pass2: '',
    oldPass: '',
    newPass: '',
    stats: null,
    version: 'v1.2.0'
  },

  onShow() {
    if (getApp().requireLock('pages/settings/settings')) return;
    const s = store.getSettings();
    this.setData({
      tc: getApp().themeClass(),
      theme: s.theme,
      lockEnabled: s.lockEnabled,
      pass: '', pass2: '', oldPass: '', newPass: '',
      stats: store.stats()
    });
  },

  // ---- 外观 ----
  pickTheme(e) {
    const theme = e.currentTarget.dataset.v;
    util.haptic();
    store.setSettings({ theme });
    this.setData({ theme, tc: getApp().themeClass() });
  },

  // ---- 隐私锁 ----
  onPass(e) { this.setData({ pass: e.detail.value }); },
  onPass2(e) { this.setData({ pass2: e.detail.value }); },
  onOldPass(e) { this.setData({ oldPass: e.detail.value }); },
  onNewPass(e) { this.setData({ newPass: e.detail.value }); },

  enableLock() {
    const { pass, pass2 } = this.data;
    if (!/^\d{4,8}$/.test(pass)) return util.toast('密码需要 4-8 位数字');
    if (pass !== pass2) return util.toast('两次输入的密码不一样');
    store.setLock(pass);
    this.setData({ lockEnabled: true, pass: '', pass2: '' });
    util.toast('隐私锁已开启 🔒', 'success');
  },
  changeLock() {
    const { oldPass, newPass } = this.data;
    if (!store.checkLock(oldPass)) return util.toast('当前密码不正确');
    if (!/^\d{4,8}$/.test(newPass)) return util.toast('新密码需要 4-8 位数字');
    store.setLock(newPass);
    this.setData({ oldPass: '', newPass: '' });
    util.toast('密码已修改 ✓', 'success');
  },
  disableLock() {
    if (!store.checkLock(this.data.oldPass)) return util.toast('密码不正确，无法关闭');
    store.clearLock();
    this.setData({ lockEnabled: false, oldPass: '' });
    util.toast('隐私锁已关闭', 'success');
  },

  // ---- 数据 ----
  exportData() {
    try {
      const path = store.exportJSON();
      wx.shareFileMessage({
        filePath: path,
        fileName: `shiguang-export-${store.todayStr()}.json`,
        success: () => util.toast('已发送', 'success'),
        fail: () => {
          // 模拟器或用户取消时，退回到复制到剪贴板
          const rows = store.listEntries();
          const brief = JSON.stringify(rows.map(e => ({ date: e.date, mood: e.mood, text: e.text, tags: e.tags })));
          wx.setClipboardData({ data: brief, success: () => util.toast('已复制文字数据到剪贴板') });
        }
      });
    } catch (e) { util.toast('导出失败'); }
  },

  clearData() {
    util.haptic();
    wx.showModal({
      title: '清空所有记录？',
      content: '全部文字、照片和视频都会被删除，无法恢复。建议先导出备份。',
      confirmText: '清空',
      confirmColor: '#e30000',
      success: res => {
        if (!res.confirm) return;
        store.clearAll();
        util.toast('已清空', 'success');
        this.onShow();
      }
    });
  }
});
