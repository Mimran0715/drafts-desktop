"""
finetune_compare.py

Compares your fine-tuned model ("llama-writer") against base Llama 3.1
on a held-out set of creative-writing continuation prompts, via a locally
running Ollama server.

Produces:
  - eval_blind.md   -> blinded, randomized side-by-side responses for you to
                       read and score manually (does NOT reveal which is which)
  - eval_key.json   -> the hidden answer key (which letter = which model),
                       plus heuristic scores. Don't open this until you've
                       scored eval_blind.md, or you'll bias yourself.

Usage:
  1. Make sure Ollama is running locally (`ollama serve` if not already).
  2. Edit MODEL_FINETUNED / MODEL_BASE below if your model names differ.
  3. Edit PROMPTS below - swap in your own held-out prompts, ideally ones
     structurally similar to (but not copied from) your training data.
  4. Run: python eval/finetune_compare.py
  5. Run: python eval/auto_evaluate.py --judge-model <judge-model> --trials 2

The automated evaluator scores anonymous responses, alternates their display
order over repeated trials, unblinds the result, and writes eval_results.md and
eval_results.json. A separate judge model is preferable to either candidate.
"""

import json
import random
import re
import statistics
import requests

EVAL_DIR = __import__("pathlib").Path(__file__).resolve().parent

OLLAMA_URL = "http://localhost:11434"
MODEL_FINETUNED = "llama-writer"   # your fine-tuned model name in Ollama
# MODEL_BASE = "llama3.1"                 # base model name in Ollama
MODEL_BASE = "llama3"

SYSTEM_PROMPT = """You are an AI writing companion.

Help authors improve stories by producing coherent,
grounded, physically plausible writing while preserving
the author's intent and style.""".strip()

# Held-out prompts: similar spirit/constraints to your training data,
# but NOT copied from it. Mix scene types so you can see whether the
# fine-tune generalizes past "action scenes" specifically.
PROMPTS = [
    {
        "id": "p1_physical_confrontation",
        "text": (
            "Write a scene where two characters argue in a cramped elevator "
            "that has stopped between floors. Track the physical position of "
            "both characters and how the confined space constrains their "
            "movement. Avoid metaphors; use precise spatial description."
        ),
    },
    {
        "id": "p2_subtext_dialogue",
        "text": (
            "Write a dinner-table conversation between a parent and adult "
            "child where neither says what they actually mean. Focus on "
            "subtext - what each line is really doing beneath the surface "
            "meaning. Avoid explicit narration of emotions; let word choice "
            "and evasion carry the subtext."
        ),
    },
    {
        "id": "p3_chase_uneven_terrain",
        "text": (
            "Write a foot chase across a rooftop under construction, with "
            "exposed beams and unfinished flooring. Track exact footing, "
            "balance, and near-falls for both the pursuer and the pursued. "
            "Avoid cinematic flourish; focus on kinesthetic detail."
        ),
    },
    {
        "id": "p4_quiet_introspection",
        "text": (
            "Write a short quiet scene of a character packing a childhood "
            "bedroom into boxes after a parent's death. Ground the scene in "
            "specific physical objects and actions rather than internal "
            "monologue about grief."
        ),
    },
    {
        "id": "p5_negotiation_standoff",
        "text": (
            "Write a tense standoff between a shop owner and a debt collector "
            "across a counter. Track hand positions, what each is holding or "
            "reaching for, and the physical objects between them. Keep "
            "dialogue clipped and avoid melodrama."
        ),
    },
]


def ollama_generate(model, prompt_text):
    resp = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt_text},
            ],
            "stream": False,
        },
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


# --- Cheap heuristic signals (not a substitute for reading, just a flag) ---

CLICHE_PHRASES = [
    "heart pounding", "heart raced", "eyes widened", "a wave of",
    "washed over", "couldn't help but", "sent shivers", "time seemed to slow",
    "breath caught", "pulse quickened", "world seemed to", "in that moment",
    "little did", "eyes met", "electricity", "butterflies in", "chills ran",
]

SPATIAL_TERMS = [
    "left", "right", "above", "below", "behind", "forward", "backward",
    "degrees", "centimeters", "meters", "feet", "inches", "weight",
    "balance", "shoulder", "knee", "elbow", "wrist", "grip", "footing",
]


def heuristics(text):
    words = re.findall(r"[A-Za-z']+", text)
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    sentence_lengths = [len(re.findall(r"[A-Za-z']+", s)) for s in sentences if s.strip()]

    lower = text.lower()
    cliche_hits = sum(lower.count(p) for p in CLICHE_PHRASES)
    spatial_hits = sum(len(re.findall(rf"\b{re.escape(t)}\b", lower)) for t in SPATIAL_TERMS)

    return {
        "word_count": len(words),
        "avg_sentence_length": round(statistics.mean(sentence_lengths), 1) if sentence_lengths else 0,
        "sentence_length_stdev": round(statistics.pstdev(sentence_lengths), 1) if len(sentence_lengths) > 1 else 0,
        "cliche_phrase_hits": cliche_hits,
        "cliche_hits_per_100_words": round(cliche_hits / max(len(words), 1) * 100, 2),
        "spatial_term_hits": spatial_hits,
        "spatial_hits_per_100_words": round(spatial_hits / max(len(words), 1) * 100, 2),
    }


def main():
    blind_md = ["# Blind Evaluation\n"]
    blind_md.append(
        "## Rubric\n\n"
        "For each prompt, score **Response A** and **Response B** 1-5 on:\n\n"
        "1. **Physical/spatial coherence** - could this actually happen in space, "
        "with limbs/objects where the text says they are?\n"
        "2. **Absence of purple prose / cliches** - concrete vs. vague-evocative language\n"
        "3. **Sensory concreteness** - specific, grounded detail vs. generic description\n"
        "4. **Constraint adherence** - did it actually follow the prompt's stated constraints?\n\n"
        "Then note an overall preference (A / B / tie) per prompt. "
        "Don't open eval_key.json until you're done scoring.\n\n---\n"
    )

    key = {}
    print("Base model: ", MODEL_BASE)
    print("Finetuned: ", MODEL_FINETUNED)

    for item in PROMPTS:
        pid, prompt_text = item["id"], item["text"]
        print(f"Generating responses for {pid}...")

        ft_response = ollama_generate(MODEL_FINETUNED, prompt_text)
        base_response = ollama_generate(MODEL_BASE, prompt_text)

        # Randomize which is A vs B per prompt
        pair = [("finetuned", ft_response), ("base", base_response)]
        random.shuffle(pair)
        (label_a, text_a), (label_b, text_b) = pair

        key[pid] = {
            "prompt": prompt_text,
            "response_a_is": label_a,
            "response_b_is": label_b,
            "heuristics_a": heuristics(text_a),
            "heuristics_b": heuristics(text_b),
        }

        blind_md.append(f"## {pid}\n")
        blind_md.append(f"**Prompt:** {prompt_text}\n")
        blind_md.append(f"### Response A\n\n{text_a}\n")
        blind_md.append(f"### Response B\n\n{text_b}\n")
        blind_md.append(
            "**Your scores:** A - phys:__ cliche:__ sensory:__ constraint:__ | "
            "B - phys:__ cliche:__ sensory:__ constraint:__ | preference: __\n"
        )
        blind_md.append("\n---\n")

    with open(EVAL_DIR / "eval_blind.md", "w") as f:
        f.write("\n".join(blind_md))

    with open(EVAL_DIR / "eval_key.json", "w") as f:
        json.dump(key, f, indent=2)

    print("\nDone. Run eval/auto_evaluate.py to score and unblind automatically.")


if __name__ == "__main__":
    main()
