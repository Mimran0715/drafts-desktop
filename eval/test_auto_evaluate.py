import json
import unittest

from unittest.mock import patch

from auto_evaluate import aggregate, evaluate_case, parse_blind_markdown, validate_judgment


class AutoEvaluateTests(unittest.TestCase):
    def test_parse_blind_markdown(self):
        text = """# Blind Evaluation
## Rubric
Ignore this.
## case_one
**Prompt:** Continue this scene.
### Response A

First response.\nWith two paragraphs.
### Response B

Second response.
**Your scores:** A - phys:__ | B - phys:__
---
"""
        self.assertEqual(
            parse_blind_markdown(text)["case_one"],
            {
                "prompt": "Continue this scene.",
                "A": "First response.\nWith two paragraphs.",
                "B": "Second response.",
            },
        )

    def test_validate_judgment_rejects_out_of_range_score(self):
        raw = json.dumps(
            {
                "left": {
                    "physical_coherence": 6,
                    "prose_control": 3,
                    "sensory_concreteness": 3,
                    "constraint_adherence": 3,
                },
                "right": {
                    "physical_coherence": 3,
                    "prose_control": 3,
                    "sensory_concreteness": 3,
                    "constraint_adherence": 3,
                },
                "preference": "LEFT",
            }
        )
        with self.assertRaises(ValueError):
            validate_judgment(raw)

    def test_aggregate_unblinds_swapped_trial(self):
        cases = {"p1": {"prompt": "prompt", "A": "one", "B": "two"}}
        key = {"p1": {"response_a_is": "finetuned", "response_b_is": "base"}}
        scores_a = {name: 5 for name in ("physical_coherence", "prose_control", "sensory_concreteness", "constraint_adherence")}
        scores_b = {name: 2 for name in scores_a}
        raw = {
            "p1": [
                {
                    "scores": {"A": scores_a, "B": scores_b},
                    "preference": "A",
                    "reason": "A is stronger.",
                }
            ]
        }
        result = aggregate(cases, key, raw)
        self.assertEqual(result["models"]["finetuned"]["overall_mean"], 5)
        self.assertEqual(result["preference_counts"], {"finetuned": 1})

    @patch("auto_evaluate.time.sleep")
    @patch("auto_evaluate.ollama_chat", side_effect=RuntimeError("model stopped"))
    def test_failed_judge_trials_are_recorded_instead_of_raised(self, _chat, _sleep):
        case = {"prompt": "prompt", "A": "one", "B": "two"}
        judgments = evaluate_case(case, "qwen3.5:4b", "http://localhost:11434", 2, 1, 2)
        self.assertEqual(len(judgments), 2)
        self.assertTrue(all(item["status"] == "failed" for item in judgments))

        key = {"p1": {"response_a_is": "finetuned", "response_b_is": "base"}}
        result = aggregate({"p1": case}, key, {"p1": judgments})
        self.assertEqual(result["models"], {})
        self.assertEqual(result["coverage"]["completion_rate"], 0)
        self.assertEqual(result["cases"]["p1"]["valid_trials"], 0)


if __name__ == "__main__":
    unittest.main()
