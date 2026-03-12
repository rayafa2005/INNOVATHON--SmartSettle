"""
SmartSettle - Payment Routing & Settlement Optimizer
Algorithm: Priority-Enhanced EDF with Lookahead (PEEL)
Optimized for 1000+ transactions.
"""

import csv
import json
import bisect
import sys
import time
from dataclasses import dataclass
from typing import Optional

# ── Channel specs ──────────────────────────────────────────────────────────────
CHANNELS = {
    "Channel_F": {"fee": 5.0,  "latency": 1,  "cap": 2},
    "Channel_S": {"fee": 1.0,  "latency": 3,  "cap": 4},
    "Channel_B": {"fee": 0.20, "latency": 10, "cap": 10},
}

CHANNEL_ORDER = ["Channel_F", "Channel_S", "Channel_B"]

# ── Twist handlers (change these if judge announces outage / fee spike) ────────
CHANNEL_AVAILABLE = {
    "Channel_F": True,   # Set False if FAST goes down
    "Channel_S": True,
    "Channel_B": True,
}

# If judge doubles Channel_F fee, just change this:
CHANNEL_FEE_OVERRIDE = {
    # "Channel_F": 10.0,   # uncomment if fee spike announced
}

P = 0.001   # delay penalty factor  (from problem spec - do not change)
F = 0.5     # failure penalty factor (from problem spec - do not change)

LOOKAHEAD_N = 5     # how many future txns to consider
LOOKAHEAD_W = 0.3   # weight of lookahead component

# ── Forced fast-path threshold ─────────────────────────────────────────────────
# If max_delay <= this AND amount >= this, force Channel_F immediately
FORCE_FAST_MAX_DELAY  = 2
FORCE_FAST_MIN_AMOUNT = 5000   # only force for high-value urgent txns


# ── Data structures ────────────────────────────────────────────────────────────
@dataclass
class Transaction:
    tx_id:        str
    amount:       int
    arrival_time: int
    max_delay:    int
    priority:     int

    @property
    def deadline(self) -> int:
        return self.arrival_time + self.max_delay


# ── Interval / capacity tracker ────────────────────────────────────────────────
class ChannelSchedule:
    """Tracks busy intervals per channel slot using sorted lists + bisect."""

    def __init__(self, channel_id: str):
        self.cid     = channel_id
        spec         = CHANNELS[channel_id]
        self.cap     = spec["cap"]
        self.latency = spec["latency"]
        self.fee     = CHANNEL_FEE_OVERRIDE.get(channel_id, spec["fee"])
        # slots[i] = sorted list of (start, end) for slot i
        self.slots: list[list[tuple[int, int]]] = [[] for _ in range(self.cap)]

    def _slot_free_at(self, slot: int, t: int) -> bool:
        end = t + self.latency
        for (s, e) in self.slots[slot]:
            if s < end and t < e:
                return False
        return True

    def _slot_earliest(self, slot: int, earliest: int) -> int:
        t = earliest
        for (s, e) in self.slots[slot]:
            if t < e and s < t + self.latency:
                t = max(t, e)
        return t

    def earliest_start(self, earliest: int) -> int:
        best = float("inf")
        for slot in range(self.cap):
            t = self._slot_earliest(slot, earliest)
            if t < best:
                best = t
        return best

    def insert(self, start: int) -> int:
        end = start + self.latency
        for slot in range(self.cap):
            if self._slot_free_at(slot, start):
                bisect.insort(self.slots[slot], (start, end))
                return slot
        raise ValueError(f"No free slot at {start} on {self.cid}")


# ── Urgency / scoring ──────────────────────────────────────────────────────────
def urgency(tx: Transaction, current_time: int) -> float:
    remaining = tx.deadline - current_time
    if remaining <= 0:
        return float("inf")
    return tx.priority / (remaining + 1) * (tx.amount / 10_000)


def effective_fee(channel_id: str) -> float:
    return CHANNEL_FEE_OVERRIDE.get(channel_id, CHANNELS[channel_id]["fee"])


def score_assignment(
    tx: Transaction,
    channel: ChannelSchedule,
    start: int,
    lookahead_txns: list,
    schedules: dict,
) -> float:
    delay = start - tx.arrival_time
    base  = channel.fee + P * tx.amount * delay

    lh_cost = 0.0
    if lookahead_txns:
        new_end = start + channel.latency
        for fut in lookahead_txns:
            fut_delay_proxy = max(0, new_end - fut.arrival_time)
            lh_cost += P * fut.amount * fut_delay_proxy * urgency(fut, start)
        lh_cost /= len(lookahead_txns)

    return base + LOOKAHEAD_W * lh_cost


# ── Fraud detection (bonus layer) ─────────────────────────────────────────────
def detect_fraud(transactions: list) -> dict:
    """
    Returns {tx_id: {"flag": str, "risk": str}} for suspicious transactions.
    Rule-based, no ML needed.
    """
    flags = {}

    # Count burst arrivals
    arrival_counts: dict[int, list] = {}
    for tx in transactions:
        arrival_counts.setdefault(tx.arrival_time, []).append(tx)

    for tx in transactions:
        # Rule 1: High amount + suspiciously low priority
        if tx.amount > 50_000 and tx.priority == 1:
            flags[tx.tx_id] = {"flag": "HIGH_AMOUNT_LOW_PRIORITY", "risk": "medium"}

        # Rule 2: Extreme urgency on very large amount
        elif tx.max_delay < 2 and tx.amount > 20_000:
            flags[tx.tx_id] = {"flag": "EXTREME_URGENCY_HIGH_AMOUNT", "risk": "high"}

        # Rule 3: Burst attack — 5+ transactions at same arrival_time with large amounts
        elif len(arrival_counts.get(tx.arrival_time, [])) >= 5 and tx.amount > 10_000:
            flags[tx.tx_id] = {"flag": "BURST_PATTERN", "risk": "high"}

        # Rule 4: Round-number structuring
        elif tx.amount % 10_000 == 0 and tx.amount >= 10_000:
            flags[tx.tx_id] = {"flag": "ROUND_NUMBER_STRUCTURING", "risk": "low"}

    return flags


# ── Main optimizer ─────────────────────────────────────────────────────────────
def optimize(transactions: list) -> tuple:
    schedules = {
        cid: ChannelSchedule(cid)
        for cid in CHANNEL_ORDER
        if CHANNEL_AVAILABLE.get(cid, True)
    }
    available_channels = [c for c in CHANNEL_ORDER if c in schedules]

    assignments = []
    total_cost  = 0.0

    # Sort: arrival time first, then by urgency desc (tighter deadline + higher priority first)
    txns = sorted(
        transactions,
        key=lambda t: (t.arrival_time, -t.priority, t.max_delay)
    )

    for idx, tx in enumerate(txns):
        # Lookahead: next urgent upcoming transactions
        future = txns[idx + 1: idx + 1 + LOOKAHEAD_N * 2]
        future_sorted = sorted(
            future, key=lambda t: -urgency(t, tx.arrival_time)
        )[:LOOKAHEAD_N]

        # ── Forced fast-path for urgent high-value transactions ────────────────
        forced_channel = None
        if (
            tx.max_delay <= FORCE_FAST_MAX_DELAY
            and tx.amount >= FORCE_FAST_MIN_AMOUNT
            and "Channel_F" in schedules
        ):
            fast_start = schedules["Channel_F"].earliest_start(tx.arrival_time)
            if fast_start <= tx.deadline:
                forced_channel = "Channel_F"
                best_start = fast_start

        if forced_channel:
            best_channel = forced_channel
            best_score   = -1  # forced, skip scoring
        else:
            best_score   = float("inf")
            best_channel = None
            best_start   = None

            for cid in available_channels:
                sch   = schedules[cid]
                start = sch.earliest_start(tx.arrival_time)

                if start > tx.deadline:
                    continue

                sc = score_assignment(tx, sch, start, future_sorted, schedules)
                if sc < best_score:
                    best_score   = sc
                    best_channel = cid
                    best_start   = start

        if best_channel is None:
            assignments.append({
                "tx_id":      tx.tx_id,
                "channel_id": None,
                "start_time": None,
                "failed":     True,
            })
            total_cost += F * tx.amount
        else:
            schedules[best_channel].insert(best_start)
            delay      = best_start - tx.arrival_time
            fee        = effective_fee(best_channel)
            penalty    = P * tx.amount * delay
            total_cost += fee + penalty
            assignments.append({
                "tx_id":      tx.tx_id,
                "channel_id": best_channel,
                "start_time": best_start,
            })

    return assignments, total_cost


# ── Naive cost (for "savings" metric in UI) ────────────────────────────────────
def naive_cost(transactions: list) -> float:
    """Cost if everything went to Channel_F with zero delay (lower bound comparison)."""
    return sum(5.0 for _ in transactions)


# ── I/O helpers ────────────────────────────────────────────────────────────────
def parse_csv(path: str) -> list:
    txns = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            txns.append(Transaction(
                tx_id        = row["tx_id"].strip(),
                amount       = int(row["amount"]),
                arrival_time = int(row["arrival_time"]),
                max_delay    = int(row["max_delay"]),
                priority     = int(row["priority"]),
            ))
    return txns


def write_json(assignments: list, cost: float, path: str, fraud_flags: dict = None):
    out = {
        "assignments":                assignments,
        "total_system_cost_estimate": round(cost, 4),
    }
    if fraud_flags:
        out["fraud_flags"] = [
            {"tx_id": tid, **info}
            for tid, info in fraud_flags.items()
        ]
    with open(path, "w") as f:
        json.dump(out, f, indent=2)


# ── Verify function ────────────────────────────────────────────────────────────
def verify(csv_path: str, json_path: str) -> dict:
    txns = {t.tx_id: t for t in parse_csv(csv_path)}
    with open(json_path) as f:
        sub = json.load(f)

    violations = []
    recomputed = 0.0
    seen       = set()
    occupancy: dict = {c: [] for c in CHANNEL_ORDER}

    for a in sub["assignments"]:
        tid = a["tx_id"]
        if tid in seen:
            violations.append(f"DUPLICATE: {tid}")
        seen.add(tid)

        if tid not in txns:
            violations.append(f"UNKNOWN tx_id: {tid}")
            continue

        tx = txns[tid]

        if a.get("failed"):
            recomputed += F * tx.amount
            continue

        cid   = a["channel_id"]
        start = a["start_time"]

        if cid not in CHANNELS:
            violations.append(f"{tid}: invalid channel {cid}")
            continue
        if start < tx.arrival_time:
            violations.append(f"{tid}: start {start} < arrival {tx.arrival_time}")
        if start > tx.deadline:
            violations.append(f"{tid}: start {start} > deadline {tx.deadline}")

        occupancy[cid].append((start, start + CHANNELS[cid]["latency"]))
        delay      = start - tx.arrival_time
        recomputed += CHANNELS[cid]["fee"] + P * tx.amount * delay

    for tid in txns:
        if tid not in seen:
            violations.append(f"MISSING: {tid}")

    for cid, intervals in occupancy.items():
        cap       = CHANNELS[cid]["cap"]
        all_times = set()
        for (s, e) in intervals:
            for t in range(s, e):
                all_times.add(t)
        for t in sorted(all_times):
            active = sum(1 for (s, e) in intervals if s <= t < e)
            if active > cap:
                violations.append(f"{cid}: capacity {active}>{cap} at t={t}")

    return {
        "ok":              len(violations) == 0,
        "violations":      violations,
        "recomputed_cost": round(recomputed, 4),
        "reported_cost":   sub.get("total_system_cost_estimate"),
    }


# ── Cost breakdown (for UI / API) ─────────────────────────────────────────────
def cost_breakdown(assignments: list, transactions: list) -> dict:
    tx_map     = {t.tx_id: t for t in transactions}
    fee_total  = 0.0
    delay_total= 0.0
    fail_total = 0.0

    for a in assignments:
        tx = tx_map[a["tx_id"]]
        if a.get("failed"):
            fail_total += F * tx.amount
        else:
            fee_total   += CHANNELS[a["channel_id"]]["fee"]
            delay_total += P * tx.amount * (a["start_time"] - tx.arrival_time)

    total = fee_total + delay_total + fail_total
    naive = sum(5.0 + P * tx.amount * 0 for tx in transactions)  # best case all-FAST

    return {
        "fee_cost":       round(fee_total, 4),
        "delay_penalty":  round(delay_total, 4),
        "failure_penalty":round(fail_total, 4),
        "total":          round(total, 4),
        "naive_fast_cost":round(naive, 4),
        "savings_vs_naive":round(naive - total, 4),
    }


# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="SmartSettle optimizer")
    parser.add_argument("--input",  default="transactions.csv")
    parser.add_argument("--output", default="submission.json")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--fraud",  action="store_true", help="Enable fraud detection")
    args = parser.parse_args()

    if args.verify:
        result = verify(args.input, args.output)
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["ok"] else 1)

    t0   = time.perf_counter()
    txns = parse_csv(args.input)
    print(f"Loaded {len(txns)} transactions")

    fraud_flags = detect_fraud(txns) if args.fraud else {}
    if fraud_flags:
        print(f"Fraud flags: {len(fraud_flags)} suspicious transactions")

    assignments, cost = optimize(txns)
    breakdown         = cost_breakdown(assignments, txns)
    write_json(assignments, cost, args.output, fraud_flags if args.fraud else None)

    elapsed = time.perf_counter() - t0
    failed  = sum(1 for a in assignments if a.get("failed"))

    print(f"Done in {elapsed:.3f}s  |  Cost: {cost:.4f}  |  Failed: {failed}/{len(txns)}")
    print(f"Fee: {breakdown['fee_cost']}  |  Delay penalty: {breakdown['delay_penalty']}  |  Failures: {breakdown['failure_penalty']}")
    print(f"Savings vs naive all-FAST: {breakdown['savings_vs_naive']:.4f}")
    print(f"Output: {args.output}")