<template>
  <view class="page">
    <view class="header">
      <view class="header-left">
        <text class="header-title">统计</text>
        <view class="year-pill" @tap="openYearPicker">
          <text>{{ curYear }}年</text>
          <text class="year-arrow">▾</text>
        </view>
      </view>
      <view class="header-avatar" @tap="goProfile">👤</view>
    </view>

    <view class="body">
      <!-- 年度快捷统计 -->
      <view class="stat-grid">
        <view class="stat-card">
          <view class="stat-icon"><text>🧾</text></view>
          <text class="stat-label">记账笔数</text>
          <text class="stat-val">{{ (stats && stats.totalCount || 0) }} 笔</text>
        </view>
        <view class="stat-card">
          <view class="stat-icon"><text>📈</text></view>
          <text class="stat-label">月均支出</text>
          <text class="stat-val">¥ {{ centsToYuan(stats && stats.monthlyAvgExpense || 0) }}</text>
        </view>
        <view class="stat-card">
          <view class="stat-icon"><text>🛍</text></view>
          <text class="stat-label">最大单笔</text>
          <text class="stat-val">{{ maxVal }}</text>
          <text class="stat-sub">{{ maxCat }}</text>
        </view>
      </view>

      <!-- 分类占比 + 收支趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">分类占比</text>
          <text class="card-year">{{ curYear }}年</text>
        </view>

        <view class="pie-block">
          <text class="pie-block-label">支出占比</text>
          <view class="pie-row">
            <view class="pie-wrap">
              <canvas canvas-id="pieExpCanvas" id="pieExpCanvas" class="pie-canvas"></canvas>
            </view>
            <view class="legend">
              <view v-for="(s, i) in pieExp.slices" :key="i" class="legend-row" @tap="toggleSlice('expense', i)" @mouseenter="hoverSlice('expense', i)" @mouseleave="hoverSlice('expense', -1)">
                <view class="legend-dot" :style="{ background: s.color }"></view>
                <view class="legend-mid">
                  <text class="legend-name">{{ s.icon }} {{ s.name }}</text>
                  <text class="legend-sub">{{ s.count }}笔 · ¥ {{ centsToYuan(s.amount) }}</text>
                </view>
                <text class="legend-pct">{{ s.pctText }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="pie-block">
          <text class="pie-block-label">收入占比</text>
          <view class="pie-row">
            <view class="pie-wrap">
              <canvas canvas-id="pieIncCanvas" id="pieIncCanvas" class="pie-canvas"></canvas>
            </view>
            <view class="legend">
              <view v-for="(s, i) in pieInc.slices" :key="i" class="legend-row" @tap="toggleSlice('income', i)" @mouseenter="hoverSlice('income', i)" @mouseleave="hoverSlice('income', -1)">
                <view class="legend-dot" :style="{ background: s.color }"></view>
                <view class="legend-mid">
                  <text class="legend-name">{{ s.icon }} {{ s.name }}</text>
                  <text class="legend-sub">{{ s.count }}笔 · ¥ {{ centsToYuan(s.amount) }}</text>
                </view>
                <text class="legend-pct">{{ s.pctText }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 收支趋势 -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">收支趋势</text>
          <view class="trend-legend">
            <view class="trend-lg-item" :style="{ opacity: trendVisible.expense ? 1 : 0.4 }" @tap="toggleTrend('expense')">
              <view class="legend-dot" style="background:#eb6834"></view><text>支出</text>
            </view>
            <view class="trend-lg-item" :style="{ opacity: trendVisible.income ? 1 : 0.4 }" @tap="toggleTrend('income')">
              <view class="legend-dot" style="background:#2a78d6"></view><text>收入</text>
            </view>
          </view>
        </view>

        <view class="trend-chart">
          <canvas v-if="trend.hasData" canvas-id="trendCanvas" id="trendCanvas" class="trend-canvas" @tap="onTrendTap"></canvas>
          <view v-else class="trend-empty">暂无数据</view>
        </view>
      </view>

      <!-- 排行 Tabs -->
      <view class="tabs">
        <view class="tab" :class="activeTab === 'expense' ? 'tab-on' : ''" @tap="switchTab('expense')">支出分类排行</view>
        <view class="tab" :class="activeTab === 'income' ? 'tab-on' : ''" @tap="switchTab('income')">收入分类排行</view>
      </view>

      <!-- 排行列表 -->
      <view v-if="activeTab === 'expense'" class="rank-list">
        <view v-for="(c, i) in expList" :key="'e' + i" class="rank-item">
          <view class="rank-top">
            <view class="rank-left">
              <view class="rank-icon" :style="rankIconStyle(i)"><text>{{ c.icon || '📝' }}</text></view>
              <view class="rank-name-wrap">
                <text class="rank-name">{{ c.name }}</text>
                <text class="rank-count">{{ c.count }}笔消费</text>
              </view>
            </view>
            <view class="rank-right">
              <text class="rank-amount">¥ {{ centsToYuan(c.amount) }}</text>
              <text class="rank-pct">{{ rankPct(c.amount, expTotal) }}%</text>
            </view>
          </view>
          <view class="rank-bar">
            <view class="rank-bar-fill" :style="{ width: rankPct(c.amount, expTotal) + '%', background: CHART_COLORS[i % CHART_COLORS.length] }"></view>
          </view>
        </view>
        <view class="rank-more">{{ expHasMore ? '继续滚动加载更多' : (expList.length ? '— 已显示全部 ' + expList.length + ' 条 —' : '') }}</view>
      </view>
      <view v-else class="rank-list">
        <view v-for="(c, i) in incList" :key="'i' + i" class="rank-item">
          <view class="rank-top">
            <view class="rank-left">
              <view class="rank-icon" :style="rankIconStyle(i)"><text>{{ c.icon || '📝' }}</text></view>
              <view class="rank-name-wrap">
                <text class="rank-name">{{ c.name }}</text>
                <text class="rank-count">{{ c.count }}笔收入</text>
              </view>
            </view>
            <view class="rank-right">
              <text class="rank-amount">¥ {{ centsToYuan(c.amount) }}</text>
              <text class="rank-pct">{{ rankPct(c.amount, incTotal) }}%</text>
            </view>
          </view>
          <view class="rank-bar">
            <view class="rank-bar-fill" :style="{ width: rankPct(c.amount, incTotal) + '%', background: CHART_COLORS[i % CHART_COLORS.length] }"></view>
          </view>
        </view>
        <view class="rank-more">{{ incHasMore ? '继续滚动加载更多' : (incList.length ? '— 已显示全部 ' + incList.length + ' 条 —' : '') }}</view>
      </view>

      <!-- 空状态 -->
      <view v-if="emptyVisible" class="empty">
        <view class="empty-icon">🐰</view>
        <text class="empty-title">这一年还没有记账哦</text>
        <text class="empty-desc">让每一笔小开销都变成生活可爱的小脚印吧～</text>
      </view>
    </view>

    <!-- 年份选择弹窗 -->
    <view v-if="yearVisible" class="mask" @tap="yearVisible = false">
      <view class="year-box" @tap.stop>
        <view class="year-head">
          <text class="year-title">选择年份</text>
          <view class="year-close" @tap="yearVisible = false">✕</view>
        </view>
        <scroll-view scroll-y class="year-scroll">
          <view v-for="y in yearRange" :key="y" class="year-cell" :class="y === curYear ? 'year-cell-on' : ''" @tap="pickYear(y)">{{ y }}年</view>
        </scroll-view>
      </view>
    </view>

    <TabBar active="stats" />
  </view>
</template>

<script>
import { get } from '@/common/api.js';
import { centsToYuan, yuanCompact } from '@/common/util.js';
import TabBar from '@/components/TabBar.vue';

const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const MAX_SLICES = 8;
const PAGE_SIZE = 8;
const THIS_YEAR = new Date().getFullYear();

function pctLabel(ratio) {
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.05) return '<0.1%';
  return pct.toFixed(1) + '%';
}

// HTML/XML 转义：环形图/折线图的 SVG 文案走 v-html 注入原生 <text>，用户可编辑的分类名需转义防破版
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function foldSlices(cats) {
  if (cats.length <= MAX_SLICES) return cats.map((c) => ({ name: c.name, icon: c.icon, amount: c.amount, count: c.count }));
  const top = cats.slice(0, MAX_SLICES - 1);
  const rest = cats.slice(MAX_SLICES - 1);
  return [...top, {
    name: '其他', icon: '📦',
    amount: rest.reduce((s, c) => s + (c.amount || 0), 0),
    count: rest.reduce((s, c) => s + (c.count || 0), 0)
  }];
}

function ringPt(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: +(cx + r * Math.cos(rad)).toFixed(2), y: +(cy + r * Math.sin(rad)).toFixed(2) };
}

function niceCeil(v) {
  if (v <= 0) return 10000;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  let nice = 10;
  if (f <= 1) nice = 1; else if (f <= 2) nice = 2; else if (f <= 5) nice = 5;
  return nice * base;
}

function smoothD(pts) {
  if (!pts.length) return '';
  let d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.16;
    const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
    d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
  }
  return d;
}

export default {
  components: { TabBar },
  data() {
    return {
      stats: null,
      curYear: THIS_YEAR,
      activeTab: 'expense',
      shown: { expense: PAGE_SIZE, income: PAGE_SIZE },
      selected: { expense: -1, income: -1 },
      hovered: { expense: -1, income: -1 },
      trendVisible: { expense: true, income: true },
      trendPinned: -1,
      trendHover: -1,
      yearVisible: false
    };
  },
  computed: {
    CHART_COLORS() { return CHART_COLORS; },
    maxVal() {
      const m = this.stats && this.stats.maxExpense;
      return m && m.amount > 0 ? '¥ ' + centsToYuan(m.amount) : '—';
    },
    maxCat() {
      const m = this.stats && this.stats.maxExpense;
      return m && m.amount > 0 ? (m.categoryName || '') : '';
    },
    emptyVisible() {
      return this.stats && (this.stats.totalCount || 0) === 0;
    },
    pieExp() { return this.pieModel('expense'); },
    pieInc() { return this.pieModel('income'); },
    trend() { return this.trendModel(); },
    expCats() { return this.stats && this.stats.expenseCategories || []; },
    incCats() { return this.stats && this.stats.incomeCategories || []; },
    expTotal() { return this.expCats.reduce((s, c) => s + (c.amount || 0), 0); },
    incTotal() { return this.incCats.reduce((s, c) => s + (c.amount || 0), 0); },
    expList() { return this.expCats.slice(0, this.shown.expense); },
    incList() { return this.incCats.slice(0, this.shown.income); },
    expHasMore() { return this.shown.expense < this.expCats.length; },
    incHasMore() { return this.shown.income < this.incCats.length; },
    yearRange() {
      const arr = [];
      for (let y = 2000; y <= THIS_YEAR; y++) arr.push(y);
      return arr;
    }
  },
  onLoad() {
    this.loadStats(this.curYear);
  },
  onReady() {
    this.redrawCharts();
  },
  onReachBottom() {
    if (this.activeTab === 'expense' && this.shown.expense < this.expCats.length) {
      this.shown.expense += PAGE_SIZE;
    } else if (this.activeTab === 'income' && this.shown.income < this.incCats.length) {
      this.shown.income += PAGE_SIZE;
    }
  },
  methods: {
    centsToYuan,
    goProfile() {
      uni.reLaunch({ url: '/pages/profile/profile' });
    },
    async loadStats(year) {
      try {
        const r = await get('/api/stats?year=' + year);
        if (r.status === 401) {
          uni.reLaunch({ url: '/pages/login/login' });
          return;
        }
        if (r.status < 200 || r.status >= 300) throw new Error((r.data && r.data.message) || '加载失败');
        this.stats = r.data;
        this.curYear = r.data.year;
      } catch (e) {
        this.stats = null;
        this.curYear = year;
      }
      this.$nextTick(() => {
        setTimeout(() => this.redrawCharts(), 60);
      });
    },
    pieModel(type) {
      const cats = type === 'expense' ? (this.stats && this.stats.expenseCategories || []) : (this.stats && this.stats.incomeCategories || []);
      const slices = foldSlices(cats);
      const total = slices.reduce((s, c) => s + (c.amount || 0), 0);
      if (!slices.length || total <= 0) {
        return { slices: [], total: 0, hasData: false, center: { name: '暂无数据', pct: '' } };
      }
      const sel = this.hovered[type] >= 0 ? this.hovered[type] : this.selected[type];
      let start = 0;
      const out = [];
      slices.forEach((cat, i) => {
        const sweep = cat.amount / total * 360;
        const end = start + sweep;
        const mid = start + sweep / 2;
        out.push({
          i, name: cat.name, icon: cat.icon, amount: cat.amount, count: cat.count,
          color: CHART_COLORS[i], single: slices.length === 1,
          pctText: pctLabel(cat.amount / total),
          startDeg: start, endDeg: end, midDeg: mid,
          isDim: sel >= 0 && sel !== i, isSel: sel === i
        });
        start = end;
      });
      let center;
      if (sel >= 0 && slices[sel]) {
        center = { name: String(slices[sel].name || ''), pct: pctLabel(slices[sel].amount / total) };
      } else {
        center = { name: type === 'expense' ? '总支出' : '总收入', pct: '' };
      }
      return { slices: out, total, hasData: true, center };
    },
    redrawCharts() {
      this.drawPie('expense');
      this.drawPie('income');
      if (this.trend.hasData) this.drawTrend();
    },
    drawPie(type) {
      const model = this.pieModel(type);
      const canvasId = type === 'expense' ? 'pieExpCanvas' : 'pieIncCanvas';
      const ctx = uni.createCanvasContext(canvasId, this);
      const S = 160, cx = 80, cy = 80, rOuter = 74, rInner = 48;
      const rMid = (rOuter + rInner) / 2, rW = rOuter - rInner;
      ctx.clearRect(0, 0, S, S);
      if (!model.hasData) {
        ctx.beginPath();
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
        ctx.setFillStyle('#f6ebee');
        ctx.fill();
        ctx.setFillStyle('#877275');
        ctx.setFontSize(11);
        ctx.setTextAlign('center');
        ctx.setTextBaseline('middle');
        ctx.fillText('暂无数据', cx, cy);
        ctx.draw();
        return;
      }
      model.slices.forEach((s) => {
        ctx.setGlobalAlpha(s.isDim ? 0.22 : 1);
        if (s.single) {
          ctx.beginPath();
          ctx.arc(cx, cy, rMid, 0, Math.PI * 2);
          ctx.setStrokeStyle(s.color);
          ctx.setLineWidth(rW);
          ctx.stroke();
        } else {
          const a0 = (s.startDeg - 90) * Math.PI / 180;
          const a1 = (s.endDeg - 90) * Math.PI / 180;
          ctx.beginPath();
          ctx.arc(cx, cy, rOuter, a0, a1, false);
          ctx.arc(cx, cy, rInner, a1, a0, true);
          ctx.closePath();
          ctx.setFillStyle(s.color);
          ctx.fill();
          ctx.setGlobalAlpha(1);
          ctx.setStrokeStyle('#ffffff');
          ctx.setLineWidth(2);
          ctx.stroke();
        }
        ctx.setGlobalAlpha(1);
        if (!s.single && (s.endDeg - s.startDeg) >= 24) {
          const am = (s.midDeg - 90) * Math.PI / 180;
          const lx = cx + rMid * Math.cos(am);
          const ly = cy + rMid * Math.sin(am);
          ctx.setFillStyle('#ffffff');
          ctx.setFontSize(10);
          ctx.setTextAlign('center');
          ctx.setTextBaseline('middle');
          ctx.fillText(s.pctText, lx, ly);
        }
      });
      ctx.beginPath();
      ctx.arc(cx, cy, rInner - 2, 0, Math.PI * 2);
      ctx.setFillStyle('#ffffff');
      ctx.fill();
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      if (model.center.pct) {
        ctx.setFillStyle('#1f1a1d');
        ctx.setFontSize(14);
        ctx.fillText(model.center.pct, cx, cy - 4);
        ctx.setFillStyle('#877275');
        ctx.setFontSize(9);
        const nm = model.center.name.length > 6 ? model.center.name.slice(0, 6) + '…' : model.center.name;
        ctx.fillText(nm, cx, cy + 14);
      } else {
        ctx.setFillStyle('#877275');
        ctx.setFontSize(11);
        ctx.fillText(model.center.name, cx, cy);
      }
      ctx.draw();
    },
    toggleSlice(type, i) {
      this.selected[type] = this.selected[type] === i ? -1 : i;
      this.drawPie(type);
    },
    hoverSlice(type, i) {
      this.hovered[type] = i;
      this.drawPie(type);
    },
    trendModel() {
      const monthly = this.stats && this.stats.monthly || [];
      const hasData = monthly.some((m) => (m.expense || 0) > 0 || (m.income || 0) > 0);
      return { hasData };
    },
    drawTrend() {
      const monthly = this.stats && this.stats.monthly || [];
      const hasData = monthly.some((m) => (m.expense || 0) > 0 || (m.income || 0) > 0);
      const q = uni.createSelectorQuery().in(this);
      q.select('#trendCanvas').boundingClientRect((rect) => {
        const W = (rect && rect.width) ? rect.width : 360;
        const H = 230, ml = 46, mr = 14, mt = 14, mb = 28;
        const plotW = W - ml - mr, plotH = H - mt - mb;
        const x0 = ml, x1 = W - mr, y0 = mt, y1 = H - mb;
        const ctx = uni.createCanvasContext('trendCanvas', this);
        ctx.clearRect(0, 0, W, H);
        if (!hasData) {
          ctx.draw();
          return;
        }
        const denom = Math.max(monthly.length - 1, 1);
        const vals = [];
        monthly.forEach((m) => { vals.push(m.expense || 0, m.income || 0); });
        const yMax = niceCeil(Math.max.apply(null, vals));
        const px = (i) => x0 + (i / denom) * plotW;
        const py = (v) => y1 - (v / yMax) * plotH;
        [0, Math.floor(yMax / 2), yMax].forEach((t) => {
          const y = y1 - (t / yMax) * plotH;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.setStrokeStyle(t === 0 ? '#dac0c4' : '#f0e5e8');
          ctx.setLineWidth(1);
          ctx.stroke();
          ctx.setFillStyle('#877275');
          ctx.setFontSize(10);
          ctx.setTextAlign('right');
          ctx.setTextBaseline('middle');
          ctx.fillText(yuanCompact(t), x0 - 6, y);
        });
        monthly.forEach((m, i) => {
          ctx.setFillStyle('#877275');
          ctx.setFontSize(9);
          ctx.setTextAlign('center');
          ctx.setTextBaseline('top');
          ctx.fillText(m.month + '月', px(i), y1 + 6);
        });
        const drawSeries = (key, color, areaColor) => {
          const pts = monthly.map((m, i) => ({ x: px(i), y: py(m[key] || 0) }));
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          this._smoothPath(ctx, pts);
          ctx.lineTo(pts[pts.length - 1].x, y1);
          ctx.lineTo(pts[0].x, y1);
          ctx.closePath();
          ctx.setFillStyle(areaColor);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          this._smoothPath(ctx, pts);
          ctx.setStrokeStyle(color);
          ctx.setLineWidth(2.2);
          ctx.setLineCap('round');
          ctx.setLineJoin('round');
          ctx.stroke();
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
            ctx.setFillStyle('#ffffff');
            ctx.fill();
            ctx.setStrokeStyle(color);
            ctx.setLineWidth(2);
            ctx.stroke();
          });
        };
        if (this.trendVisible.expense) drawSeries('expense', '#eb6834', 'rgba(235,104,52,0.20)');
        if (this.trendVisible.income) drawSeries('income', '#2a78d6', 'rgba(42,120,214,0.20)');
        if (this.trendPinned >= 0 && monthly[this.trendPinned]) {
          const m = monthly[this.trendPinned];
          const x = px(this.trendPinned);
          const expY = py(m.expense || 0), incY = py(m.income || 0);
          let tipY = Math.min(expY, incY) - 46;
          if (tipY < 4) tipY = Math.max(expY, incY) + 12;
          const tw = 170;
          const tx = Math.min(Math.max(x, tw / 2 + 4), W - tw / 2 - 4);
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
          ctx.setStrokeStyle('#dac0c4');
          ctx.setLineWidth(1);
          ctx.stroke();
          ctx.setFillStyle('rgba(52,47,49,0.95)');
          ctx.fillRect(tx - tw / 2, tipY, tw, 40);
          ctx.setFillStyle('#f9eef1');
          ctx.setFontSize(10);
          ctx.setTextAlign('center');
          ctx.setTextBaseline('middle');
          ctx.fillText(m.month + '月', tx, tipY + 13);
          ctx.fillText('支出 ¥' + yuanCompact(m.expense) + ' · 收入 ¥' + yuanCompact(m.income), tx, tipY + 29);
        }
        ctx.draw();
      }).exec();
    },
    _smoothPath(ctx, pts) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const t = 0.16;
        const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
        const c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
      }
    },
    onTrendTap(e) {
      const monthly = this.stats && this.stats.monthly || [];
      if (!monthly.length) return;
      const q = uni.createSelectorQuery().in(this);
      q.select('#trendCanvas').boundingClientRect((rect) => {
        if (!rect) return;
        const tapX = (e && e.detail && typeof e.detail.x === 'number') ? e.detail.x : null;
        if (tapX == null) return;
        const W = rect.width || 360, ml = 46, mr = 14;
        const plotW = W - ml - mr;
        const denom = Math.max(monthly.length - 1, 1);
        const idx = Math.round((tapX - rect.left - ml) / plotW * denom);
        if (idx >= 0 && idx < monthly.length) {
          this.trendPinned = this.trendPinned === idx ? -1 : idx;
        } else {
          this.trendPinned = -1;
        }
        this.drawTrend();
      }).exec();
    },
    toggleTrend(key) {
      this.trendVisible[key] = !this.trendVisible[key];
      this.drawTrend();
    },
    switchTab(type) {
      this.activeTab = type;
    },
    rankPct(amount, total) {
      return total > 0 ? (amount / total * 100).toFixed(1) : '0.0';
    },
    rankIconStyle(i) {
      const c = CHART_COLORS[i % CHART_COLORS.length];
      return { background: c + '22', color: c };
    },
    openYearPicker() {
      this.yearVisible = true;
    },
    pickYear(y) {
      this.yearVisible = false;
      if (y === this.curYear) return;
      this.selected = { expense: -1, income: -1 };
      this.hovered = { expense: -1, income: -1 };
      this.trendPinned = -1;
      this.trendHover = -1;
      this.shown = { expense: PAGE_SIZE, income: PAGE_SIZE };
      this.loadStats(y);
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
.header-left {
  height: 128rpx;
  line-height: 128rpx;
  padding: 0 32rpx;
  display: flex;
  align-items: center;
}
.header-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1f1a1d;
  margin-right: 16rpx;
}
.year-pill {
  display: flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: 40rpx;
  background: rgba(255, 217, 224, 0.6);
  color: #79243f;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
}
.year-arrow {
  margin-left: 6rpx;
  font-size: 20rpx;
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

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.stat-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx 16rpx;
  box-shadow: 0 4rpx 24rpx rgba(155, 63, 90, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.stat-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #ffd9e0;
  color: #9b3f5a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  margin-bottom: 8rpx;
}
.stat-label {
  font-size: 22rpx;
  color: #544245;
  margin-bottom: 2rpx;
}
.stat-val {
  font-size: 24rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.stat-sub {
  font-size: 20rpx;
  color: #877275;
}

.card {
  background: #ffffff;
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: 0 4rpx 24rpx rgba(155, 63, 90, 0.04);
  margin-bottom: 32rpx;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.card-year {
  font-size: 24rpx;
  color: #9b3f5a;
}

.pie-block {
  margin-bottom: 40rpx;
}
.pie-block:last-child {
  margin-bottom: 0;
}
.pie-block-label {
  display: block;
  font-size: 24rpx;
  color: #544245;
  margin-bottom: 16rpx;
}
.pie-row {
  display: flex;
  align-items: center;
}
.pie-wrap {
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}
.pie-canvas {
  width: 160px;
  height: 160px;
}
.pie-slice {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.pie-slice.is-dim {
  opacity: 0.22;
}
.legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-left: 24rpx;
}
.legend-row {
  display: flex;
  align-items: center;
}
.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 12rpx;
}
.legend-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.legend-name {
  font-size: 24rpx;
  color: #1f1a1d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.legend-sub {
  font-size: 20rpx;
  color: #544245;
}
.legend-pct {
  font-size: 22rpx;
  font-weight: 600;
  color: #9b3f5a;
  flex-shrink: 0;
}

.trend-legend {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.trend-lg-item {
  display: flex;
  align-items: center;
  font-size: 22rpx;
  color: #544245;
}
.trend-chart {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 440rpx;
}
.trend-canvas {
  width: 100%;
  height: 230px;
  display: block;
}
.trend-empty {
  color: #877275;
  font-size: 26rpx;
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

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.rank-item {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(155, 63, 90, 0.04);
}
.rank-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.rank-left {
  display: flex;
  align-items: center;
}
.rank-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.rank-name-wrap {
  display: flex;
  flex-direction: column;
}
.rank-name {
  font-size: 26rpx;
  color: #1f1a1d;
}
.rank-count {
  font-size: 22rpx;
  color: #544245;
}
.rank-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.rank-amount {
  font-size: 26rpx;
  font-weight: 700;
  color: #1f1a1d;
}
.rank-pct {
  font-size: 22rpx;
  color: #9b3f5a;
}
.rank-bar {
  width: 100%;
  height: 16rpx;
  background: #f6ebee;
  border-radius: 999px;
  overflow: hidden;
}
.rank-bar-fill {
  height: 100%;
  border-radius: 999px;
}
.rank-more {
  text-align: center;
  font-size: 22rpx;
  color: #877275;
  padding: 8rpx 0;
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
.year-box {
  width: 100%;
  max-width: 480rpx;
  background: #fff8f9;
  border-radius: 40rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
}
.year-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.year-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f1a1d;
}
.year-close {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #fcf1f4;
  color: #544245;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.year-scroll {
  max-height: 60vh;
}
.year-cell {
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 40rpx;
  font-size: 26rpx;
  color: #544245;
  margin-bottom: 8rpx;
}
.year-cell-on {
  background: #9b3f5a;
  color: #fff;
  font-weight: 700;
}
</style>
