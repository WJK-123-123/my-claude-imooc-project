<template>
  <view class="page">
    <!-- 顶部栏 -->
    <view class="header">
      <text class="header-title">记一笔</text>
      <view class="header-avatar" @tap="goProfile">👤</view>
    </view>

    <view class="body">
      <!-- 支出 / 收入切换 -->
      <view class="seg">
        <view class="seg-btn" :class="curTab === 'expense' ? 'seg-on-expense' : 'seg-off'" @tap="switchTab('expense')">支出</view>
        <view class="seg-btn" :class="curTab === 'income' ? 'seg-on-income' : 'seg-off'" @tap="switchTab('income')">收入</view>
      </view>

      <!-- 金额显示卡 -->
      <view class="amount-card">
        <view class="amount-deco" :class="curTab === 'expense' ? 'deco-expense' : 'deco-income'"></view>
        <text class="amount-label">输入金额</text>
        <view class="amount-row">
          <text class="amount-symbol" :class="curTab === 'expense' ? 'c-expense' : 'c-income'">¥</text>
          <text class="amount-value">{{ amount }}</text>
        </view>
      </view>

      <!-- 分类九宫格 -->
      <view class="section">
        <view class="section-head">
          <text class="section-title">选择分类</text>
          <text class="section-hint">轻触切换</text>
        </view>
        <view class="cat-grid">
          <view v-for="(c, i) in catPageArr" :key="c.id" class="cat-cell" :class="{ 'cat-on-expense': isCatOn(i) && curTab === 'expense', 'cat-on-income': isCatOn(i) && curTab === 'income' }" @tap="selectCategory(startIndex + i)">
            <view class="cat-circle" :class="catCircleCls(i)">
              <text class="cat-emoji">{{ c.icon }}</text>
            </view>
            <text class="cat-name">{{ c.name }}</text>
          </view>
          <view v-if="!catArr.length" class="cat-empty">暂无分类，请到「我的 → 分类管理」添加</view>
        </view>
        <view v-if="totalPages > 1" class="cat-pager">
          <view class="pager-btn" :style="{ opacity: catPage[curTab] <= 0 ? 0.4 : 1 }" @tap="catPageMove(-1)">‹</view>
          <text class="pager-label">{{ catPage[curTab] + 1 }}/{{ totalPages }}</text>
          <view class="pager-btn" :style="{ opacity: catPage[curTab] >= totalPages - 1 ? 0.4 : 1 }" @tap="catPageMove(1)">›</view>
        </view>
      </view>

      <!-- 备注 / 日期 / 账户 -->
      <view class="detail-card">
        <view class="note-row">
          <text class="note-icon">✏️</text>
          <input class="note-input" v-model="note" maxlength="50" :placeholder="curTab === 'expense' ? '这笔钱花在哪里了？' : '这笔钱从哪儿来呀？'" placeholder-class="ph" />
        </view>
        <view class="date-row" @tap="openCalendar">
          <text class="date-icon">📅</text>
          <text class="date-label">{{ dateText }}</text>
          <text class="date-expand">▾</text>
        </view>
        <view>
          <text class="acct-label">{{ curTab === 'expense' ? '账户' : '收款账户' }}</text>
          <view class="acct-grid">
            <view v-if="!accounts.length" class="acct-empty">暂无账户，请到「我的 → 账户管理」添加</view>
            <view v-for="(a, i) in accounts" :key="a.id" class="acct-pill" :class="acctPillCls(i)" @tap="selectAccount(i)">
              <text class="acct-emoji">{{ a.emoji }}</text>
              <text>{{ a.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 数字键盘 -->
      <view class="pad">
        <view v-for="(b, idx) in padKeys" :key="idx" class="pad-key" :class="padKeyCls(b)" @tap="appendNum(b)">
          <text>{{ b }}</text>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-wrap">
        <button class="save-btn" :class="curTab === 'expense' ? 'save-expense' : 'save-income'" :disabled="saving" @tap="handleSave">
          <text>✓</text>
          <text>保存并继续记账</text>
        </button>
      </view>
    </view>

    <!-- 成功 Toast -->
    <view v-if="showToast" class="toast">
      <text>💗</text>
      <text>记账成功！小主真棒~</text>
    </view>

    <!-- 日历弹窗 -->
    <view v-if="showCalendar" class="mask" @tap="closeCalendar">
      <view class="calendar" @tap.stop>
        <view class="cal-nav">
          <view class="cal-nav-btn" @tap="calStep(-1, 'y')">«</view>
          <view class="cal-nav-btn" @tap="calStep(-1, 'm')">‹</view>
          <text class="cal-title">{{ viewY }}年{{ viewM }}月</text>
          <view class="cal-nav-btn" @tap="calStep(1, 'm')">›</view>
          <view class="cal-nav-btn" @tap="calStep(1, 'y')">»</view>
        </view>
        <view class="cal-week">
          <text v-for="w in week" :key="w" class="cal-week-item">{{ w }}</text>
        </view>
        <view class="cal-grid">
          <view v-for="(d, i) in calDays" :key="i" class="cal-cell">
            <view v-if="d" class="cal-day" :class="calDayCls(d)" @tap="pickDay(d.d)">{{ d.d }}</view>
          </view>
        </view>
        <view class="cal-footer">
          <view class="cal-today" @tap="gotoToday">回到今天</view>
          <view class="cal-close" @tap="closeCalendar">关闭</view>
        </view>
      </view>
    </view>

    <TabBar active="add" />
  </view>
</template>

<script>
import { get, post } from '@/common/api.js';
import { yuanToCents, toast } from '@/common/util.js';
import TabBar from '@/components/TabBar.vue';

const CAT_PAGE_SIZE = 6;

export default {
  components: { TabBar },
  data() {
    const t = new Date();
    return {
      curTab: 'expense',
      cats: { expense: [], income: [] },
      accounts: [],
      catSel: { expense: 0, income: 0 },
      acctSel: { expense: -1, income: -1 },
      catPage: { expense: 0, income: 0 },
      amount: '0.00',
      note: '',
      cur: { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() },
      viewY: t.getFullYear(),
      viewM: t.getMonth() + 1,
      showCalendar: false,
      showToast: false,
      saving: false,
      week: ['日', '一', '二', '三', '四', '五', '六'],
      padKeys: ['1', '2', '3', 'C', '4', '5', '6', '+', '7', '8', '9', '.', '00', '0', 'del']
    };
  },
  computed: {
    catArr() {
      return this.cats[this.curTab] || [];
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.catArr.length / CAT_PAGE_SIZE));
    },
    startIndex() {
      return this.catPage[this.curTab] * CAT_PAGE_SIZE;
    },
    catPageArr() {
      return this.catArr.slice(this.startIndex, this.startIndex + CAT_PAGE_SIZE);
    },
    dateText() {
      return this.cur.y + '年' + this.cur.m + '月' + this.cur.d + '日';
    },
    calDays() {
      const first = new Date(this.viewY, this.viewM - 1, 1).getDay();
      const dim = new Date(this.viewY, this.viewM, 0).getDate();
      const t = new Date();
      const days = [];
      for (let i = 0; i < first; i++) days.push(null);
      for (let d = 1; d <= dim; d++) {
        days.push({
          d,
          sel: d === this.cur.d && this.viewM === this.cur.m && this.viewY === this.cur.y,
          isToday: d === t.getDate() && this.viewM === (t.getMonth() + 1) && this.viewY === t.getFullYear()
        });
      }
      return days;
    }
  },
  onLoad() {
    this.loadData();
  },
  methods: {
    goProfile() {
      uni.reLaunch({ url: '/pages/profile/profile' });
    },
    async loadData() {
      try {
        const [cr, ar] = await Promise.all([get('/api/categories'), get('/api/accounts')]);
        if (cr.status === 401 || ar.status === 401) {
          uni.reLaunch({ url: '/pages/login/login' });
          return;
        }
        const all = (cr.data && cr.data.categories) || [];
        this.cats = { expense: [], income: [] };
        all.forEach((c) => { this.cats[c.scope].push(c); });
        this.accounts = (ar.data && ar.data.accounts) || [];
      } catch (e) {
        this.cats = { expense: [], income: [] };
        this.accounts = [];
      }
      this.normalizePages();
    },
    normalizePages() {
      const arr = this.catArr;
      if (this.catSel[this.curTab] >= arr.length) this.catSel[this.curTab] = Math.max(0, arr.length - 1);
      const tp = Math.max(1, Math.ceil(arr.length / CAT_PAGE_SIZE));
      if (this.catPage[this.curTab] < 0) this.catPage[this.curTab] = 0;
      if (this.catPage[this.curTab] >= tp) this.catPage[this.curTab] = tp - 1;
    },
    switchTab(type) {
      this.curTab = type;
      this.normalizePages();
    },
    isCatOn(i) {
      return (this.startIndex + i) === this.catSel[this.curTab];
    },
    catCircleCls(i) {
      const on = this.isCatOn(i);
      if (on) {
        return this.curTab === 'expense' ? 'circle-expense-on' : 'circle-income-on';
      }
      return 'circle-off';
    },
    selectCategory(globalIndex) {
      this.catSel[this.curTab] = globalIndex;
    },
    catPageMove(delta) {
      const next = this.catPage[this.curTab] + delta;
      if (next < 0 || next >= this.totalPages) return;
      this.catPage[this.curTab] = next;
    },
    acctPillCls(i) {
      const on = i === this.acctSel[this.curTab];
      if (on) return this.curTab === 'expense' ? 'pill-expense-on' : 'pill-income-on';
      return 'pill-off';
    },
    selectAccount(i) {
      this.acctSel[this.curTab] = (this.acctSel[this.curTab] === i) ? -1 : i;
    },
    padKeyCls(b) {
      if (b === 'C') return 'pad-key-accent pad-c';
      if (b === 'del') return 'pad-key-accent';
      if (b === '00') return 'pad-double';
      return '';
    },
    appendNum(val) {
      let current = this.amount;
      if (current === '0.00') current = '';
      if (val === 'C') { this.amount = '0.00'; return; }
      if (val === 'del') {
        current = current.slice(0, -1);
        this.amount = current === '' ? '0.00' : current;
        return;
      }
      if (val === '.' && current.includes('.')) return;
      this.amount = current + val;
    },
    async handleSave() {
      const cents = yuanToCents(this.amount);
      if (cents == null) { toast('请输入有效金额（最多两位小数）'); return; }
      const arr = this.catArr;
      const ci = this.catSel[this.curTab];
      if (ci < 0 || ci >= arr.length || !arr[ci]) { toast('请先选择分类'); return; }
      const ai = this.acctSel[this.curTab];
      const accountId = (ai >= 0 && ai < this.accounts.length) ? this.accounts[ai].id : null;
      const payload = {
        type: this.curTab,
        amount: cents,
        categoryId: arr[ci].id,
        accountId,
        note: this.note.trim() || null,
        billDate: this.cur.y + '-' + String(this.cur.m).padStart(2, '0') + '-' + String(this.cur.d).padStart(2, '0')
      };
      this.saving = true;
      try {
        const r = await post('/api/bills', payload);
        if (r.status >= 200 && r.status < 300) {
          this.showToast = true;
          this.amount = '0.00';
          this.note = '';
          setTimeout(() => { this.showToast = false; }, 1500);
        } else {
          toast(r.data.message || '保存失败，请重试');
        }
      } catch (e) {
        toast('网络异常，请稍后再试');
      } finally {
        this.saving = false;
      }
    },
    openCalendar() {
      this.viewY = this.cur.y;
      this.viewM = this.cur.m;
      this.showCalendar = true;
    },
    closeCalendar() {
      this.showCalendar = false;
    },
    calStep(n, unit) {
      if (unit === 'y') this.viewY += n;
      else {
        this.viewM += n;
        if (this.viewM > 12) { this.viewM = 1; this.viewY++; }
        if (this.viewM < 1) { this.viewM = 12; this.viewY--; }
      }
    },
    calDayCls(d) {
      if (d.sel) return 'cal-day-sel';
      if (d.isToday) return 'cal-day-today';
      return 'cal-day-normal';
    },
    pickDay(d) {
      this.cur = { y: this.viewY, m: this.viewM, d };
      this.closeCalendar();
    },
    gotoToday() {
      const t = new Date();
      this.cur = { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
      this.closeCalendar();
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

/* 切换器 */
.seg {
  display: flex;
  justify-content: center;
  margin-bottom: 48rpx;
}
.seg-btn {
  flex: 0 0 auto;
  width: 200rpx;
  height: 76rpx;
  line-height: 76rpx;
  text-align: center;
  border-radius: 40rpx;
  font-size: 28rpx;
  transition: all 0.15s;
}
.seg-on-expense {
  background: #9b3f5a;
  color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}
.seg-on-income {
  background: #006b56;
  color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}
.seg-off {
  color: #544245;
}
.seg-btn + .seg-btn {
  margin-left: -12rpx;
}

/* 金额卡 */
.amount-card {
  position: relative;
  background: #fcf1f4;
  border-radius: 24rpx;
  padding: 64rpx 48rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 48rpx;
}
.amount-deco {
  position: absolute;
  right: -40rpx;
  bottom: -40rpx;
  width: 256rpx;
  height: 256rpx;
  border-radius: 50%;
}
.deco-expense { background: rgba(255, 143, 171, 0.2); }
.deco-income { background: rgba(117, 249, 212, 0.3); }
.amount-label {
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 16rpx;
}
.amount-row {
  display: flex;
  align-items: center;
}
.amount-symbol {
  font-size: 48rpx;
  font-weight: 600;
  margin-right: 8rpx;
}
.c-expense { color: #9b3f5a; }
.c-income { color: #006b56; }
.amount-value {
  font-size: 64rpx;
  font-weight: 700;
  color: #1f1a1d;
}

/* 分类 */
.section {
  margin-bottom: 48rpx;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
  padding: 0 8rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #544245;
}
.section-hint {
  font-size: 24rpx;
  color: #9b3f5a;
  font-weight: 700;
}
.cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32rpx;
}
.cat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx 16rpx;
  border-radius: 24rpx;
  background: #fcf1f4;
  border: 4rpx solid transparent;
}
.cat-on-expense { border-color: #9b3f5a; }
.cat-on-income { border-color: #006b56; }
.cat-circle {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}
.circle-expense-on { background: rgba(255, 143, 171, 0.3); color: #79243f; }
.circle-income-on { background: rgba(117, 249, 212, 0.6); color: #00725c; }
.circle-off { background: #f6ebee; color: #544245; }
.cat-emoji {
  font-size: 44rpx;
  line-height: 1;
}
.cat-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f1a1d;
}
.cat-empty {
  grid-column: span 3;
  text-align: center;
  font-size: 28rpx;
  color: #544245;
  padding: 64rpx 0;
}
.cat-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 32rpx;
}
.pager-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #fcf1f4;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}
.pager-label {
  min-width: 96rpx;
  text-align: center;
  font-size: 24rpx;
  color: #544245;
}

/* 详情卡 */
.detail-card {
  background: #fcf1f4;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 48rpx;
}
.note-row {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 24rpx;
  padding: 0 32rpx;
  height: 88rpx;
}
.note-icon {
  font-size: 32rpx;
  color: #9b3f5a;
  margin-right: 16rpx;
}
.note-input {
  flex: 1;
  font-size: 28rpx;
  color: #1f1a1d;
}
.ph {
  color: #e2d7da;
}
.date-row {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 24rpx;
  padding: 0 32rpx;
  height: 80rpx;
}
.date-icon {
  font-size: 32rpx;
  color: #9b3f5a;
  margin-right: 16rpx;
}
.date-label {
  flex: 1;
  font-size: 24rpx;
  color: #1f1a1d;
}
.date-expand {
  font-size: 32rpx;
  color: #877275;
}
.acct-label {
  display: block;
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 16rpx;
}
.acct-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.acct-empty {
  font-size: 24rpx;
  color: #544245;
}
.acct-pill {
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  height: 72rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 500;
}
.acct-emoji {
  margin-right: 8rpx;
}
.pill-expense-on { background: #9b3f5a; color: #fff; }
.pill-income-on { background: #006b56; color: #fff; }
.pill-off { background: #f6ebee; color: #544245; }

/* 数字键盘 */
.pad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  background: #fcf1f4;
  padding: 32rpx;
  border-radius: 24rpx;
  margin-bottom: 48rpx;
}
.pad-key {
  height: 96rpx;
  background: #fff;
  border-radius: 16rpx;
  font-size: 40rpx;
  font-weight: 600;
  color: #1f1a1d;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pad-key-accent {
  background: #f0e5e8;
}
.pad-c {
  color: #ae2f34;
}
.pad-double {
  grid-column: span 2;
}

/* 保存按钮 */
.save-wrap {
  padding-bottom: 16rpx;
}
.save-btn {
  width: 100%;
  height: 104rpx;
  border-radius: 52rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.12);
}
.save-expense {
  background: #ff8fab;
  color: #79243f;
}
.save-income {
  background: #75f9d4;
  color: #00725c;
}
.save-btn text + text {
  margin-left: 8rpx;
}

/* Toast */
.toast {
  position: fixed;
  top: 160rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: #9b3f5a;
  color: #fff;
  padding: 24rpx 48rpx;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.2);
}
.toast text + text {
  margin-left: 8rpx;
  font-weight: 700;
}

/* 日历弹窗 */
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
.calendar {
  width: 100%;
  max-width: 560rpx;
  background: #fff8f9;
  border-radius: 48rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
}
.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.cal-nav-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #fcf1f4;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}
.cal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
}
.cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 8rpx;
}
.cal-week-item {
  font-size: 22rpx;
  color: #877275;
  font-weight: 600;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 8rpx;
  place-items: center;
}
.cal-cell {
  width: 72rpx;
  height: 72rpx;
}
.cal-day {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 700;
}
.cal-day-sel {
  background: #9b3f5a;
  color: #fff;
}
.cal-day-today {
  color: #9b3f5a;
  background: rgba(255, 217, 224, 0.5);
}
.cal-day-normal {
  color: #1f1a1d;
}
.cal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid #fcf1f4;
}
.cal-today {
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(255, 217, 224, 0.6);
  color: #9b3f5a;
  font-size: 24rpx;
  font-weight: 600;
}
.cal-close {
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  color: #877275;
  font-size: 24rpx;
  font-weight: 600;
}
</style>
