<template>
  <view class="page">
    <view class="topbar"></view>

    <view class="logo-head">
      <view class="logo-circle">
        <text class="logo-pets">🐱</text>
        <text class="logo-spark">✨</text>
      </view>
      <text class="logo-title">财务管家</text>
      <text class="logo-sub">让记账像撸猫一样治愈轻松 ✨</text>
    </view>

    <view class="card">
      <view class="field">
        <text class="field-label">用户名</text>
        <view class="input-wrap">
          <text class="input-icon">🪪</text>
          <input class="input" v-model="username" placeholder="起一个好听的昵称" placeholder-class="ph" />
        </view>
      </view>

      <view class="field">
        <text class="field-label">设置密码</text>
        <view class="input-wrap">
          <text class="input-icon">🔒</text>
          <input class="input input-pwd" :password="!showPwd" v-model="password" placeholder="6位以上，含数字/小写/大写/特殊字符中三种" placeholder-class="ph" />
          <text class="input-eye" @tap="togglePwd">{{ showPwd ? '👁' : '🙈' }}</text>
        </view>
      </view>

      <view class="field">
        <text class="field-label">确认密码</text>
        <view class="input-wrap">
          <text class="input-icon">✅</text>
          <input class="input" :password="!showPwd" v-model="confirmPassword" placeholder="再次输入密码确认" placeholder-class="ph" />
        </view>
      </view>

      <text v-if="error" class="err">{{ error }}</text>

      <button class="btn-primary" :disabled="submitting" @tap="submit">
        <text>加入财务小窝</text>
        <text class="btn-arrow">💗</text>
      </button>

      <view class="check agree" @tap="agree = !agree">
        <view class="check-box" :class="{ on: agree }"><text v-if="agree" class="check-mark">✓</text></view>
        <text class="check-label agree-label">同意 <text class="agree-link" @tap.stop="goAgreement">用户服务协议</text> 与 <text class="agree-link" @tap.stop="goPrivacy">隐私政策</text></text>
      </view>
      <text class="age-note">本产品面向 18 岁以上用户</text>
    </view>

    <view class="center">
      <button class="link-btn" @tap="goLogin">
        <text class="link-arrow">←</text>
        <text>已有账号？直接登录</text>
      </button>
    </view>

    <view class="footer">
      <text class="footer-icon">🌱</text>
      <text class="footer-text">每一笔记账，都是对生活的小小热爱</text>
    </view>

    <!-- 密码规范提示弹窗 -->
    <view v-if="showRule" class="mask" @tap="showRule = false">
      <view class="modal" @tap.stop>
        <view class="modal-icon">🔒</view>
        <text class="modal-title">密码不符合规范，请重新输入</text>
        <text class="modal-desc">需 6 位以上，且包含数字、小写字母、大写字母、特殊字符中的至少三种</text>
        <button class="modal-btn" @tap="showRule = false">我知道了</button>
      </view>
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
      confirmPassword: '',
      showPwd: false,
      agree: false,
      error: '',
      showRule: false,
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
    goLogin() {
      uni.redirectTo({ url: '/pages/login/login' });
    },
    passwordInvalid() {
      const p = this.password;
      const kinds = (/\d/.test(p) ? 1 : 0) + (/[a-z]/.test(p) ? 1 : 0) + (/[A-Z]/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
      return p.length < 6 || kinds < 3;
    },
    submit() {
      if (this.submitting) return;
      if (!this.agree) {
        this.error = '请先阅读并同意用户协议与隐私政策';
        return;
      }
      const username = this.username.trim();
      const password = this.password;
      const confirmPassword = this.confirmPassword;
      if (!username || !password || !confirmPassword) {
        this.error = '请填写完整的注册信息';
        return;
      }
      if (password !== confirmPassword) {
        this.error = '两次输入的密码不一致';
        return;
      }
      if (this.passwordInvalid()) {
        this.showRule = true;
        return;
      }
      this.submitting = true;
      this.error = '';
      post('/api/auth/register', { username, password, confirmPassword }).then((res) => {
        if (res.status >= 200 && res.status < 300) {
          uni.reLaunch({ url: '/pages/add/add' });
          return;
        }
        this.submitting = false;
        this.error = res.data.message || '注册失败，请稍后再试';
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
.age-note {
  display: block;
  margin-top: 12rpx;
  text-align: center;
  font-size: 24rpx;
  color: #877275;
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
  margin-right: 8rpx;
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

/* 弹窗 */
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(52, 47, 49, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}
.modal {
  width: 100%;
  max-width: 560rpx;
  background: #fff8f9;
  border-radius: 48rpx;
  padding: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.modal-icon {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #ffd9e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-bottom: 32rpx;
}
.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
  margin-bottom: 16rpx;
}
.modal-desc {
  font-size: 28rpx;
  color: #544245;
  margin-bottom: 40rpx;
}
.modal-btn {
  width: 100%;
  height: 96rpx;
  background: #9b3f5a;
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
