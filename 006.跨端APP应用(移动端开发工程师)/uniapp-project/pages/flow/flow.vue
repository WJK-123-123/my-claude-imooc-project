<template>
  <view class="page">
    <view class="header">
      <text class="header-title">账单流水</text>
      <view class="header-avatar" @tap="goProfile">👤</view>
    </view>

    <view class="body">
      <!-- 月份切换 -->
      <view class="month-bar">
        <view class="month-btn" :style="{ opacity: viewMonth <= '2000-01' ? 0.3 : 1 }" @tap="shiftMonth(-1)">‹</view>
        <text class="month-label">{{ month || '本月' }}</text>
        <view class="month-btn" :style="{ opacity: viewMonth >= nowYM() ? 0.3 : 1 }" @tap="shiftMonth(1)">›</view>
      </view>
      <view class="back-this" v-if="viewMonth < nowYM()">
        <view class="back-btn" @tap="backToCurrentMonth">回到本月</view>
      </view>

      <!-- 月度汇总卡 -->
      <view class="summary-card">
        <view class="summary-glow glow1"></view>
        <view class="summary-glow glow2"></view>
        <view class="summary-grid">
          <view class="summary-item">
            <view class="summary-label"><text>👛</text><text>{{ prefix }}结余</text></view>
            <text class="summary-val c-primary">{{ balanceText }}</text>
          </view>
          <view class="summary-item">
            <view class="summary-label"><text>↗</text><text>{{ prefix }}支出</text></view>
            <text class="summary-val c-on">{{ expenseText }}</text>
          </view>
          <view class="summary-item">
            <view class="summary-label"><text>↘</text><text>{{ prefix }}收入</text></view>
            <text class="summary-val c-secondary">{{ incomeText }}</text>
          </view>
        </view>
      </view>

      <!-- 标题 -->
      <view class="list-title">
        <view class="list-title-left"><text>🧾</text><text>收支明细</text></view>
      </view>

      <!-- 类型筛选 -->
      <view class="filter">
        <view class="filter-btn" :class="filter === 'all' ? 'filter-on' : 'filter-off'" @tap="setFilter('all')">全部</view>
        <view class="filter-btn" :class="filter === 'expense' ? 'filter-on' : 'filter-off'" @tap="setFilter('expense')">支出</view>
        <view class="filter-btn" :class="filter === 'income' ? 'filter-on' : 'filter-off'" @tap="setFilter('income')">收入</view>
      </view>

      <!-- 账单列表 -->
      <view class="bill-list">
        <block v-for="(it, idx) in list" :key="idx">
          <view v-if="it.type === 'group'" class="bill-group">
            <text class="group-date">{{ it.label }}</text>
            <text class="group-total">{{ it.totals }}</text>
          </view>
          <view v-else class="bill-item" @tap="openDetail(it.bill)">
            <view class="bill-icon">{{ it.bill.categoryIcon || '📝' }}</view>
            <view class="bill-mid">
              <text class="bill-cat">{{ it.bill.categoryName }}</text>
              <text v-if="it.bill.note" class="bill-note">{{ it.bill.note }}</text>
            </view>
            <view class="bill-right">
              <text class="bill-amount" :class="it.bill.type === 'income' ? 'c-secondary' : 'c-on'">{{ it.amountText }}</text>
              <text class="bill-account">{{ it.bill.accountName || '—' }}</text>
            </view>
          </view>
        </block>
      </view>

      <view v-if="loading" class="loading">⏳ 加载中…</view>
      <view v-if="endVisible" class="end">— 已经到底啦，没有更多账单了 —</view>

      <!-- 空状态 -->
      <view v-if="emptyVisible" class="empty">
        <view class="empty-icon">🐰</view>
        <text class="empty-title">{{ emptyTitle }}</text>
        <text class="empty-desc">让每一笔小开销都变成生活可爱的小脚印吧～</text>
        <button class="empty-btn" @tap="goAdd">＋ 记一笔账</button>
      </view>
    </view>

    <!-- 详情弹窗（底部弹出） -->
    <view v-if="detailVisible" class="mask" @tap="closeDetail">
      <view class="sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-head">
          <text class="sheet-title">账单详情</text>
          <view class="sheet-close" @tap="closeDetail">✕</view>
        </view>
        <view class="sheet-body">
          <view class="sheet-icon" :class="currentBill && currentBill.type === 'income' ? 'icon-income' : 'icon-expense'">{{ currentBill ? (currentBill.categoryIcon || '📝') : '' }}</view>
          <text class="sheet-cat">{{ currentBill ? currentBill.categoryName : '' }}</text>
          <text class="sheet-amount" :class="currentBill && currentBill.type === 'income' ? 'c-secondary' : 'c-on'">{{ currentBill ? ((currentBill.type === 'income' ? '+' : '-') + '¥' + centsToYuan(currentBill.amount)) : '' }}</text>
        </view>
        <view class="sheet-info">
          <view class="info-row"><text class="info-k">记账类型</text><text class="info-v">{{ currentBill ? (currentBill.type === 'income' ? '收入' : '支出') : '' }}</text></view>
          <view class="info-row"><text class="info-k">交易时间</text><text class="info-v">{{ currentBill ? (fullDate(currentBill.billDate) + ' ' + (currentBill.createdTime || '')) : '' }}</text></view>
          <view class="info-row"><text class="info-k">账户</text><text class="info-v">{{ currentBill ? (currentBill.accountName || '—') : '' }}</text></view>
          <view class="info-row"><text class="info-k">备注摘要</text><text class="info-v">{{ currentBill ? (currentBill.note || '—') : '' }}</text></view>
        </view>
        <view class="sheet-actions">
          <button class="act-del" @tap="confirmDelete">删除记录</button>
          <button class="act-edit" @tap="openEdit">编辑</button>
        </view>
      </view>
    </view>

    <!-- 删除确认 -->
    <view v-if="deleteVisible" class="mask center-mask">
      <view class="dialog">
        <view class="dialog-icon">🗑</view>
        <text class="dialog-title">确认删除这条记录？</text>
        <text class="dialog-desc">删除后不可恢复，月统计也会同步更新哦。</text>
        <view class="dialog-actions">
          <button class="d-cancel" @tap="closeDeleteConfirm">取消</button>
          <button class="d-ok" @tap="doDelete">确认删除</button>
        </view>
      </view>
    </view>

    <!-- 编辑弹窗 -->
    <view v-if="editVisible" class="mask center-mask">
      <view class="edit-box">
        <view class="edit-head">
          <text class="edit-title">编辑账单</text>
          <view class="sheet-close" @tap="closeEdit">✕</view>
        </view>
        <view class="edit-scroll">
          <view class="edit-seg">
            <view class="edit-seg-btn" :class="editTab === 'expense' ? 'seg-expense' : 'seg-off'" @tap="editSwitchTab('expense')">支出</view>
            <view class="edit-seg-btn" :class="editTab === 'income' ? 'seg-income' : 'seg-off'" @tap="editSwitchTab('income')">收入</view>
          </view>
          <view class="edit-amount-card">
            <text class="edit-amount-label">金额</text>
            <view class="edit-amount-row">
              <text class="edit-currency" :class="editTab === 'expense' ? 'c-expense' : 'c-income'">¥</text>
              <input class="edit-amount" type="digit" v-model="editAmount" />
            </view>
          </view>
          <view class="edit-cat-wrap">
            <text class="edit-cat-label">选择分类</text>
            <view class="edit-cat-grid">
              <view v-for="(c, i) in editCatArr" :key="c.id" class="edit-cat-cell" :class="editCatOn(i)" @tap="editSelectCategory(i)">
                <view class="edit-cat-circle" :class="editCatCircle(i)"><text>{{ c.icon }}</text></view>
                <text class="edit-cat-name">{{ c.name }}</text>
              </view>
              <view v-if="!editCatArr.length" class="edit-cat-empty">暂无分类</view>
            </view>
          </view>
          <view class="edit-field">
            <text class="edit-field-icon">✏️</text>
            <input class="edit-field-input" v-model="editNote" maxlength="50" :placeholder="editTab === 'expense' ? '这笔钱花在哪里了？' : '这笔钱从哪儿来呀？'" placeholder-class="ph" />
          </view>
          <picker mode="date" :value="editDate" @change="onEditDate">
            <view class="edit-field">
              <text class="edit-field-icon">📅</text>
              <text class="edit-field-text">{{ editDate }}</text>
            </view>
          </picker>
          <view class="edit-acct-wrap">
            <text class="edit-acct-label">{{ editTab === 'expense' ? '账户' : '收款账户' }}</text>
            <view class="edit-acct-grid">
              <view v-if="!editAccounts.length" class="acct-empty">暂无账户</view>
              <view v-for="a in editAccounts" :key="a.id" class="acct-pill" :class="editAcctOn(a.id)" @tap="editSelectAccount(a.id)">
                <text class="acct-emoji">{{ a.emoji }}</text><text>{{ a.name }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="edit-foot">
          <button class="edit-save" @tap="submitEdit">✓ 保存修改</button>
        </view>
      </view>
    </view>

    <TabBar active="flow" />
  </view>
</template>

<script>
import { get, put, del } from '@/common/api.js';
import { centsToYuan, centsToPlainYuan, yuanToCents, dayLabel, fullDate, nowYM, addMonthsYM, toast } from '@/common/util.js';
import TabBar from '@/components/TabBar.vue';

const PAGE_SIZE = 20;

export default {
  components: { TabBar },
  data() {
    return {
      summary: { income: 0, expense: 0, balance: 0 },
      month: '',
      dayMap: {},
      total: 0,
      offset: 0,
      loading: false,
      hasMore: true,
      lastDate: null,
      viewMonth: nowYM(),
      filter: 'all',
      list: [],
      emptyVisible: false,
      endVisible: false,
      currentBill: null,
      detailVisible: false,
      deleteVisible: false,
      editVisible: false,
      editCats: { expense: [], income: [] },
      editAccounts: [],
      editTab: 'expense',
      editCatSel: { expense: -1, income: -1 },
      editAcctSelId: null,
      editAmount: '0.00',
      editNote: '',
      editDate: ''
    };
  },
  computed: {
    prefix() {
      return this.viewMonth === nowYM() ? '本月' : (parseInt(this.viewMonth.slice(5, 7), 10) + '月');
    },
    balanceText() {
      return (this.summary.balance < 0 ? '-¥ ' : '¥ ') + centsToYuan(Math.abs(this.summary.balance));
    },
    expenseText() {
      return '¥ ' + centsToYuan(this.summary.expense);
    },
    incomeText() {
      return '¥ ' + centsToYuan(this.summary.income);
    },
    emptyTitle() {
      return this.filter === 'expense' ? '这个月还没有支出记录哦' : this.filter === 'income' ? '这个月还没有收入记录哦' : '这个月还没有记账哦';
    },
    editCatArr() {
      return this.editCats[this.editTab] || [];
    }
  },
  onLoad() {
    this.loadMore();
  },
  onReachBottom() {
    this.loadMore();
  },
  methods: {
    centsToYuan,
    fullDate,
    nowYM,
    goProfile() {
      uni.reLaunch({ url: '/pages/profile/profile' });
    },
    goAdd() {
      uni.reLaunch({ url: '/pages/add/add' });
    },
    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      try {
        const url = '/api/bills?month=' + this.viewMonth + '&offset=' + this.offset + '&limit=' + PAGE_SIZE + (this.filter === 'all' ? '' : '&type=' + this.filter);
        const r = await get(url);
        if (r.status === 401) {
          uni.reLaunch({ url: '/pages/login/login' });
          return;
        }
        if (r.status < 200 || r.status >= 300) throw new Error((r.data && r.data.message) || '加载失败');
        const data = r.data;
        if (this.offset === 0) {
          this.summary = data.summary || { income: 0, expense: 0, balance: 0 };
          this.month = data.month || '';
          this.total = data.total || 0;
          const dm = {};
          (data.dayTotals || []).forEach((d) => { dm[d.date] = d; });
          this.dayMap = dm;
          if (this.total === 0) {
            this.emptyVisible = true;
            this.list = [];
            this.hasMore = false;
            return;
          }
          this.emptyVisible = false;
        }
        this.appendItems(data.bills || []);
        this.offset += (data.bills || []).length;
        this.hasMore = (data.bills || []).length > 0 && this.offset < this.total;
        this.endVisible = !this.hasMore;
      } catch (e) {
        this.hasMore = false;
      } finally {
        this.loading = false;
      }
    },
    appendItems(items) {
      items.forEach((b) => {
        if (b.billDate !== this.lastDate) {
          this.lastDate = b.billDate;
          const dt = this.dayMap[b.billDate] || { expense: 0, income: 0 };
          let totals;
          if (this.filter === 'expense') totals = '支出 ¥' + centsToYuan(dt.expense);
          else if (this.filter === 'income') totals = '收入 ¥' + centsToYuan(dt.income);
          else totals = '支出 ¥' + centsToYuan(dt.expense) + ' · 收入 ¥' + centsToYuan(dt.income);
          this.list.push({ type: 'group', label: dayLabel(b.billDate), totals });
        }
        this.list.push({
          type: 'bill',
          bill: b,
          amountText: (b.type === 'income' ? '+¥' : '-¥') + centsToYuan(b.amount)
        });
      });
    },
    shiftMonth(delta) {
      const target = addMonthsYM(this.viewMonth, delta);
      if (target < '2000-01' || target > nowYM()) return;
      this.viewMonth = target;
      this.reloadAll();
    },
    backToCurrentMonth() {
      this.viewMonth = nowYM();
      this.reloadAll();
    },
    setFilter(f) {
      if (this.filter === f) return;
      this.filter = f;
      this.reloadAll();
    },
    reloadAll() {
      this.offset = 0;
      this.total = 0;
      this.hasMore = true;
      this.lastDate = null;
      this.summary = { income: 0, expense: 0, balance: 0 };
      this.month = '';
      this.dayMap = {};
      this.list = [];
      this.emptyVisible = false;
      this.endVisible = false;
      this.loadMore();
    },
    openDetail(b) {
      this.currentBill = b;
      this.detailVisible = true;
    },
    closeDetail() {
      this.detailVisible = false;
    },
    confirmDelete() {
      this.deleteVisible = true;
    },
    closeDeleteConfirm() {
      this.deleteVisible = false;
    },
    async doDelete() {
      if (!this.currentBill) return;
      try {
        const r = await del('/api/bills/' + this.currentBill.id);
        if (r.status < 200 || r.status >= 300) { toast(r.data.message || '删除失败，请重试'); return; }
        this.deleteVisible = false;
        this.detailVisible = false;
        this.reloadAll();
      } catch (e) {
        toast('网络异常，请稍后再试');
      }
    },
    // —— 编辑 ——
    async openEdit() {
      if (!this.currentBill) return;
      const b = this.currentBill;
      this.editTab = b.type;
      this.editCatSel = { expense: -1, income: -1 };
      this.editAmount = centsToPlainYuan(b.amount);
      this.editNote = b.note || '';
      this.editDate = b.billDate;
      this.editAcctSelId = b.accountId != null ? b.accountId : null;
      try {
        const [cr, ar] = await Promise.all([get('/api/categories'), get('/api/accounts')]);
        const all = (cr.data && cr.data.categories) || [];
        this.editCats = { expense: [], income: [] };
        all.forEach((c) => { this.editCats[c.scope].push(c); });
        this.editAccounts = (ar.data && ar.data.accounts) || [];
        const arr = this.editCats[this.editTab] || [];
        arr.forEach((c, i) => { if (c.id === b.categoryId) this.editCatSel[this.editTab] = i; });
        this.editVisible = true;
      } catch (e) {
        this.editCats = { expense: [], income: [] };
        this.editAccounts = [];
        this.editVisible = true;
      }
    },
    closeEdit() {
      this.editVisible = false;
    },
    editSwitchTab(type) {
      this.editTab = type;
    },
    editCatOn(i) {
      return i === this.editCatSel[this.editTab] ? (this.editTab === 'expense' ? 'edit-on-expense' : 'edit-on-income') : '';
    },
    editCatCircle(i) {
      const on = i === this.editCatSel[this.editTab];
      if (on) return this.editTab === 'expense' ? 'circle-expense-on' : 'circle-income-on';
      return 'circle-off';
    },
    editSelectCategory(i) {
      this.editCatSel[this.editTab] = i;
    },
    editAcctOn(id) {
      const on = id === this.editAcctSelId;
      if (on) return this.editTab === 'expense' ? 'pill-expense-on' : 'pill-income-on';
      return 'pill-off';
    },
    editSelectAccount(id) {
      this.editAcctSelId = (this.editAcctSelId === id) ? null : id;
    },
    onEditDate(e) {
      this.editDate = e.detail.value;
    },
    async submitEdit() {
      if (!this.currentBill) return;
      const cents = yuanToCents(this.editAmount);
      if (cents == null) { toast('请输入有效金额（最多两位小数）'); return; }
      const arr = this.editCatArr;
      const ci = this.editCatSel[this.editTab];
      if (ci < 0 || ci >= arr.length || !arr[ci]) { toast('请先选择分类'); return; }
      if (!this.editDate) { toast('请选择日期'); return; }
      const payload = {
        type: this.editTab,
        amount: cents,
        categoryId: arr[ci].id,
        accountId: this.editAcctSelId,
        note: this.editNote.trim() || null,
        billDate: this.editDate
      };
      try {
        const r = await put('/api/bills/' + this.currentBill.id, payload);
        if (r.status < 200 || r.status >= 300) { toast(r.data.message || '保存失败，请重试'); return; }
        this.editVisible = false;
        this.detailVisible = false;
        this.reloadAll();
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
  padding: calc(var(--status-bar-height) + 160rpx) 48rpx 240rpx;
}

.month-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.month-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #fcf1f4;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}
.month-label {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
  letter-spacing: 2rpx;
}
.back-this {
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}
.back-btn {
  padding: 8rpx 32rpx;
  border-radius: 40rpx;
  background: rgba(255, 217, 224, 0.6);
  color: #79243f;
  font-size: 24rpx;
  font-weight: 600;
}

.summary-card {
  position: relative;
  background: #ffffff;
  border-radius: 48rpx;
  padding: 48rpx;
  margin-bottom: 64rpx;
  box-shadow: 0 8rpx 48rpx rgba(155, 63, 90, 0.06);
  overflow: hidden;
}
.summary-glow {
  position: absolute;
  width: 288rpx;
  height: 288rpx;
  border-radius: 50%;
  filter: blur(40rpx);
}
.glow1 { right: -40rpx; bottom: -40rpx; background: rgba(255, 217, 224, 0.4); }
.glow2 { left: -40rpx; top: -40rpx; background: rgba(117, 249, 212, 0.2); }
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32rpx;
  position: relative;
}
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.summary-label {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #544245;
  letter-spacing: 1rpx;
}
.summary-label text:first-child {
  margin-right: 6rpx;
  font-size: 28rpx;
}
.summary-val {
  margin-top: 6rpx;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}
.c-primary { color: #9b3f5a; }
.c-on { color: #1f1a1d; }
.c-secondary { color: #006b56; }
.c-expense { color: #9b3f5a; }
.c-income { color: #006b56; }
.ph { color: #e2d7da; }

.list-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 0 6rpx;
}
.list-title-left {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f1a1d;
}
.list-title-left text:first-child {
  margin-right: 8rpx;
  font-size: 32rpx;
  color: #9b3f5a;
}

.filter {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
  padding: 0 6rpx;
}
.filter-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 40rpx;
  font-size: 28rpx;
  transition: all 0.15s;
}
.filter-on {
  background: #9b3f5a;
  color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}
.filter-off {
  color: #544245;
}

.bill-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}
.bill-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  font-size: 24rpx;
  color: #544245;
}
.group-date {
  font-weight: 700;
  color: #1f1a1d;
}
.bill-item {
  background: #ffffff;
  padding: 40rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.03);
}
.bill-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 32rpx;
  background: #ffd9e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  flex-shrink: 0;
}
.bill-mid {
  flex: 1;
  min-width: 0;
  margin-left: 32rpx;
  display: flex;
  flex-direction: column;
}
.bill-cat {
  font-size: 32rpx;
  font-weight: 500;
  color: #1f1a1d;
}
.bill-note {
  font-size: 24rpx;
  color: #544245;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bill-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
}
.bill-amount {
  font-size: 32rpx;
  font-weight: 600;
}
.bill-account {
  font-size: 24rpx;
  color: #544245;
}

.loading, .end {
  text-align: center;
  padding: 32rpx 0;
  font-size: 24rpx;
  color: #877275;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64rpx 32rpx;
  text-align: center;
}
.empty-icon {
  width: 256rpx;
  height: 256rpx;
  border-radius: 50%;
  background: rgba(255, 217, 224, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120rpx;
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
  max-width: 480rpx;
  margin-bottom: 40rpx;
}
.empty-btn {
  padding: 24rpx 48rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
}

/* 底部弹窗 */
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.4);
}
.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  border-radius: 48rpx 48rpx 0 0;
  padding: 32rpx 48rpx calc(env(safe-area-inset-bottom) + 64rpx);
}
.sheet-handle {
  width: 96rpx;
  height: 12rpx;
  background: #eae0e3;
  border-radius: 6rpx;
  margin: 0 auto 40rpx;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 40rpx;
}
.sheet-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
}
.sheet-close {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f6ebee;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.sheet-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 0;
  margin-bottom: 40rpx;
  border-bottom: 2rpx solid #f6ebee;
}
.sheet-icon {
  width: 128rpx;
  height: 128rpx;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64rpx;
  margin-bottom: 16rpx;
}
.icon-expense { background: #ffd9e0; color: #3f0018; }
.icon-income { background: #75f9d4; color: #002018; }
.sheet-cat {
  font-size: 32rpx;
  font-weight: 500;
  color: #1f1a1d;
  margin-bottom: 4rpx;
}
.sheet-amount {
  font-size: 64rpx;
  font-weight: 700;
}
.sheet-info {
  background: #fcf1f4;
  border-radius: 32rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 48rpx;
}
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 28rpx;
}
.info-k {
  color: #544245;
}
.info-v {
  font-weight: 700;
  color: #1f1a1d;
}
.sheet-actions {
  display: flex;
  gap: 32rpx;
}
.act-del {
  flex: 1;
  height: 96rpx;
  background: #f6ebee;
  color: #1f1a1d;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.act-edit {
  flex: 1;
  height: 96rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 居中对话框 */
.center-mask {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.dialog {
  width: 100%;
  max-width: 560rpx;
  background: #ffffff;
  border-radius: 48rpx;
  padding: 48rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.dialog-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #ffdad6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  margin-bottom: 16rpx;
}
.dialog-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
  margin-bottom: 8rpx;
}
.dialog-desc {
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 40rpx;
}
.dialog-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}
.d-cancel {
  flex: 1;
  height: 80rpx;
  background: #f6ebee;
  color: #544245;
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
  background: #ae2f34;
  color: #fff;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 编辑弹窗 */
.edit-box {
  width: 100%;
  max-width: 640rpx;
  height: 85vh;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 48rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 2rpx solid #f6ebee;
}
.edit-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
}
.edit-scroll {
  flex: 1;
  min-height: 0;
  padding: 32rpx 40rpx 40rpx;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.edit-seg {
  display: flex;
  justify-content: center;
  background: #f0e5e8;
  padding: 8rpx;
  border-radius: 40rpx;
  gap: 8rpx;
  margin-bottom: 24rpx;
}
.edit-seg-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 36rpx;
  font-size: 28rpx;
}
.seg-expense { background: #9b3f5a; color: #fff; }
.seg-income { background: #006b56; color: #fff; }
.seg-off { color: #544245; }
.edit-amount-card {
  background: #fcf1f4;
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24rpx;
}
.edit-amount-label {
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 8rpx;
}
.edit-amount-row {
  display: flex;
  align-items: center;
}
.edit-currency {
  font-size: 48rpx;
  font-weight: 600;
  margin-right: 8rpx;
}
.edit-amount {
  font-size: 64rpx;
  font-weight: 700;
  color: #1f1a1d;
  min-width: 240rpx;
  text-align: center;
}
.edit-cat-wrap {
  margin-bottom: 24rpx;
}
.edit-cat-label {
  display: block;
  font-size: 28rpx;
  color: #544245;
  margin-bottom: 16rpx;
}
.edit-cat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}
.edit-cat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 8rpx;
  border-radius: 24rpx;
  background: #fcf1f4;
  border: 4rpx solid transparent;
}
.edit-on-expense { border-color: #9b3f5a; }
.edit-on-income { border-color: #006b56; }
.edit-cat-circle {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
  font-size: 36rpx;
}
.edit-cat-name {
  font-size: 24rpx;
  color: #1f1a1d;
}
.circle-expense-on { background: rgba(255, 143, 171, 0.3); color: #79243f; }
.circle-income-on { background: rgba(117, 249, 212, 0.6); color: #00725c; }
.circle-off { background: #f6ebee; color: #544245; }
.edit-cat-empty {
  grid-column: span 3;
  text-align: center;
  font-size: 28rpx;
  color: #544245;
  padding: 40rpx 0;
}
.edit-field {
  display: flex;
  align-items: center;
  background: #fcf1f4;
  border-radius: 24rpx;
  padding: 0 24rpx;
  height: 80rpx;
  margin-bottom: 16rpx;
}
.edit-field-icon {
  font-size: 32rpx;
  color: #9b3f5a;
  margin-right: 16rpx;
}
.edit-field-input {
  flex: 1;
  font-size: 28rpx;
  color: #1f1a1d;
}
.edit-field-text {
  flex: 1;
  font-size: 24rpx;
  color: #1f1a1d;
}
.edit-acct-label {
  display: block;
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 12rpx;
}
.edit-acct-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}
.acct-empty {
  grid-column: span 3;
  font-size: 24rpx;
  color: #544245;
}
.acct-pill {
  display: flex;
  align-items: center;
  justify-content: center;
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
.edit-foot {
  padding: 24rpx 40rpx;
  border-top: 2rpx solid #f6ebee;
}
.edit-save {
  width: 100%;
  height: 96rpx;
  background: #9b3f5a;
  color: #fff;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
