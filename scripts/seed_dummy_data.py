#!/usr/bin/env python3
"""Seed the LedgerFlow dev API with plausible dummy data, Jan 2025 to today.

Hits the running dev server (default http://localhost:8000) with a JWT access
token and creates, for that token's business:

  - a realistic business name (PATCH /api/business/)
  - 6 dealers
  - ~54 purchase bills spread over Jan 2025 .. today, each with a generated
    single-page PDF (the API only accepts application/pdf uploads)
  - ~28 payments, each dated 3-45 days after one of its dealer's bills, with
    a pay-vs-billed ratio per dealer chosen so the outstanding board shows a
    mix of owed / credit / near-zero dealers
  - ~580 daily cashbook entries over the same span, weekend-weighted, a few
    skipped dead days
  - 10 tasks (created today; the API doesn't let you backdate them)

Usage:
    python scripts/seed_dummy_data.py <access-token> [base-url]

Refuses to run if the business already has dealers, so an accidental
re-seed can't double the data. Reset the dev db (or delete the dealer rows)
to start over.

NOTE: the access token is valid 1 hour from issue. This script makes ~700
requests and finishes in well under a minute, but re-run it promptly after
issuing the token.
"""
from __future__ import annotations

import json
import random
import sys
import uuid
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE_URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
TOKEN = sys.argv[1] if len(sys.argv) > 1 else None
if not TOKEN:
    sys.exit("usage: seed_dummy_data.py <access-token> [base-url]")

random.seed(20261010)

TODAY = date.today()
WINDOW_START = date(2025, 1, 1)        # bills + payments + cashbook
WINDOW_END = TODAY - timedelta(days=1)  # nothing dated in the future
CASHBOOK_START = date(2025, 1, 1)


# --- HTTP helpers ------------------------------------------------------------

def request(method: str, path: str, body: dict | None = None,
            upload: tuple[str, bytes, str] | None = None,
            form: dict[str, str] | None = None) -> tuple[int, dict | list]:
    """One API call. `upload` = (field_name, bytes, filename) for multipart;
    `form` = extra plain form fields to send alongside it."""
    url = BASE_URL + path
    headers = {"Authorization": "Bearer " + TOKEN}
    data = None
    if body is not None and upload is None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    elif upload is not None:
        data, ctype = encode_multipart(form or {}, upload)
        headers["Content-Type"] = ctype
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        if e.code == 401:
            raise SystemExit(f"Token expired mid-run at {method} {path}. "
                             "Issue a fresh token and re-run.")
        raise SystemExit(f"FAILED: {method} {path} -> {e.code}\n{detail[:600]}")


def encode_multipart(form: dict[str, str], upload: tuple[str, bytes, str]) -> tuple[bytes, str]:
    field, payload, filename = upload
    boundary = uuid.uuid4().hex
    parts = []
    for key, value in form.items():
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n".encode()
        )
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode()
    return b"".join(parts) + head + payload + f"\r\n--{boundary}--\r\n".encode(), \
        f"multipart/form-data; boundary={boundary}"


# --- A genuinely valid one-page PDF (Courier, a few lines of text) -----------

def make_pdf(title: str, lines: list[str]) -> bytes:
    def esc(s: str) -> str:
        return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    content = f"BT /F1 16 Tf 72 716 Td ({esc(title)}) Tj ET\n"
    y = 684
    for line in lines:
        content += f"BT /F1 11 Tf 72 {y} Td ({esc(line)}) Tj ET\n"
        y -= 18
    data = content.encode("latin-1").rstrip(b"\n")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(data)).encode() + b" >>\nstream\n" + data + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref}\n%%EOF").encode()
    return out


# --- Fixture data -------------------------------------------------------------

DEALERS = [
    {"name": "Shree Balaji Distributors", "gstin": "27AAACS4821B1Z5", "opening_balance": "12500.00", "is_active": True},
    {"name": "Gupta & Sons Wholesalers",  "gstin": "09AAGPG5678B2K1", "opening_balance": "8200.00",  "is_active": True},
    {"name": "City Traders Pvt Ltd",      "gstin": "29AACCT9012C3P8", "opening_balance": "15000.00", "is_active": True},
    {"name": "Modern Hardware Supplies",  "gstin": "24AABCM3456D7Q2", "opening_balance": "0.00",     "is_active": True},
    {"name": "Krishna Pack Private",      "gstin": "33AAFCR7890E5M6", "opening_balance": "3500.00",  "is_active": True},
    {"name": "Anand Provision Stores",    "gstin": None,              "opening_balance": "6000.00",  "is_active": False},
]

# (dealer index, bill count, paid/billed ratio). 0.93 -> some still owed;
# 1.12 / 1.18 -> dealer overpaid (credit); 0.72 -> the biggest claimant.
BILL_PROFILES = [
    (0, 12, 0.93),
    (1, 11, 1.12),
    (2, 13, 0.72),
    (3, 10, 0.99),
    (4, 8, 1.18),
]

METHODS = ["upi", "upi", "upi", "cash", "cash", "cash", "bank_transfer", "cheque", "card"]

TASKS = [
    ("Chase Gupta & Sons for the delayed payment on INV-1087", False),
    ("Ask City Traders to reissue invoice INV-2026-0041 -- wrong GSTIN printed", False),
    ("Finalise the Diwali stock order with Shree Balaji Distributors", False),
    ("File the Q3 GST return", False),
    ("Reconcile this week's cashbook against the bank statement", False),
    ("Upload the remaining July purchase bills", True),
    ("Verify opening balances against the old ledger", True),
    ("Set up Anand Provision Stores once they re-open in the new market", False),
    ("Archive the August bill PDFs", True),
    ("Compare the UPI settlement report with the cashbook totals", True),
]


def rand_day(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))


def money(lo: int, hi: int) -> str:
    if random.random() < 0.85:
        return f"{random.randint(lo, hi):.2f}"
    return f"{random.uniform(lo, hi):.2f}"


def slug(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")


def main() -> None:
    # 0. Auth check + refuse to double-seed -----------------------------------
    status, business = request("GET", "/api/business/")
    if status != 200:
        sys.exit(f"GET /api/business/ -> {status}; is the token valid?")
    status, dealers = request("GET", "/api/dealers/")
    if dealers.get("count", 0) > 0:
        sys.exit(f"Business {business['id']} already has {dealers['count']} dealers -- "
                 "refusing to seed twice. Reset the dev db first.")
    print(f"Business: #{business['id']} \"{business['name']}\" -- empty, seeding "
          f"{WINDOW_START} .. {TODAY}")

    # 1. Business: give the placeholder a real name ----------------------------
    request("PATCH", "/api/business/", body={"name": "Sharma Trading Co."})
    print("  business renamed to \"Sharma Trading Co.\"")

    # 2. Dealers ----------------------------------------------------------------
    dealer_ids: list[int] = []
    for spec in DEALERS:
        _, created = request("POST", "/api/dealers/", body=spec)
        dealer_ids.append(created["id"])
        print(f"  dealer   {created['name']!r} (#{created['id']})")

    # 3. Bills (multipart PDF upload each) --------------------------------------
    dealer_bills: list[dict] = []   # per profile: {"name": ..., "bills": [(date, amount)]}
    inv_seq: dict[int, int] = {}    # year -> running invoice number
    for idx, count, _ratio in BILL_PROFILES:
        d = DEALERS[idx]
        bills = []
        for _ in range(count):
            day = rand_day(WINDOW_START, WINDOW_END)
            inv_seq[day.year] = inv_seq.get(day.year, 0) + 1
            inv = f"INV-{day.year}-{inv_seq[day.year]:04d}"
            amount = money(1800, 58000)
            pdf = make_pdf(
                f"INVOICE {inv}",
                [
                    "To: Sharma Trading Co.",
                    f"From: {d['name']}",
                    f"Date: {day.isoformat()}",
                    f"Amount: Rs. {amount}",
                    "Goods supplied as per delivery note. Payment due in 30 days.",
                ],
            )
            filename = f"bill-{day.isoformat()}-{slug(d['name'])}.pdf"
            _, created = request("POST", "/api/bills/", upload=("image", pdf, filename),
                                 form={"dealer": str(dealer_ids[idx]),
                                       "date": day.isoformat(),
                                       "amount": amount})
            bills.append({"date": created["date"], "amount": created["amount"], "inv": inv})
        print(f"  bills    {len(bills)} for {d['name']} (#{idx + 1})")
        dealer_bills.append({"dealer": d, "bills": bills, "dealer_id": dealer_ids[idx]})

    # 4. Payments (pay-vs-billed ratio per dealer; each follows one bill) -------
    n_payments = 0
    prev = 0
    for entry, (_idx, _count, ratio) in zip(dealer_bills, BILL_PROFILES):
        d = entry["dealer"]
        total = round(sum(float(b["amount"]) for b in entry["bills"]) * ratio, 2)
        n = random.randint(3, 6)
        chunks = [round(total * random.uniform(0.2, 0.5) / n * 2, 2) for _ in range(n)]
        diff = round(total - sum(chunks), 2)
        chunks[0] = round(chunks[0] + diff, 2)
        for amount in chunks:
            if amount <= 0:
                continue
            ref = random.choice(entry["bills"])
            day = min(date.fromisoformat(ref["date"]) + timedelta(days=random.randint(3, 45)),
                      WINDOW_END)
            request("POST", "/api/payments/", body={
                "dealer": entry["dealer_id"],
                "date": day.isoformat(),
                "amount": f"{amount:.2f}",
                "method": random.choice(METHODS),
            })
            n_payments += 1
        print(f"  payments +{n_payments - prev} ({entry['dealer']['name']}, total {n_payments})")
        prev = n_payments

    # 5. Cashbook, one PUT per day ----------------------------------------------
    entries = 0
    day = CASHBOOK_START
    while day <= TODAY:
        if random.random() >= 0.14:  # a couple of dead days
            scale = 1.6 if day.weekday() >= 5 else 1.0
            request("PUT", f"/api/cashbook/by-date/{day.isoformat()}/", body={
                "upi": f"{random.uniform(1500, 15000) * scale:.2f}",
                "cash": f"{random.uniform(500, 6500) * scale:.2f}",
                "cards": "0.00" if random.random() < 0.3
                          else f"{random.uniform(300, 3500) * scale:.2f}",
            })
            entries += 1
        day += timedelta(days=1)
    print(f"  cashbook {entries} entries ({CASHBOOK_START} .. {TODAY})")

    # 6. Tasks --------------------------------------------------------------------
    for title, done in TASKS:
        _, created = request("POST", "/api/tasks/", body={"title": title, "is_done": done})
    print(f"  tasks    {len(TASKS)} created")

    # 7. Verify ----------------------------------------------------------------------
    _, summary = request("GET", "/api/dashboard-summary/?period=quarter")
    _, trend = request("GET", "/api/collection-trend/?period=month")
    for name, path in [("dealers", "/api/dealers/"), ("bills", "/api/bills/"),
                       ("payments", "/api/payments/"), ("tasks", "/api/tasks/"),
                       ("cashbook", "/api/cashbook/")]:
        _, listing = request("GET", path)
        print(f"  total {name:9s}: {listing['count']}")
    out = summary["outstanding"]
    print("\nDashboard (Q4 2026):")
    print(f"  net cash flow: {summary['net_cash_flow']['collected']} collected, "
          f"{summary['net_cash_flow']['paid']} paid, net {summary['net_cash_flow']['amount']}")
    print(f"  purchasing:    {summary['purchasing']['bill_count']} bills / "
          f"{summary['purchasing']['payment_count']} payments this quarter")
    print(f"  outstanding:   {out['total']} across {out['dealer_count']} dealers "
          f"(owed {out['owed']}, credit {out['credit']})")
    for row in out["dealers"]:
        print(f"    {row['name'][:28]:28s} {row['balance']}")
    active_days = len([p for p in trend["trend"] if p["amount"] != "0.00"])
    print(f"  october trend: {trend['current']['total']} so far ({active_days} active days)")
    print("\nDone.")


if __name__ == "__main__":
    main()
