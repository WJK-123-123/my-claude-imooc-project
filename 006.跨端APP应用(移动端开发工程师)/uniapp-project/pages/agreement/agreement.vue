<template>
  <view class="page">
    <view class="topbar"></view>

    <view class="head">
      <view class="back" @tap="goBack"><text class="back-icon">←</text></view>
      <text class="title">用户协议</text>
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
// 用户协议正文（与 Web 端 003/pages/14_user_agreement.html 同内容同版本，改动须两侧同步）
export default {
  data() {
    return {
      sections: [
        { t: '一、协议的接受', ps: ['欢迎使用财务管家。本协议是您与财务管家之间关于使用本产品（含网页端与移动应用）所订立的条款。您在注册、登录或使用本产品时，即表示已阅读、理解并同意接受本协议全部内容；若不同意，请停止使用并注销账号。'] },
        { t: '二、服务内容', ps: ['财务管家是一款免费的极简记账工具，提供账号注册与登录、记一笔、账单流水、年度统计、分类与支付账户管理、头像设置等功能。您的记账数据云端保存，使用同一账号在其他设备登录即可继续使用。'] },
        { t: '三、账号与安全', ps: [
          '1. 您需设置用户名与密码创建账号，并妥善保管；因保管不善导致的损失由您自行承担。',
          '2. 同一用户名连续输错密码 5 次将锁定 10 分钟；忘记密码可通过登录页「忘记密码」找回。',
          '3. 您可以随时在「我的 → 设置」中申请注销账号；提交后进入 7 天冷静期，期间登录可撤销，期满后账号与全部账单数据将被永久删除且无法恢复。',
        ] },
        { t: '四、用户行为规范', ps: ['您承诺不利用本产品从事违法违规活动、不录入违反法律法规的信息、不干扰产品正常运行（包括恶意刷接口、攻击服务等）。违反者我们有权暂停或终止服务。'] },
        { t: '五、年龄要求', ps: ['本产品面向 18 岁以上用户。未满 18 周岁请在监护人陪同指导下使用。'] },
        { t: '六、服务的变更与终止', ps: ['我们可能因业务调整对服务内容进行变更、暂停或终止，并将尽可能提前公告。因不可抗力、系统维护等原因导致服务中断的，我们将尽力恢复，但对中断期间造成的损失不承担责任。'] },
        { t: '七、免责声明', ps: ['本产品按「现状」提供。在法律允许的范围内，我们对间接损失、数据丢失（您可自行通过统计导出留存数据）等不承担超出法律规定的责任。'] },
        { t: '八、协议更新', ps: ['我们可能不定期修订本协议并在产品内公示，修订后的协议自公示时生效。若您在协议修订后继续使用，即视为接受修订内容。'] },
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
