#!/usr/bin/env python3
"""ローカル3主体×3ターンの提案receiptをJSONLで出力する薄いrunner。

ネットワーク、外部API、secretを使わず、Node側のCanonical contractだけを呼ぶ。
Google Cloud等へ移す場合も、この入出力境界を変えずに実行環境だけを差し替える。
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
RECEIPT_CLI = APP_ROOT / "src" / "ai" / "receipt-cli.mjs"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", default="hackathon-mvp-0")
    args = parser.parse_args()
    completed = subprocess.run(
        ["node", str(RECEIPT_CLI)],
        input=json.dumps({"command": "fixture", "seed": args.seed}, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
        cwd=APP_ROOT,
    )
    print(completed.stdout.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
