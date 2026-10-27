<template>
  <view class="page">
    <view class="header">
      <view class="header-back" @tap="goBack">‹</view>
      <text class="header-title">分类管理</text>
      <view class="header-spacer"></view>
    </view>

    <view class="body">
      <!-- 支出/收入 Tab -->
      <view class="tabs">
        <view class="tab" :class="curTab === 'expense' ? 'tab-on' : ''" @tap="switchTab('expense')">支出分类</view>
        <view class="tab" :class="curTab === 'income' ? 'tab-on' : ''" @tap="switchTab('income')">收入分类</view>
      </view>

      <!-- 分类列表 -->
      <view v-if="curList.length" class="list">
        <view v-for="c in curList" :key="c.id" class="item">
          <view class="item-emoji"><text>{{ c.icon }}</text></view>
          <view class="item-mid">
            <text class="item-name">{{ c.name }}</text>
            <text class="item-type">{{ curTab === 'expense' ? '支出分类' : '收入分类' }}</text>
          </view>
          <view class="item-action item-action-edit" @tap="openEdit(c)"><text>✏️</text></view>
          <view class="item-action item-action-del" @tap="askDelete(c)"><text>🗑</text></view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty">
        <view class="empty-icon"><text>🐱</text></view>
        <text class="empty-title">这里还没有分类哦</text>
        <text class="empty-desc">添加几个分类，记账更轻松～</text>
      </view>

      <button class="add-btn" @tap="openAdd">＋ 添加分类</button>
    </view>

    <!-- 编辑/添加弹窗 -->
    <view v-if="modalVisible" class="mask" @tap="modalVisible = false">
      <view class="modal" @tap.stop>
        <text class="modal-title">{{ modalTitle }}</text>
        <view class="modal-row">
          <view class="modal-preview"><text>{{ emojiSel }}</text></view>
          <input class="modal-input" v-model="name" maxlength="6" placeholder="分类名称，如：餐饮" placeholder-class="ph" />
        </view>
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
        <text class="del-title">删除分类</text>
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

const EMOJIS = ['🍜','☕','🧋','🚇','🚗','✈️','🏠','🎮','🛍','💊','📈','✨','🧰','🎓','🎁','🐾','🌸','📱','💻','🏥','📦','⚽','🎯','🍖','💰','💙','💚','🏦','🧧','💳','🐱','🐶'];

export default {
  data() {
    return {
      EMOJIS,
      cats: { expense: [], income: [] },
      curTab: 'expense',
      modalVisible: false,
      modalTitle: '添加支出分类',
      editingId: null,
      name: '',
      emojiSel: EMOJIS[0],
      delVisible: false,
      delId: null,
      delName: ''
    };
  },
  computed: {
    curList() {
      return this.cats[this.curTab] || [];
    }
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
        const r = await get('/api/categories');
        if (r.status === 401) { uni.reLaunch({ url: '/pages/login/login' }); return; }
        if (r.status < 200 || r.status >= 300) throw new Error();
        const all = r.data.categories || [];
        const cats = { expense: [], income: [] };
        all.forEach((c) => { if (cats[c.scope]) cats[c.scope].push(c); });
        this.cats = cats;
      } catch (e) {
        this.cats = { expense: [], income: [] };
      }
    },
    switchTab(t) {
      this.curTab = t;
    },
    openAdd() {
      this.editingId = null;
      this.modalTitle = '添加' + (this.curTab === 'expense' ? '支出' : '收入') + '分类';
      this.name = '';
      this.emojiSel = EMOJIS[0];
      this.modalVisible = true;
    },
    openEdit(c) {
      this.editingId = c.id;
      this.modalTitle = '编辑分类';
      this.name = c.name;
      this.emojiSel = c.icon;
      this.modalVisible = true;
    },
    selectEmoji(e) {
      this.emojiSel = e;
    },
    async save() {
      const name = this.name.trim();
      if (!name) { toast('请输入分类名称'); return; }
      const payload = { scope: this.curTab, name, icon: this.emojiSel };
      try {
        const r = this.editingId != null ? await put('/api/categories/' + this.editingId, payload) : await post('/api/categories', payload);
        if (r.status < 200 || r.status >= 300) { toast((r.data && r.data.message) || '保存失败'); return; }
        this.modalVisible = false;
        await this.load();
      } catch (e) {
        toast('网络异常，请稍后再试');
      }
    },
    askDelete(c) {
      this.delId = c.id;
      this.delName = c.name;
      this.delVisible = true;
    },
    async confirmDel() {
      if (this.delId == null) return;
      try {
        const r = await del('/api/categories/' + this.delId);
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

.tabs {
  display: flex;
  background: #f6ebee;
  padding: 8rpx;
  border-radius: 24rpx;
  gap: 8rpx;
  margin-bottom: 24rpx;
}
.tab {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #544245;
  transition: all 0.15s;
}
.tab-on {
  background: #ffffff;
  color: #9b3f5a;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
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
  border-radius: 50%;
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
.item-type {
  font-size: 24rpx;
  color: #877275;
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
  margin-bottom: 24rpx;
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
