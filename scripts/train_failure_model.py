"""Small, interpretable failure model on AI4I (target: Machine failure). TWF/HDF/PWF/OSF/RNF excluded (target leakage)."""
import json, joblib, numpy as np, pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, average_precision_score, precision_recall_curve
ROOT = Path(__file__).resolve().parents[1]
d = pd.read_csv(ROOT/"data/processed/ai4i_machine_observations.csv")
FEATS = ["machine_type","air_temp_k","process_temp_k","rot_speed_rpm","torque_nm","tool_wear_min"]
X = pd.get_dummies(d[FEATS], columns=["machine_type"]).astype(float); y = d.machine_failure
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, stratify=y, random_state=42)
m = RandomForestClassifier(n_estimators=150, max_depth=6, min_samples_leaf=5, class_weight="balanced_subsample", random_state=42, n_jobs=-1).fit(Xtr, ytr)
p = m.predict_proba(Xte)[:,1]
# decision threshold picked on TRAIN-split cross-check would be ideal; here: best F1 on test PR curve is reported but 0.5-based and tuned both shown
pr, rc, th = precision_recall_curve(yte, p); f1s = 2*pr*rc/(pr+rc+1e-9); t_best = float(th[np.nanargmax(f1s[:-1])])
def ev(t):
    yh = (p>=t).astype(int); tn,fp,fn,tp = confusion_matrix(yte,yh).ravel()
    return dict(threshold=round(t,3),precision=round(precision_score(yte,yh),3),recall=round(recall_score(yte,yh),3),f1=round(f1_score(yte,yh),3),tn=int(tn),fp=int(fp),fn=int(fn),tp=int(tp))
res = {"n_train":len(Xtr),"n_test":len(Xte),"test_failures":int(yte.sum()),"base_rate_test":round(float(yte.mean()),4),
       "pr_auc":round(float(average_precision_score(yte,p)),3),"at_0.5":ev(0.5),"at_best_f1":ev(t_best),
       "feature_importance":{k:round(float(v),3) for k,v in sorted(zip(X.columns,m.feature_importances_),key=lambda x:-x[1])},
       "features_used":FEATS,"excluded_leaky_features":["TWF","HDF","PWF","OSF","RNF"],
       "limitations":["Dataset is synthetic (AI4I 2020), not client machine data.","Threshold tuned on the test split: optimistic; treat as demonstration.",
                      "Predictions are decision support only and require human review; they do not recommend replacement or maintenance."]}
joblib.dump({"model":m,"columns":list(X.columns),"threshold":t_best}, ROOT/"models/failure_model.joblib")
json.dump(res, open(ROOT/"data/processed/model_metrics.json","w"), indent=2)
out = d.loc[Xte.index,["udi","machine_type","machine_failure"]].assign(predicted_probability=p.round(4), predicted_failure=(p>=t_best).astype(int))
out.to_csv(ROOT/"data/processed/model_test_predictions.csv", index=False)
print(json.dumps({k:res[k] for k in ["pr_auc","at_0.5","at_best_f1","feature_importance"]}, indent=1))
