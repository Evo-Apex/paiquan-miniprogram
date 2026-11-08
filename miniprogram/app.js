// 小程序全局逻辑。
// 这里做两件事：初始化云开发（否则 wx.cloud.callFunction 用不了）；「外观」跟随系统时，手机切换深浅色跟着换。
/**
 * 云开发环境 ID。
 *
 * **这个必须写**。官方文档里 env 标注为「必填」：不传的话小程序端不知道
 * 要连哪个云环境，模拟器和真机都会直接报
 *   -601034「没有权限，请先开通云开发或者云托管」
 * 而云函数在控制台里跑得好好的，特别容易误判成"云开发没开通"，白折腾很久。
 *
 * 换环境（或以后建了新环境）时，去云开发控制台左上角的环境列表里抄新的 ID，
 * 形如 cloud1-xxxxxxxxxxxxxxxx。
 */
var CLOUD_ENV = "cloud1-d8ggx095757c58e20";
var theme = require("./utils/theme.js");

App({
  onLaunch: function () {
    if (!wx.cloud) {
      // 基础库太旧，云能力不可用。这种情况页面会收到 callFunction 报错，
      // 提前打日志方便排查，别让用户对着白屏猜。
      console.error("当前基础库不支持云开发，请在开发者工具里把调试基础库调高（>= 2.2.3）");
      return;
    }

    // 刻意不设置 traceUser（它默认就是 false）。
    //
    // traceUser: true 会把用户访问记录到云开发控制台的「用户管理」里，
    // 也就是把 openid 这类个人信息存下来 —— 而本项目压根不需要知道"谁在用"。
    // 一旦被认定"处理用户个人信息"，微信就要求配置《用户隐私保护指引》、
    // 弹隐私授权框、在提审时逐项声明，纯属自找麻烦。
    // 不采集，就不需要那一整套。
    wx.cloud.init({
      env: CLOUD_ENV
    });

    // 「外观」选了跟随系统时，手机切换深浅色要跟着换（2026-11-08）。
    // 当前页面直接刷新；后面压着的页面回到前台时 onShow 自己会对一遍
    if (wx.onThemeChange) {
      wx.onThemeChange(function (res) {
        if (!theme.onSystemChange(res && res.theme)) return;
        var pages = getCurrentPages();
        var page = pages[pages.length - 1];
        if (page && page.data && page.data.theme !== undefined) page.setData({ theme: theme.getTheme() });
      });
    }
  },

  globalData: {}
});
