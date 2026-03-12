"""
SmartSettle FastAPI Backend
Person 2's responsibility — integrates Person 1's optimizer with Person 3's UI.

Run with:  uvicorn main:app --reload

Folder structure (flat — everything in the same directory):
    main.py
    optimizer.py       ← Person 1's file
    generate_tests.py  ← Person 1's test generator
    submission.json    ← written here after /optimize runs
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store (last run) ─────────────────────────────────────────────────
_last_result: dict = {}
_last_txns:   list = []
SUBMISSION_PATH    = "submission.json"


# ══════════════════════════════════════════════════════════════════════════════
#  CORE ENDPOINTS  (Person 1's logic — do not change)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"status": "SmartSettle API running ✅"}


@app.post("/optimize")
async def run_optimizer(
    file: UploadFile = File(...),
    fraud: bool = False,
):
    """
    PRIMARY ENDPOINT — Person 3 calls this with the CSV file.

    Returns:
        submission   → assignments + total_system_cost_estimate
        breakdown    → fee / delay / failure totals + savings vs naive
        verification → did we pass all judge rules?
        tx_count, failed_count, fraud_count → summary numbers for UI header
    """
    global _last_result, _last_txns

    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files accepted")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="wb") as tmp:
        contents = await file.read()
        tmp.write(contents)
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
    breakdown   = cost_breakdown(assignments, txns)
    fraud_flags = detect_fraud(txns) if fraud else {}

    submission = {
        "assignments":                assignments,
        "total_system_cost_estimate": round(total_cost, 4),
    }
    if fraud_flags:
        submission["fraud_flags"] = [
            {"tx_id": tid, **info} for tid, info in fraud_flags.items()
        ]

    write_json(assignments, total_cost, SUBMISSION_PATH,
               fraud_flags if fraud else None)

    verification = verify(tmp_path, SUBMISSION_PATH)
    os.unlink(tmp_path)

    _last_txns = txns
    result = {
        "submission":   submission,
        "breakdown":    breakdown,
        "verification": verification,
        "tx_count":     len(txns),
        "failed_count": sum(1 for a in assignments if a.get("failed")),
        "fraud_count":  len(fraud_flags),
    }
    _last_result = result
    return JSONResponse(result)


@app.get("/results")
def get_last_results():
    """Returns the full result of the last /optimize call."""
    if not _last_result:
        raise HTTPException(404, "No results yet — run POST /optimize first.")
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
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
#  PERSON 3's EXTRA ENDPOINTS  (added by Person 2)
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/cost-breakdown")
def get_cost_breakdown():
    """
    Per-row breakdown table + summary. Call AFTER POST /optimize.

    Person 3 uses the 'rows' list to render the assignments table,
    and 'summary' to render the cost cards and savings number.

    summary keys:
        fee_cost, delay_penalty, failure_penalty, total
        naive_fast_cost   ← what it would cost routing everything to Channel_F
        savings_vs_naive  ← the big number to show judges
        savings_pct       ← percentage cheaper than naive

    row keys:
        tx_id, amount, channel, start_time, waited_minutes
        fee, delay_penalty, failure_penalty, status
    """
    if not _last_result:
        raise HTTPException(404, "No results yet — run POST /optimize first.")
    if not _last_txns:
        raise HTTPException(404, "Transaction data missing — re-run /optimize.")

    assignments = _last_result["submission"]["assignments"]
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
                "tx_id":           tx_id,
                "amount":          amount,
                "channel":         "FAILED",
                "start_time":      None,
                "waited_minutes":  None,
                "fee":             0.0,
                "delay_penalty":   0.0,
                "failure_penalty": round(fp, 4),
                "status":          "failed",
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
                "tx_id":           tx_id,
                "amount":          amount,
                "channel":         channel,
                "start_time":      start_time,
                "waited_minutes":  waited,
                "fee":             round(fee, 4),
                "delay_penalty":   round(dp, 4),
                "failure_penalty": 0.0,
                "status":          "settled",
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
    Returns the raw submission.json.
    Person 3 can wire this to a download button in the UI.
    """
    if not os.path.exists(SUBMISSION_PATH):
        raise HTTPException(404, "No submission.json yet — run POST /optimize first.")
    with open(SUBMISSION_PATH) as f:
        return JSONResponse(json.load(f))