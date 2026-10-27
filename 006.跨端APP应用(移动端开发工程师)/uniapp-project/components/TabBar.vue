<template>
  <view class="tabbar" :class="{ 'tabbar--profile': variant === 'profile' }">
    <view class="tabbar__item" :class="{ 'is-active': active === 'flow' }" @tap="go('flow')">
      <text class="tabbar__icon">🧾</text>
      <text class="tabbar__label">流水</text>
    </view>
    <view class="tabbar__item" :class="{ 'is-active': active === 'add' }" @tap="go('add')">
      <view class="tabbar__fab">
        <text class="tabbar__fab-icon">＋</text>
      </view>
      <text class="tabbar__label">记一笔</text>
    </view>
    <view class="tabbar__item" :class="{ 'is-active': active === 'stats' }" @tap="go('stats')">
      <text class="tabbar__icon">📊</text>
      <text class="tabbar__label">统计</text>
    </view>
    <view class="tabbar__item" :class="{ 'is-active': active === 'profile' }" @tap="go('profile')">
      <text class="tabbar__icon">👤</text>
      <text class="tabbar__label">我的</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'TabBar',
  props: {
    active: { type: String, default: 'add' },
    // variant: 'default'（05/06/07/11 页） | 'profile'（10 我的页）
    variant: { type: String, default: 'default' }
  },
  methods: {
    go(key) {
      if (key === this.active) return;
      const map = {
        flow: '/pages/flow/flow',
        add: '/pages/add/add',
        stats: '/pages/stats/stats',
        profile: '/pages/profile/profile'
      };
      uni.reLaunch({ url: map[key] });
    }
  }
}
</script>

<style>
/* 底部导航栏（对齐 003 前端自绘底部导航，非原生 tabBar） */
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 160rpx; /* h-20 = 80px */
  padding: 0 8rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(255, 248, 249, 0.9);
  backdrop-filter: blur(24px);
  box-shadow: 0 -2rpx 16rpx rgba(0, 0, 0, 0.04);
}

.tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 128rpx; /* w-16 = 64px */
  height: 128rpx;
  color: #544245;
}

.tabbar__icon {
  font-size: 44rpx;
  line-height: 1;
  margin-bottom: 4rpx;
}

.tabbar__label {
  font-size: 20rpx; /* label-sm = 10px */
  font-weight: 600;
}

.tabbar__fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx; /* w-12 = 48px */
  height: 96rpx;
  border-radius: 50%;
  background: #9b3f5a;
  box-shadow: 0 6rpx 16rpx rgba(155, 63, 90, 0.35);
  margin-bottom: 4rpx;
}
.tabbar__fab-icon {
  color: #ffffff;
  font-size: 44rpx;
  line-height: 1;
  font-weight: 700;
}

.tabbar__item.is-active {
  color: #9b3f5a;
  font-weight: 700;
}

/* —— 10 我的页变体（h-16 / 22px 图标 / 渐变上浮 FAB） —— */
.tabbar--profile {
  height: 128rpx; /* h-16 = 64px */
  padding: 0 16rpx;
  background: rgba(255, 251, 252, 0.95);
  border-top: 2rpx solid #F7E5EB;
  box-shadow: 0 -4rpx 24rpx rgba(255, 143, 171, 0.08);
}
.tabbar--profile .tabbar__item {
  width: 112rpx;
  height: 112rpx;
  color: #544245;
}
.tabbar--profile .tabbar__icon {
  font-size: 40rpx;
}
.tabbar--profile .tabbar__label {
  font-size: 22rpx;
  font-weight: 500;
}
.tabbar--profile .tabbar__fab {
  margin-top: -32rpx; /* -mt-4 上浮 */
  width: 96rpx;
  height: 96rpx;
  background: linear-gradient(135deg, #9b3f5a, #FF8FAB);
  box-shadow: 0 8rpx 24rpx rgba(255, 143, 171, 0.4);
}
.tabbar--profile .tabbar__item.is-active {
  color: #FF8FAB;
  font-weight: 700;
}
</style>
