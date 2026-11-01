# Website: Workforce & Operational Intelligence Platform (prototype)

## Run
- Easiest: double-click `index.html` (data is embedded in `data/data.js`, so no server is needed).
- Or VS Code: install **Live Server**, right-click `index.html` -> *Open with Live Server*.
- Or: `python -m http.server 8000` inside `website/`, then open http://localhost:8000
- Charts use Chart.js 4.4.1 from cdnjs, so an internet connection is needed the first time. Without it, tables and KPIs still work and charts show a notice.

## Rebuild data (optional)
From the project root: `python scripts/prepare_data.py`, `generate_synthetic_data.py`, `train_failure_model.py`, `analytics_engine.py`, then `python scripts/build_website_data.py`.

## Notes
- Action updates are stored in the browser (localStorage key `woip_actions_v1`); nothing is sent anywhere. Use "Reset to demo data" in the tracker to restore the seed.
- Data labelled Uploaded = AI4I / WFS (WFS only aggregated and pseudonymized). Simulated = generated demo data. No live API is connected.
- Insights are rule-based (thresholds in `data/processed/insights.json`); the failure model is a small Random Forest, both for human review only.

## Time logic
- The From / To dates are the only time control. KPIs, charts, issues and the connected view are all computed for them (default: the last 6 months of data).
- Arrows and trend rules compare with the previous period of the same length (Jan-Jun 2022 vs Jul-Dec 2021). If the dates reach the start of the data, there is nothing earlier, so no arrows or trend rules.

## Charts and explanations
- Every chart card has the same size. Use + / - to zoom (the card scrolls inside), and the expand button for a full-screen view (Esc closes it). Charts with many categories get scroll room automatically.
- Explanations live behind "Details" buttons so the page stays clean.
