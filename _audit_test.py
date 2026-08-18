import ast

with open('kristo_api.py', encoding='utf-8') as f:
    source = f.read()

# 1. Syntax check
try:
    ast.parse(source)
    print("PASS: Syntax OK")
except SyntaxError as e:
    print(f"FAIL: Syntax error: {e}")

# 2. Check for get_remote_address usage without import
if 'get_remote_address' in source:
    if 'from slowapi.util import get_remote_address' in source or 'import get_remote_address' in source:
        print("PASS: get_remote_address is imported")
    else:
        print("CRITICAL FAIL: get_remote_address is USED but NOT IMPORTED -> NameError on startup")

# 3. Check for the SQL bug
if "datetime('now', '-7 days' AND" in source:
    print("FAIL: SQL syntax bug in run_intelligence_cycle (missing closing paren)")

# 4. Check for double fetchone
if 'cursor.fetchone()["wallets"] if cursor.fetchone()' in source:
    print("FAIL: Double cursor.fetchone() call - second returns None")

# 5. Check x402 pricing
if '"price_per_call": "0.25"' in source or '"amount": "0.25"' in source:
    print("FAIL: x402 manifest hardcodes 0.25 instead of PRICE_USDC")

# 6. Check deprecated event handlers
if '@app.on_event("startup")' in source or '@app.on_event("shutdown")' in source:
    print("WARN: Deprecated @app.on_event handlers - should use lifespan")

# 7. Check CORS
if 'allow_origins=["*"]' in source:
    print("WARN: CORS allows all origins")

# 8. Check HTTP timeout
if 'timeout=15.0' in source:
    print("WARN: HTTP client timeout is 15s (too long)")

# 9. Check for SQLite indexes
if 'CREATE INDEX' not in source:
    print("WARN: No SQLite indexes defined")

print("\n--- Audit complete ---")