/**
 * 「我的」页上半部分（在分包 evo 里，由主包的 pages/me 异步引用，同 overview 组件）：
 * 游戏 ID + 绑定状态、三格统计、每台电脑一张「电脑上的 Evo」卡（2026-11-08 照 August 的设计稿）。
 * 解绑时先选云端的数据怎么办，选了删除再确认一次（删了不能恢复）：每次都问（Evo 的用户决定）。
 */
var i18n = require("../../../utils/i18n.js");
var view = require("../../utils/view.js");
var evoCloud = require("../../utils/cloud.js");
var state = require("../../utils/state.js");

Component({
  options: { styleIsolation: "apply-shared" },

  properties: {
    lang: { type: String, value: "zh" }
  },

  data: {
    T: i18n.T("zh"),
    state: "loading",
    error: "",
    v: null
  },

  observers: {
    lang: function (lang) {
      this.setData({ T: i18n.T(lang) });
      this.rebuild();
    }
  },

  lifetimes: {
    attached: function () {
      this.load();
    }
  },

  pageLifetimes: {
    // 「我的」每次回到前台都重新读：可能刚在绑定页绑好了一台电脑
    show: function () {
      if (this.loadedAt) this.load();
    }
  },

  methods: {
    load: function () {
      var self = this;
      return evoCloud.callEvo("me").then(function (r) {
        if (!r.ok) {
          if (self._raw) wx.showToast({ title: view.errText(r.code, self.data.T), icon: "none" });
          else self.setData({ state: "error", error: view.errText(r.code, self.data.T) });
          return;
        }
        self.loadedAt = Date.now();
        self._raw = r.data;
        self.rebuild();
      });
    },

    rebuild: function () {
      if (!this._raw) return;
      this.setData({ v: view.meView(this._raw, this.data.T, Date.now()), state: "ready", error: "" });
    },

    /** 管理游戏账号 → 账号页（同一个分包） */
    onAccounts: function () {
      wx.navigateTo({ url: "/evo/accounts/accounts" });
    },

    onScan: function () {
      evoCloud.scanToBind(this.data.T);
    },

    onUnbind: function (e) {
      var self = this;
      var T = this.data.T;
      var device = this.data.v.devices[e.currentTarget.dataset.index];
      wx.showActionSheet({
        alertText: view.fill(T.evoUnbindAsk, { pc: device.name }),
        itemList: [T.evoUnbindKeep, T.evoUnbindDelete],
        success: function (res) {
          if (res.tapIndex === 0) {
            self.doUnbind(device, false);
            return;
          }
          wx.showModal({
            title: T.evoDeleteTitle,
            content: view.count(T.evoDeleteBody, device.matches, { pc: device.name }),
            confirmText: T.evoDeleteConfirm,
            confirmColor: "#d92b2b",   // = --accent（弹窗是原生的，读不到 CSS 变量）
            success: function (r) { if (r.confirm) self.doUnbind(device, true); }
          });
        }
      });
    },

    doUnbind: function (device, deleteData) {
      var self = this;
      var T = this.data.T;
      wx.showLoading({ title: T.evoUnbinding, mask: true });
      evoCloud.callEvo("unbind", { device: device.id, delete_data: deleteData }).then(function (r) {
        wx.hideLoading();
        if (!r.ok) {
          wx.showModal({ title: T.evoUnbindFail, content: view.errText(r.code, T), showCancel: false });
          return;
        }
        wx.showToast({ title: deleteData ? T.evoUnboundDeleted : T.evoUnbound, icon: "success" });
        state.dirty = true;
        state.account = null;
        self.load();
      });
    }
  }
});
