/**
 * 小游戏分类页（pages/games）上显示的两个题量：猜圈练习、圈型速判。
 *
 * 为什么抄在这里（2026-11-07）：三个玩法页和它们的题库搬进了分包 games/（主包少约 470 KB），
 * 而分类页是 tab，只能留在主包；主包不能 require 分包里的文件，题库又只在分包里，
 * 所以把两个数抄在这里。
 *
 * 题库更新后这两个数要跟着改：tests/page.test.mjs「小游戏分类页」会拿真题库核对，
 * 对不上就报错并给出正确的数 —— 照着改这里，别改测试。
 */
module.exports = {
  ringQuestions: 757,  // games/utils/rings.js 的 allQuestions().length
  pickQuestions: 749   // games/utils/ringpick.js 的 bank().length
};
