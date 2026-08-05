import urllib.request
import urllib.error
import json
import ssl

BASE_URL = "https://kristo-intelligence.vercel.app"

tests = [
    {
        "id": "1_defi_yields",
        "name": "GET /api/defi/yields",
        "url": f"{BASE_URL}/api/defi/yields",
        "headers": {}
    },
    {
        "id": "2_defi_tvl_movers",
        "name": "GET /api/defi/tvl-movers",
        "url": f"{BASE_URL}/api/defi/tvl-movers",
        "headers": {}
    },
    {
        "id": "3_defi_tvl_movers_payment",
        "name": "GET /api/defi/tvl-movers with X-PAYMENT header",
        "url": f"{BASE_URL}/api/defi/tvl-movers",
        "headers": {"X-PAYMENT": "0x1234567890123456789012345678901234567890"}
    },
    {
        "id": "4_crypto_token_prices",
        "name": "GET /api/crypto/token-prices?tokens=ETH,USDC",
        "url": f"{BASE_URL}/api/crypto/token-prices?tokens=ETH,USDC",
        "headers": {}
    },
    {
        "id": "5_crypto_gas_oracle",
        "name": "GET /api/crypto/gas-oracle",
        "url": f"{BASE_URL}/api/crypto/gas-oracle",
        "headers": {}
    },
    {
        "id": "6_crypto_wallet_profile",
        "name": "GET /api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "url": f"{BASE_URL}/api/crypto/wallet-profile?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "headers": {}
    },
    {
        "id": "7_crypto_whale_moves",
        "name": "GET /api/crypto/whale-moves",
        "url": f"{BASE_URL}/api/crypto/whale-moves",
        "headers": {}
    },
    {
        "id": "8_crypto_airdrop_tracker",
        "name": "GET /api/crypto/airdrop-tracker",
        "url": f"{BASE_URL}/api/crypto/airdrop-tracker",
        "headers": {}
    },
    {
        "id": "9_nft_floor_prices",
        "name": "GET /api/nft/floor-prices",
        "url": f"{BASE_URL}/api/nft/floor-prices",
        "headers": {}
    },
    {
        "id": "10_health",
        "name": "GET /api/health",
        "url": f"{BASE_URL}/api/health",
        "headers": {}
    },
    {
        "id": "11_stats_public",
        "name": "GET /api/stats/public",
        "url": f"{BASE_URL}/api/stats/public",
        "headers": {}
    },
    {
        "id": "12_sales_recent",
        "name": "GET /api/sales/recent",
        "url": f"{BASE_URL}/api/sales/recent",
        "headers": {}
    },
    {
        "id": "13_credits",
        "name": "GET /api/credits?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "url": f"{BASE_URL}/api/credits?address=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
        "headers": {}
    },
    {
        "id": "14_mcp",
        "name": "GET /mcp",
        "url": f"{BASE_URL}/mcp",
        "headers": {}
    },
    {
        "id": "15_llms_txt",
        "name": "GET /llms.txt",
        "url": f"{BASE_URL}/llms.txt",
        "headers": {}
    },
    {
        "id": "16_agents_txt",
        "name": "GET /agents.txt",
        "url": f"{BASE_URL}/agents.txt",
        "headers": {}
    },
    {
        "id": "17_well_known_x402",
        "name": "GET /.well-known/x402.json",
        "url": f"{BASE_URL}/.well-known/x402.json",
        "headers": {}
    },
    {
        "id": "18_openapi_json",
        "name": "GET /openapi.json",
        "url": f"{BASE_URL}/openapi.json",
        "headers": {}
    },
    {
        "id": "19_api_root",
        "name": "GET /api",
        "url": f"{BASE_URL}/api",
        "headers": {}
    },
    {
        "id": "20_api_pricing",
        "name": "GET /api/pricing",
        "url": f"{BASE_URL}/api/pricing",
        "headers": {}
    },
    {
        "id": "21_api_agent_intelligence",
        "name": "GET /api/agent/intelligence",
        "url": f"{BASE_URL}/api/agent/intelligence",
        "headers": {}
    },
    {
        "id": "extra_yields_demo",
        "name": "GET /api/defi/yields?demo=true",
        "url": f"{BASE_URL}/api/defi/yields?demo=true",
        "headers": {}
    },
    {
        "id": "extra_yields_trial_wallet",
        "name": "GET /api/defi/yields with X-TRIAL-WALLET",
        "url": f"{BASE_URL}/api/defi/yields",
        "headers": {"X-TRIAL-WALLET": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"}
    }
]

ctx = ssl.create_default_context()

results = {}

for test in tests:
    url = test["url"]
    req = urllib.request.Request(url, headers={"User-Agent": "curl/7.88.1", **test["headers"]})
    print(f"Testing {test['name']} ...")
    status_code = None
    headers_dict = {}
    body_str = ""
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            status_code = resp.status
            for k, v in resp.headers.items():
                headers_dict[k.lower()] = v
            body_bytes = resp.read()
            body_str = body_bytes.decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        status_code = e.code
        for k, v in e.headers.items():
            headers_dict[k.lower()] = v
        body_bytes = e.read()
        body_str = body_bytes.decode('utf-8', errors='replace')
    except Exception as e:
        status_code = 0
        body_str = f"Error: {str(e)}"
    
    # Try parsing body as json
    parsed_json = None
    try:
        parsed_json = json.loads(body_str)
    except Exception:
        pass
        
    custom_headers = {
        k: v for k, v in headers_dict.items() 
        if k.startswith('x-') or k in ['content-type', 'www-authenticate', 'location']
    }
    
    results[test["id"]] = {
        "test_name": test["name"],
        "url": test["url"],
        "request_headers": test["headers"],
        "status_code": status_code,
        "response_headers": headers_dict,
        "custom_headers": custom_headers,
        "body_preview": body_str[:2000],
        "body_full": body_str,
        "parsed_json": parsed_json
    }

print("Done testing all endpoints.")

report_path = "/app/conversations/6a6c97fe4bc0607c480e0ad6/api_audit/endpoint_report.json"
with open(report_path, "w", encoding="utf-8") as f:
    json.dump({
        "target_base_url": BASE_URL,
        "summary": {
            "total_endpoints_tested": len(tests),
            "status_counts": {
                str(code): sum(1 for r in results.values() if r["status_code"] == code)
                for code in set(r["status_code"] for r in results.values())
            }
        },
        "endpoints": results
    }, f, indent=2)

print(f"Saved report to {report_path}")
