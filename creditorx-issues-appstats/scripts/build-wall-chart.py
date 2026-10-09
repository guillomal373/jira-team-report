#!/usr/bin/env python3
"""Generates wall-chart.html from the issues data.
Usage: python3 scripts/build-wall-chart.py [data/issues-merged.json | some-issues.csv]
Default source: data/issues-merged.json, every CSV already merged the way the dashboard
merges them (refresh it first with: node scripts/update-files-manifest.mjs).
Uses the same rules as the dashboard (scripts/issue-theme-rules.js)."""
import csv, re, sys, json, unicodedata, subprocess, collections, html, datetime, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = sys.argv[1] if len(sys.argv) > 1 else 'data/issues-merged.json'
cfg = json.loads(subprocess.check_output(['node', '-e', 'global.window={};require("./scripts/issue-theme-rules.js");console.log(JSON.stringify(window.CREDITORX_ISSUE_THEME_CONFIG))'], cwd=root, text=True))

def norm(v):
    v = unicodedata.normalize('NFD', str(v or ''))
    v = ''.join(c for c in v if not unicodedata.combining(c)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s/]+', ' ', v)).strip()

def theme(t):
    t = norm(t); best = None
    for r in cfg['rules']:
        m = [k for k in r['keywords'] if (norm(k) in t if ' ' in norm(k) else re.search(r'\b' + re.escape(norm(k)) + r'\b', t))]
        if m:
            s = sum(len(norm(k)) for k in m) + 10 * len(m)
            if not best or s > best[0]: best = (s, r['label'])
    return best[1] if best else cfg['fallbackTheme']['label']

STAGE = {
 'First Login': 'Registration / First login', 'Phone Number & External Data': 'Registration / First login',
 'Identity Validation & DOB': 'Registration / First login', 'Verification Code & Message Delivery': 'Registration / First login',
 'Login': 'Access (login)',
 'USSD & Carrier Setup': 'Install & setup', 'Install, Reinstall & App Version': 'Install & setup',
 'Contacts & Device Permissions': 'Install & setup',
 'Calls Not Being Blocked': 'Core function (call blocking)', 'Voicemail Blocked': 'Core function (call blocking)',
 'Numbers Under Review & Add Creditor Failures': 'Core function (call blocking)', 'Call Blocking & Creditor Numbers': 'Core function (call blocking)',
 'App Flow, Buttons & Freezes': 'App stability',
}
DAYS = 60
cutoff = (datetime.date.today() - datetime.timedelta(days=DAYS)).isoformat()
COLUMNS = ['Reported Issue', 'Tier 2 Comments', 'Dev Team Comments', 'Date', 'IOS or Android', 'Carrier/Provider']
def load_rows(path):
    """Rows as dicts with the column names used below (headers matched ignoring case)."""
    if str(path).lower().endswith('.json'):
        merged = json.load(open(path, encoding='utf-8'))
        headers, values = merged['headers'], merged['rows']
        records = [dict(zip(headers, v)) for v in values]
    else:
        records = list(csv.DictReader(open(path, encoding='utf-8-sig')))
        headers = list(records[0].keys()) if records else []
    by_lower = {h.strip().lower(): h for h in headers}
    return [{c: rec.get(by_lower.get(c.lower(), c), '') or '' for c in COLUMNS} for rec in records]

rows = [r for r in load_rows(root / src) if norm(r['Reported Issue']) and r['Date'][:10] >= cutoff]
themes = collections.defaultdict(list)
for r in rows:
    themes[theme(' '.join([r['Reported Issue'], r['Tier 2 Comments'], r['Dev Team Comments']]))].append(r)
total = len(rows)
ranked = sorted(themes.items(), key=lambda kv: -len(kv[1]))
stages = collections.Counter()
for k, v in themes.items(): stages[STAGE.get(k, 'Unclassified / generic')] += len(v)
osc = collections.Counter('iOS' if r['IOS or Android'] == 'IOS' else 'Android' if r['IOS or Android'] == 'Android' else 'Both/N/A' for r in rows)
car = collections.Counter()
for r in rows:
    c = r['Carrier/Provider'].strip().lower().replace('-', '').replace(' ', '')
    car[{'verizon': 'Verizon', 'at&t': 'AT&T', 'att': 'AT&T', 'tmobile': 'T-Mobile', 'spectrum': 'Spectrum', 'xfinity': 'Xfinity'}.get(c, 'Other')] += 1
def week(d):
    dt = datetime.date.fromisoformat(d[:10]); return dt - datetime.timedelta(days=dt.weekday())
weeks = collections.Counter(week(r['Date']) for r in rows if r['Date'][:10] >= cutoff)

def example(rs):
    rs = sorted(rs, key=lambda r: len(r['Reported Issue']))
    for r in rs:
        t = ' '.join(r['Reported Issue'].split()).split('*')[0].strip()
        if 25 < len(t) < 110: return t
    return ''
def bars(counter, color, n=None):
    items = counter.most_common(n); mx = max(v for _, v in items)
    return ''.join(f'<div class="row"><span class="lbl">{html.escape(str(k))}</span><span class="track"><i style="width:{v/mx*100:.1f}%;background:{color}"></i></span><b>{v}</b><em>{v/total*100:.0f}%</em></div>' for k, v in items)

PAL = ['#e4572e', '#f3a712', '#29335c', '#2a9d8f', '#8e5572']
stage_names = ['Registration / First login', 'Access (login)', 'Install & setup', 'Core function (call blocking)', 'App stability']
stage_color = dict(zip(stage_names, PAL)); stage_color['Unclassified / generic'] = '#999'
top = ''
mx = len(ranked[0][1])
for i, (k, v) in enumerate(ranked[:10], 1):
    st = STAGE.get(k, 'Unclassified / generic')
    top += f'<div class="theme"><span class="rank">{i}</span><div class="tbody"><div class="thead"><strong>{html.escape(k)}</strong><span class="chip" style="background:{stage_color[st]}">{st}</span></div><div class="track big"><i style="width:{len(v)/mx*100:.1f}%;background:{stage_color[st]}"></i></div><small>“{html.escape(example(v))}”</small></div><div class="num">{len(v)}<small>{len(v)/total*100:.0f}%</small></div></div>'
stage_html = ''.join(f'<div class="row"><span class="lbl">{html.escape(k)}</span><span class="track"><i style="width:{v/max(stages.values())*100:.1f}%;background:{stage_color[k]}"></i></span><b>{v}</b><em>{v/total*100:.0f}%</em></div>' for k, v in stages.most_common())
wk = sorted(weeks.items()); wmx = max(v for _, v in wk)
trend = ''.join(f'<div class="col"><b>{v}</b><i style="height:{v/wmx*120:.0f}px"></i><span>{d.strftime("%m/%d")}</span></div>' for d, v in wk)
dmin = min(r['Date'] for r in rows); dmax = max(r['Date'] for r in rows)
top_stage = stages.most_common(1)[0]
out = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wall Chart – Where CreditorX Fails (Updated {datetime.date.today()})</title><style>
:root{{--bg:#fbfaf6;--ink:#1b1b1f;--mut:#6b6b73;--card:#fff;--line:#e3e0d6}}
@media(prefers-color-scheme:dark){{:root{{--bg:#16161a;--ink:#f2f1ec;--mut:#a3a3ad;--card:#1f1f25;--line:#34343c}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:28px 16px}}
.wrap{{max-width:1400px;margin:auto}}header{{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;align-items:end;border-bottom:4px solid var(--ink);padding-bottom:16px;margin-bottom:24px}}
h1{{font-size:clamp(28px,4vw,52px);margin:0;letter-spacing:-.02em}}header p{{margin:6px 0 0;color:var(--mut)}}
.kpis{{display:flex;gap:28px}}.kpi b{{display:block;font-size:44px;line-height:1}}.kpi span{{color:var(--mut);font-size:13px}}
.grid{{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:20px}}@media(max-width:900px){{.grid{{grid-template-columns:1fr}}}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:20px}}h2{{margin:0 0 14px;font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}}
.theme{{display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}}.theme:last-child{{border:0}}
.rank{{font-size:26px;font-weight:800;width:34px;color:var(--mut)}}.tbody{{flex:1;min-width:0}}.thead{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px}}
.chip{{color:#fff;font-size:11px;padding:2px 8px;border-radius:99px}}.track{{display:block;background:var(--line);border-radius:6px;height:10px;overflow:hidden}}.track.big{{height:14px}}.track i{{display:block;height:100%}}
.theme small{{color:var(--mut);display:block;margin-top:4px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.num{{font-size:34px;font-weight:800;text-align:right;min-width:70px}}.num small{{font-size:12px;font-style:normal;font-weight:400}}
.row{{display:grid;grid-template-columns:150px 1fr 38px 38px;gap:8px;align-items:center;margin:7px 0;font-size:14px}}.row em{{color:var(--mut);font-style:normal;font-size:12px;text-align:right}}.row b{{text-align:right}}
.trend{{display:flex;gap:10px;align-items:end;height:170px}}.col{{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:3px;font-size:12px}}.col i{{width:100%;background:#e4572e;border-radius:4px 4px 0 0}}.col span{{color:var(--mut)}}
.take{{background:var(--ink);color:var(--bg);border-radius:12px;padding:18px;margin-bottom:20px;font-size:18px}}footer{{color:var(--mut);font-size:12px;margin-top:8px}}
.back{{margin-bottom:12px}}.back a{{color:var(--mut);text-decoration:none;font-size:14px}}@media print{{body{{padding:0}}}}</style></head><body><div class="wrap">
<nav class="back"><a href="./index.html">← Dashboard</a></nav><header><div><h1>Where does CreditorX fail?</h1><p><strong>Last updated: {datetime.date.today()}</strong></p><p>Issues reported to support · last {DAYS} days ({dmin} to {dmax}) · source: {src}</p></div>
<div class="kpis"><div class="kpi"><b>{total}</b><span>issues</span></div><div class="kpi"><b>{len(ranked)}</b><span>themes</span></div><div class="kpi"><b>{top_stage[1]/total*100:.0f}%</b><span>in “{top_stage[0].split(" (")[0].split(" /")[0]}”</span></div></div></header>
<div class="take"><strong>Quick read:</strong> {top_stage[1]/total*100:.0f}% of issues happen in <strong>{top_stage[0]}</strong>; the largest single theme is <strong>{ranked[0][0]}</strong> ({len(ranked[0][1])}). Registration/first login + login add up to {(stages['Registration / First login']+stages['Access (login)'])/total*100:.0f}% — most problems occur before users ever get to the call-blocking feature.</div>
<div class="grid"><div><div class="card"><h2>Top 10 failure themes</h2>{top}</div></div>
<div><div class="card"><h2>By journey stage</h2>{stage_html}</div>
<div class="card"><h2>Platform</h2>{bars(osc, '#29335c')}</div>
<div class="card"><h2>Carrier</h2>{bars(car, '#2a9d8f')}</div>
<div class="card"><h2>Issues per week (last {DAYS} days)</h2><div class="trend">{trend}</div></div></div></div>
<footer>Automatic keyword-based classification (scripts/issue-theme-rules.js). Generated on {datetime.date.today()}. Regenerate: node scripts/update-files-manifest.mjs, then python3 scripts/build-wall-chart.py</footer></div></body></html>'''
(root / 'wall-chart.html').write_text(out, encoding='utf-8')
print('ok', total, [(k, len(v)) for k, v in ranked[:5]], dict(stages))
