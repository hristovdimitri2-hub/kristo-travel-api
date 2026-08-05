import urllib.request
import urllib.error
import json
import ssl
import time
from datetime import datetime, timezone

BASE_URL = "https://kristo-intelligence.vercel.app"

test_definitions = [
    {
        "id": "1_defi_yields_default",
        "route": "/api/defi/yields",
        "description": "GET /api/defi/yields (default free tier / paywall test)",
        "url": f"{BASE_URL}/api/defi/yields",
        "headers": {}
    },
    {
        "id": "1b_defi_yields_demo",
        "route": "/api/defi/yields?demo=true",
        "description": "GET /api/defi/yields?demo=true (demo mode preview)",
        "url": f"{BASE_URL}/api/defi/yields?demo=true",
        "headers": {}
    },
    {
        "id": "1c_defi_yields_trial_wallet",
        "route": "/api/defi/yields",
        "description": "GET /api/defi/yields with X-TRIAL-WALLET header",
        "url": f"{BASE_URL}/api/defi/yields",
        "headers": {"X-TRIAL-WALLET": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"}
    },
    {
        "id": "2_defi_tvl_movers_default",
        "route": "/api/defi/tvl-movers",
        "description": "GET /api/defi/tvl-movers",
        "url": f"{BASE_URL}/api/defi/tvl-movers",
        "headers": {}
    },
    {
        "id": "2b_defi_tvl_movers_demo",
        "route": "/api/defi/tvl-movers?demo=true",
        "description": "GET /api/defi/tvl-movers?demo=true",
        "url": f"{BASE_URL}/api/defi/tvl-movers?demo=true",
        "headers": {}
    },
    {
        "id": "3_defi_tvl_movers_invalid_payment",
        "route": "/api/defi/tvl-movers",
        "description": "GET /api/defi/tvl-movers with invalid X-PAYMENT header",
        "url": f"{BASE_URL}/api/defi/tvl-movers",
        "headers": {"X-PAYMENT": "0x1234567890123456789012345678901234567890"}
    },
    {
        "id": "4_crypto_token_prices_default",
        "route": "/api/crypto/token-prices?tokens=ETH,USDC",
        "description": "GET /api/crypto/token-prices?tokens=ETH,USDC",
        "url": f"{BASE_URL}/api/crypto/token-prices?tokens=ETH,USDC",
        "headers": {}
    },
    {
        "id": "4b_crypto_token_prices_demo",
        "route": "/api/crypto/token-prices?tokens=ETH,USDC&demo=true",
        "description": "GET /api/crypto/token-prices?tokens=ETH,USDC&demo=true",
        "url": f"{BASE_URL}/api/crypto/token-prices?tokens=ETH,USDC&demo=true",
        "headers": {}
    },
    {
        "id": "5_crypto_gas_oracle_default",
        "route": "/api/crypto/gas-oracle",
        "description": "GET /api/crypto/gas-oracle",
        "url": f"{BASE_URL}/api/crypto/gas-oracle",
        "headers": {}
    },
    {
        "id": "5b_crypto_gas_oracle_detail",
        "route": "/api/crypto/gas-oracle?detail=true",
        "description": "GET /api/crypto/gas-oracle?detail=true",
        "url": f"{BASE_URL}/api/crypto/gas-oracle?detail=true",
        "headers": {}
    },
    {
        "id": "6_crypto_wallet_profile_default",
        "route": "/api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "description": "GET /api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "url": f"{BASE_URL}/api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "headers": {}
    },
    {
        "id": "6b_crypto_wallet_profile_demo",
        "route": "/api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f&demo=true",
        "description": "GET /api/crypto/wallet-profile?address=...&demo=true",
        "url": f"{BASE_URL}/api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f&demo=true",
        "headers": {}
    },
    {
        "id": "7_crypto_whale_moves_default",
        "route": "/api/crypto/whale-moves",
        "description": "GET /api/crypto/whale-moves",
        "url": f"{BASE_URL}/api/crypto/whale-moves",
        "headers": {}
    },
    {
        "id": "7b_crypto_whale_moves_demo",
        "route": "/api/crypto/whale-moves?demo=true",
        "description": "GET /api/crypto/whale-moves?demo=true",
        "url": f"{BASE_URL}/api/crypto/whale-moves?demo=true",
        "headers": {}
    },
    {
        "id": "8_crypto_airdrop_tracker_default",
        "route": "/api/crypto/airdrop-tracker",
        "description": "GET /api/crypto/airdrop-tracker",
        "url": f"{BASE_URL}/api/crypto/airdrop-tracker",
        "headers": {}
    },
    {
        "id": "8b_crypto_airdrop_tracker_demo",
        "route": "/api/crypto/airdrop-tracker?demo=true",
        "description": "GET /api/crypto/airdrop-tracker?demo=true",
        "url": f"{BASE_URL}/api/crypto/airdrop-tracker?demo=true",
        "headers": {}
    },
    {
        "id": "9_nft_floor_prices_default",
        "route": "/api/nft/floor-prices",
        "description": "GET /api/nft/floor-prices",
        "url": f"{BASE_URL}/api/nft/floor-prices",
        "headers": {}
    },
    {
        "id": "9b_nft_floor_prices_demo",
        "route": "/api/nft/floor-prices?demo=true",
        "description": "GET /api/nft/floor-prices?demo=true",
        "url": f"{BASE_URL}/api/nft/floor-prices?demo=true",
        "headers": {}
    },
    {
        "id": "10_health",
        "route": "/api/health",
        "description": "GET /api/health",
        "url": f"{BASE_URL}/api/health",
        "headers": {}
    },
    {
        "id": "11_stats_public",
        "route": "/api/stats/public",
        "description": "GET /api/stats/public",
        "url": f"{BASE_URL}/api/stats/public",
        "headers": {}
    },
    {
        "id": "12_sales_recent",
        "route": "/api/sales/recent",
        "description": "GET /api/sales/recent",
        "url": f"{BASE_URL}/api/sales/recent",
        "headers": {}
    },
    {
        "id": "13_credits_no_address",
        "route": "/api/credits",
        "description": "GET /api/credits (without address param)",
        "url": f"{BASE_URL}/api/credits",
        "headers": {}
    },
    {
        "id": "13b_credits_with_address",
        "route": "/api/credits?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "description": "GET /api/credits?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "url": f"{BASE_URL}/api/credits?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "headers": {}
    },
    {
        "id": "14_mcp",
        "route": "/mcp",
        "description": "GET /mcp (Model Context Protocol endpoint)",
        "url": f"{BASE_URL}/mcp",
        "headers": {}
    },
    {
        "id": "15_llms_txt",
        "route": "/llms.txt",
        "description": "GET /llms.txt",
        "url": f"{BASE_URL}/llms.txt",
        "headers": {}
    },
    {
        "id": "16_agents_txt",
        "route": "/agents.txt",
        "description": "GET /agents.txt",
        "url": f"{BASE_URL}/agents.txt",
        "headers": {}
    },
    {
        "id": "17_well_known_x402",
        "route": "/.well-known/x402.json",
        "description": "GET /.well-known/x402.json",
        "url": f"{BASE_URL}/.well-known/x402.json",
        "headers": {}
    },
    {
        "id": "17b_well_known_ai_plugin",
        "route": "/.well-known/ai-plugin.json",
        "description": "GET /.well-known/ai-plugin.json",
        "url": f"{BASE_URL}/.well-known/ai-plugin.json",
        "headers": {}
    },
    {
        "id": "18_openapi_json",
        "route": "/openapi.json",
        "description": "GET /openapi.json",
        "url": f"{BASE_URL}/openapi.json",
        "headers": {}
    },
    {
        "id": "19_api_root",
        "route": "/api",
        "description": "GET /api",
        "url": f"{BASE_URL}/api",
        "headers": {}
    },
    {
        "id": "20_api_pricing",
        "route": "/api/pricing",
        "description": "GET /api/pricing",
        "url": f"{BASE_URL}/api/pricing",
        "headers": {}
    },
    {
        "id": "21_api_agent_intelligence",
        "route": "/api/agent/intelligence",
        "description": "GET /api/agent/intelligence",
        "url": f"{BASE_URL}/api/agent/intelligence",
        "headers": {}
    },
    {
        "id": "extra_agent_welcome",
        "route": "/api/agent/welcome",
        "description": "GET /api/agent/welcome (bounty program)",
        "url": f"{BASE_URL}/api/agent/welcome",
        "headers": {}
    }
]

ctx = ssl.create_default_context()
audit_results = {}

for test in test_definitions:
    url = test["url"]
    headers = {"User-Agent": "curl/7.88.1", **test["headers"]}
    req = urllib.request.Request(url, headers=headers)
    
    status_code = None
    all_headers = {}
    body_str = ""
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            status_code = resp.status
            for k, v in resp.headers.items():
                all_headers[k.lower()] = v
            body_str = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        status_code = e.code
        for k, v in e.headers.items():
            all_headers[k.lower()] = v
        body_str = e.read().decode('utf-8', errors='replace')
    except Exception as e:
        status_code = 0
        body_str = f"Error performing request: {str(e)}"

    parsed_json = None
    try:
        parsed_json = json.loads(body_str)
    except Exception:
        pass

    custom_headers = {
        k: v for k, v in all_headers.items() 
        if k.startswith('x-') or k in ['content-type', 'www-authenticate', 'location']
    }

    audit_results[test["id"]] = {
        "id": test["id"],
        "route": test["route"],
        "description": test["description"],
        "url": test["url"],
        "request_headers": test["headers"],
        "status_code": status_code,
        "custom_headers": custom_headers,
        "all_response_headers": all_headers,
        "body_preview": body_str[:2000],
        "body_full": body_str,
        "parsed_json": parsed_json
    }

# Build summary
status_counts = {}
for r in audit_results.values():
    sc = str(r["status_code"])
    status_counts[sc] = status_counts.get(sc, 0) + 1

output_payload = {
    "metadata": {
        "target": BASE_URL,
        "audited_at_utc": datetime.now(timezone.utc).isoformat(),
        "total_requests_executed": len(test_definitions),
        "status_code_summary": status_counts
    },
    "protocol_specification": {
        "name": "x402 Protocol v1/v2",
        "network": "Base (chain ID 8453)",
        "asset": "USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)",
        "payTo": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "price_per_call": "0.10 USDC (100000 raw, 6 decimals)",
        "payment_header": "X-PAYMENT: <tx_hash>",
        "trial_header_tested": "X-TRIAL-WALLET (ignored or unhandled without valid hash)",
        "demo_query_param": "?demo=true (bypasses paywall and returns sample data with 200 OK)",
        "custom_headers_emitted": [
            "x-payment-required",
            "x-free-tier",
            "x-free-reset",
            "x-bounty-program",
            "x-bounty-info-url"
        ]
    },
    "endpoints": audit_results
}

report_file_path = "/app/conversations/6a6c97fe4bc0607c480e0ad6/api_audit/endpoint_report.json"
with open(report_file_path, "w", encoding="utf-8") as f:
    json.dump(output_payload, f, indent=2)

print(f"Successfully generated full endpoint report at {report_file_path}")
print(f"Total requests: {len(test_definitions)}")
print(f"Status breakdown: {status_counts}")
