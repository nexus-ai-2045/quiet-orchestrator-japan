#!/usr/bin/env python3
"""3主体×3ターンのAI提案を生成し、検証済みJSONL receiptを出力する。

外部APIは --provider openai を明示した場合だけ shared.lib.llm_client 経由で呼ぶ。
既定の fixture はCI・デモの再現用で、ネットワークもsecretも使用しない。
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
RECEIPT_CLI = APP_ROOT / "src" / "ai" / "receipt-cli.mjs"
DEFAULT_SEED = "hackathon-mvp-0"
ACTOR_IDS = ("B1", "J2", "C6")


def _node_contract(payload: dict) -> str:
    completed = subprocess.run(
        ["node", str(RECEIPT_CLI)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
        cwd=APP_ROOT,
    )
    return completed.stdout.strip()


def _fixture(seed: str) -> int:
    output = _node_contract({"command": "fixture", "seed": seed})
    print(output)
    return 0


def _load_llm_client():
    projects_root = Path.home() / "Projects"
    sys.path.insert(0, str(projects_root))
    from shared.lib.llm_client import LLMClientError, chat_completion  # type: ignore

    return chat_completion, LLMClientError


def _live(seed: str, model: str, timeout: int) -> int:
    chat_completion, llm_error = _load_llm_client()
    accepted_count = 0
    state_summary = json.loads(_node_contract({"command": "demo-state-summary"}))
    for turn in range(1, 4):
        for actor_id in ACTOR_IDS:
            observation = json.loads(
                _node_contract(
                    {
                        "command": "observation",
                        "actorId": actor_id,
                        "turn": turn,
                        "seed": seed,
                        "stateSummary": state_summary,
                    }
                )
            )
            messages = [
                {
                    "role": "system",
                    "content": (
                        "あなたは協調安全シミュレーターの提案役です。状態を変更せず、"
                        "渡された許可IDだけから提案し、JSONオブジェクトだけを返してください。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "observation": observation,
                            "requiredKeys": [
                                "proposalVersion",
                                "actorId",
                                "turn",
                                "observationHash",
                                "actionId",
                                "relationshipId",
                                "rationale",
                                "confidence",
                            ],
                        },
                        ensure_ascii=False,
                    ),
                },
            ]
            provider_status = "ok"
            proposal: str | None = None
            try:
                proposal = chat_completion(
                    messages,
                    model=model,
                    max_output_tokens=400,
                    reasoning_effort="minimal",
                    response_format={"type": "json_object"},
                    timeout=timeout,
                )
            except llm_error as exc:
                provider_status = "timeout" if "timed out" in str(exc).lower() else "error"
            receipt = json.loads(
                _node_contract(
                    {
                        "command": "receipt",
                        "observation": observation,
                        "proposal": proposal,
                        "providerStatus": provider_status,
                        "providerMeta": {
                            "mode": "live",
                            "model": model,
                            "promptVersion": "ai-proposal-v1",
                        },
                    }
                )
            )
            if receipt["outcome"] == "accepted":
                accepted_count += 1
            print(json.dumps(receipt, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=("fixture", "openai"), default="fixture")
    parser.add_argument("--seed", default=DEFAULT_SEED)
    parser.add_argument("--model", default="gpt-5-mini")
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()
    if args.timeout < 1 or args.timeout > 120:
        parser.error("--timeout must be between 1 and 120")
    return _fixture(args.seed) if args.provider == "fixture" else _live(args.seed, args.model, args.timeout)


if __name__ == "__main__":
    raise SystemExit(main())
