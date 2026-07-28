# Automated Evaluation Results

Judge model: `qwen3.5:4b` · Trials per prompt: 2

Coverage: 8/10 valid judgments (80.0%)

## Overall scores

| Model | Physical Coherence | Prose Control | Sensory Concreteness | Constraint Adherence | Overall |
|---|---:|---:|---:|---:|---:|
| base | 2.88 | 2.38 | 2.50 | 2.50 | 2.56 |
| finetuned | 4.69 | 3.19 | 4.25 | 3.88 | 4.00 |

## Pairwise preferences

- base: 2
- finetuned: 6

## Per-prompt results

### p1_physical_confrontation

- Coverage: 2/2 valid trials
- base: physical coherence 2.50, prose control 2.50, sensory concreteness 2.00, constraint adherence 1.50
- finetuned: physical coherence 5.00, prose control 4.50, sensory concreteness 5.00, constraint adherence 5.00
- Preferences: finetuned, finetuned
- Judge reasons: RIGHT adheres strictly to the constraint of avoiding metaphors and using precise spatial description (e.g., specific angles, distances), whereas LEFT relies on clichéd abstract language ('air grew thick', 'fragile thread'). RIGHT demonstrates superior physical coherence through measurable movement details that respect elevator constraints. / Left adheres strictly to spatial constraints with precise measurements (e.g., 'eight centimeters', 'twelve degrees') and avoids clichés throughout the scene. Right fails physical logic by describing pacing in a stopped elevator, uses pervasive metaphors ('eyes snapped', 'air grew thick'), and lacks specific sensory detail.

### p2_subtext_dialogue

- Coverage: 2/2 valid trials
- finetuned: physical coherence 4.25, prose control 3.25, sensory concreteness 4.00, constraint adherence 2.00
- base: physical coherence 2.50, prose control 1.50, sensory concreteness 1.50, constraint adherence 1.00
- Preferences: finetuned, finetuned
- Judge reasons: Left demonstrates superior physical coherence and sensory concreteness (e.g., fork taps against plate) compared to Right's generic script format. Both responses failed the core constraint by explicitly annotating subtext rather than letting it remain implicit, but Left maintains better narrative immersion. / LEFT uses a script format with generic stage directions and lacks sensory detail (e.g., 'cozy dining room'), while RIGHT employs specific physical imagery ('silver against porcelain', 'liquid calm') that enhances immersion. Both responses violate the constraint to avoid explicit subtext narration via meta-commentary blocks, but RIGHT's narrative prose is significantly more concrete and physically coherent.

### p3_chase_uneven_terrain

- Coverage: 2/2 valid trials
- finetuned: physical coherence 4.50, prose control 2.00, sensory concreteness 3.50, constraint adherence 4.50
- base: physical coherence 3.50, prose control 2.50, sensory concreteness 3.00, constraint adherence 4.00
- Preferences: finetuned, base
- Judge reasons: Left adheres strictly to the constraint of avoiding cinematic flourish by eliminating emotional adjectives and clichés (e.g., 'desperately sought', 'eating away'), focusing instead on precise kinesthetic mechanics. It tracks exact footing, balance, and near-falls with superior specificity compared to Right's generic action verbs. / Response LEFT provides insertion-ready narrative prose that fulfills the prompt's request to write a scene without meta-labels or structural headers. While Response RIGHT offers precise mechanical details and high physical coherence, it fails Prose Control by using formatting elements (e.g., **Scene:**, **Kinesthetic Notes**) that break immersion and prevent immediate use in a manuscript.

### p4_quiet_introspection

- Coverage: 1/2 valid trials
- base: physical coherence 2.00, prose control 3.00, sensory concreteness 4.00, constraint adherence 2.00
- finetuned: physical coherence 5.00, prose control 4.00, sensory concreteness 5.00, constraint adherence 5.00
- Preferences: finetuned
- Judge reasons: LEFT fails physical coherence by contradicting itself regarding box labels (Antiques vs Special Keepsakes) and violates the constraint to avoid internal monologue by describing memories flooding her mind. RIGHT demonstrates superior grounding in specific actions (hammering nails, sandpaper dust) without emotional exposition or meta-commentary.
- Warning: Judge failed after 3 attempts: Judge returned invalid JSON: Expecting value: line 1 column 1 (char 0)

### p5_negotiation_standoff

- Coverage: 1/2 valid trials
- base: physical coherence 4.00, prose control 3.00, sensory concreteness 3.00, constraint adherence 5.00
- finetuned: physical coherence 5.00, prose control 2.00, sensory concreteness 4.00, constraint adherence 3.00
- Preferences: base
- Judge reasons: Response RIGHT includes meta-labels (SCENE SKELETON) and analytical commentary at the end which violates the instruction to avoid explicit explanation where quality should be demonstrated implicitly. It is not insertion-ready prose but rather an outline document with analysis, whereas Response LEFT delivers functional narrative text that adheres strictly to the prompt's constraints on standoff dynamics.
- Warning: Judge failed after 3 attempts: Judge returned invalid JSON: Expecting value: line 1 column 1 (char 0)

## Interpretation note

LLM judging is a repeatable signal, not ground truth. Prefer a judge model that is not one of the candidates, and review disagreements or close results manually.
