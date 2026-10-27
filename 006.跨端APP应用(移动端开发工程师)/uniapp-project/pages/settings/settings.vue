<template>
  <view class="page">
    <view class="header">
      <text class="header-title">设置</text>
      <view class="header-avatar" @tap="goProfile">👤</view>
    </view>

    <view class="body">
      <!-- 账号信息 -->
      <view class="account-card">
        <view class="account-avatar"><text>🙂</text></view>
        <view class="account-mid">
          <text class="account-name">{{ username }}</text>
          <text class="account-sub">极简记账，治愈生活</text>
        </view>
        <view class="account-badge"><text>已登录</text></view>
      </view>

      <!-- 通用设置 -->
      <view class="list-card">
        <view class="list-item">
          <view class="list-item-left">
            <view class="list-icon"><text>📄</text></view>
            <text class="list-text">用户协议</text>
          </view>
          <text class="list-arrow">›</text>
        </view>
        <view class="list-divider"></view>
        <view class="list-item">
          <view class="list-item-left">
            <view class="list-icon"><text>🔐</text></view>
            <text class="list-text">隐私政策</text>
          </view>
          <text class="list-arrow">›</text>
        </view>
        <view class="list-divider"></view>
        <view class="list-item">
          <view class="list-item-left">
            <view class="list-icon"><text>ℹ️</text></view>
            <text class="list-text">关于财务管家</text>
          </view>
          <view class="list-right">
            <text class="list-ver">v1.0</text>
            <text class="list-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 账号操作 -->
      <view class="ops">
        <button class="logout-btn" @tap="showLogoutModal">🚪 退出登录</button>
        <button class="delete-btn" @tap="showDeleteModal">🚫 注销账号</button>
        <text class="ops-note">退出仅结束本机登录；注销将永久清空全部记账数据</text>
      </view>
    </view>

    <!-- 退出登录弹窗 -->
    <view v-if="showLogout" class="mask" @tap="showLogout = false">
      <view class="dialog" @tap.stop>
        <view class="dialog-icon dialog-icon-tertiary"><text>🚪</text></view>
        <text class="dialog-title">确定要退出登录吗？</text>
        <text class="dialog-desc">退出后本地未同步的数据可能会丢失哦~</text>
        <view class="dialog-actions">
          <button class="d-cancel" @tap="backToMine">取消</button>
          <button class="d-tertiary" @tap="doLogout">退出</button>
        </view>
      </view>
    </view>

    <!-- 注销账号弹窗 -->
    <view v-if="showDelete" class="mask" @tap="showDelete = false">
      <view class="dialog" @tap.stop>
        <view class="dialog-icon dialog-icon-error"><text>⚠️</text></view>
        <text class="dialog-title">注销账号警告</text>
        <text class="dialog-desc">注销后所有记账数据将被永久清空，无法找回，请谨慎操作！</text>
        <text class="dialog-label">请输入登录密码确认</text>
        <input class="dialog-input" :password="true" v-model="deletePassword" placeholder="输入密码以确认注销" placeholder-class="ph" />
        <text v-if="deleteError" class="dialog-error">{{ deleteError }}</text>
        <view class="dialog-actions">
          <button class="d-cancel" @tap="backToMine">我再想想</button>
          <button class="d-danger" :disabled="submitting" @tap="doDeactivate">{{ submitting ? '提交中…' : '确认注销' }}</button>
        </view>
      </view>
    </view>

    <!-- 注销成功弹窗 -->
    <view v-if="showSuccess" class="mask">
      <view class="dialog">
        <view class="dialog-icon dialog-icon-ok"><text>✅</text></view>
        <text class="dialog-title">注销申请已提交</text>
        <text class="dialog-desc">已进入 7 天冷静期，期间重新登录即可撤销注销；期满后数据将永久删除。</text>
        <button class="d-ok" @tap="gotoLogin">我知道了</button>
      </view>
    </view>

    <TabBar active="profile" />
  </view>
</template>

<script>
import { get, post, clearToken } from '@/common/api.js';
import { toast } from '@/common/util.js';
import TabBar from '@/components/TabBar.vue';

export default {
  components: { TabBar },
  data() {
    return {
      username: '小桃子酱',
      showLogout: false,
      showDelete: false,
      showSuccess: false,
      deletePassword: '',
      deleteError: '',
      submitting: false
    };
  },
  onLoad() {
    get('/api/auth/me').then((r) => {
      if (r.status >= 200 && r.status < 300 && r.data.username) this.username = r.data.username;
    }).catch(() => {});
  },
  methods: {
    toast,
    goProfile() {
      uni.reLaunch({ url: '/pages/profile/profile' });
    },
    backToMine() {
      this.showLogout = false;
      this.showDelete = false;
      uni.reLaunch({ url: '/pages/profile/profile' });
    },
    showLogoutModal() { this.showLogout = true; },
    showDeleteModal() {
      this.deletePassword = '';
      this.deleteError = '';
      this.showDelete = true;
    },
    doLogout() {
      post('/api/auth/logout').then(() => {
        clearToken();
        uni.reLaunch({ url: '/pages/login/login' });
      }).catch(() => {
        clearToken();
        uni.reLaunch({ url: '/pages/login/login' });
      });
    },
    doDeactivate() {
      if (this.submitting) return;
      const password = this.deletePassword.trim();
      if (!password) { this.deleteError = '请输入登录密码'; return; }
      this.deleteError = '';
      this.submitting = true;
      post('/api/auth/deactivate', { password }).then((r) => {
        if (r.status >= 200 && r.status < 300) {
          clearToken();
          this.showDelete = false;
          this.submitting = false;
          this.showSuccess = true;
        } else {
          this.submitting = false;
          this.deleteError = (r.data && r.data.message) || '注销失败，请稍后再试';
        }
      }).catch(() => {
        this.submitting = false;
        this.deleteError = '网络异常，请稍后再试';
      });
    },
    gotoLogin() {
      uni.reLaunch({ url: '/pages/login/login' });
    }
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #FFF4F7;
}
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding-top: var(--status-bar-height);
  background: rgba(255, 248, 249, 0.8);
  backdrop-filter: blur(24px);
  box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.04);
}
.header-title {
  height: 128rpx;
  line-height: 128rpx;
  padding: 0 32rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #1f1a1d;
  display: inline-block;
}
.header-avatar {
  position: absolute;
  right: 32rpx;
  top: calc(var(--status-bar-height) + 32rpx);
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #9b3f5a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.body {
  padding: calc(var(--status-bar-height) + 160rpx) 32rpx 240rpx;
}

.account-card {
  background: #fcf1f4;
  border-radius: 40rpx;
  padding: 40rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 48rpx rgba(155, 63, 90, 0.06);
  margin-bottom: 32rpx;
}
.account-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #ffd9e0;
  color: #3f0018;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  flex-shrink: 0;
  margin-right: 32rpx;
}
.account-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.account-name {
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.account-sub {
  font-size: 24rpx;
  color: #544245;
  margin-top: 4rpx;
}
.account-badge {
  flex-shrink: 0;
  height: 48rpx;
  padding: 0 24rpx;
  border-radius: 40rpx;
  background: #75f9d4;
  color: #005140;
  display: flex;
  align-items: center;
  font-size: 24rpx;
  font-weight: 600;
}

.list-card {
  background: #fcf1f4;
  border-radius: 40rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 48rpx rgba(155, 63, 90, 0.04);
  margin-bottom: 40rpx;
}
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
}
.list-item-left {
  display: flex;
  align-items: center;
}
.list-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 32rpx;
  background: #f0e5e8;
  color: #9b3f5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-right: 28rpx;
}
.list-text {
  font-size: 32rpx;
  font-weight: 500;
  color: #1f1a1d;
}
.list-arrow {
  font-size: 36rpx;
  color: #544245;
}
.list-right {
  display: flex;
  align-items: center;
}
.list-ver {
  font-size: 24rpx;
  color: #544245;
  margin-right: 16rpx;
}
.list-divider {
  height: 2rpx;
  background: #f0e5e8;
  margin-left: 136rpx;
}

.ops {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logout-btn {
  width: 100%;
  height: 112rpx;
  background: #ae2f34;
  color: #ffffff;
  border-radius: 56rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(174, 47, 52, 0.2);
  margin-bottom: 24rpx;
}
.delete-btn {
  width: 100%;
  height: 96rpx;
  background: transparent;
  color: #ba1a1a;
  border-radius: 48rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}
.ops-note {
  font-size: 22rpx;
  color: #877275;
  text-align: center;
}

.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.dialog {
  width: 100%;
  max-width: 560rpx;
  background: #fff8f9;
  border-radius: 48rpx;
  padding: 48rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.dialog-icon {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  margin-bottom: 24rpx;
}
.dialog-icon-tertiary {
  background: #ffdad8;
  color: #410006;
}
.dialog-icon-error {
  background: #ffdad6;
  color: #93000a;
}
.dialog-icon-ok {
  background: #ffd9e0;
  color: #3f0018;
}
.dialog-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
  margin-bottom: 12rpx;
}
.dialog-desc {
  font-size: 24rpx;
  color: #544245;
  line-height: 1.6;
  margin-bottom: 32rpx;
}
.dialog-label {
  align-self: flex-start;
  font-size: 24rpx;
  font-weight: 600;
  color: #544245;
  margin-bottom: 8rpx;
  margin-left: 4rpx;
}
.dialog-input {
  width: 100%;
  height: 88rpx;
  padding: 0 32rpx;
  background: #fcf1f4;
  border: 2rpx solid #f0e5e8;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #1f1a1d;
  margin-bottom: 16rpx;
}
.ph {
  color: #dac0c4;
}
.dialog-error {
  align-self: flex-start;
  width: 100%;
  font-size: 22rpx;
  color: #ba1a1a;
  text-align: center;
  margin-bottom: 8rpx;
}
.dialog-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-top: 8rpx;
}
.d-cancel {
  flex: 1;
  height: 96rpx;
  background: #f0e5e8;
  color: #1f1a1d;
  border-radius: 48rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-tertiary {
  flex: 1;
  height: 96rpx;
  background: #ae2f34;
  color: #fff;
  border-radius: 48rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-danger {
  flex: 1;
  height: 96rpx;
  background: #ba1a1a;
  color: #fff;
  border-radius: 48rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-ok {
  width: 100%;
  height: 96rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 48rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
