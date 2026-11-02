# -*- coding: utf-8 -*-
"""
从 财务管家-数据分析数据文档.xlsx 抽取图表所需的聚合数据，输出 chart_data.json。
账单流水列（1-based）：id, user_id, 用户名, type, amount(分), 金额(元), category_id,
分类名称, account_id, 账户名称, note, bill_date, 月份, created_at, updated_at
"""
import io
import json
import sys
from collections import defaultdict

from openpyxl import load_workbook

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

XLSX = "财务管家-数据分析数据文档.xlsx"
wb = load_workbook(XLSX, read_only=True, data_only=True)

# ---- 账单 ----
ws = wb["账单流水"]
bills = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[3] is None:
        continue
    bills.append({
        "type": r[3],            # expense / income
        "amount": r[5],          # 金额(元)
        "cat": r[7],             # 分类名称
        "acct": r[9] or "未标记",  # 账户名称
        "month": r[12],          # 月份
        "user": r[2],            # 用户名
    })

exp = [b for b in bills if b["type"] == "expense"]
inc = [b for b in bills if b["type"] == "income"]
tot_exp = round(sum(b["amount"] for b in exp), 2)
tot_inc = round(sum(b["amount"] for b in inc), 2)

# ---- 用户 ----
uws = wb["用户"]
users = list(uws.iter_rows(min_row=2, values_only=True))
active_users = sum(1 for u in users if u[3] == "active")

# ---- 月度 ----
mstat = defaultdict(lambda: [0, 0.0, 0, 0.0])
for b in bills:
    if b["type"] == "expense":
        mstat[b["month"]][0] += 1
        mstat[b["month"]][1] += b["amount"]
    else:
        mstat[b["month"]][2] += 1
        mstat[b["month"]][3] += b["amount"]
months = sorted(mstat)
monthly = {"months": months, "exp": [], "inc": [], "balance": [],
           "exp_count": [], "inc_count": []}
for m in months:
    e_c, e_a, i_c, i_a = mstat[m]
    monthly["exp"].append(round(e_a, 2))
    monthly["inc"].append(round(i_a, 2))
    monthly["balance"].append(round(i_a - e_a, 2))
    monthly["exp_count"].append(e_c)
    monthly["inc_count"].append(i_c)


def cat_stat(bs):
    d = defaultdict(lambda: [0, 0.0])
    for b in bs:
        d[b["cat"]][0] += 1
        d[b["cat"]][1] += b["amount"]
    return [{"name": k, "count": v[0], "amount": round(v[1], 2)}
            for k, v in sorted(d.items(), key=lambda x: -x[1][1])]


exp_cat = cat_stat(exp)
inc_cat = cat_stat(inc)

# ---- 账户 ----
astat = defaultdict(lambda: [0, 0.0, 0, 0.0])
for b in bills:
    if b["type"] == "expense":
        astat[b["acct"]][0] += 1
        astat[b["acct"]][1] += b["amount"]
    else:
        astat[b["acct"]][2] += 1
        astat[b["acct"]][3] += b["amount"]
accounts = [{"name": k, "exp": round(v[1], 2), "inc": round(v[3], 2),
             "exp_count": v[0], "inc_count": v[2]}
            for k, v in sorted(astat.items(), key=lambda x: -x[1][1])]

# ---- 用户 Top10（按总支出）----
ustat = defaultdict(lambda: [0, 0.0, 0.0])
for b in bills:
    ustat[b["user"]][0] += 1
    if b["type"] == "expense":
        ustat[b["user"]][1] += b["amount"]
    else:
        ustat[b["user"]][2] += b["amount"]
user_top = sorted(ustat.items(), key=lambda x: -x[1][1])[:10]
user_top10 = [{"name": k, "count": v[0], "exp": round(v[1], 2), "inc": round(v[2], 2)}
              for k, v in user_top]

data = {
    "kpi": {
        "total_exp": tot_exp,
        "total_inc": tot_inc,
        "net": round(tot_inc - tot_exp, 2),
        "bill_count": len(bills),
        "exp_count": len(exp),
        "inc_count": len(inc),
        "active_users": active_users,
        "months": len(months),
        "avg_exp": round(tot_exp / len(exp), 2) if exp else 0,
        "avg_month_exp": round(tot_exp / len(months), 2) if months else 0,
    },
    "monthly": monthly,
    "exp_cat": exp_cat,
    "inc_cat": inc_cat,
    "accounts": accounts,
    "user_top10": user_top10,
}

with open("chart_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(json.dumps(data, ensure_ascii=False, indent=2))
