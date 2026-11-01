"""Rule-based insight engine (no ML). Every insight states the rule + threshold that produced it.
Output: data/processed/insights.json and data/synthetic/fact_action_tracking.csv (SIMULATED seed actions)."""
import json, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; S, P = ROOT/"data/synthetic", ROOT/"data/processed"
CFG = {"gap_vs_peer_median_pct": 5.0,        # plant KPI worse than peer median by >= this relative %
       "recent_months": 3, "trend_increase_pct": 25.0,  # last 3 mo vs prior 9 mo
       "absenteeism_rate_pct": 5.0, "overtime_hours_per_100_workers_day": 15.0,
       "behavior_lapse_rate_increase_pct": 25.0, "min_people_per_cell": 5}
fp, fq, fw = (pd.read_csv(S/f"fact_{n}.csv", parse_dates=["date"]) for n in ("production","quality","workforce"))
for d in (fp,fq,fw): d["month"] = d.date.dt.strftime("%Y-%m")
def plant_month():
    a = fp.groupby(["plant_id","month"]).agg(target=("target_units","sum"),output=("output_units","sum"),good=("good_units","sum"),hrs=("direct_labor_hours","sum"),dt=("downtime_minutes","sum"),run=("planned_run_minutes","sum"))
    b = fq.groupby(["plant_id","month"]).agg(insp=("inspected_units","sum"),fpass=("first_pass_units","sum"),defect=("defect_units","sum"))
    c = fw.groupby(["plant_id","month"]).agg(abs_=("absent_shifts","sum"),sched=("scheduled_shifts","sum"),ot=("overtime_hours","sum"),days=("date","nunique"),hc=("headcount","sum"))
    m = a.join(b).join(c).reset_index()
    m["ach"]=m.output/m.target*100; m["prod"]=m.good/m.hrs; m["fpy"]=m.fpass/m.insp*100
    m["defect_rate"]=m.defect/m.insp*100; m["dt_min_per_run"]=m.dt/m.run*100; m["absent"]=m.abs_/m.sched*100
    m["ot100"]=m.ot/(m.hc/m.days)*100/m.days   # overtime hours per 100 workers per day
    return m
M = plant_month(); months = sorted(M.month.unique()); rec, base = months[-CFG["recent_months"]:], months[:-CFG["recent_months"]]
IND = {"dt":"downtime_pct","prod":"labor_productivity","fpy":"first_pass_yield","ach":"production_achievement","abs_":"absenteeism_rate","defect":"defect_rate"}
ins = []; PN = {"PLT-A":"Plant A","PLT-B":"Plant B","PLT-C":"Plant C","PLT-D":"Plant D"}
def add(kind, plant, dept, inds, obs, why, review, method, sev, extra=None):
    ins.append(dict(id=f"INS-{len(ins)+1:03d}", label=kind, plant_id=plant, plant=PN.get(plant,"All plants"), department=dept, indicators=[IND.get(i,i) for i in inds],
                    observation=obs, why_it_matters=why, review_by=review, method=method, severity=sev, validation_status="Not yet validated by humans", **(extra or {})))
# Rule 1: plant gap vs peer median over the last N months (lower-is-better flag handled)
R = M[M.month.isin(rec)].groupby("plant_id").agg(target=("target","sum"),output=("output","sum"),good=("good","sum"),hrs=("hrs","sum"),insp=("insp","sum"),fpass=("fpass","sum"),defect=("defect","sum"),dt=("dt","sum"),run=("run","sum"),ab=("abs_","sum"),sc=("sched","sum"))
R["ach"]=R.output/R.target*100; R["prod"]=R.good/R.hrs; R["fpy"]=R.fpass/R.insp*100; R["defect_rate"]=R.defect/R.insp*100; R["dt"]=R.dt/R.run*100; R["absent"]=R.ab/R.sc*100
for kpi, lab, dept, hib in [("prod","Labor productivity (good units/direct labor hour)","Production",True),("fpy","First-pass yield (%)","Quality",True),("ach","Production achievement (%)","Production",True),("dt","Downtime (% of planned run time)","Maintenance",False)]:
    for pid, v in R[kpi].items():
        med = R[kpi].drop(pid).median(); gap = (med-v)/med*100 if hib else (v-med)/med*100
        if gap >= CFG["gap_vs_peer_median_pct"]:
            add("Rule-based alert", pid, dept, [kpi], f"{PN[pid]} {lab} is {v:.2f} vs peer median {med:.2f} ({gap:.1f}% worse) over the last {len(rec)} months ({rec[0]} to {rec[-1]}).",
                "A sustained gap versus comparable plants running standardized processes warrants investigation; the gap does not itself identify a cause.", [dept,"COO / Operations"],
                f"Compare plant KPI with median of other plants; alert if >= {CFG['gap_vs_peer_median_pct']}% worse.", "High" if gap>=15 else "Medium")
# Rule 2: recent vs baseline trend deterioration
def per(pid, ms, num, den, mult=100):
    x = M[(M.plant_id==pid)&M.month.isin(ms)]; return x[num].sum()/x[den].sum()*mult
for pid in M.plant_id.unique():
    for num, den, lab, dept in [("dt","run","Downtime (% of planned run time)","Maintenance"),("defect","insp","Defect rate (%)","Quality"),("abs_","sched","Absenteeism rate (%)","HR & Workforce")]:
        r, b = per(pid,rec,num,den), per(pid,base,num,den); ch = (r-b)/b*100
        if ch >= CFG["trend_increase_pct"]:
            add("Rule-based alert", pid, dept, [num], f"{PN[pid]} {lab} rose from {b:.2f} (baseline {base[0]} to {base[-1]}) to {r:.2f} (last {len(rec)} months), +{ch:.0f}%.",
                "A marked deterioration against the plant's own history; check whether it is persistent, seasonal, or linked to a known event.", [dept,"Plant Manager"],
                f"Recent {len(rec)}-month rate vs prior baseline; alert if increase >= {CFG['trend_increase_pct']}%.", "High" if ch>=50 else "Medium")
# Rule 3: absenteeism / overtime absolute thresholds (last N months)
for pid, r in R.iterrows():
    if r.absent >= CFG["absenteeism_rate_pct"]:
        add("Rule-based alert", pid, "HR & Workforce", ["absent_shifts"], f"{PN[pid]} absenteeism is {r.absent:.1f}% in the last {len(rec)} months (threshold {CFG['absenteeism_rate_pct']}%).","Sustained absenteeism raises scheduling risk and may increase overtime.", ["HR & Workforce","Production"], f"Absent / scheduled shifts >= {CFG['absenteeism_rate_pct']}%.","High" if r.absent>=6 else "Medium")
for pid in M.plant_id.unique():
    x = M[(M.plant_id==pid)&M.month.isin(rec)]; hcv = x.hc.sum()/x.days.sum(); v = x.ot.sum()/x.days.sum()/hcv*100
    if v >= CFG["overtime_hours_per_100_workers_day"]:
        add("Rule-based alert", pid, "HR & Workforce", ["overtime_hours"], f"{PN[pid]} overtime is {v:.1f} h per 100 workers per day in the last {len(rec)} months (threshold {CFG['overtime_hours_per_100_workers_day']}).","High overtime can signal capacity or absence pressure; review before it affects retention.", ["HR & Workforce","Production"], "Overtime hours per 100 scheduled workers per workday above threshold.","Medium")
# Rule 5: single-month defect-rate spike vs the plant's own other months (catches temporary episodes)
CFG_SPIKE = 40.0
for pid in M.plant_id.unique():
    x = M[M.plant_id==pid].set_index("month")
    for mo in months[-6:]:
        oth = x.drop(mo); b = oth.defect.sum()/oth.insp.sum()*100; v = x.loc[mo,"defect_rate"]; ch=(v-b)/b*100
        if ch >= CFG_SPIKE:
            add("Rule-based alert", pid, "Quality", ["defect_units"], f"{PN[pid]} defect rate was {v:.2f}% in {mo} vs {b:.2f}% in its other months (+{ch:.0f}%).",
                "A temporary spike can reveal a process, material, or inspection change; confirm whether it has been resolved.", ["Quality","Production"],
                f"Month defect rate vs plant's other months; alert if increase >= {CFG_SPIKE:.0f}% (checked over last 6 months).","Medium"); break
# Rule 4: WFS aggregate behavior trend (shift-level, uploaded data; no plant link)
w = pd.read_csv(P/"wfs_events_monthly_by_shift.csv"); w = w[(~w.suppressed)&(w.event_type.isin(["Lapse","Slip","Disruption","Sabotage"]))].groupby(["month","shift"]).event_count.sum().reset_index()
ppl = pd.read_csv(P/"wfs_team_shift_monthly.csv").groupby(["month","shift"]).distinct_people.sum().reset_index(); w = w.merge(ppl); w["rate"] = w.event_count/w.distinct_people*100
wm = sorted(w.month.unique()); wr, wb = wm[-3:], wm[-9:-3]
for sh, g in w.groupby("shift"):
    r = g[g.month.isin(wr)].rate.mean(); b = g[g.month.isin(wb)].rate.mean(); ch = (r-b)/b*100 if b else 0
    if ch >= CFG["behavior_lapse_rate_increase_pct"]:
        add("Rule-based alert", None, "HR & Workforce", ["behavior_events"], f"WFS (uploaded data): supervisor-recorded lapse/slip/disruption/sabotage events per 100 workers rose {ch:.0f}% on {sh} (last 3 months vs prior 6).","Aggregate team pattern only; not for individual evaluation. Check process, training, or staffing factors.", ["HR & Workforce","Shift managers"], f"Mean monthly recorded-event rate, last 3 vs prior 6 months; alert if >= {CFG['behavior_lapse_rate_increase_pct']}%.","Low", {"source":"Uploaded Dataset: WFS (aggregated)"})
# Observed metric: machine failure + model note (AI4I; demonstration attributes)
mt = json.load(open(P/"model_metrics.json")); a = pd.read_csv(S/"fact_maintenance_ai4i_with_sim_attrs.csv")
add("Model-generated prediction", None, "Maintenance", ["machine_failure"], f"Failure model (Random Forest, AI4I data) reaches PR-AUC {mt['pr_auc']} vs base rate {mt['base_rate_test']:.3f}; at its tuned threshold precision is {mt['at_best_f1']['precision']:.2f} and recall {mt['at_best_f1']['recall']:.2f}.","Useful to prioritize inspection, but roughly 4 in 9 flags are false alarms; predictions require human review.", ["Maintenance"], "Random Forest on type, temperatures, speed, torque, tool wear; failure-mode flags excluded to avoid leakage.","Low", {"source":"Uploaded Dataset: AI4I 2020"})
sev = {"High":0,"Medium":1,"Low":2}; ins.sort(key=lambda i:(sev[i["severity"]], i["plant_id"] or "ZZZ"))
for i,x in enumerate(ins,1): x["id"]=f"INS-{i:03d}"
json.dump({"config":CFG,"insights":ins}, open(P/"insights.json","w"), indent=2)
# seed action tracker: one action per top insight, owners are ROLES (simulated), each function sets its own action
OWN = {"Production":"Production Manager","Quality":"Quality Manager","Maintenance":"Maintenance Manager","HR & Workforce":"HR Business Partner"}
ACT = {"Production":"Review line balancing, staffing and changeover losses with plant team.","Quality":"Run defect Pareto and review inspection/process controls with line leads.","Maintenance":"Review downtime logs and planned-maintenance backlog; validate failure causes on site.","HR & Workforce":"Review scheduling, absence reasons (aggregate) and overtime allocation with team leaders."}
acts = []; st = ["In Progress","Open","Under Review","Open","Completed","In Progress","Open","Under Review"]
for i, x in enumerate([x for x in ins if x["severity"]!="Low"][:8]):
    acts.append(dict(action_id=f"ACT-{i+1:03d}", insight_id=x["id"], issue=x["observation"], plant_id=x["plant_id"], department=x["department"], contributing_indicators=";".join(x["indicators"]),
        action=ACT[x["department"]], owner_role=OWN[x["department"]], priority=x["severity"], due_date=(pd.Timestamp("2022-07-15")+pd.Timedelta(days=14*i)).strftime("%Y-%m-%d"), status=st[i],
        notes="Seeded demo record; root cause not yet validated." if st[i]!="Completed" else "Validated on site; schedule adjusted.", outcome_review="Pending" if st[i]!="Completed" else "Absence trend under watch; re-check in 4 weeks.", source="Simulated Dataset"))
pd.DataFrame(acts).to_csv(S/"fact_action_tracking.csv", index=False)
print(len(ins),"insights;",len(acts),"actions"); 
for x in ins: print(x["id"],x["severity"],x["label"][:6],x["plant_id"],x["department"],"|",x["observation"][:95])
