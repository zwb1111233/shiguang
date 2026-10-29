const store = require('../../utils/store');
const util = require('../../utils/util');

Page({
  data: {
    tc: '',
    pass: '',
    shaking: false,
    unlocking: false
  },

  onLoad() {
    this.setData({ tc: getApp().themeClass() });
  },

  onPass(e) { this.setData({ pass: e.detail.value }); },

  unlock() {
    if (this.data.unlocking) return;
    const pass = this.data.pass;
    if (!pass) return;
    this.setData({ unlocking: true });
    // 轻微延迟让按钮反馈先渲染
    setTimeout(() => {
      if (store.checkLock(pass)) {
        getApp().globalData.locked = false;
        util.haptic();
        wx.reLaunch({ url: '/pages/home/home' });
      } else {
        this.setData({ shaking: true, pass: '', unlocking: false });
        util.toast('密码不正确，再试试');
        setTimeout(() => this.setData({ shaking: false }), 500);
      }
    }, 150);
  }
});
