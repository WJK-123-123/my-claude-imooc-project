<script>
export default {
  onLaunch: function () {},
  onShow: function () {},
  onHide: function () {}
}
</script>

<style>
/* 全局基础样式（每页共用）：粉嫩可爱风设计令牌，对齐 003 前端 DESIGN.md */
page {
  background-color: #FFF4F7;
  color: #1f1a1d;
  font-family: "PingFang SC", "Helvetica Neue", "Helvetica", "Arial", sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

view, text, button, input, textarea, scroll-view {
  box-sizing: border-box;
}

/* 重置 uni-app button 默认样式，按钮外观全部由页面样式控制 */
button {
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  line-height: inherit;
  font-size: inherit;
  color: inherit;
  border-radius: 0;
}
button::after {
  border: none;
}

/* 安全区：底部栏预留 iPhone 底部小黑条 */
.safe-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
