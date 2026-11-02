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

    // 参考的做法：轴名和数值写在一起（"场均伤害 340.51"），比纯轴名信息量大，
    // 也不用悬停/看表。这里照做：indicator.name = 标签 + 空格 + 数值。
    var fmt = function (k, i) {
      var v = me[i];
      return labels[i] + " " + (Math.round(v * 100) / 100);
    };

    var playerColor = dark ? "#ff4d9e" : "#c2185b";   // 选手：品红
    var avgColor = dark ? "#8b7cf0" : "#6a5acd";      // 赛段平均：紫，虚线
    var nameColor = dark ? "#e8e2f0" : "#3a3348";

    return {
      backgroundColor: "transparent",
      legend: {
        top: 0,
        itemWidth: 16,
        itemHeight: 8,
        textStyle: { color: dark ? "#b9b3c9" : "#5f586e", fontSize: 11 },
        data: [T.resRadarAvg, T.resRadarSelf]
      },
      radar: {
        center: ["50%", "52%"],
        radius: "58%",
        splitNumber: 4,
        axisName: { color: nameColor, fontSize: 11, fontWeight: "bold" },
        splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.22)" : "#dfe3ea" } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.18)" : "#e2e5eb" } },
        indicator: DIMS.map(function (k, i) {
          return { name: fmt(k, i), max: (f[k] && f[k].max) || 1 };
        })
      },
      series: [{
        type: "radar",
        symbolSize: 3,
        data: [
          {
            value: avg,
            name: T.resRadarAvg,
            lineStyle: { type: "dashed", width: 1.5, color: avgColor },
            itemStyle: { color: avgColor },
            areaStyle: { opacity: 0 }
          },
          {
            value: me,
            name: T.resRadarSelf,
            lineStyle: { width: 2, color: playerColor },
            itemStyle: { color: playerColor },
            areaStyle: { opacity: 0.35, color: playerColor }
          }
        ]
      }]
    };
  }
  }
});
