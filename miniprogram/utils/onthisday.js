// ============ 历史上的今天 ============
// 优先请求 Wikimedia API（需在真机预览时开启「不校验合法域名」或配置域名白名单），失败时用内置数据兜底。
const BUILTIN = {
  '01-01': [[1912, '中华民国宣布成立，孙中山就任临时大总统'], [1995, '世界贸易组织正式运作'], [1999, '欧元在欧盟部分国家正式启动']],
  '01-27': [[1756, '奥地利作曲家莫扎特在萨尔茨堡出生']],
  '02-14': [[1946, '世界上第一台通用电子计算机 ENIAC 在美国宾夕法尼亚大学公开展示']],
  '02-19': [[1473, '提出日心说的天文学家哥白尼在波兰出生']],
  '03-12': [[1925, '孙中山在北京逝世']],
  '03-14': [[1879, '物理学家爱因斯坦在德国乌尔姆出生'], [1883, '卡尔·马克思在伦敦逝世']],
  '04-15': [[1912, '泰坦尼克号在北大西洋撞上冰山后沉没']],
  '04-24': [[1970, '中国第一颗人造地球卫星“东方红一号”发射成功']],
  '05-01': [[1889, '第二国际巴黎大会确定5月1日为国际劳动节'], [1931, '美国帝国大厦在纽约落成']],
  '05-05': [[1818, '卡尔·马克思在德国特里尔出生']],
  '05-12': [[2008, '四川汶川发生8.0级特大地震，全国展开大规模抗震救灾']],
  '06-01': [[1949, '国际民主妇女联合会确定6月1日为国际儿童节']],
  '07-01': [[1921, '中国共产党第一次全国代表大会在上海开幕'], [1997, '中国政府对香港恢复行使主权']],
  '07-07': [[1937, '卢沟桥事变爆发，中国全民族抗战开始']],
  '07-20': [[1969, '美国阿波罗11号宇航员阿姆斯特朗踏上月球表面']],
  '08-01': [[1927, '南昌起义打响，中国人民解放军的前身由此诞生']],
  '08-08': [[2008, '第29届夏季奥林匹克运动会在北京开幕']],
  '09-03': [[1945, '中国人民抗日战争暨世界反法西斯战争取得胜利']],
  '09-10': [[1985, '中国确定每年9月10日为教师节']],
  '09-18': [[1931, '九一八事变爆发，日本侵占中国东北']],
  '09-25': [[2012, '中国第一艘航空母舰辽宁舰正式交接入列']],
  '10-01': [[1949, '中华人民共和国开国大典在北京天安门广场隆重举行'], [1955, '新疆维吾尔自治区成立'], [1960, '尼日利亚脱离英国殖民统治宣布独立']],
  '10-16': [[1964, '中国第一颗原子弹在罗布泊爆炸成功']],
  '10-24': [[1945, '联合国正式成立'], [1929, '纽约华尔街股市崩盘，史称“黑色星期四”'], [2007, '中国首颗绕月人造卫星嫦娥一号发射成功']],
  '10-28': [[1886, '自由女神像在纽约港落成揭幕'], [1918, '捷克斯洛伐克宣布独立，奥匈帝国走向解体'], [1962, '苏联宣布撤走部署在古巴的导弹，导弹危机落幕']],
  '11-09': [[1989, '柏林墙开放边境，东西德民众涌上街头']],
  '11-12': [[1866, '孙中山在广东香山出生']],
  '12-13': [[1937, '南京大屠杀开始，后成为中国国家公祭日']],
  '12-26': [[1893, '毛泽东在湖南湘潭韶山冲出生']]
};

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).trim();
}

function fetchOnthisday(cb) {
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cacheKey = `sg_hist_${now.getFullYear()}_${mmdd}`;
  const cached = wx.getStorageSync(cacheKey);
  if (cached && cached.events && cached.events.length) return cb(cached);
  wx.request({
    url: `https://api.wikimedia.org/feed/v1/wikipedia/zh/onthisday/selected/${mmdd.split('-')[0]}/${mmdd.split('-')[1]}`,
    timeout: 4000,
    success(res) {
      try {
        const events = (res.data.selected || [])
          .map(e => ({ year: e.year, text: stripHtml(e.text) }))
          .filter(e => e.text)
          .sort((a, b) => a.year - b.year)
          .slice(0, 9);
        if (!events.length) throw new Error('empty');
        const out = { source: 'wikipedia', mmdd, events };
        wx.setStorageSync(cacheKey, out);
        cb(out);
      } catch (e) { fallback(mmdd, cb); }
    },
    fail() { fallback(mmdd, cb); }
  });
}
function fallback(mmdd, cb) {
  const events = (BUILTIN[mmdd] || []).map(([year, text]) => ({ year, text }));
  cb({ source: 'builtin', mmdd, events });
}
module.exports = { fetchOnthisday };
