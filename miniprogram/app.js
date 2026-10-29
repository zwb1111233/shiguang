// ============ 拾光小程序入口 ============
const store = require('./utils/store');
const util = require('./utils/util');

App({
  globalData: { locked: false, pendingNotesFilter: null },

  onLaunch() {
    const s = store.getSettings();
    this.globalData.locked = s.lockEnabled;
  },

  // 跳到手账 tab 并带筛选（tab 页不能直接带 query，先暂存再 switchTab）
  openNotesWith(filter) {
    this.globalData.pendingNotesFilter = filter || null;
    wx.switchTab({ url: '/pages/notes/notes' });
  },

  // 当前生效主题：auto 时返回 ''（交给系统深色媒体查询），手动时返回覆盖类
  themeClass() {
    const s = store.getSettings();
    if (s.theme === 'dark') return 't-dark';
    if (s.theme === 'light') return 't-light';
    return '';
  },

  // 页面 onShow 里调用：需要时跳到锁屏页
  requireLock(route) {
    if (this.globalData.locked && route !== 'pages/lock/lock') {
      wx.reLaunch({ url: '/pages/lock/lock' });
      return true;
    }
    return false;
  },

  // 瀑布流两列列宽（rpx）：750 - 左右页边距 32 - 列间距 24
  colW() { return 347; }
});
