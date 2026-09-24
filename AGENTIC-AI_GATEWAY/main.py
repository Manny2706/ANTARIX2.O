import os
import requests
import json

API_KEY = "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"


if not API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY is not set")

url = "https://openrouter.ai/api/alpha/decisions"

payload = {
    "model": "typesafe/jev-1.13",

    "state": {
        "description": "A user request that needs to be routed to an appropriate agent.",
        "records": [
            {
                "id": "r001",
                "record": "I need to query a PostgreSQL database and retrieve the user's orders."
            }
        ]
    },

    "questions": {
        "route": {
            "type": "choice",

            "instructions": "Which agent should handle this request?",

            "criteria": {
                "database": "The request involves querying, reading, writing, or modifying a database.",
                "coding": "The request primarily involves writing, debugging, or modifying software code."
            }
        }
    }
}

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.post(
    url,
    headers=headers,
    json=payload,
    timeout=60
)

print("Status:", response.status_code)

try:
    result = response.json()
    print(json.dumps(result, indent=2))
except Exception:
    print(response.text)