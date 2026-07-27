# Automated Evaluation Results

Judge model: `llama3.1` · Trials per prompt: 2

## Overall scores

| Model | Physical Coherence | Prose Control | Sensory Concreteness | Constraint Adherence | Overall |
|---|---:|---:|---:|---:|---:|
| base | 3.75 | 3.60 | 3.80 | 4.50 | 3.91 |
| finetuned | 4.70 | 4.60 | 4.80 | 4.80 | 4.72 |

## Pairwise preferences

- base: 2
- finetuned: 8

## Per-prompt results

### p1_physical_confrontation

- finetuned: physical coherence 5.00, prose control 5.00, sensory concreteness 5.00, constraint adherence 5.00
- base: physical coherence 4.00, prose control 4.00, sensory concreteness 4.50, constraint adherence 4.50
- Preferences: finetuned, finetuned
- Judge reasons: The LEFT response demonstrates a more nuanced and detailed physical description of the characters' movements within the cramped elevator, effectively conveying the tension and constraint. The RIGHT response relies on more generic descriptions and lacks the same level of sensory detail. / The RIGHT response demonstrates a more nuanced and detailed understanding of the physical constraints of the elevator space. The description of Alex's movements and Maya's positioning is more precise and immersive, creating a stronger sense of tension and confinement.

### p2_subtext_dialogue

- base: physical coherence 3.50, prose control 2.50, sensory concreteness 3.00, constraint adherence 4.50
- finetuned: physical coherence 5.00, prose control 4.50, sensory concreteness 5.00, constraint adherence 5.00
- Preferences: finetuned, finetuned
- Judge reasons: The RIGHT response demonstrates a more nuanced understanding of subtext and uses specific, grounded sensory details to convey the underlying emotions. The physical setting is vividly described, and the character descriptions are concise yet evocative. The conversation itself is a masterclass in subtle implication, with each line building on the previous one to create a rich tapestry of unspoken meaning. / The LEFT response demonstrates a more nuanced and subtle exploration of subtext, with each line building on the previous one to create a rich tapestry of unspoken meanings. The use of specific sensory details (e.g., 'the scent is clean laundry, slightly burnt dinner') and physical descriptions (e.g., 'posture slightly guarded, hands busy folding the napkin into precise squares') adds depth and concreteness to the narrative. In contrast, the RIGHT response relies on more generic language and clichés ('shadows on a moonlit night', 'unspoken accusations and unexpressed fears swirled beneath the surface'), which detract from its overall impact.

### p3_chase_uneven_terrain

- base: physical coherence 4.25, prose control 3.50, sensory concreteness 4.00, constraint adherence 4.50
- finetuned: physical coherence 4.50, prose control 4.00, sensory concreteness 4.50, constraint adherence 4.50
- Preferences: base, finetuned
- Judge reasons: The LEFT response demonstrates superior physical coherence, with a more nuanced and detailed portrayal of the characters' movements and balance. The sensory concreteness is also more vivid and immersive, effectively conveying the sights, sounds, and textures of the rooftop environment. / The LEFT response demonstrates superior physical coherence, with a more nuanced and detailed depiction of the rooftop environment and the characters' movements. The prose is also more controlled, avoiding clichés and generic filler. Sensory concreteness is equally impressive in both responses, but the LEFT response excels in this area as well.

### p4_quiet_introspection

- finetuned: physical coherence 5.00, prose control 5.00, sensory concreteness 5.00, constraint adherence 5.00
- base: physical coherence 3.50, prose control 3.50, sensory concreteness 3.00, constraint adherence 4.50
- Preferences: finetuned, finetuned
- Judge reasons: The left response demonstrates a more nuanced and detailed physical coherence, with specific actions and movements that create a sense of realism. The prose is also more controlled, avoiding clichés and generic filler. Additionally, the sensory details are more vivid and grounded in the scene. / The RIGHT response demonstrates a more nuanced and precise handling of physical space, with a clear distinction between the objects being packed and those left behind. The writing is also more controlled in its use of language, avoiding clichés and generic filler. Additionally, the sensory details are more vivid and specific, effectively grounding the reader in the scene.

### p5_negotiation_standoff

- base: physical coherence 3.50, prose control 4.50, sensory concreteness 4.50, constraint adherence 4.50
- finetuned: physical coherence 4.00, prose control 4.50, sensory concreteness 4.50, constraint adherence 4.50
- Preferences: base, finetuned
- Judge reasons: The LEFT response demonstrates superior physical coherence, with more precise and detailed descriptions of hand positions and movements. The prose is also more controlled, avoiding clichés and generic filler. Sensory concreteness is equally impressive in both responses, but the LEFT response excels in its ability to convey tension and atmosphere through specific details. / The LEFT response demonstrates a more nuanced and detailed physical environment, with specific attention to hand positions, objects between the characters, and sensory details. The prose is also more controlled, avoiding clichés and generic filler.

## Interpretation note

LLM judging is a repeatable signal, not ground truth. Prefer a judge model that is not one of the candidates, and review disagreements or close results manually.
