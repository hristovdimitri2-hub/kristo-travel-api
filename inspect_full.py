import json

with open("/app/conversations/6a6c97fe4bc0607c480e0ad6/api_audit/endpoint_report.json") as f:
    report = json.load(f)

for k, ep in report["endpoints"].items():
    print("=" * 80)
    print(f"KEY: {k}")
    print(f"NAME: {ep['test_name']}")
    print(f"STATUS: {ep['status_code']}")
    print("CUSTOM HEADERS:")
    for hk, hv in ep['custom_headers'].items():
        print(f"  {hk}: {hv}")
    print("BODY:")
    print(ep['body_full'][:1500])
    if len(ep['body_full']) > 1500:
        print("... [TRUNCATED IN DISPLAY]")
