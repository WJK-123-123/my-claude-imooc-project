# -*- coding: utf-8 -*-
"""
财务管家 · 数据分析数据文档生成脚本
依据 004.数据库脚本 的 9 张表结构，随机生成演示数据，导出为 xlsx 数据文档。
- 金额一律以「分」整数存储（bill.amount），另加「金额(元)」展示列 = amount / 100
- 注销用户(deleted)业务数据物理删除；删除中(deleting)仍保留（冷静期未清）
- V1.9 起注册不再复制模板：用户分类 is_system 均为 0
- 所有汇总看板、占比、月度/分类/账户统计均为预计算落值（本机无 LibreOffice，不写公式）
"""
import random
import datetime as dt
from collections import defaultdict

random.seed(42)

OUT = r"D:\claude-my-product\011.数据可视化\财务管家-数据分析数据文档.xlsx"

# ---------------------------------------------------------------------------
# 常量：模板（忠实 02_seed.sql 附录 A）
# ---------------------------------------------------------------------------
CAT_TEMPLATE = [
    ("expense", "餐饮", "🍜", 10), ("expense", "交通", "🚌", 20),
    ("expense", "购物", "🛒", 30), ("expense", "日用", "🧻", 40),
    ("expense", "水果生鲜", "🥬", 50), ("expense", "娱乐", "🎮", 60),
    ("expense", "通讯", "📱", 70), ("expense", "居住", "🏠", 80),
    ("expense", "医疗", "💊", 90), ("expense", "教育", "📚", 100),
    ("expense", "人情往来", "🎁", 110), ("expense", "宠物", "🐾", 120),
    ("expense", "其他", "📝", 130),
    ("income", "工资", "💰", 10), ("income", "奖金", "🧧", 20),
    ("income", "兼职", "💼", 30), ("income", "理财收益", "📈", 40),
    ("income", "红包", "🎊", 50), ("income", "其他", "📝", 60),
]
ACCT_TEMPLATE = [
    ("微信", "💚", "第三方支付", 10), ("支付宝", "💙", "第三方支付", 20),
    ("现金", "💰", "零钱与日常现金", 30), ("银行卡", "🏦", "储蓄卡 · 日常消费", 40),
]

# 分类金额区间（分）与权重、备注模板
EXP_CAT_SPEC = {
    "餐饮":   ((500, 15000), 30, ["午饭", "晚饭", "奶茶", "早餐", "聚餐", "外卖", "咖啡"]),
    "交通":   ((200, 8000), 15, ["地铁", "公交", "打车", "加油", "停车", "高铁票"]),
    "购物":   ((1000, 80000), 14, ["网购", "超市采购", "衣服", "日用品", "数码配件"]),
    "日用":   ((500, 20000), 10, ["洗衣液", "纸巾", "洗护", "收纳"]),
    "娱乐":   ((1500, 30000), 8, ["电影", "KTV", "游戏充值", "演唱会"]),
    "居住":   ((5000, 350000), 6, ["房租", "水电燃气", "物业费", "宽带"]),
    "通讯":   ((2000, 20000), 5, ["话费", "流量包"]),
    "水果生鲜": ((500, 12000), 5, ["水果", "蔬菜", "买菜"]),
    "医疗":   ((2000, 60000), 3, ["买药", "挂号", "体检"]),
    "教育":   ((5000, 200000), 2, ["网课", "教材", "培训费"]),
    "人情往来": ((10000, 100000), 2, ["随礼", "请客", "生日礼物"]),
    "宠物":   ((1000, 30000), 2, ["猫粮", "狗粮", "宠物用品", "驱虫"]),
    "其他":   ((500, 20000), 3, ["其他", "杂项"]),
}
INC_CAT_SPEC = {
    "工资":   ((800000, 2500000), 30, ["工资"]),
    "奖金":   ((100000, 1000000), 8, ["季度奖金", "年终奖", "绩效奖"]),
    "兼职":   ((80000, 800000), 6, ["外包稿费", "兼职收入"]),
    "理财收益": ((1000, 300000), 10, ["基金收益", "余额宝", "定期到期"]),
    "红包":   ((500, 50000), 12, ["微信红包", "过节红包", "抢红包"]),
    "其他":   ((500, 100000), 6, ["报销", "退款", "其他"]),
}

ADJ = ["小", "软", "甜", "萌", "奶", "蜜", "桃", "草莓", "柠檬", "蓝莓", "芝士",
       "奶茶", "布丁", "果冻", "曲奇", "棉花糖", "星星", "月亮", "太阳", "云朵",
       "气泡", "苏打", "薄荷", "樱花", "蜜桃", "乌龙", "雪梨", "青柠", "椰子", "糯米"]
NOUN = ["桃子", "草莓", "柠檬", "布丁", "果冻", "曲奇", "糖", "奶盖", "气泡", "苏打",
        "薄荷", "樱花", "雪梨", "青柠", "椰子", "奶茶", "团子", "豆豆", "糯米", "汤圆",
        "年糕", "芝麻", "栗子", "芋圆", "西米", "露露", "小鹿", "小熊", "小兔", "小羊",
        "小鲸", "猫猫", "狗狗", "麋鹿", "考拉"]
SUFFIX = ["酱", "子", "仔", "同学", "的账本", "日常", "要暴富", "不熬夜", "爱吃肉", "想睡觉", "去旅行"]

def rnd_username(used):
    while True:
        if random.random() < 0.8:
            s = random.choice(ADJ) + random.choice(NOUN)
        else:
            s = random.choice(NOUN) + random.choice(SUFFIX)
        if random.random() < 0.15:
            s = s + "_" + str(random.randint(2024, 2026))
        if 2 <= len(s) <= 20 and s not in used:
            used.add(s)
            return s

def rnd_hash():
    return '$2b$12$' + ''.join(random.choices(
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./', k=53))

def rnd_token():
    return ''.join(random.choices('0123456789abcdef', k=64))

def rnd_dt(start, end):
    span = (end - start).total_seconds()
    return start + dt.timedelta(seconds=random.randint(0, int(span)))

# ---------------------------------------------------------------------------
# 生成数据
# ---------------------------------------------------------------------------
NOW = dt.datetime(2026, 10, 31, 23, 59, 0)

# ---- user ----
users = []
usernames = set()
N_ACTIVE, N_DELETING, N_DELETED = 48, 6, 6
for i in range(N_ACTIVE + N_DELETING + N_DELETED):
    uid = i + 1
    name = rnd_username(usernames)
    created = rnd_dt(dt.datetime(2025, 1, 1), dt.datetime(2026, 9, 30))
    if i < N_ACTIVE:
        status = "active"
        purge = None
    elif i < N_ACTIVE + N_DELETING:
        status = "deleting"
        purge = created + dt.timedelta(days=7) + dt.timedelta(days=random.randint(0, 6))
    else:
        status = "deleted"
        purge = created + dt.timedelta(days=7)
    # 密码：deleted 清空
    pwd = "" if status == "deleted" else rnd_hash()
    avatar = None
    if status != "deleted" and random.random() < 0.6:
        avatar = f"/static/avatars/u{uid}.png"
    # 登录失败 / 锁定
    failed = random.choices([0, 0, 0, 0, 1, 2, 3, 4], k=1)[0] if status != "deleted" else 0
    locked = None
    if failed >= 5 or (random.random() < 0.02):
        failed = 5
        locked = created + dt.timedelta(minutes=10)
    last_login = None
    if status == "active" and random.random() < 0.9:
        last_login = rnd_dt(dt.datetime(2026, 10, 1), NOW)
    elif status == "deleting" and random.random() < 0.7:
        last_login = rnd_dt(created, dt.datetime(2026, 10, 25))
    updated = last_login if last_login else created
    users.append(dict(id=uid, username=name, password_hash=pwd, status=status,
                      avatar_url=avatar, failed_login_count=failed, locked_until=locked,
                      purge_at=purge, last_login_at=last_login, created_at=created,
                      updated_at=updated))

# ---- user_session ----
sessions = []
sid = 1
for u in users:
    if u["status"] != "active" or u["last_login_at"] is None:
        continue
    for _ in range(random.randint(1, 3)):
        created = rnd_dt(u["created_at"], u["last_login_at"])
        sessions.append(dict(id=sid, user_id=u["id"], token_hash=rnd_token(),
                             expires_at=created + dt.timedelta(days=30),
                             created_at=created, updated_at=u["last_login_at"]))
        sid += 1

# ---- password_reset_code ----
resets = []
rid = 1
for u in users:
    if u["status"] != "active" or random.random() < 0.55:
        continue
    created = rnd_dt(u["created_at"], NOW)
    used = random.random() < 0.7
    resets.append(dict(id=rid, user_id=u["id"], code=f"{random.randint(0,999999):06d}",
                       expires_at=created + dt.timedelta(minutes=10),
                       fail_count=random.randint(0, 4),
                       used_at=(created + dt.timedelta(minutes=random.randint(1, 9))) if used else None,
                       created_at=created))
    rid += 1

# ---- category / account / bill（仅 active + deleting 有业务数据）----
categories = []
accounts = []
bills = []
cid = 1
aid = 1
bid = 1
business_users = [u for u in users if u["status"] != "deleted"]

for u in business_users:
    # 分类
    exp_names = ["餐饮", "交通", "购物", "日用", "娱乐", "居住", "通讯"]
    exp_names += [n for n in ["水果生鲜", "医疗", "教育", "人情往来", "宠物", "其他"]
                  if random.random() < 0.55]
    custom_exp = random.random() < 0.3
    if custom_exp:
        exp_names.append(random.choice(["咖啡", "健身", "护肤", "旅行", "数码"]))
    inc_names = ["工资"] if random.random() < 0.95 else []
    inc_names += [n for n in ["红包", "理财收益", "兼职", "奖金", "其他"]
                  if random.random() < 0.5]
    icon_map = {n: ic for sc, n, ic, s in CAT_TEMPLATE}
    # 兜底图标
    for extra in ["咖啡", "健身", "护肤", "旅行", "数码"]:
        icon_map.setdefault(extra, random.choice(["☕", "🏋️", "🧴", "✈️", "💻"]))

    u_exp = {}
    for n in exp_names:
        icon = icon_map.get(n, "📝")
        u_exp[n] = cid
        categories.append(dict(id=cid, user_id=u["id"], scope="expense", name=n,
                               icon=icon, sort=10 * len(u_exp), is_system=0,
                               created_at=u["created_at"]))
        cid += 1
    u_inc = {}
    for n in inc_names:
        icon = icon_map.get(n, "📝")
        u_inc[n] = cid
        categories.append(dict(id=cid, user_id=u["id"], scope="income", name=n,
                               icon=icon, sort=10 * len(u_inc), is_system=0,
                               created_at=u["created_at"]))
        cid += 1

    # 账户
    pool = [("微信", "💚", "第三方支付"), ("支付宝", "💙", "第三方支付"),
            ("现金", "💰", "零钱与日常现金"), ("银行卡", "🏦", "储蓄卡 · 日常消费")]
    chosen = random.sample(pool, random.randint(2, 4))
    if random.random() < 0.3:
        chosen.append(("信用卡", "💳", "额度卡"))
    u_acct = {}
    for nm, em, rk in chosen:
        u_acct[nm] = aid
        accounts.append(dict(id=aid, user_id=u["id"], name=nm, emoji=em, remark=rk,
                             sort=10 * len(u_acct), created_at=u["created_at"],
                             updated_at=u["updated_at"]))
        aid += 1

    # 账单
    n_bill = random.randint(40, 160)
    for _ in range(n_bill):
        is_income = random.random() < 0.28
        if is_income and u_inc:
            cat_name = random.choice(list(u_inc.keys()))
            (lo, hi), w, notes = INC_CAT_SPEC.get(cat_name, INC_CAT_SPEC["其他"])
            typ = "income"
        else:
            cat_name = random.choice(list(u_exp.keys()))
            (lo, hi), w, notes = EXP_CAT_SPEC.get(cat_name, EXP_CAT_SPEC["其他"])
            typ = "expense"
        amount = random.randint(lo, hi)
        # 账户：expense 一定比例留空；income 大多有
        if random.random() < (0.12 if is_income else 0.22):
            acct_name, acct_id = None, None
        else:
            acct_name = random.choice(list(u_acct.keys()))
            acct_id = u_acct[acct_name]
        # 日期：偏近期，2026 权重更高
        y = 2026 if random.random() < 0.62 else 2025
        m = random.randint(1, 12)
        d = random.randint(1, 28)
        bd = dt.date(y, m, d)
        if bd > dt.date(2026, 10, 31):
            bd = dt.date(2026, 10, random.randint(1, 31))
        month = bd.strftime("%Y-%m")
        # 记录时间：多数当天，少数补录 +1 天
        rec = dt.datetime.combine(bd, dt.time(random.randint(0, 23), random.randint(0, 59), random.randint(0, 59)))
        if random.random() < 0.08:
            rec += dt.timedelta(days=1)
        updated = rec
        if random.random() < 0.05:
            updated = rec + dt.timedelta(days=random.randint(1, 30))
        # 备注
        note = None
        if random.random() < 0.5:
            base = random.choice(notes)
            if typ == "income" and cat_name == "工资":
                note = f"{m}月工资"
            else:
                note = base
        bills.append(dict(id=bid, user_id=u["id"], username=u["username"], type=typ,
                          amount=amount, amount_yuan=round(amount / 100, 2),
                          category_id=u_exp[cat_name] if typ == "expense" else u_inc[cat_name],
                          category_name=cat_name,
                          account_id=acct_id, account_name=acct_name, note=note,
                          bill_date=bd, month=month,
                          created_at=rec, updated_at=updated))
        bid += 1

# ---- admin_user ----
admins = [
    dict(id=1, username="superadmin", password_hash=rnd_hash(), token_hash=rnd_token(),
         token_expires_at=NOW + dt.timedelta(days=30), failed_login_count=0,
         locked_until=None, last_login_at=rnd_dt(dt.datetime(2026, 10, 25), NOW),
         created_at=dt.datetime(2026, 9, 1, 10, 0, 0),
         updated_at=dt.datetime(2026, 10, 31, 10, 0, 0)),
    dict(id=2, username="ops01", password_hash=rnd_hash(), token_hash=None,
         token_expires_at=None, failed_login_count=2, locked_until=None,
         last_login_at=rnd_dt(dt.datetime(2026, 10, 1), dt.datetime(2026, 10, 28)),
         created_at=dt.datetime(2026, 9, 15, 9, 30, 0),
         updated_at=dt.datetime(2026, 10, 28, 9, 30, 0)),
    dict(id=3, username="ops02", password_hash=rnd_hash(), token_hash=rnd_token(),
         token_expires_at=NOW + dt.timedelta(days=30), failed_login_count=0,
         locked_until=None, last_login_at=dt.datetime(2026, 10, 31, 8, 40, 0),
         created_at=dt.datetime(2026, 10, 1, 14, 0, 0),
         updated_at=dt.datetime(2026, 10, 31, 8, 40, 0)),
]

# ---------------------------------------------------------------------------
# 汇总统计（预计算）
# ---------------------------------------------------------------------------
exp_bills = [b for b in bills if b["type"] == "expense"]
inc_bills = [b for b in bills if b["type"] == "income"]
tot_exp = sum(b["amount_yuan"] for b in exp_bills)
tot_inc = sum(b["amount_yuan"] for b in inc_bills)

cat_exp = defaultdict(lambda: [0, 0.0])
for b in exp_bills:
    cat_exp[b["category_name"]][0] += 1
    cat_exp[b["category_name"]][1] += b["amount_yuan"]
cat_inc = defaultdict(lambda: [0, 0.0])
for b in inc_bills:
    cat_inc[b["category_name"]][0] += 1
    cat_inc[b["category_name"]][1] += b["amount_yuan"]

month_stat = defaultdict(lambda: [0, 0.0, 0, 0.0])
for b in bills:
    if b["type"] == "expense":
        month_stat[b["month"]][0] += 1
        month_stat[b["month"]][1] += b["amount_yuan"]
    else:
        month_stat[b["month"]][2] += 1
        month_stat[b["month"]][3] += b["amount_yuan"]

acct_stat = defaultdict(lambda: [0, 0.0, 0, 0.0])
for b in bills:
    nm = b["account_name"] or "未标记"
    if b["type"] == "expense":
        acct_stat[nm][0] += 1
        acct_stat[nm][1] += b["amount_yuan"]
    else:
        acct_stat[nm][2] += 1
        acct_stat[nm][3] += b["amount_yuan"]

user_stat = defaultdict(lambda: [0, 0.0, 0.0])
for b in bills:
    user_stat[b["username"]][0] += 1
    if b["type"] == "expense":
        user_stat[b["username"]][1] += b["amount_yuan"]
    else:
        user_stat[b["username"]][2] += b["amount_yuan"]

months_sorted = sorted(month_stat.keys())
active_cnt = sum(1 for u in users if u["status"] == "active")
n_exp, n_inc = len(exp_bills), len(inc_bills)
avg_exp = tot_exp / n_exp if n_exp else 0
months_span = len(months_sorted)
per_capita_month_exp = tot_exp / active_cnt / months_span if active_cnt and months_span else 0

# ---------------------------------------------------------------------------
# 写 xlsx
# ---------------------------------------------------------------------------
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

FONT = "微软雅黑"
F_TITLE = Font(name=FONT, size=16, bold=True, color="8B3A62")
F_SUB = Font(name=FONT, size=9, color="9E9E9E")
F_HEAD = Font(name=FONT, size=11, bold=True, color="FFFFFF")
F_SEC = Font(name=FONT, size=12, bold=True, color="8B3A62")
F_BODY = Font(name=FONT, size=11, color="333333")
F_KPI = Font(name=FONT, size=11, bold=True, color="C2185B")

FILL_HEAD = PatternFill("solid", fgColor="E91E63")
FILL_SEC = PatternFill("solid", fgColor="FCE4EC")
FILL_TITLE = PatternFill("solid", fgColor="F8BBD0")
FILL_ALT = PatternFill("solid", fgColor="FDF5F8")

THIN = Side(style="thin", color="F0D0DA")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center")
RIGHT = Alignment(horizontal="right", vertical="center")

FMT_INT = '#,##0'
FMT_MONEY = '#,##0.00'
FMT_DATE = 'yyyy-mm-dd'
FMT_DT = 'yyyy-mm-dd hh:mm:ss'
FMT_PCT = '0.0%'

wb = Workbook()
wb.remove(wb.active)


def write_table(ws, headers, rows, fmts, start=1, tab_color="E91E63", autofilter=True):
    ws.sheet_properties.tabColor = tab_color
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=start, column=c, value=h)
        cell.font = F_HEAD
        cell.fill = FILL_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
    for r, row in enumerate(rows, start + 1):
        for c, v in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.font = F_BODY
            cell.border = BORDER
            fmt = fmts[c - 1]
            if fmt in (FMT_INT, FMT_MONEY, FMT_PCT):
                cell.number_format = fmt
                cell.alignment = RIGHT
            elif fmt == FMT_DATE:
                cell.number_format = FMT_DATE
                cell.alignment = CENTER
            elif fmt == FMT_DT:
                cell.number_format = FMT_DT
                cell.alignment = CENTER
            else:
                cell.alignment = LEFT
            if (r - start) % 2 == 0:
                cell.fill = FILL_ALT
    if autofilter and rows:
        ws.auto_filter.ref = f"A{start}:{get_column_letter(len(headers))}{start + len(rows)}"
    ws.freeze_panes = ws.cell(row=start + 1, column=1)
    # 列宽
    widths = [len(h) * 2 for h in headers]
    for row in rows:
        for c, v in enumerate(row):
            if v is not None:
                ln = len(str(v)) * 1.15
                widths[c] = max(widths[c], min(ln, 40))
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = max(w + 2, 10)


# ---- 说明 ----
ws = wb.create_sheet("说明")
ws.sheet_properties.tabColor = "8B3A62"
ws["A1"] = "财务管家 · 数据分析数据文档"
ws["A1"].font = F_TITLE
ws.merge_cells("A1:F1")
ws["A2"] = "数据为按项目数据库设计随机生成的演示数据（非真实用户数据）· 生成时间 2026-10-31"
ws["A2"].font = F_SUB
ws.merge_cells("A2:F2")

notes = [
    ("字段", "说明"),
    ("金额口径", "库中金额一律以「分」为整数存储（bill.amount），本表另加「金额(元)」= amount / 100 供分析，全程无浮点"),
    ("数据来源", "004.数据库脚本(数据库管理员DBA)/01_schema.sql 的 9 张表 + 02_seed.sql 附录 A 模板"),
    ("用户状态", "active 正常 / deleting 注销冷静期（7 天）/ deleted 已注销墓碑；deleted 用户业务数据已物理删除，故无分类/账户/账单"),
    ("分类模板", "V1.9 起注册不再复制模板，故用户分类 is_system 均为 0；category_template 仅存附录 A 参考清单"),
    ("账户", "账户仅为账单的支付方式标记（无余额字段），账户被删时账单 account_id 置 NULL（显示「未标记」）"),
    ("汇总看板", "本表所有统计/占比/月度/分类/账户汇总均为预计算落值（生成脚本以 Python 计算后写入），打开即可用"),
    ("演示规模", f"用户 {len(users)} 人、会话 {len(sessions)} 条、账单 {len(bills)} 笔、分类 {len(categories)} 条、账户 {len(accounts)} 条"),
    ("重新生成", "运行 011.数据可视化/generate_data.py 可重新随机生成（random.seed(42) 固定，可改种子）"),
]
r = 4
for i, (a, b) in enumerate(notes):
    ca = ws.cell(row=r, column=1, value=a)
    cb = ws.cell(row=r, column=2, value=b)
    ca.font = Font(name=FONT, size=10, bold=True, color="8B3A62")
    cb.font = F_BODY
    ca.alignment = LEFT
    cb.alignment = LEFT
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
    r += 1
ws.column_dimensions["A"].width = 14
for c in "BCDEF":
    ws.column_dimensions[c].width = 22
ws["A1"].fill = FILL_TITLE

# ---- 汇总看板 ----
ws = wb.create_sheet("汇总看板")
ws.sheet_properties.tabColor = "C2185B"
ws["A1"] = "财务管家 · 数据分析汇总看板"
ws["A1"].font = F_TITLE
ws.merge_cells("A1:F1")
ws["A1"].fill = FILL_TITLE
ws["A2"] = f"演示数据 · 金额单位：元 · 账单 {len(bills)} 笔 · 覆盖 {months_sorted[0]} ~ {months_sorted[-1]}"
ws["A2"].font = F_SUB
ws.merge_cells("A2:F2")

r = 4
def section(ws, r, title):
    ws.cell(row=r, column=1, value=title).font = F_SEC
    ws.cell(row=r, column=1).fill = FILL_SEC
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    return r + 1

r = section(ws, r, "一、核心指标")
kpis = [
    ("用户总数", len(users)), ("活跃用户", active_cnt),
    ("注销中用户", sum(1 for u in users if u["status"] == "deleting")),
    ("已注销用户", sum(1 for u in users if u["status"] == "deleted")),
    ("账单总笔数", len(bills)), ("支出笔数", n_exp), ("收入笔数", n_inc),
    ("总支出(元)", round(tot_exp, 2)), ("总收入(元)", round(tot_inc, 2)),
    ("净结余(元)", round(tot_inc - tot_exp, 2)),
    ("平均单笔支出(元)", round(avg_exp, 2)),
    ("月均支出(元)", round(tot_exp / months_span, 2)),
    ("月均收入(元)", round(tot_inc / months_span, 2)),
    ("人均月支出(元)", round(per_capita_month_exp, 2)),
]
for i, (k, v) in enumerate(kpis):
    col = (i % 3) * 2 + 1
    row = r + (i // 3)
    ws.cell(row=row, column=col, value=k).font = F_BODY
    ws.cell(row=row, column=col).fill = FILL_ALT
    vc = ws.cell(row=row, column=col + 1, value=v)
    vc.font = F_KPI
    if isinstance(v, float):
        vc.number_format = FMT_MONEY
    else:
        vc.number_format = FMT_INT
    vc.alignment = RIGHT
r += (len(kpis) + 2) // 3 + 1

r = section(ws, r, "二、支出分类汇总")
ws.cell(row=r, column=1, value="分类名称").font = F_HEAD
ws.cell(row=r, column=2, value="笔数").font = F_HEAD
ws.cell(row=r, column=3, value="金额(元)").font = F_HEAD
ws.cell(row=r, column=4, value="占比").font = F_HEAD
for c in range(1, 5):
    ws.cell(row=r, column=c).fill = FILL_HEAD
    ws.cell(row=r, column=c).alignment = CENTER
    ws.cell(row=r, column=c).border = BORDER
r += 1
for name, (cnt, amt) in sorted(cat_exp.items(), key=lambda x: -x[1][1]):
    ws.cell(row=r, column=1, value=name).font = F_BODY
    ws.cell(row=r, column=2, value=cnt).number_format = FMT_INT
    ws.cell(row=r, column=3, value=round(amt, 2)).number_format = FMT_MONEY
    pc = ws.cell(row=r, column=4, value=amt / tot_exp if tot_exp else 0)
    pc.number_format = FMT_PCT
    r += 1
r += 1

r = section(ws, r, "三、收入分类汇总")
ws.cell(row=r, column=1, value="分类名称").font = F_HEAD
ws.cell(row=r, column=2, value="笔数").font = F_HEAD
ws.cell(row=r, column=3, value="金额(元)").font = F_HEAD
ws.cell(row=r, column=4, value="占比").font = F_HEAD
for c in range(1, 5):
    ws.cell(row=r, column=c).fill = FILL_HEAD
    ws.cell(row=r, column=c).alignment = CENTER
    ws.cell(row=r, column=c).border = BORDER
r += 1
for name, (cnt, amt) in sorted(cat_inc.items(), key=lambda x: -x[1][1]):
    ws.cell(row=r, column=1, value=name).font = F_BODY
    ws.cell(row=r, column=2, value=cnt).number_format = FMT_INT
    ws.cell(row=r, column=3, value=round(amt, 2)).number_format = FMT_MONEY
    pc = ws.cell(row=r, column=4, value=amt / tot_inc if tot_inc else 0)
    pc.number_format = FMT_PCT
    r += 1
r += 1

r = section(ws, r, "四、按月收支趋势")
mheaders = ["月份", "支出笔数", "支出(元)", "收入笔数", "收入(元)", "结余(元)"]
for c, h in enumerate(mheaders, 1):
    ws.cell(row=r, column=c, value=h).font = F_HEAD
    ws.cell(row=r, column=c).fill = FILL_HEAD
    ws.cell(row=r, column=c).alignment = CENTER
    ws.cell(row=r, column=c).border = BORDER
r += 1
for m in months_sorted:
    e_cnt, e_amt, i_cnt, i_amt = month_stat[m]
    ws.cell(row=r, column=1, value=m).font = F_BODY
    ws.cell(row=r, column=2, value=e_cnt).number_format = FMT_INT
    ws.cell(row=r, column=3, value=round(e_amt, 2)).number_format = FMT_MONEY
    ws.cell(row=r, column=4, value=i_cnt).number_format = FMT_INT
    ws.cell(row=r, column=5, value=round(i_amt, 2)).number_format = FMT_MONEY
    ws.cell(row=r, column=6, value=round(i_amt - e_amt, 2)).number_format = FMT_MONEY
    r += 1
r += 1

r = section(ws, r, "五、支付账户汇总")
aheaders = ["账户名称", "支出笔数", "支出(元)", "收入笔数", "收入(元)"]
for c, h in enumerate(aheaders, 1):
    ws.cell(row=r, column=c, value=h).font = F_HEAD
    ws.cell(row=r, column=c).fill = FILL_HEAD
    ws.cell(row=r, column=c).alignment = CENTER
    ws.cell(row=r, column=c).border = BORDER
r += 1
for nm, (e_cnt, e_amt, i_cnt, i_amt) in sorted(acct_stat.items(), key=lambda x: -x[1][1]):
    ws.cell(row=r, column=1, value=nm).font = F_BODY
    ws.cell(row=r, column=2, value=e_cnt).number_format = FMT_INT
    ws.cell(row=r, column=3, value=round(e_amt, 2)).number_format = FMT_MONEY
    ws.cell(row=r, column=4, value=i_cnt).number_format = FMT_INT
    ws.cell(row=r, column=5, value=round(i_amt, 2)).number_format = FMT_MONEY
    r += 1
r += 1

r = section(ws, r, "六、用户记账 Top10（按总支出）")
uheaders = ["用户名", "总笔数", "总支出(元)", "总收入(元)"]
for c, h in enumerate(uheaders, 1):
    ws.cell(row=r, column=c, value=h).font = F_HEAD
    ws.cell(row=r, column=c).fill = FILL_HEAD
    ws.cell(row=r, column=c).alignment = CENTER
    ws.cell(row=r, column=c).border = BORDER
r += 1
for nm, (cnt, e_amt, i_amt) in sorted(user_stat.items(), key=lambda x: -x[1][1])[:10]:
    ws.cell(row=r, column=1, value=nm).font = F_BODY
    ws.cell(row=r, column=2, value=cnt).number_format = FMT_INT
    ws.cell(row=r, column=3, value=round(e_amt, 2)).number_format = FMT_MONEY
    ws.cell(row=r, column=4, value=round(i_amt, 2)).number_format = FMT_MONEY
    r += 1
ws.column_dimensions["A"].width = 14
for c in "BCDEF":
    ws.column_dimensions[c].width = 16

# ---- 用户 ----
write_table(wb.create_sheet("用户"),
    ["id", "username", "password_hash", "status", "avatar_url", "failed_login_count",
     "locked_until", "purge_at", "last_login_at", "created_at", "updated_at"],
    [[u["id"], u["username"], u["password_hash"], u["status"], u["avatar_url"],
      u["failed_login_count"], u["locked_until"], u["purge_at"], u["last_login_at"],
      u["created_at"], u["updated_at"]] for u in users],
    [FMT_INT, None, None, None, None, FMT_INT, FMT_DT, FMT_DT, FMT_DT, FMT_DT, FMT_DT])

# ---- 用户会话 ----
write_table(wb.create_sheet("用户会话"),
    ["id", "user_id", "token_hash", "expires_at", "created_at", "updated_at"],
    [[s["id"], s["user_id"], s["token_hash"], s["expires_at"], s["created_at"], s["updated_at"]]
     for s in sessions],
    [FMT_INT, FMT_INT, None, FMT_DT, FMT_DT, FMT_DT], tab_color="D81B60")

# ---- 找回密码验证码 ----
write_table(wb.create_sheet("找回密码验证码"),
    ["id", "user_id", "code", "expires_at", "fail_count", "used_at", "created_at"],
    [[x["id"], x["user_id"], x["code"], x["expires_at"], x["fail_count"], x["used_at"],
      x["created_at"]] for x in resets],
    [FMT_INT, FMT_INT, None, FMT_DT, FMT_INT, FMT_DT, FMT_DT], tab_color="EC407A")

# ---- 分类模板 ----
write_table(wb.create_sheet("分类模板"),
    ["id", "scope", "name", "icon", "sort", "created_at"],
    [[i + 1, sc, nm, ic, s, dt.datetime(2026, 9, 1, 10, 0, 0)]
     for i, (sc, nm, ic, s) in enumerate(CAT_TEMPLATE)],
    [FMT_INT, None, None, None, FMT_INT, FMT_DT], tab_color="F06292")

# ---- 账户模板 ----
write_table(wb.create_sheet("账户模板"),
    ["id", "name", "emoji", "remark", "sort", "created_at"],
    [[i + 1, nm, em, rk, s, dt.datetime(2026, 9, 1, 10, 0, 0)]
     for i, (nm, em, rk, s) in enumerate(ACCT_TEMPLATE)],
    [FMT_INT, None, None, None, FMT_INT, FMT_DT], tab_color="F48FB1")

# ---- 分类 ----
write_table(wb.create_sheet("分类"),
    ["id", "user_id", "scope", "name", "icon", "sort", "is_system", "created_at"],
    [[c["id"], c["user_id"], c["scope"], c["name"], c["icon"], c["sort"],
      c["is_system"], c["created_at"]] for c in categories],
    [FMT_INT, FMT_INT, None, None, None, FMT_INT, FMT_INT, FMT_DT])

# ---- 账户 ----
write_table(wb.create_sheet("账户"),
    ["id", "user_id", "name", "emoji", "remark", "sort", "created_at", "updated_at"],
    [[a["id"], a["user_id"], a["name"], a["emoji"], a["remark"], a["sort"],
      a["created_at"], a["updated_at"]] for a in accounts],
    [FMT_INT, FMT_INT, None, None, None, FMT_INT, FMT_DT, FMT_DT], tab_color="E91E63")

# ---- 账单流水 ----
write_table(wb.create_sheet("账单流水"),
    ["id", "user_id", "用户名", "type", "amount(分)", "金额(元)", "category_id", "分类名称",
     "account_id", "账户名称", "note", "bill_date", "月份", "created_at", "updated_at"],
    [[b["id"], b["user_id"], b["username"], b["type"], b["amount"], b["amount_yuan"],
      b["category_id"], b["category_name"], b["account_id"], b["account_name"],
      b["note"], b["bill_date"], b["month"], b["created_at"], b["updated_at"]] for b in bills],
    [FMT_INT, FMT_INT, None, None, FMT_INT, FMT_MONEY, FMT_INT, None, FMT_INT, None,
     None, FMT_DATE, None, FMT_DT, FMT_DT], tab_color="C2185B")

# ---- 后台管理员 ----
write_table(wb.create_sheet("后台管理员"),
    ["id", "username", "password_hash", "token_hash", "token_expires_at",
     "failed_login_count", "locked_until", "last_login_at", "created_at", "updated_at"],
    [[a["id"], a["username"], a["password_hash"], a["token_hash"], a["token_expires_at"],
      a["failed_login_count"], a["locked_until"], a["last_login_at"], a["created_at"],
      a["updated_at"]] for a in admins],
    [FMT_INT, None, None, None, FMT_DT, FMT_INT, FMT_DT, FMT_DT, FMT_DT, FMT_DT],
    tab_color="AD1457")

wb.save(OUT)
print(f"OK  saved -> {OUT}")
print(f"users={len(users)} sessions={len(sessions)} resets={len(resets)} "
      f"categories={len(categories)} accounts={len(accounts)} bills={len(bills)}")
print(f"total_exp={tot_exp:.2f} total_inc={tot_inc:.2f} months={months_span}")
