<template>
  <view class="page">
    <view class="header">
      <text class="header-title">个人中心</text>
      <view class="header-bell">🔔</view>
    </view>

    <view class="body">
      <!-- 顶部个人资料区 -->
      <view class="profile-area">
        <view class="avatar-wrap">
          <view class="avatar" @tap="chooseAvatar">
            <image v-if="avatarUrl" class="avatar-img" :src="avatarUrl" mode="aspectFill" />
            <text v-else class="avatar-emoji">🐱</text>
          </view>
          <view class="avatar-badge">📷</view>
        </view>
        <view class="profile-name">
          <text class="name">{{ username }}</text>
          <text v-if="registeredAt" class="reg">注册于 {{ registeredAt }}</text>
        </view>
        <view class="profile-badge">
          <text class="badge-icon">🎖</text>
          <text class="badge-text">{{ badge }}</text>
        </view>
      </view>

      <!-- 数据概览卡片 -->
      <view class="stat-grid">
        <view class="stat-card">
          <text class="stat-label">累计记账</text>
          <view class="stat-num-row"><text class="stat-num">{{ totalCount }}</text><text class="stat-unit">笔</text></view>
        </view>
        <view class="stat-card">
          <text class="stat-label">记账天数</text>
          <view class="stat-num-row"><text class="stat-num">{{ daysCount }}</text><text class="stat-unit">天</text></view>
        </view>
        <view class="stat-card">
          <text class="stat-label">本月记账</text>
          <view class="stat-num-row"><text class="stat-num">{{ monthCount }}</text><text class="stat-unit">笔</text></view>
        </view>
      </view>

      <!-- 管理分组 -->
      <view class="group">
        <text class="group-label">管理</text>
        <view class="group-card">
          <view class="group-item" @tap="goAccounts">
            <view class="group-item-left">
              <view class="group-icon"><text>👛</text></view>
              <text class="group-text">账户管理</text>
            </view>
            <text class="group-arrow">›</text>
          </view>
          <view class="group-divider"></view>
          <view class="group-item" @tap="goCategories">
            <view class="group-item-left">
              <view class="group-icon"><text>🏷</text></view>
              <text class="group-text">分类管理</text>
            </view>
            <text class="group-arrow">›</text>
          </view>
          <view class="group-divider"></view>
          <view class="group-item" @tap="showDeleteModal">
            <view class="group-item-left">
              <view class="group-icon group-icon-error"><text>🚪</text></view>
              <text class="group-text group-text-error">注销账号</text>
            </view>
            <text class="group-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 底部操作区 -->
      <view class="foot">
        <button class="logout-btn" @tap="showLogoutModal">🚪 退出登录</button>
        <view class="foot-note">
          <text class="foot-heart">💗</text>
          <text>财务管家 · 极简记账 治愈生活</text>
        </view>
      </view>
    </view>

    <!-- 退出登录弹窗 -->
    <view v-if="showLogout" class="mask" @tap="showLogout = false">
      <view class="dialog" @tap.stop>
        <view class="dialog-icon"><text>🚪</text></view>
        <text class="dialog-title">确定要退出登录吗？</text>
        <text class="dialog-desc">退出后本地未同步的数据可能会丢失哦~</text>
        <view class="dialog-actions">
          <button class="d-cancel" @tap="showLogout = false">取消</button>
          <button class="d-ok" @tap="doLogout">退出</button>
        </view>
      </view>
    </view>

    <!-- 注销账号弹窗 -->
    <view v-if="showDelete" class="mask" @tap="showDelete = false">
      <view class="dialog" @tap.stop>
        <view class="dialog-icon dialog-icon-error"><text>⚠️</text></view>
        <text class="dialog-title">注销账号</text>
        <text class="dialog-desc">提交后进入 7 天冷静期，冷静期内登录可撤销；期满后所有记账数据将被永久删除，无法找回。</text>
        <input class="dialog-input" :password="!showPwd" v-model="deletePassword" placeholder="请输入登录密码确认" placeholder-class="ph" />
        <view class="dialog-actions">
          <button class="d-cancel" @tap="showDelete = false">我再想想</button>
          <button class="d-danger" @tap="confirmDeactivate">确认注销</button>
        </view>
      </view>
    </view>

    <TabBar active="profile" variant="profile" />
  </view>
</template>

<script>
import { get, post, put, clearToken } from '@/common/api.js';
import { BASE_URL } from '@/common/config.js';
import { toast } from '@/common/util.js';
import TabBar from '@/components/TabBar.vue';

export default {
  components: { TabBar },
  data() {
    return {
      me: null,
      stats: null,
      showLogout: false,
      showDelete: false,
      showPwd: false,
      deletePassword: ''
    };
  },
  computed: {
    username() { return this.me && this.me.username || '小桃子酱'; },
    registeredAt() { return this.me && this.me.registeredAt || ''; },
    badge() {
      if (this.me && this.me.id != null && this.me.joinedDays != null) {
        return '已坚持记账 ' + this.me.joinedDays + ' 天 · UID: ' + this.me.id;
      }
      return '已坚持记账 48 天 · UID: 20491';
    },
    avatarUrl() {
      const url = (this.me && this.me.avatarUrl) || '';
      // 后端存/返回的是相对路径 /uploads/avatars/...，App/鸿蒙端 <image> 无法解析相对地址，需拼上 BASE_URL
      // （H5 时 BASE_URL 为空，仍走相对路径、由浏览器按同源解析）
      if (url && url.startsWith('/')) return BASE_URL + url;
      return url;
    },
    totalCount() { return this.stats ? this.stats.totalCount : 0; },
    daysCount() { return this.stats ? this.stats.daysCount : 0; },
    monthCount() { return this.stats ? this.stats.monthCount : 0; }
  },
  onLoad() {
    this.loadData();
  },
  methods: {
    toast,
    loadData() {
      get('/api/auth/me').then((r) => {
        if (r.status >= 200 && r.status < 300) this.me = r.data;
      }).catch(() => {});
      get('/api/profile/stats').then((r) => {
        if (r.status >= 200 && r.status < 300) this.stats = r.data;
      }).catch(() => {});
    },
    goAccounts() {
      uni.navigateTo({ url: '/pages/accounts/accounts' });
    },
    goCategories() {
      uni.navigateTo({ url: '/pages/categories/categories' });
    },
    chooseAvatar() {
      uni.chooseImage({
        count: 1,
        success: (res) => {
          const path = res.tempFilePaths && res.tempFilePaths[0];
          if (!path) return;
          // #ifdef H5
          const xhr = new XMLHttpRequest();
          xhr.open('GET', path, true);
          xhr.responseType = 'blob';
          xhr.onload = () => {
            const reader = new FileReader();
            reader.onloadend = () => this.uploadAvatar(reader.result);
            reader.readAsDataURL(xhr.response);
          };
          xhr.onerror = () => toast('读取图片失败');
          xhr.send();
          // #endif
          // #ifndef H5
          const ext = (path.split('.').pop() || 'png').toLowerCase();
          const mime = ext === 'jpeg' || ext === 'jpg' ? 'jpeg' : ext === 'webp' ? 'webp' : ext === 'gif' ? 'gif' : 'png';
          uni.getFileSystemManager().readFile({
            filePath: path,
            encoding: 'base64',
            success: (r) => this.uploadAvatar('data:image/' + mime + ';base64,' + r.data),
            fail: () => toast('读取图片失败')
          });
          // #endif
        }
      });
    },
    uploadAvatar(dataUrl) {
      if (!/^data:image\//.test(dataUrl)) { toast('请选择图片文件'); return; }
      put('/api/profile/avatar', { avatar: dataUrl }).then((r) => {
        if (r.status >= 200 && r.status < 300 && r.data.avatarUrl) {
          if (this.me) this.me.avatarUrl = r.data.avatarUrl;
        } else {
          toast((r.data && r.data.message) || '头像上传失败');
        }
      }).catch(() => toast('网络异常，头像上传失败'));
    },
    showLogoutModal() { this.showLogout = true; },
    showDeleteModal() { this.showDelete = true; },
    doLogout() {
      post('/api/auth/logout').then(() => {
        clearToken();
        uni.reLaunch({ url: '/pages/login/login' });
      }).catch(() => {
        clearToken();
        uni.reLaunch({ url: '/pages/login/login' });
      });
    },
    confirmDeactivate() {
      const password = this.deletePassword;
      if (!password) { toast('请输入登录密码'); return; }
      post('/api/auth/deactivate', { password }).then((r) => {
        if (r.status >= 200 && r.status < 300) {
          clearToken();
          uni.reLaunch({ url: '/pages/login/login' });
        } else {
          toast((r.data && r.data.message) || '操作失败，请稍后再试');
        }
      }).catch(() => toast('网络异常，请稍后再试'));
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
  background: rgba(255, 244, 247, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 2rpx solid #F7E5EB;
}
.header-title {
  height: 112rpx;
  line-height: 112rpx;
  padding: 0 40rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #2D2024;
  display: inline-block;
}
.header-bell {
  position: absolute;
  right: 40rpx;
  top: calc(var(--status-bar-height) + 28rpx);
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #FFE5EC;
  color: #9b3f5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}

.body {
  padding: calc(var(--status-bar-height) + 144rpx) 32rpx 240rpx;
}

.profile-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 40rpx;
}
.avatar-wrap {
  position: relative;
  margin-bottom: 20rpx;
}
.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #FFE2EB;
  border: 4rpx solid #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(255, 143, 171, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.avatar-emoji {
  font-size: 72rpx;
}
.avatar-img {
  width: 100%;
  height: 100%;
}
.avatar-badge {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF8FAB, #9b3f5a);
  border: 4rpx solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}
.profile-name {
  display: flex;
  align-items: baseline;
  margin-bottom: 8rpx;
}
.name {
  font-size: 36rpx;
  font-weight: 700;
  color: #2D2024;
  margin-right: 8rpx;
}
.reg {
  font-size: 22rpx;
  color: #877275;
}
.profile-badge {
  display: flex;
  align-items: center;
  padding: 8rpx 24rpx;
  border-radius: 40rpx;
  background: #FFEBF0;
  color: #9b3f5a;
}
.badge-icon {
  font-size: 22rpx;
  margin-right: 6rpx;
}
.badge-text {
  font-size: 22rpx;
  font-weight: 500;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 40rpx;
}
.stat-card {
  background: #FFFBFC;
  border: 2rpx solid #FFF0F4;
  border-radius: 32rpx;
  padding: 24rpx 12rpx;
  box-shadow: 0 8rpx 32rpx rgba(255, 143, 171, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.stat-label {
  font-size: 22rpx;
  color: #877275;
  margin-bottom: 8rpx;
  font-weight: 500;
}
.stat-num-row {
  display: flex;
  align-items: baseline;
}
.stat-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #9b3f5a;
}
.stat-unit {
  font-size: 22rpx;
  color: #877275;
}

.group {
  margin-bottom: 48rpx;
}
.group-label {
  display: block;
  padding: 0 8rpx 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(135, 114, 117, 0.8);
  letter-spacing: 2rpx;
}
.group-card {
  background: #FFFBFC;
  border: 2rpx solid #FFF0F4;
  border-radius: 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(255, 143, 171, 0.12);
  overflow: hidden;
}
.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
}
.group-item:active {
  background: #FFEBF0;
}
.group-item-left {
  display: flex;
  align-items: center;
}
.group-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 24rpx;
  background: #FFEAF1;
  color: #9b3f5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  margin-right: 24rpx;
}
.group-icon-error {
  background: #FDECEF;
  color: #BA1A1A;
}
.group-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #2D2024;
}
.group-text-error {
  color: #BA1A1A;
}
.group-arrow {
  font-size: 36rpx;
  color: rgba(135, 114, 117, 0.7);
}
.group-divider {
  height: 2rpx;
  background: #FDF1F4;
  margin-left: 128rpx;
}

.foot {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logout-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(90deg, #9b3f5a, #802a42);
  color: #ffffff;
  border-radius: 48rpx;
  font-size: 30rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(155, 63, 90, 0.25);
}
.foot-note {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: rgba(135, 114, 117, 0.65);
}
.foot-heart {
  font-size: 22rpx;
  color: rgba(155, 63, 90, 0.6);
  margin-right: 6rpx;
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
  background: #FFFBFC;
  border-radius: 48rpx;
  padding: 48rpx;
  border: 2rpx solid #FFF0F4;
  box-shadow: 0 8rpx 32rpx rgba(255, 143, 171, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.dialog-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #FFE5EC;
  color: #9b3f5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  margin-bottom: 24rpx;
}
.dialog-icon-error {
  background: #FFDAD6;
  color: #93000A;
}
.dialog-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2D2024;
  margin-bottom: 12rpx;
}
.dialog-desc {
  font-size: 22rpx;
  color: #877275;
  line-height: 1.6;
  margin-bottom: 32rpx;
}
.dialog-input {
  width: 100%;
  height: 88rpx;
  padding: 0 32rpx;
  background: #F5E9EC;
  border-radius: 44rpx;
  font-size: 28rpx;
  color: #2D2024;
  margin-bottom: 32rpx;
}
.ph {
  color: #c4aeb5;
}
.dialog-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}
.d-cancel {
  flex: 1;
  height: 80rpx;
  background: #F5E9EC;
  color: #2D2024;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-ok {
  flex: 1;
  height: 80rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.d-danger {
  flex: 1;
  height: 80rpx;
  background: #BA1A1A;
  color: #fff;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
