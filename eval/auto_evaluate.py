"""Automatically judge and unblind a finetune comparison.

Uses an Ollama model as a blinded pairwise judge, alternates response order to
reduce position bias, then combines the judgments with eval_key.json.

Example:
    python eval/auto_evaluate.py --judge-model qwen2.5:14b --trials 2
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import time
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


CRITERIA = (
    ("physical_coherence", "Physical/spatial coherence and plausible movement"),
    ("prose_control", "Concrete prose without cliches, purple prose, or generic filler"),
    ("sensory_concreteness", "Specific, grounded sensory and physical detail"),
    ("constraint_adherence", "Adherence to every explicit prompt constraint"),
)

JUDGE_SYSTEM_PROMPT = """You are a strict creative-writing evaluator.
Judge only the supplied text. Do not guess which model wrote it. Favor prose
that is insertion-ready, physically coherent, specific, controlled, and fully
responsive to the prompt. Do not reward length by itself. Penalize commentary,
labels, restatement of the task, and explicit explanation where the prompt asks
the writing to demonstrate a quality implicitly. Return JSON only."""


def parse_blind_markdown(text: str) -> dict[str, dict[str, str]]:
    """Extract prompt and response pairs from finetune_compare.py output."""
    sections = re.split(r"(?m)^## (?!Rubric\s*$)([^\n]+)\s*$", text)
    cases: dict[str, dict[str, str]] = {}
    for index in range(1, len(sections), 2):
        case_id = sections[index].strip()
        body = sections[index + 1]
        match = re.search(
            r"\*\*Prompt:\*\*\s*(.*?)\n+### Response A\s*\n+(.*?)\n+### Response B\s*\n+(.*?)\n+\*\*Your scores:\*\*",
            body,
            flags=re.DOTALL,
        )
        if not match:
            raise ValueError(f"Could not parse prompt/responses for {case_id!r}")
        cases[case_id] = {
            "prompt": match.group(1).strip(),
            "A": match.group(2).strip(),
            "B": match.group(3).strip(),
        }
    if not cases:
        raise ValueError("No evaluation cases found in blind Markdown")
    return cases


def judge_prompt(prompt: str, left: str, right: str) -> str:
    criterion_lines = "\n".join(f"- {key}: {description}" for key, description in CRITERIA)
    return f"""PROMPT
{prompt}

RESPONSE LEFT
{left}

RESPONSE RIGHT
{right}

Score each response from 1 (poor) to 5 (excellent) on:
{criterion_lines}

Choose an overall preference: LEFT, RIGHT, or TIE. A tie means genuinely equal,
not merely close. Give a concise evidence-based reason. Return exactly one JSON
object with this shape:
{{
  "left": {{"physical_coherence": 1, "prose_control": 1, "sensory_concreteness": 1, "constraint_adherence": 1}},
  "right": {{"physical_coherence": 1, "prose_control": 1, "sensory_concreteness": 1, "constraint_adherence": 1}},
  "preference": "LEFT",
  "reason": "brief explanation"
}}"""


def ollama_chat(url: str, model: str, prompt: str, timeout: int) -> str:
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0},
        }
    ).encode("utf-8")
    request = Request(
        f"{url.rstrip('/')}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc
    try:
        return result["message"]["content"]
    except (KeyError, TypeError) as exc:
        raise RuntimeError(f"Unexpected Ollama response: {result!r}") from exc


def validate_judgment(raw: str) -> dict[str, Any]:
    try:
        judgment = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Judge returned invalid JSON: {exc}") from exc
    expected = {key for key, _ in CRITERIA}
    for side in ("left", "right"):
        scores = judgment.get(side)
        if not isinstance(scores, dict) or set(scores) != expected:
            raise ValueError(f"Judge {side!r} scores must contain exactly {sorted(expected)}")
        for criterion, score in scores.items():
            if isinstance(score, bool) or not isinstance(score, (int, float)) or not 1 <= score <= 5:
                raise ValueError(f"Invalid {side}.{criterion} score: {score!r}")
    preference = str(judgment.get("preference", "")).upper()
    if preference not in {"LEFT", "RIGHT", "TIE"}:
        raise ValueError(f"Invalid preference: {preference!r}")
    judgment["preference"] = preference
    judgment["reason"] = str(judgment.get("reason", "")).strip()
    return judgment


def evaluate_case(
    case: dict[str, str], model: str, url: str, trials: int, timeout: int, retries: int
) -> list[dict[str, Any]]:
    judgments = []
    for trial in range(trials):
        order = ("A", "B") if trial % 2 == 0 else ("B", "A")
        prompt = judge_prompt(case["prompt"], case[order[0]], case[order[1]])
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                parsed = validate_judgment(ollama_chat(url, model, prompt, timeout))
                break
            except (RuntimeError, ValueError) as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(1)
        else:
            error = f"Judge failed after {retries + 1} attempts: {last_error}"
            print(f"  Warning: trial {trial + 1} skipped: {error}")
            judgments.append(
                {
                    "trial": trial + 1,
                    "display_order": list(order),
                    "status": "failed",
                    "error": error,
                }
            )
            continue

        preference = parsed["preference"]
        judgments.append(
            {
                "trial": trial + 1,
                "display_order": list(order),
                "status": "valid",
                "scores": {order[0]: parsed["left"], order[1]: parsed["right"]},
                "preference": order[0] if preference == "LEFT" else order[1] if preference == "RIGHT" else "TIE",
                "reason": parsed["reason"],
            }
        )
    return judgments


def aggregate(cases: dict[str, dict[str, str]], key: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    model_scores: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    preference_counts: dict[str, int] = defaultdict(int)
    case_results = {}
    attempted_judgments = 0
    valid_judgments = 0

    for case_id in cases:
        if case_id not in key:
            raise ValueError(f"{case_id!r} is missing from eval_key.json")
        label_to_model = {
            "A": key[case_id]["response_a_is"],
            "B": key[case_id]["response_b_is"],
        }
        all_trials = raw[case_id]
        attempted_judgments += len(all_trials)
        trials = [trial for trial in all_trials if trial.get("status", "valid") == "valid"]
        failures = [trial for trial in all_trials if trial.get("status") == "failed"]
        valid_judgments += len(trials)
        trial_preferences = []
        label_scores: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for trial in trials:
            for label in ("A", "B"):
                model = label_to_model[label]
                for criterion, score in trial["scores"][label].items():
                    model_scores[model][criterion].append(score)
                    label_scores[label][criterion].append(score)
            preferred = trial["preference"]
            winner = "tie" if preferred == "TIE" else label_to_model[preferred]
            preference_counts[winner] += 1
            trial_preferences.append(winner)

        case_results[case_id] = {
            "prompt": cases[case_id]["prompt"],
            "response_a_is": label_to_model["A"],
            "response_b_is": label_to_model["B"],
            "mean_scores": {
                label_to_model[label]: {
                    criterion: round(statistics.mean(values), 2)
                    for criterion, values in criteria.items()
                }
                for label, criteria in label_scores.items()
            },
            "trial_preferences": trial_preferences,
            "reasons": [trial["reason"] for trial in trials],
            "valid_trials": len(trials),
            "attempted_trials": len(all_trials),
            "failures": [trial["error"] for trial in failures],
        }

    models = {
        model: {
            "mean_scores": {
                criterion: round(statistics.mean(values), 2)
                for criterion, values in criteria.items()
            },
            "overall_mean": round(statistics.mean(v for values in criteria.values() for v in values), 2),
        }
        for model, criteria in model_scores.items()
    }
    return {
        "models": models,
        "preference_counts": dict(preference_counts),
        "coverage": {
            "valid_judgments": valid_judgments,
            "attempted_judgments": attempted_judgments,
            "completion_rate": round(valid_judgments / attempted_judgments, 3) if attempted_judgments else 0,
        },
        "cases": case_results,
    }


def markdown_report(result: dict[str, Any], judge_model: str, trials: int) -> str:
    criteria = [key for key, _ in CRITERIA]
    lines = [
        "# Automated Evaluation Results",
        "",
        f"Judge model: `{judge_model}` · Trials per prompt: {trials}",
        "",
        f"Coverage: {result['coverage']['valid_judgments']}/{result['coverage']['attempted_judgments']} valid judgments ({result['coverage']['completion_rate']:.1%})",
        "",
        "## Overall scores",
        "",
        "| Model | " + " | ".join(c.replace("_", " ").title() for c in criteria) + " | Overall |",
        "|---|" + "---:|" * (len(criteria) + 1),
    ]
    for model, values in sorted(result["models"].items()):
        scores = [f'{values["mean_scores"][criterion]:.2f}' for criterion in criteria]
        lines.append(f'| {model} | ' + " | ".join(scores) + f' | {values["overall_mean"]:.2f} |')
    preferences = result["preference_counts"]
    lines.extend(["", "## Pairwise preferences", ""])
    for name, count in sorted(preferences.items()):
        lines.append(f"- {name}: {count}")
    lines.extend(["", "## Per-prompt results", ""])
    for case_id, case in result["cases"].items():
        lines.append(f"### {case_id}")
        lines.append("")
        lines.append(f"- Coverage: {case['valid_trials']}/{case['attempted_trials']} valid trials")
        if case["mean_scores"]:
            for model, scores in case["mean_scores"].items():
                score_text = ", ".join(f"{name.replace('_', ' ')} {score:.2f}" for name, score in scores.items())
                lines.append(f"- {model}: {score_text}")
            lines.append(f"- Preferences: {', '.join(case['trial_preferences'])}")
            lines.append(f"- Judge reasons: {' / '.join(case['reasons'])}")
        else:
            lines.append("- Result: unavailable because every judge attempt failed")
        for failure in case["failures"]:
            lines.append(f"- Warning: {failure}")
        lines.append("")
    lines.extend(
        [
            "## Interpretation note",
            "",
            "LLM judging is a repeatable signal, not ground truth. Prefer a judge model that is not one of the candidates, and review disagreements or close results manually.",
            "",
        ]
    )
    return "\n".join(lines)


def cli() -> argparse.Namespace:
    eval_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blind", type=Path, default=eval_dir / "eval_blind.md")
    parser.add_argument("--key", type=Path, default=eval_dir / "eval_key.json")
    parser.add_argument("--output-json", type=Path, default=eval_dir / "eval_results.json")
    parser.add_argument("--output-md", type=Path, default=eval_dir / "eval_results.md")
    parser.add_argument("--judge-model", default="llama3.1")
    parser.add_argument("--ollama-url", default="http://localhost:11434")
    parser.add_argument("--trials", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--retries", type=int, default=2)
    return parser.parse_args()


def main() -> None:
    args = cli()
    if args.trials < 1:
        raise SystemExit("--trials must be at least 1")
    if args.trials > 1 and args.trials % 2:
        raise SystemExit("Use an even --trials value so each response appears first equally often")
    cases = parse_blind_markdown(args.blind.read_text(encoding="utf-8"))
    key = json.loads(args.key.read_text(encoding="utf-8"))
    if set(cases) != set(key):
        raise SystemExit(f"Blind/key case IDs differ: blind={sorted(cases)}, key={sorted(key)}")

    raw = {}
    for index, (case_id, case) in enumerate(cases.items(), start=1):
        print(f"[{index}/{len(cases)}] Judging {case_id}...")
        raw[case_id] = evaluate_case(
            case, args.judge_model, args.ollama_url, args.trials, args.timeout, args.retries
        )

    result = aggregate(cases, key, raw)
    result["metadata"] = {"judge_model": args.judge_model, "trials_per_prompt": args.trials}
    result["raw_judgments"] = raw
    args.output_json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    args.output_md.write_text(markdown_report(result, args.judge_model, args.trials), encoding="utf-8")
    print(f"Wrote {args.output_md} and {args.output_json}")


if __name__ == "__main__":
    main()
