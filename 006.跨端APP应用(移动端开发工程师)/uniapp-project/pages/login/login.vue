<template>
  <view class="page">
    <!-- 顶部留白（避开状态栏） -->
    <view class="topbar"></view>

    <!-- Cute Logo & Title Header -->
    <view class="logo-head">
      <view class="logo-circle">
        <text class="logo-pets">🐱</text>
        <text class="logo-spark">✨</text>
      </view>
      <text class="logo-title">财务管家</text>
      <text class="logo-sub">让记账像撸猫一样治愈轻松 ✨</text>
    </view>

    <!-- Main Card -->
    <view class="card">
      <view class="field">
        <text class="field-label">用户名 / 手机号</text>
        <view class="input-wrap">
          <text class="input-icon">👤</text>
          <input class="input" v-model="username" placeholder="请输入可爱昵称或手机号" placeholder-class="ph" />
        </view>
      </view>

      <view class="field">
        <text class="field-label">密码</text>
        <view class="input-wrap">
          <text class="input-icon">🔒</text>
          <input class="input input-pwd" :password="!showPwd" v-model="password" placeholder="请输入安全密码" placeholder-class="ph" />
          <text class="input-eye" @tap="togglePwd">{{ showPwd ? '👁' : '🙈' }}</text>
        </view>
      </view>

      <view class="row-between">
        <view class="check" @tap="autoLogin = !autoLogin">
          <view class="check-box" :class="{ on: autoLogin }"><text v-if="autoLogin" class="check-mark">✓</text></view>
          <text class="check-label">自动登录</text>
        </view>
        <text class="link" @tap="goForgot">忘记密码？</text>
      </view>

      <text v-if="error" class="err">{{ error }}</text>

      <button class="btn-primary" :disabled="submitting" @tap="submit">
        <text>开启记账之旅</text>
        <text class="btn-arrow">→</text>
      </button>

      <view class="check agree" @tap="agree = !agree">
        <view class="check-box" :class="{ on: agree }"><text v-if="agree" class="check-mark">✓</text></view>
        <text class="check-label agree-label">我已阅读并同意 <text class="agree-link" @tap.stop="goAgreement">用户协议</text> 与 <text class="agree-link" @tap.stop="goPrivacy">隐私政策</text></text>
      </view>
    </view>

    <!-- Switch to Register -->
    <view class="center">
      <button class="link-btn" @tap="goRegister">
        <text>没有账号？立即注册</text>
        <text class="link-arrow">→</text>
      </button>
    </view>

    <!-- Footer Note -->
    <view class="footer">
      <text class="footer-icon">🌱</text>
      <text class="footer-text">每一笔记账，都是对生活的小小热爱</text>
    </view>
  </view>
</template>

<script>
import { post } from '@/common/api.js';

export default {
  data() {
    return {
      username: '',
      password: '',
      showPwd: false,
      autoLogin: false,
      agree: false,
      error: '',
      submitting: false
    };
  },
  methods: {
    goAgreement() {
      uni.navigateTo({ url: '/pages/agreement/agreement' });
    },
    goPrivacy() {
      uni.navigateTo({ url: '/pages/privacy/privacy' });
    },
    togglePwd() {
      this.showPwd = !this.showPwd;
    },
    goForgot() {
      uni.navigateTo({ url: '/pages/forgot/forgot' });
    },
    goRegister() {
      uni.redirectTo({ url: '/pages/register/register' });
    },
    submit() {
      if (this.submitting) return;
      if (!this.agree) {
        this.error = '请先阅读并同意用户协议与隐私政策';
        return;
      }
      const username = this.username.trim();
      const password = this.password;
      if (!username || !password) {
        this.error = '请输入用户名和密码';
        return;
      }
      this.submitting = true;
      this.error = '';
      post('/api/auth/login', { username, password }).then((res) => {
        if (res.status >= 200 && res.status < 300) {
          uni.reLaunch({ url: '/pages/add/add' });
          return;
        }
        this.submitting = false;
        this.error = res.data.message || '登录失败，请稍后再试';
      }).catch(() => {
        this.submitting = false;
        this.error = '网络异常，请稍后再试';
      });
    }
  }
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

/* 顶部 Logo */
.logo-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
}
.logo-circle {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #ffd9e0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  box-shadow: 0 20rpx 40rpx rgba(155, 63, 90, 0.12);
  overflow: hidden;
}
.logo-pets {
  font-size: 72rpx;
}
.logo-spark {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  font-size: 28rpx;
}
.logo-title {
  font-size: 64rpx;
  font-weight: 700;
  color: #1f1a1d;
  letter-spacing: -1rpx;
  line-height: 1.25;
}
.logo-sub {
  margin-top: 8rpx;
  font-size: 28rpx;
  color: #877275;
}

/* 主卡片 */
.card {
  background: #ffffff;
  border-radius: 48rpx;
  padding: 48rpx;
  box-shadow: 0 16rpx 32rpx rgba(155, 63, 90, 0.06);
  display: flex;
  flex-direction: column;
}
.field {
  margin-bottom: 32rpx;
}
.field-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #544245;
  margin-left: 4rpx;
  display: block;
  margin-bottom: 8rpx;
}
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 32rpx;
  font-size: 36rpx;
  z-index: 1;
}
.input {
  flex: 1;
  height: 96rpx;
  padding-left: 96rpx;
  padding-right: 32rpx;
  background: #fcf1f4;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #1f1a1d;
}
.input-pwd {
  padding-right: 96rpx;
}
.input-eye {
  position: absolute;
  right: 32rpx;
  font-size: 36rpx;
}
.ph {
  color: #dac0c4;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 16rpx;
}
.check {
  display: flex;
  align-items: center;
}
.check-box {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 3rpx solid #dac0c4;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8rpx;
  box-sizing: border-box;
}
.check-box.on {
  background: #9b3f5a;
  border-color: #9b3f5a;
}
.check-mark {
  color: #ffffff;
  font-size: 24rpx;
  line-height: 1;
}
.check-label {
  font-size: 24rpx;
  color: #877275;
}
.link {
  font-size: 24rpx;
  color: #9b3f5a;
}

.err {
  font-size: 24rpx;
  color: #93000a;
  text-align: center;
  margin-bottom: 16rpx;
}

.btn-primary {
  height: 96rpx;
  margin-top: 16rpx;
  background: #ff8fab;
  color: #ffffff;
  border-radius: 32rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(255, 143, 171, 0.3);
}
.btn-arrow {
  margin-left: 8rpx;
  font-size: 32rpx;
}

.agree {
  margin-top: 32rpx;
  justify-content: center;
}
.agree-link {
  color: #9b3f5a;
  text-decoration: underline;
}
.agree-label {
  font-size: 24rpx;
  line-height: 1.6;
}

.center {
  margin-top: 32rpx;
  text-align: center;
}
.link-btn {
  display: inline-flex;
  align-items: center;
  color: #9b3f5a;
  font-size: 28rpx;
  font-weight: 600;
}
.link-arrow {
  margin-left: 8rpx;
  font-size: 28rpx;
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
