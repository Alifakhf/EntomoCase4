"""Generate SIMULATED demonstration data (fixed seed). Nothing here is real client data.
Window: 2021-07-01..2022-06-30 (last 12 months covered by the uploaded WFS dataset)."""
import numpy as np, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
P, S = ROOT/"data/processed", ROOT/"data/synthetic"
S.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20240601)
SRC = "Simulated Dataset"
days = pd.bdate_range("2021-07-01", "2022-06-30")
plants = pd.DataFrame({"plant_id":["PLT-A","PLT-B","PLT-C","PLT-D"],"plant_name":["Plant A","Plant B","Plant C","Plant D"],
    "region":["North","North","South","East"],"source":SRC})
lines = pd.DataFrame([(f"{p}-L{i}",p,f"Line {i}",t) for p in plants.plant_id for i,t in zip((1,2,3),(480,520,440))],
    columns=["line_id","plant_id","line_name","daily_shift_target_units"]); lines["source"]=SRC
shifts = pd.DataFrame({"shift":["Shift 1","Shift 2","Shift 3"],"start_time":["06:00","14:00","22:00"],"source":["WFS shift label; times simulated"]*3})
depts = pd.DataFrame({"department":["Production","Quality","Maintenance","HR & Workforce"],"source":SRC})
# Simulated mapping of the 24 WFS teams to plants: each shift's 8 teams split 2 per plant (demonstration attribute)
tm = pd.read_csv(P/"wfs_team_shift_monthly.csv").groupby("team").agg(shift=("shift","first"),headcount=("distinct_people","mean")).reset_index()
tm["n"] = tm.team.str.extract(r"(\d+)").astype(int); tm = tm.sort_values(["shift","n"])
tm["plant_id"] = [plants.plant_id[i//2] for i in range(8)]*3 if False else tm.groupby("shift").cumcount().floordiv(2).map(dict(enumerate(plants.plant_id)))
tm["headcount"] = tm.headcount.round().astype(int); tm["source"]="WFS team/shift (uploaded) + plant mapping (simulated)"
tm.drop(columns="n").to_csv(S/"dim_team_plant_mapping.csv", index=False)
hc = tm.groupby(["plant_id","shift"]).headcount.sum()           # frontline headcount per plant-shift (from WFS)
# plant profiles: baseline attainment, defect rate, absence, OT hours/shift/day, downtime min/line-shift
prof = {"PLT-A":(0.985,0.022,0.032,5.0,22),"PLT-B":(0.955,0.030,0.040,7.0,35),
        "PLT-C":(0.915,0.040,0.060,12.0,55),"PLT-D":(0.950,0.031,0.045,8.0,38)}
t = np.arange(len(days))/(len(days)-1)                            # 0..1 across the year
def story(pid, k):                                               # injected, clearly illustrative patterns
    late = np.clip((t-0.6)/0.4,0,1)
    if pid=="PLT-C": return {"abs":1+0.55*late,"dt":1+1.1*late,"att":-0.045*late,"def":1+0.15*late,"ot":1+0.8*late}
    if pid=="PLT-D": q = ((t>0.55)&(t<0.85)).astype(float); return {"abs":1+0.1*q,"dt":1+0.1*q,"att":-0.01*q,"def":1+0.55*q,"ot":1+0.1*q}
    return {"abs":1+0*t,"dt":1+0*t,"att":0*t,"def":1+0*t,"ot":1+0*t}
rows_p, rows_q, rows_w = [], [], []
for pid in plants.plant_id:
    att0, d0, a0, ot0, dt0 = prof[pid]; st = story(pid,0)
    for sh in shifts["shift"]:
        shf = {"Shift 1":1.0,"Shift 2":1.01,"Shift 3":0.975}[sh]      # night shift slightly lower
        n = hc[(pid,sh)]; arate = np.clip(a0*st["abs"]*rng.normal(1,0.18,len(days)),0.005,0.2)
        absent = rng.binomial(n, arate); ot = np.maximum(0, ot0*st["ot"]*(n/40)*rng.normal(1,0.25,len(days)))
        rows_w.append(pd.DataFrame({"date":days,"plant_id":pid,"shift":sh,"headcount":n,"scheduled_shifts":n,"absent_shifts":absent,"overtime_hours":ot.round(1)}))
        for _,ln in lines[lines.plant_id==pid].iterrows():
            share = 1/3; target = np.full(len(days), ln.daily_shift_target_units)
            present = (n-absent)*share
            att = np.clip((att0+st["att"])*shf*rng.normal(1,0.03,len(days)) - 0.25*(absent*share/ (n*share))*0,0.6,1.08)
            dtm = np.maximum(0, dt0*st["dt"]*rng.gamma(2.0,0.5,len(days)))
            out = np.round(target*att*(1-dtm/(8*60)*0.5)).astype(int)
            rows_p.append(pd.DataFrame({"date":days,"plant_id":pid,"line_id":ln.line_id,"shift":sh,"target_units":target,"output_units":out,
                "planned_run_minutes":480,"downtime_minutes":dtm.round(0).astype(int),
                "direct_labor_hours":(present*7.5+ot*share).round(1)}))
            insp = out; dr = np.clip(d0*st["def"]*rng.normal(1,0.2,len(days)),0.002,0.15)
            defect = rng.binomial(insp, dr); rework = np.round(defect*rng.uniform(0.5,0.7,len(days))).astype(int); scrap = defect-rework
            rows_q.append(pd.DataFrame({"date":days,"plant_id":pid,"line_id":ln.line_id,"shift":sh,"inspected_units":insp,
                "first_pass_units":insp-defect,"defect_units":defect,"rework_units":rework,"scrap_units":scrap,"good_units":insp-scrap}))
fp = pd.concat(rows_p); fq = pd.concat(rows_q); fw = pd.concat(rows_w)
# good_units belongs to production grain too (output - scrap); merge from quality so KPI definitions agree
fp = fp.merge(fq[["date","line_id","shift","good_units"]], on=["date","line_id","shift"]); 
for d in (fp,fq,fw): d["source"]=SRC
# monthly turnover (simulated; WFS resignations are NOT used here because plant mapping is simulated)
mon = pd.period_range("2021-07","2022-06",freq="M"); tr=[]
for pid in plants.plant_id:
    avg = int(hc[pid].sum()); r = {"PLT-A":0.008,"PLT-B":0.012,"PLT-C":0.020,"PLT-D":0.014}[pid]
    for i,m in enumerate(mon): tr.append((pid,str(m)+"-01",avg,int(rng.poisson(avg*r*(1+ (0.7*max(0,i-6)/5 if pid=="PLT-C" else 0))))))
ft = pd.DataFrame(tr,columns=["plant_id","month","avg_headcount","separations"]); ft["source"]=SRC
# AI4I + generated demonstration attributes (plant, line, date) – NOT in the uploaded file
a = pd.read_csv(P/"ai4i_machine_observations.csv").sort_values("udi")
a["sim_date"] = [days[min(i*len(days)//len(a), len(days)-1)] for i in range(len(a))]
a["sim_plant_id"] = rng.choice(plants.plant_id, len(a)); a["sim_line_id"] = [f"{p}-L{rng.integers(1,4)}" for p in a.sim_plant_id]
a["sim_attributes_note"] = "sim_date, sim_plant_id, sim_line_id are generated demonstration attributes"
dd = pd.DataFrame({"date":pd.date_range("2021-07-01","2022-06-30")}); dd["year"]=dd.date.dt.year; dd["month"]=dd.date.dt.month
dd["month_start"]=dd.date.dt.strftime("%Y-%m-01"); dd["month_name"]=dd.date.dt.strftime("%b %Y"); dd["quarter"]=dd.date.dt.to_period("Q").astype(str); dd["is_workday"]=dd.date.dt.weekday<5
for n,d in {"dim_plant":plants,"dim_line":lines,"dim_shift":shifts,"dim_department":depts,"dim_date":dd,"fact_production":fp,"fact_quality":fq,
            "fact_workforce":fw,"fact_turnover_monthly":ft}.items(): d.to_csv(S/f"{n}.csv", index=False)
a.to_csv(S/"fact_maintenance_ai4i_with_sim_attrs.csv", index=False)
if __name__ == "__main__":
    k = fp.groupby("plant_id").agg(t=("target_units","sum"),o=("output_units","sum"),g=("good_units","sum"),h=("direct_labor_hours","sum"),dt=("downtime_minutes","sum"))
    k["ach%"]=k.o/k.t*100; k["prod"]=k.g/k.h; q=fq.groupby("plant_id")[["inspected_units","first_pass_units","defect_units"]].sum()
    k["FPY%"]=q.first_pass_units/q.inspected_units*100; w=fw.groupby("plant_id")[["absent_shifts","scheduled_shifts","overtime_hours"]].sum()
    k["abs%"]=w.absent_shifts/w.scheduled_shifts*100; k["OT_h"]=w.overtime_hours
    print(k.round(2).to_string()); print(len(fp),len(fq),len(fw),len(ft),len(a)); print(tm.groupby(["plant_id","shift"]).headcount.sum().unstack())
