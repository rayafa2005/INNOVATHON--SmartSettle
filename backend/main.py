"""
SmartSettle FastAPI Backend
Run with:  uvicorn main:app --reload   (from inside backend/ folder)

Folder structure:
    smartsettle/
    ├── backend/
    │   ├── main.py          ← this file
    │   ├── optimizer.py     ← Person 1's file
    │   └── submission.json  ← written here after /optimize runs
    └── frontend/
        ├── index.html
        ├── styles.css
        └── script.js

Open browser at: http://localhost:8000/ui
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import tempfile, os, json

from optimizer import (
    parse_csv,
    optimize,
    verify,
    cost_breakdown,
    detect_fraud,
    write_json,
    CHANNELS,
)

app = FastAPI(title="SmartSettle API", version="2.0")

# ── CORS — allow frontend to call backend ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SERVE FRONTEND ────────────────────────────────────────────────────────────
# backend/ and frontend/ are siblings, so go one level up with ..
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/ui", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

# submission.json lands in backend/ alongside main.py
SUBMISSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "submission.json")

# ── In-memory store ────────────────────────────────────────────────────────────
_last_result: dict = {}
_last_txns:   list = []


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {
        "status":   "SmartSettle API running ✅",
        "frontend": "http://localhost:8000/ui",
        "docs":     "http://localhost:8000/docs",
    }


@app.post("/optimize")
async def run_optimizer(
    file: UploadFile = File(...),
    fraud: bool = False,
):
    """
    PRIMARY ENDPOINT — called by script.js runOptimizer().

    RESPONSE IS FLAT — script.js reads result.assignments and
    result.total_system_cost_estimate directly at the top level.
    Do NOT nest them under a 'submission' key.

    {
      "assignments":                [...],
      "total_system_cost_estimate": 123.45,
      "breakdown":    {...},
      "verification": {...},
      "fraud_flags":  [...],   only if fraud=true
      "tx_count":     8,
      "failed_count": 0,
      "fraud_count":  0
    }
    """
    global _last_result, _last_txns

    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="wb") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        txns = parse_csv(tmp_path)
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(400, f"CSV parse error: {e}")

    if not txns:
        os.unlink(tmp_path)
        raise HTTPException(400, "No transactions found in file")

    assignments, total_cost = optimize(txns)
    breakdown               = cost_breakdown(assignments, txns)
    fraud_flags             = detect_fraud(txns) if fraud else {}

    # Embed tx metadata into each assignment so the frontend can compute
    # delay and delay penalty without needing to keep txData in memory.
    tx_map = {t.tx_id: t for t in txns}
    for a in assignments:
        tx = tx_map.get(a["tx_id"])
        if tx:
            a["arrival_time"] = tx.arrival_time
            a["amount"]       = tx.amount
            a["priority"]     = tx.priority
            a["max_delay"]    = tx.max_delay

    write_json(assignments, total_cost, SUBMISSION_PATH,
               fraud_flags if fraud else None)

    verification = verify(tmp_path, SUBMISSION_PATH)
    os.unlink(tmp_path)

    # FLAT — assignments at top level so script.js can read result.assignments
    result = {
        "assignments":                assignments,
        "total_system_cost_estimate": round(total_cost, 4),
        "breakdown":                  breakdown,
        "verification":               verification,
        "tx_count":                   len(txns),
        "failed_count":               sum(1 for a in assignments if a.get("failed")),
        "fraud_count":                len(fraud_flags),
    }
    if fraud_flags:
        result["fraud_flags"] = [
            {"tx_id": tid, **info} for tid, info in fraud_flags.items()
        ]

    _last_txns   = txns
    _last_result = result
    return JSONResponse(result)


@app.get("/results")
def get_last_results():
    """
    Returns last result. script.js refetchResults() reads result.assignments.
    Returns JSON {error:...} not HTTP 404 so script.js can check d.error safely.
    """
    if not _last_result:
        return JSONResponse({"error": "No results yet — run POST /optimize first."})
    return JSONResponse(_last_result)


@app.post("/verify")
async def verify_submission(
    csv_file:  UploadFile = File(...),
    json_file: UploadFile = File(...),
):
    """Verify any submission.json against any transactions.csv."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="wb") as tc:
        tc.write(await csv_file.read())
        csv_path = tc.name
    with tempfile.NamedTemporaryFile(delete=False, suffix=".json", mode="wb") as tj:
        tj.write(await json_file.read())
        json_path = tj.name

    result = verify(csv_path, json_path)
    os.unlink(csv_path)
    os.unlink(json_path)
    return JSONResponse(result)


@app.get("/health")
def health():
    """script.js polls this every 12s to show the API status dot in the nav."""
    return {"ok": True}


@app.get("/cost-breakdown")
def get_cost_breakdown():
    """Per-row breakdown + summary. Call after POST /optimize."""
    if not _last_result:
        raise HTTPException(404, "No results yet — run POST /optimize first.")
    if not _last_txns:
        raise HTTPException(404, "Transaction data missing — re-run /optimize.")

    assignments = _last_result["assignments"]  # flat
    tx_map      = {t.tx_id: t for t in _last_txns}

    PENALTY_FACTOR = 0.001
    FAILURE_FACTOR = 0.5
    fee_total = delay_total = failure_total = 0.0
    rows = []

    for a in assignments:
        tx_id  = a["tx_id"]
        tx     = tx_map.get(tx_id)
        amount = tx.amount if tx else 0

        if a.get("failed") or a.get("channel_id") is None:
            fp = FAILURE_FACTOR * amount
            failure_total += fp
            rows.append({
                "tx_id": tx_id, "amount": amount, "channel": "FAILED",
                "start_time": None, "waited_minutes": None,
                "fee": 0.0, "delay_penalty": 0.0,
                "failure_penalty": round(fp, 4), "status": "failed",
            })
        else:
            channel      = a["channel_id"]
            start_time   = a["start_time"]
            arrival_time = tx.arrival_time if tx else 0
            waited       = start_time - arrival_time
            fee          = CHANNELS[channel]["fee"]
            dp           = PENALTY_FACTOR * amount * waited
            fee_total   += fee
            delay_total += dp
            rows.append({
                "tx_id": tx_id, "amount": amount, "channel": channel,
                "start_time": start_time, "waited_minutes": waited,
                "fee": round(fee, 4), "delay_penalty": round(dp, 4),
                "failure_penalty": 0.0, "status": "settled",
            })

    total           = fee_total + delay_total + failure_total
    naive_fast_cost = len(_last_txns) * 5.0
    savings         = naive_fast_cost - total
    savings_pct     = round(savings / naive_fast_cost * 100, 1) if naive_fast_cost > 0 else 0

    return {
        "summary": {
            "fee_cost":         round(fee_total, 4),
            "delay_penalty":    round(delay_total, 4),
            "failure_penalty":  round(failure_total, 4),
            "total":            round(total, 4),
            "naive_fast_cost":  round(naive_fast_cost, 4),
            "savings_vs_naive": round(savings, 4),
            "savings_pct":      savings_pct,
        },
        "rows": rows,
    }


@app.get("/download-submission")
def download_submission():
    """
    script.js sets dl-json href to this URL.
    FileResponse adds Content-Disposition: attachment so browser downloads it.
    """
    if not os.path.exists(SUBMISSION_PATH):
        raise HTTPException(404, "No submission.json yet — run POST /optimize first.")
    return FileResponse(
        SUBMISSION_PATH,
        media_type="application/json",
        filename="submission.json",
    )