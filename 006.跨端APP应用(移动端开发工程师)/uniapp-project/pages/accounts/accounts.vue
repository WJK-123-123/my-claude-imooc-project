<template>
  <view class="page">
    <view class="header">
      <view class="header-back" @tap="goBack">‹</view>
      <text class="header-title">账户管理</text>
      <view class="header-spacer"></view>
    </view>

    <view class="body">
      <view class="note">
        <text class="note-icon">ℹ️</text>
        <text class="note-text">管理记账时可选择的支付账户（仅作标记，不含余额）</text>
      </view>

      <!-- 账户列表 -->
      <view v-if="accounts.length" class="list">
        <view v-for="a in accounts" :key="a.id" class="item">
          <view class="item-emoji"><text>{{ a.emoji }}</text></view>
          <view class="item-mid">
            <text class="item-name">{{ a.name }}</text>
            <text class="item-remark">{{ a.remark || '—' }}</text>
          </view>
          <view class="item-action item-action-edit" @tap="openEdit(a)"><text>✏️</text></view>
          <view class="item-action item-action-del" @tap="askDelete(a)"><text>🗑</text></view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty">
        <view class="empty-icon"><text>🐱</text></view>
        <text class="empty-title">还没有账户哦</text>
        <text class="empty-desc">添加现金、支付宝、微信等账户吧～</text>
      </view>

      <button class="add-btn" @tap="openAdd">＋ 添加账户</button>
    </view>

    <!-- 编辑/添加弹窗 -->
    <view v-if="modalVisible" class="mask" @tap="modalVisible = false">
      <view class="modal" @tap.stop>
        <text class="modal-title">{{ modalTitle }}</text>
        <view class="modal-row">
          <view class="modal-preview"><text>{{ emojiSel }}</text></view>
          <input class="modal-input" v-model="name" maxlength="8" placeholder="账户名称，如：现金" placeholder-class="ph" />
        </view>
        <input class="modal-input modal-input-full" v-model="remark" maxlength="12" placeholder="备注（可选），如：日常现金" placeholder-class="ph" />
        <text class="modal-label">选择图标</text>
        <view class="emoji-grid">
          <view v-for="e in EMOJIS" :key="e" class="emoji-cell" :class="e === emojiSel ? 'emoji-on' : ''" @tap="selectEmoji(e)">{{ e }}</view>
        </view>
        <view class="modal-actions">
          <button class="m-cancel" @tap="modalVisible = false">取消</button>
          <button class="m-save" @tap="save">保存</button>
        </view>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <view v-if="delVisible" class="mask" @tap="delVisible = false">
      <view class="del-box" @tap.stop>
        <view class="del-icon"><text>⚠️</text></view>
        <text class="del-title">删除账户</text>
        <text class="del-desc">确定删除「{{ delName }}」吗？</text>
        <view class="del-actions">
          <button class="m-cancel" @tap="delVisible = false">取消</button>
          <button class="m-del" @tap="confirmDel">确认删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { get, post, put, del } from '@/common/api.js';
import { toast } from '@/common/util.js';

const EMOJIS = ['💰','💙','💚','🏦','🧧','💳','🐱','🐶','🍜','☕','🧋','🚇','🚗','✈️','🏠','🎮','🛍','💊','📈','✨','🧰','🎓','🎁','🐾','🌸','📱','💻','🏥','📦','⚽','🎯','🍖'];

export default {
  data() {
    return {
      EMOJIS,
      accounts: [],
      modalVisible: false,
      modalTitle: '添加账户',
      editingId: null,
      name: '',
      remark: '',
      emojiSel: EMOJIS[0],
      delVisible: false,
      delId: null,
      delName: ''
    };
  },
  onLoad() {
    this.load();
  },
  methods: {
    toast,
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) uni.navigateBack();
      else uni.reLaunch({ url: '/pages/profile/profile' });
    },
    async load() {
      try {
        const r = await get('/api/accounts');
        if (r.status === 401) { uni.reLaunch({ url: '/pages/login/login' }); return; }
        if (r.status < 200 || r.status >= 300) throw new Error();
        this.accounts = r.data.accounts || [];
      } catch (e) {
        this.accounts = [];
      }
    },
    openAdd() {
      this.editingId = null;
      this.modalTitle = '添加账户';
      this.name = '';
      this.remark = '';
      this.emojiSel = EMOJIS[0];
      this.modalVisible = true;
    },
    openEdit(a) {
      this.editingId = a.id;
      this.modalTitle = '编辑账户';
      this.name = a.name;
      this.remark = a.remark || '';
      this.emojiSel = a.emoji;
      this.modalVisible = true;
    },
    selectEmoji(e) {
      this.emojiSel = e;
    },
    async save() {
      const name = this.name.trim();
      if (!name) { toast('请输入账户名称'); return; }
      const payload = { name, emoji: this.emojiSel, remark: this.remark.trim() };
      try {
        const r = this.editingId != null ? await put('/api/accounts/' + this.editingId, payload) : await post('/api/accounts', payload);
        if (r.status < 200 || r.status >= 300) { toast((r.data && r.data.message) || '保存失败'); return; }
        this.modalVisible = false;
        await this.load();
      } catch (e) {
        toast('网络异常，请稍后再试');
      }
    },
    askDelete(a) {
      this.delId = a.id;
      this.delName = a.name;
      this.delVisible = true;
    },
    async confirmDel() {
      if (this.delId == null) return;
      try {
        const r = await del('/api/accounts/' + this.delId);
        if (r.status < 200 || r.status >= 300) { toast((r.data && r.data.message) || '删除失败'); return; }
        this.delVisible = false;
        await this.load();
      } catch (e) {
        toast('网络异常，请稍后再试');
      }
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
  display: flex;
  align-items: center;
  height: calc(var(--status-bar-height) + 128rpx);
  padding-left: 32rpx;
  padding-right: 32rpx;
}
.header-back {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #fcf1f4;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
}
.header-title {
  flex: 1;
  text-align: center;
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.header-spacer {
  width: 80rpx;
}

.body {
  padding: calc(var(--status-bar-height) + 160rpx) 32rpx 80rpx;
}

.note {
  display: flex;
  align-items: center;
  padding: 0 8rpx;
  margin-bottom: 24rpx;
}
.note-icon {
  font-size: 30rpx;
  color: #9b3f5a;
  margin-right: 8rpx;
}
.note-text {
  font-size: 24rpx;
  color: #877275;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 32rpx;
}
.item {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 24rpx rgba(155, 63, 90, 0.05);
}
.item-emoji {
  width: 96rpx;
  height: 96rpx;
  border-radius: 32rpx;
  background: rgba(255, 217, 224, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  flex-shrink: 0;
  margin-right: 24rpx;
}
.item-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.item-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.item-remark {
  font-size: 24rpx;
  color: #877275;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-action {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f6ebee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
  margin-left: 12rpx;
}
.item-action-edit {
  color: #9b3f5a;
}
.item-action-del {
  color: #ba1a1a;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64rpx 32rpx;
  text-align: center;
  margin-bottom: 32rpx;
}
.empty-icon {
  width: 192rpx;
  height: 192rpx;
  border-radius: 50%;
  background: rgba(255, 217, 224, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 80rpx;
  margin-bottom: 32rpx;
}
.empty-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
  margin-bottom: 8rpx;
}
.empty-desc {
  font-size: 28rpx;
  color: #544245;
}

.add-btn {
  width: 100%;
  height: 96rpx;
  background: rgba(255, 217, 224, 0.7);
  color: #9b3f5a;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
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
.modal {
  width: 100%;
  max-width: 560rpx;
  background: #fff8f9;
  border-radius: 40rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.2);
}
.modal-title {
  display: block;
  text-align: center;
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
  margin-bottom: 24rpx;
}
.modal-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.modal-preview {
  width: 96rpx;
  height: 96rpx;
  border-radius: 32rpx;
  background: #ffd9e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.modal-input {
  flex: 1;
  height: 88rpx;
  padding: 0 24rpx;
  background: #fcf1f4;
  border: 2rpx solid #f0e5e8;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #1f1a1d;
}
.modal-input-full {
  width: 100%;
  margin-bottom: 24rpx;
}
.modal-label {
  display: block;
  font-size: 24rpx;
  color: #877275;
  margin-bottom: 12rpx;
}
.ph {
  color: #dac0c4;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12rpx;
  margin-bottom: 32rpx;
}
.emoji-cell {
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  background: #fcf1f4;
}
.emoji-on {
  background: #ffd9e0;
  box-shadow: inset 0 0 0 4rpx #9b3f5a;
}
.modal-actions {
  display: flex;
  gap: 20rpx;
}
.m-cancel {
  flex: 1;
  height: 88rpx;
  background: #f0e5e8;
  color: #1f1a1d;
  border-radius: 44rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-save {
  flex: 1;
  height: 88rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 44rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.del-box {
  width: 100%;
  max-width: 560rpx;
  background: #fff8f9;
  border-radius: 40rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.del-icon {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: #ffdad6;
  color: #93000a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-bottom: 16rpx;
}
.del-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
  margin-bottom: 8rpx;
}
.del-desc {
  font-size: 28rpx;
  color: #544245;
  margin-bottom: 32rpx;
}
.del-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}
.m-del {
  flex: 1;
  height: 88rpx;
  background: #ba1a1a;
  color: #fff;
  border-radius: 44rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
