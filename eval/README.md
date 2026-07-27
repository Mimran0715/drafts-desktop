# Model comparison evaluation

Generate anonymous candidate responses:

```sh
python3 eval/finetune_compare.py
```

Score and unblind them automatically:

```sh
python3 eval/auto_evaluate.py --judge-model qwen2.5:14b --trials 2
```

Or use the npm shortcut (arguments after `--` are forwarded to Python):

```sh
npm run eval:judge -- --judge-model qwen2.5:14b --trials 2
```

The evaluator reads `eval_blind.md` and `eval_key.json`, then writes:

- `eval_results.md`: readable overall and per-prompt results
- `eval_results.json`: scores, metadata, reasons, and raw judgments for later analysis

Use a capable judge model other than `llama3.1` or `llama-writer` when one is
available. Judging a model with itself can introduce self-preference bias. Two
trials show each response first once, reducing response-order bias; higher even
trial counts are supported.

The script retries malformed judge output, validates every score, uses a zero
temperature, and fails rather than silently accepting incomplete results.

Run the offline tests with:

```sh
python3 -m unittest discover -s eval -p 'test_*.py' -v
```
