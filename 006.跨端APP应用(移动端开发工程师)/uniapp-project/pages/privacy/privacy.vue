<template>
  <view class="page">
    <view class="topbar"></view>

    <view class="head">
      <view class="back" @tap="goBack"><text class="back-icon">←</text></view>
      <text class="title">隐私政策</text>
      <text class="ver">V1.0</text>
    </view>
    <text class="date">更新日期：2026-11-05 · 生效日期：2026-11-05</text>

    <view class="card">
      <view class="sec" v-for="(s, i) in sections" :key="i">
        <text class="sec-title">{{ s.t }}</text>
        <text class="sec-p" v-for="(p, j) in s.ps" :key="j">{{ p }}</text>
      </view>
    </view>

    <view class="footer">
      <text class="footer-icon">🌱</text>
      <text class="footer-text">每一笔记账，都是对生活的小小热爱</text>
    </view>
  </view>
</template>

<script>
// 隐私政策正文（与 Web 端 003/pages/15_privacy_policy.html 同内容同版本，改动须两侧同步）
export default {
  data() {
    return {
      sections: [
        { t: '一、我们收集哪些信息', ps: [
          '遵循最小化收集原则，我们仅收集以下信息：',
          '1. 账号信息：用户名与密码。密码仅以不可逆加密哈希（bcrypt）形式存储，平台无法获知您的密码明文。',
          '2. 记账数据：您记录的账单（类型、金额、分类、支付方式标记、备注、日期）、自定义分类与账户、头像图片。',
          '3. 登录凭据：登录后设备保存的会话令牌（仅存不可逆哈希，30 天有效）。',
          '我们不收集手机号、身份证等实名信息，不采集设备敏感信息，不做个性化推荐。',
        ] },
        { t: '二、信息的用途', ps: ['您的信息仅用于提供与维护产品功能：登录与多设备数据同步、记账与流水展示、年度统计、账号安全保护（如异常登录锁定）。我们不将您的数据用于任何营销用途。'] },
        { t: '三、保存期限', ps: ['记账数据在您的账号存续期间保存。您申请注销账号后进入 7 天冷静期，期间可登录撤销；冷静期满后，账号与全部账单数据将被不可恢复地删除。'] },
        { t: '四、您的权利', ps: [
          '1. 查询与更正：您可随时在流水、统计及分类/账户管理页查看、编辑自己的数据。',
          '2. 留存：您可在统计页导出年度统计报表自行留存。',
          '3. 注销：您可通过「我的 → 设置 → 注销账号」删除账号与全部数据（需密码确认，7 天冷静期）。',
        ] },
        { t: '五、信息的共享', ps: ['我们不向任何第三方共享、出售您的个人信息。除法律法规要求或主管部门依法定程序要求外，不会向外部提供您的数据。'] },
        { t: '六、本地存储说明', ps: ['我们仅使用登录会话令牌维持登录状态（App 存于本机存储、不暴露给页面脚本读取）；不使用任何第三方跟踪标识或广告标识。'] },
        { t: '七、政策更新', ps: ['本政策如有修订，我们将更新页面顶部的版本号与更新日期并在产品内公示。若您在修订后继续使用，即视为接受修订内容。'] },
      ],
    };
  },
  methods: {
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) uni.navigateBack();
      else uni.reLaunch({ url: '/pages/login/login' });
    },
  },
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #FFF4F7;
  padding: 0 32rpx 64rpx;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: calc(var(--status-bar-height) + 24rpx);
}
.head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 8rpx;
}
.back {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4rpx 12rpx rgba(155, 63, 90, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon {
  font-size: 36rpx;
  color: #1f1a1d;
}
.title {
  font-size: 48rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.ver {
  margin-left: auto;
  font-size: 24rpx;
  color: #544245;
  background: #ffffff;
  border-radius: 999rpx;
  padding: 8rpx 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(155, 63, 90, 0.06);
}
.date {
  font-size: 24rpx;
  color: #877275;
  margin: 16rpx 4rpx 24rpx;
}
.card {
  background: #ffffff;
  border-radius: 48rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 16rpx 32rpx rgba(155, 63, 90, 0.06);
  display: flex;
  flex-direction: column;
}
.sec {
  margin-bottom: 32rpx;
  display: flex;
  flex-direction: column;
}
.sec:last-child {
  margin-bottom: 0;
}
.sec-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f1a1d;
  margin-bottom: 12rpx;
}
.sec-p {
  font-size: 28rpx;
  color: #544245;
  line-height: 1.7;
  margin-bottom: 8rpx;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 48rpx;
  color: #877275;
}
.footer-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}
.footer-text {
  font-size: 24rpx;
}
</style>
