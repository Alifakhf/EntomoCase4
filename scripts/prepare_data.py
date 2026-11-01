"""Prepare uploaded source data. Original files in data/raw are never modified.
WFS: names, age, sex, health, personality/ability attributes and free-text notes are dropped;
only team/shift-level aggregates are written; groups with < K_MIN distinct people are suppressed."""
import hashlib, pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT/"data/raw", ROOT/"data/processed"
K_MIN = 5          # minimum distinct people per published aggregate cell
OUT.mkdir(parents=True, exist_ok=True)

def prep_ai4i():
    a = pd.read_csv(RAW/"ai4i2020.csv")
    a.columns = ["udi","product_id","machine_type","air_temp_k","process_temp_k","rot_speed_rpm",
                 "torque_nm","tool_wear_min","machine_failure","twf","hdf","pwf","osf","rnf"]
    assert a.udi.is_unique and a.isna().sum().sum() == 0 and a.duplicated().sum() == 0
    a["source"] = "Uploaded Dataset: AI4I 2020"
    a.to_csv(OUT/"ai4i_machine_observations.csv", index=False)
    return a

def prep_wfs():
    f = next(RAW.glob("wfs_behaviors_and_records*.csv"))
    use = ["sub_ID","sub_shift","sub_team","sub_role","event_date","record_comptype","recorded_efficacy"]
    w = pd.read_csv(f, encoding="cp1252", usecols=use, low_memory=False)   # file is Windows-1252, not UTF-8
    w["event_date"] = pd.to_datetime(w.event_date, format="%m/%d/%Y")
    w["month"] = w.event_date.dt.strftime("%Y-%m-01")
    w = w[(w.sub_team != "unassigned") & (w.sub_shift != "unassigned") & (w.sub_role == "Laborer")].copy()
    w["person_key"] = w.sub_ID.map(lambda i: "P" + hashlib.sha256(f"wfs-{i}".encode()).hexdigest()[:8])
    # Event categories are a grouping choice made for this project (not a WFS-provided field)
    cat = {"Feat":"Positive contribution","Idea":"Positive contribution","Teamwork":"Positive contribution","Sacrifice":"Positive contribution",
           "Lapse":"Conduct/quality lapse","Slip":"Conduct/quality lapse","Disruption":"Conduct/quality lapse","Sabotage":"Conduct/quality lapse",
           "Absence":"Absence","Onboarding":"Workforce change","Resignation":"Workforce change","Termination":"Workforce change"}
    w["event_category"] = w.record_comptype.map(cat)
    def agg(df, keys, label):
        g = df.groupby(keys).agg(event_count=("person_key","size"), distinct_people=("person_key","nunique")).reset_index()
        g["suppressed"] = g.distinct_people < K_MIN
        g.loc[g.suppressed, "event_count"] = pd.NA
        g["source"] = "Uploaded Dataset: WFS (aggregated, pseudonymized)"
        return g
    ev = w[w.event_category.notna()]
    # (1) shift-level, fine event type   (2) team-level, event category
    agg(ev, ["month","sub_shift","record_comptype"], "shift").rename(columns={"sub_shift":"shift","record_comptype":"event_type"}).to_csv(OUT/"wfs_events_monthly_by_shift.csv", index=False)
    agg(ev, ["month","sub_team","sub_shift","event_category"], "team").rename(columns={"sub_team":"team","sub_shift":"shift"}).to_csv(OUT/"wfs_events_monthly_by_team.csv", index=False)
    keys = ["month","sub_team","sub_shift"]
    pr = w[w.record_comptype == "Presence"].groupby(keys).size().rename("presence_records")
    ab = w[w.record_comptype == "Absence"].groupby(keys).size().rename("absence_records")
    hc = w.groupby(keys).person_key.nunique().rename("distinct_people")
    t = pd.concat([pr,ab,hc],axis=1).reset_index().fillna({"absence_records":0,"presence_records":0})
    t = t.rename(columns={"sub_team":"team","sub_shift":"shift"})
    t["suppressed"] = t.distinct_people < K_MIN
    t.to_csv(OUT/"wfs_team_shift_monthly.csv", index=False)
    g = pd.read_csv(OUT/"wfs_events_monthly_by_team.csv")
    return w, g, t

if __name__ == "__main__":
    a = prep_ai4i(); w,g,t = prep_wfs()
    print("AI4I", a.shape, "failure rate %.2f%%" % (a.machine_failure.mean()*100))
    print("WFS laborer rows", len(w), "| event cells", len(g), "suppressed", int(g.suppressed.sum()),
          "| team-shift-week rows", len(t), "| date", w.event_date.min().date(), "to", w.event_date.max().date())
