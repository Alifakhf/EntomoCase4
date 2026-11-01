"""Build website/data/processed_demo_data.json (+ data.js so index.html also works by double-click)."""
import json, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; S, P, W = ROOT/"data/synthetic", ROOT/"data/processed", ROOT/"website/data"
rd = lambda f: pd.read_csv(f)
plants = rd(S/"dim_plant.csv"); lines = rd(S/"dim_line.csv"); pid = {p:i for i,p in enumerate(plants.plant_id)}; sid = {"Shift 1":0,"Shift 2":1,"Shift 3":2}
lid = {l:i for i,l in enumerate(lines.line_id)}
fp, fq = rd(S/"fact_production.csv"), rd(S/"fact_quality.csv"); fw = rd(S/"fact_workforce.csv")
m = fp.merge(fq[["date","line_id","shift","inspected_units","first_pass_units","defect_units","rework_units","scrap_units"]], on=["date","line_id","shift"])
assert len(m)==len(fp)==len(fq)
line_cols = ["date","plant","line","shift","target","output","good","hrs","dt","run","insp","fp","def","rework","scrap"]
line_rows = [[r.date,pid[r.plant_id],lid[r.line_id],sid[r["shift"]],int(r.target_units),int(r.output_units),int(r.good_units),float(r.direct_labor_hours),int(r.downtime_minutes),int(r.planned_run_minutes),int(r.inspected_units),int(r.first_pass_units),int(r.defect_units),int(r.rework_units),int(r.scrap_units)] for _,r in m.iterrows()]
wf_cols = ["date","plant","shift","hc","absent","sched","ot"]
wf_rows = [[r.date,pid[r.plant_id],sid[r["shift"]],int(r.headcount),int(r.absent_shifts),int(r.scheduled_shifts),float(r.overtime_hours)] for _,r in fw.iterrows()]
a = rd(S/"fact_maintenance_ai4i_with_sim_attrs.csv"); tix = {"L":0,"M":1,"H":2}
mt_cols = ["date","plant","line","type","air","proc","rpm","torque","wear","fail","twf","hdf","pwf","osf","rnf"]
mt_rows = [[r.sim_date[:10],pid[r.sim_plant_id],lid[r.sim_line_id],tix[r.machine_type],float(r.air_temp_k),float(r.process_temp_k),int(r.rot_speed_rpm),float(r.torque_nm),int(r.tool_wear_min),int(r.machine_failure),int(r.twf),int(r.hdf),int(r.pwf),int(r.osf),int(r.rnf)] for _,r in a.iterrows()]
tm = rd(S/"dim_team_plant_mapping.csv"); teamplant = {r.team:pid[r.plant_id] for _,r in tm.iterrows()}
ws = rd(P/"wfs_events_monthly_by_shift.csv"); wt = rd(P/"wfs_events_monthly_by_team.csv"); wp = rd(P/"wfs_team_shift_monthly.csv")
wfs_shift = [[r.month[:7],sid[r["shift"]],r.event_type,None if r.suppressed else int(r.event_count),int(r.distinct_people)] for _,r in ws.iterrows()]
wfs_team = [[r.month[:7],r.team,teamplant[r.team],sid[r["shift"]],r.event_category,None if r.suppressed else int(r.event_count),int(r.distinct_people)] for _,r in wt.iterrows()]
wfs_people = [[r.month[:7],r.team,teamplant[r.team],sid[r["shift"]],int(r.distinct_people)] for _,r in wp.iterrows()]
tr = rd(S/"fact_turnover_monthly.csv"); ins = json.load(open(P/"insights.json")); met = json.load(open(P/"model_metrics.json"))
pred = rd(P/"model_test_predictions.csv"); top = pred.sort_values("predicted_probability",ascending=False).head(15)
cp = pred.assign(pf=pred.predicted_failure).groupby(["machine_type"]).agg(n=("udi","size"),obs=("machine_failure","sum"),pred=("predicted_failure","sum")).reset_index()
acts = rd(S/"fact_action_tracking.csv").fillna("").to_dict("records")
def n(f): return int(len(pd.read_csv(f)))
sources = [
 dict(name="AI4I 2020 Predictive Maintenance",type="Uploaded Dataset",file="ai4i2020.csv",records=10000,completeness=100.0,grain="Machine observation",use="Maintenance dashboard, failure model",note="Plant, line and date are generated demo attributes."),
 dict(name="WFS Behaviors & Records",type="Uploaded Dataset",file="wfs_behaviors_and_records_*.csv",records=411948,completeness=100.0,grain="Daily employee record (aggregated before use)",use="HR & Workforce behavior patterns",note="Names, age, sex, health, personality attributes and notes removed; cells under 5 people suppressed; team-to-plant mapping is simulated."),
 dict(name="Production (simulated)",type="Simulated Dataset",file="fact_production.csv",records=n(S/"fact_production.csv"),completeness=100.0,grain="Date x line x shift",use="Production, Executive",note="Seed 20240601."),
 dict(name="Quality (simulated)",type="Simulated Dataset",file="fact_quality.csv",records=n(S/"fact_quality.csv"),completeness=100.0,grain="Date x line x shift",use="Quality, Executive",note="Seed 20240601."),
 dict(name="Workforce (simulated)",type="Simulated Dataset",file="fact_workforce.csv",records=n(S/"fact_workforce.csv"),completeness=100.0,grain="Date x plant x shift",use="HR, Executive",note="Headcount derived from WFS people counts."),
 dict(name="Turnover (simulated)",type="Simulated Dataset",file="fact_turnover_monthly.csv",records=len(tr),completeness=100.0,grain="Month x plant",use="HR",note="Not derived from WFS resignations."),
 dict(name="Action tracking (simulated seed)",type="Simulated Dataset",file="fact_action_tracking.csv",records=len(acts),completeness=100.0,grain="Action",use="Action tracker",note="Edits are stored only in this browser."),
]
D = dict(generated="Pipeline run: data prepared offline; no live refresh", plants=plants.to_dict("records"), lines=lines.to_dict("records"), shifts=["Shift 1","Shift 2","Shift 3"],
  line_cols=line_cols, line_rows=line_rows, wf_cols=wf_cols, wf_rows=wf_rows, mt_cols=mt_cols, mt_rows=mt_rows,
  wfs_shift=wfs_shift, wfs_team=wfs_team, wfs_people=wfs_people, turnover=tr[["plant_id","month","avg_headcount","separations"]].values.tolist(),
  insights=ins["insights"], insight_config=ins["config"], model=met, top_pred=top.to_dict("records"), pred_by_type=cp.to_dict("records"), actions=acts, sources=sources,
  date_min="2021-07-01", date_max="2022-06-30")
s = json.dumps(D, separators=(",",":"), default=str); (W/"processed_demo_data.json").write_text(s); (W/"data.js").write_text("window.DEMO_DATA="+s+";")
print(len(s)//1024,"KB", len(line_rows),len(wf_rows),len(mt_rows))
