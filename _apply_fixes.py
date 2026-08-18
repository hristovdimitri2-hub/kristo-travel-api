import re

with open('kristo_api.py', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Fix SQL syntax bug: missing closing paren + double fetchone
old_sql = 'cursor.execute("SELECT COUNT(DISTINCT payer_address) as wallets FROM sales WHERE timestamp >= datetime(\'now\', \'-7 days\' AND payer_address IS NOT NULL)")'
if old_sql in content:
    content = content.replace(old_sql, 'cursor.execute("""\n                SELECT COUNT(DISTINCT payer_address) as wallets\n                FROM sales\n                WHERE timestamp >= datetime(\'now\', \'-7 days\')\n                  AND payer_address IS NOT NULL\n            """)')
    changes += 1
    print("FIXED: SQL syntax bug")

old_fetchone = 'unique_wallets = cursor.fetchone()["wallets"] if cursor.fetchone() else 0'
if old_fetchone in content:
    content = content.replace(old_fetchone, 'row = cursor.fetchone()\n            unique_wallets = row["wallets"] if row else 0')
    changes += 1
    print("FIXED: Double fetchone")

# 2. Fix x402 manifest pricing (0.25 -> PRICE_USDC)
if '"price_per_call": "0.25"' in content:
    content = content.replace('"price_per_call": "0.25"', '"price_per_call": str(PRICE_USDC)')
    changes += 1
    print("FIXED: x402 price_per_call")

if '"amount": "0.25"' in content:
    content = content.replace('"amount": "0.25"', '"amount": str(PRICE_USDC)')
    changes += 1
    print("FIXED: x402 accepts amount")

# 3. Fix openapi description hardcoded price
old_desc = '"Each paid endpoint requires payment of 0.01 USDC sent to 0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f via X-PAYMENT header."'
if old_desc in content:
    new_desc = 'f"Each paid endpoint requires payment of {PRICE_USDC} USDC sent to {WALLET_ADDRESS} via X-PAYMENT header."'
    content = content.replace(old_desc, new_desc)
    content = content.replace(
        '"description": "Production-ready pay-per-call AI Agent Intelligence API powered by x402 on Base Blockchain (Chain ID 8453). "',
        '"description": f"Production-ready pay-per-call AI Agent Intelligence API powered by x402 on Base Blockchain (Chain ID 8453). "'
    )
    changes += 1
    print("FIXED: openapi description hardcoded price")

# 4. Fix llms.txt hardcoded prices
if 'txt = """# Kristo Intelligence' in content:
    content = content.replace('txt = """# Kristo Intelligence', 'txt = f"""# Kristo Intelligence')
    content = content.replace('- Paid endpoints: 0.25 USDC per call (USDC on Base mainnet)', f'- Paid endpoints: {{PRICE_USDC}} USDC per call (USDC on Base mainnet)')
    content = content.replace('- Trial: First 3 calls free for new wallets', f'- Trial: First {{TRIAL_FREE_CALLS}} calls free for new wallets')
    content = content.replace('- Volume: 0.15 USDC/call after 50 paid calls', f'- Volume: {{VOLUME_DISCOUNT_PRICE}} USDC/call after {{VOLUME_DISCOUNT_THRESHOLD}} paid calls')
    content = content.replace('2. Send 0.01 USDC to payTo address on Base', f'2. Send {{PRICE_USDC}} USDC to payTo address on Base')
    content = content.replace('## Paid Endpoints (0.01 USDC/call)', f'## Paid Endpoints ({{PRICE_USDC}} USDC/call)')
    changes += 1
    print("FIXED: llms.txt hardcoded prices")

# 5. Fix agents.json hardcoded prices
if '"price_per_call": 0.01,' in content:
    content = content.replace('"price_per_call": 0.01,', '"price_per_call": PRICE_USDC,')
    changes += 1
    print("FIXED: agents.json price_per_call")

content = content.replace('"price_usdc": 0.01', '"price_usdc": PRICE_USDC')
changes += 1
print("FIXED: agents.json tool prices")

# 6. Optimize token security scanner - add owner to parallel gather + timeout
old_gather = '''        r_name = rpc_call("eth_call", [{"to": address, "data": "0x06fdde03"}, "latest"])
        r_symbol = rpc_call("eth_call", [{"to": address, "data": "0x95d89b41"}, "latest"])
        r_decimals = rpc_call("eth_call", [{"to": address, "data": "0x313ce567"}, "latest"])
        r_supply = rpc_call("eth_call", [{"to": address, "data": "0x18160ddd"}, "latest"])

        res_name, res_symbol, res_decimals, res_supply = await asyncio.gather(
            r_name, r_symbol, r_decimals, r_supply
        )'''
if old_gather in content:
    new_gather = '''        r_name = rpc_call("eth_call", [{"to": address, "data": "0x06fdde03"}, "latest"])
        r_symbol = rpc_call("eth_call", [{"to": address, "data": "0x95d89b41"}, "latest"])
        r_decimals = rpc_call("eth_call", [{"to": address, "data": "0x313ce567"}, "latest"])
        r_supply = rpc_call("eth_call", [{"to": address, "data": "0x18160ddd"}, "latest"])
        r_owner = rpc_call("eth_call", [{"to": address, "data": "0x8da5cb5b"}, "latest"])

        try:
            res_name, res_symbol, res_decimals, res_supply, res_owner = await asyncio.wait_for(
                asyncio.gather(r_name, r_symbol, r_decimals, r_supply, r_owner),
                timeout=8.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="RPC timeout - Base node too slow")'''
    content = content.replace(old_gather, new_gather)
    changes += 1
    print("FIXED: Token security scanner - parallel owner fetch + timeout")

# Remove the now-duplicate sequential owner fetch
old_owner_seq = '''        # 3. Check if contract has mint function (0x40c10f19 = mint(address,uint256))
        # Check if contract has owner/setOwner functions (0x8da5cb5b = owner())
        r_owner = rpc_call("eth_call", [{"to": address, "data": "0x8da5cb5b"}, "latest"])
        res_owner = await r_owner'''
if old_owner_seq in content:
    content = content.replace(old_owner_seq, '        # 3. Owner was fetched in parallel above (0x8da5cb5b = owner())')
    changes += 1
    print("FIXED: Removed duplicate sequential owner fetch")

with open('kristo_api.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal changes applied: {changes}")
print("File saved successfully.")