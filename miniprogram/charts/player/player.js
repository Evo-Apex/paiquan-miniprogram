/**
 * 选手能力雷达（ECharts）。
 *
 * 为什么用 ECharts 而不是自己画 canvas：
 *   手写的版本三个问题——卡片透明（主题变量不在作用域）、数字被原生画布盖住
 *   （canvas 是原生组件，层级永远在最上面）、坐标轴文字被裁（半径算小了）。
 *   ECharts 的 name 标签会自己收进图内，原生层级的问题也不存在。
 *
 * 数据在 utils/match_result_data.js（主包），分包可以 require 主包的模块。
 * 六轴按全场 60 人的最大值归一化，所以满格 = 全会第一。
 */
import * as echarts from "../ec-canvas/echarts";

var i18n = require("../../utils/i18n.js");
var theme = require("../../utils/theme.js");
var RAW = require("../../utils/match_result_data.js");

var DIMS = ["kills", "dmg", "knocks", "assists", "kd", "kp"];

function labelKeys() {
  var T = i18n.T(i18n.getLang());
  return [T.radarKills, T.radarDmg, T.radarKnocks, T.radarAssists, T.radarKd, T.radarKp];
}

Page({
  data: {
    lang: i18n.getLang(),
    T: i18n.T(i18n.getLang()),
    theme: theme.getTheme(),
    player: "",
    team: "",
    nums: [],
    ec: {
      onInit: null   // onLoad 里再赋值，因为要先知道选的是谁
    }
  },

  onLoad: function (q) {
    var raw = RAW.players || {};
    var rows = raw.rows || [];
    var idx = Number(q && q.p);
    var row = rows[idx];
    if (!row) {
      this.setData({ player: "", team: "" });
      return;
    }
    var T = this.data.T;
    var f = raw.field || {};
    var labels = labelKeys();
    var nums = DIMS.map(function (k, i) {
      return { k: labels[i], v: String(row.stats[k]), a: String((f[k] && f[k].avg) || "") };
    });
    this._row = row;
    this._field = f;
    this.setData({ player: row.player, team: row.team, nums: nums });
    try { wx.setNavigationBarTitle({ title: row.player }); } catch (e) { /* 旧基础库 */ }

    var self = this;
    this.setData({
      ec: {
        onInit: function (canvas, width, height, dpr) {
          var E = echarts && echarts.init ? echarts : (echarts && echarts.default) || echarts;
          var chart = E.init(canvas, null, { width: width, height: height, devicePixelRatio: dpr });
          canvas.setChart(chart);
          chart.setOption(self.buildOption());
          self._chart = chart;
          return chart;
        }
      }
    });
    theme.applyChrome(this.data.theme);
  },

  buildOption: function () {
    var T = this.data.T;
    var row = this._row;
    var f = this._field;
    var labels = labelKeys();
    var dark = this.data.theme !== "light";

    var me = DIMS.map(function (k) { return row.stats[k] || 0; });
    var avg = DIMS.map(function (k) { return (f[k] && f[k].avg) || 0; });

    return {
      backgroundColor: "transparent",
      legend: {
        bottom: 0,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: dark ? "#9aa4b4" : "#545f6e", fontSize: 11 },
        data: [T.resRadarAvg, T.resRadarSelf]
      },
      radar: {
        center: ["50%", "46%"],
        radius: "62%",
        splitNumber: 4,
        axisName: { color: dark ? "#9aa4b4" : "#545f6e", fontSize: 11 },
        splitLine: { lineStyle: { color: dark ? "#2b3140" : "#e2e5eb" } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: dark ? "#2b3140" : "#e2e5eb" } },
        indicator: DIMS.map(function (k, i) {
          return { name: labels[i], max: (f[k] && f[k].max) || 1 };
        })
      },
      series: [{
        type: "radar",
        symbolSize: 3,
        data: [
          {
            value: avg,
            name: T.resRadarAvg,
            lineStyle: { type: "dashed", width: 1.5, color: dark ? "#8b95a6" : "#7b8595" },
            itemStyle: { color: dark ? "#8b95a6" : "#7b8595" },
            areaStyle: { opacity: 0 }
          },
          {
            value: me,
            name: T.resRadarSelf,
            lineStyle: { width: 2, color: dark ? "#ff5a52" : "#c62828" },
            itemStyle: { color: dark ? "#ff5a52" : "#c62828" },
            areaStyle: { opacity: 0.18, color: dark ? "#ff5a52" : "#c62828" }
          }
        ]
      }]
    };
  }
});
