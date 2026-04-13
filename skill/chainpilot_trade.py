#!/usr/bin/env python3
"""
ChainPilot Trade Helper - standalone script for OpenClaw skill.
Handles HMAC-SHA256 signing for AVE Trading API.

Usage:
  python3 chainpilot_trade.py buy <chain> <token_address> <amount_raw> [slippage]
  python3 chainpilot_trade.py sell <chain> <token_address> <amount_raw> [slippage]
  python3 chainpilot_trade.py status <chain> <order_id>
  python3 chainpilot_trade.py wallet
  python3 chainpilot_trade.py approve <chain> <token_address>

Environment variables required:
  AVE_ACCESS_KEY, AVE_SECRET_KEY, AVE_ASSETS_ID
"""

import base64
import hashlib
import hmac
import json
import os
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE_URL = "https://bot-api.ave.ai"
ACCESS_KEY = os.environ.get("AVE_ACCESS_KEY", "")
SECRET_KEY = os.environ.get("AVE_SECRET_KEY", "")
ASSETS_ID = os.environ.get("AVE_ASSETS_ID", "")

NATIVE_TOKEN = {
    "solana": "sol",
    "bsc": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "eth": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "base": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
}


def sign(timestamp, method, path, body=""):
    message = timestamp + method.upper() + path + body
    sig = hmac.new(
        SECRET_KEY.encode(), message.encode(), hashlib.sha256
    ).digest()
    return base64.b64encode(sig).decode()


def api_post(path, payload):
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f000Z")
    sig = sign(ts, "POST", "/" + path.lstrip("/"), body)

    req = Request(
        f"{BASE_URL}/{path.lstrip('/')}",
        data=body.encode(),
        headers={
            "Content-Type": "application/json",
            "AVE-ACCESS-KEY": ACCESS_KEY,
            "AVE-ACCESS-TIMESTAMP": ts,
            "AVE-ACCESS-SIGN": sig,
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        return {"status": e.code, "msg": e.read().decode()}


def api_get(path, params=None):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f000Z")
    sig = sign(ts, "GET", "/" + path.lstrip("/"), "")

    url = f"{BASE_URL}/{path.lstrip('/')}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())

    req = Request(
        url,
        headers={
            "AVE-ACCESS-KEY": ACCESS_KEY,
            "AVE-ACCESS-TIMESTAMP": ts,
            "AVE-ACCESS-SIGN": sig,
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        return {"status": e.code, "msg": e.read().decode()}


def cmd_buy(chain, token_address, amount_raw, slippage="500"):
    native = NATIVE_TOKEN.get(chain, "sol")
    payload = {
        "chain": chain,
        "assetsId": ASSETS_ID,
        "inTokenAddress": native,
        "outTokenAddress": token_address,
        "inAmount": str(amount_raw),
        "swapType": "buy",
        "slippage": str(slippage),
        "useMev": True,
        "autoSlippage": True,
    }
    if chain == "solana":
        payload["gas"] = "21000"
    else:
        payload["autoGas"] = "average"

    result = api_post("v1/thirdParty/tx/sendSwapOrder", payload)
    print(json.dumps(result, indent=2))


def cmd_sell(chain, token_address, amount_raw, slippage="500"):
    native = NATIVE_TOKEN.get(chain, "sol")
    payload = {
        "chain": chain,
        "assetsId": ASSETS_ID,
        "inTokenAddress": token_address,
        "outTokenAddress": native,
        "inAmount": str(amount_raw),
        "swapType": "sell",
        "slippage": str(slippage),
        "useMev": True,
        "autoSlippage": True,
    }
    if chain == "solana":
        payload["gas"] = "21000"
    else:
        payload["autoGas"] = "average"

    result = api_post("v1/thirdParty/tx/sendSwapOrder", payload)
    print(json.dumps(result, indent=2))


def cmd_status(chain, order_id):
    result = api_get("v1/thirdParty/tx/getSwapOrder", {
        "chain": chain, "ids": order_id
    })
    print(json.dumps(result, indent=2))


def cmd_wallet():
    result = api_get("v1/thirdParty/user/getUserByAssetsId", {
        "assetsId": ASSETS_ID
    })
    print(json.dumps(result, indent=2))


def cmd_approve(chain, token_address):
    result = api_post("v1/thirdParty/tx/approve", {
        "chain": chain,
        "assetsId": ASSETS_ID,
        "tokenAddress": token_address,
    })
    print(json.dumps(result, indent=2))


def main():
    if not ACCESS_KEY or not SECRET_KEY or not ASSETS_ID:
        print("Error: AVE_ACCESS_KEY, AVE_SECRET_KEY, and AVE_ASSETS_ID must be set")
        sys.exit(1)

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "buy" and len(sys.argv) >= 5:
        cmd_buy(sys.argv[2], sys.argv[3], sys.argv[4],
                sys.argv[5] if len(sys.argv) > 5 else "500")
    elif action == "sell" and len(sys.argv) >= 5:
        cmd_sell(sys.argv[2], sys.argv[3], sys.argv[4],
                 sys.argv[5] if len(sys.argv) > 5 else "500")
    elif action == "status" and len(sys.argv) >= 4:
        cmd_status(sys.argv[2], sys.argv[3])
    elif action == "wallet":
        cmd_wallet()
    elif action == "approve" and len(sys.argv) >= 4:
        cmd_approve(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
