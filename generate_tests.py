"""
Generate test datasets for SmartSettle.
Usage: python generate_tests.py [--size 1000] [--seed 42] [--mode stress]
"""
import csv, random, argparse

def generate(size=100, seed=42, mode="basic", output="transactions.csv"):
    random.seed(seed)
    rows = []

    if mode == "basic":
        for i in range(size):
            rows.append({
                "tx_id":        f"T{i+1}",
                "amount":       random.randint(100, 20000),
                "arrival_time": random.randint(0, 60),
                "max_delay":    random.randint(5, 30),
                "priority":     random.randint(1, 5),
            })

    elif mode == "peak":
        # heavy simultaneous arrivals
        for i in range(size):
            arrival = random.choices(
                [random.randint(0,5), random.randint(5,20), random.randint(20,60)],
                weights=[60, 20, 20]
            )[0]
            rows.append({
                "tx_id":        f"T{i+1}",
                "amount":       random.randint(100, 20000),
                "arrival_time": arrival,
                "max_delay":    random.randint(3, 20),
                "priority":     random.randint(1, 5),
            })

    elif mode == "stress":
        for i in range(size):
            rows.append({
                "tx_id":        f"T{i+1}",
                "amount":       random.randint(100, 50000),
                "arrival_time": random.randint(0, 300),
                "max_delay":    random.choice([1, 2, 3, 5, 10, 30, 60]),
                "priority":     random.randint(1, 5),
            })

    rows.sort(key=lambda r: r["arrival_time"])
    with open(output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["tx_id","amount","arrival_time","max_delay","priority"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} transactions → {output}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--size",   type=int, default=1000)
    parser.add_argument("--seed",   type=int, default=42)
    parser.add_argument("--mode",   choices=["basic","peak","stress"], default="stress")
    parser.add_argument("--output", default="transactions.csv")
    args = parser.parse_args()
    generate(args.size, args.seed, args.mode, args.output)