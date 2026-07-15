# Evaluation Framework

Use this framework consistently for every simulated customer. It creates comparable reasoning; it does not predict real conversion rates.

## Evidence types

Classify important statements as one of:

- **Observed:** directly visible in the page, copy, interaction, or supplied artifact.
- **Inferred:** a reasonable interpretation based on observed evidence.
- **Unknown:** cannot be established without analytics, interviews, pricing context, or product access.

Never convert an unknown into a fact.

## Journey stages

Evaluate each persona at six stages:

1. **First five seconds:** Can the persona identify what this is and whether it may be relevant?
2. **Comprehension:** Can the persona explain the product, outcome, and basic mechanism?
3. **Relevance:** Does the page connect the product to this persona's job and urgency?
4. **Trust:** Is there credible proof that the product and company can deliver safely?
5. **Risk and effort:** Are price, setup, switching, privacy, and time costs understandable?
6. **Action:** Is the next step visible, specific, and proportionate to the commitment requested?

## Scoring dimensions

Score each dimension from 0 to 5:

- **Clarity (25%)** — product, audience, outcome, and mechanism are understandable.
- **Relevance (20%)** — the value maps to the persona's job and urgency.
- **Trust (20%)** — proof, specificity, safety, and credibility reduce doubt.
- **Friction (15%)** — the journey minimizes unnecessary effort and uncertainty.
- **Value confidence (10%)** — the expected outcome feels worth the cost and risk.
- **CTA fit (10%)** — the action is visible, clear, and appropriate for readiness.

Calculate the simulated decision score:

```text
score = clarity/5*25
      + relevance/5*20
      + trust/5*20
      + friction/5*15
      + value_confidence/5*10
      + cta_fit/5*10
```

Interpretation:

- **80–100:** likely to continue in this simulated journey
- **60–79:** interested but blocked by a material objection
- **40–59:** understands some value but lacks relevance or confidence
- **20–39:** weak fit or major communication failure
- **0–19:** would probably leave immediately

Always display “Simulated decision score — not a predicted conversion rate” beside the first score table.

## Persona construction

Choose roles that expose different decisions, not different personalities. Define:

- role or situation
- job to be done
- awareness level
- urgency
- budget or authority constraint
- decision criteria
- strongest likely objection

Prefer roles supported by page evidence. If the audience is unclear, include one plausible ideal customer and make the uncertainty itself part of the verdict.

## Prioritizing fixes

Rate each proposed fix:

- **Impact:** high, medium, or low based on how many personas and journey stages it affects.
- **Effort:** small, medium, or large based on likely implementation scope.
- **Confidence:** high, medium, or low based on the strength of observed evidence.

Rank high-impact, small-effort, high-confidence fixes first. For copy problems, provide replacement wording. For interaction problems, identify the exact component and desired behavior.

## Report template

```markdown
# Startup User Simulation

**Tested:** [URL or artifact]
**Goal:** [primary conversion]
**Mode:** [quick/deep/mobile/before-after/copy]

## Verdict
[One sentence]

## Biggest conversion leak
[Issue, affected personas, and observed evidence]

## Persona scorecard
Simulated decision score — not a predicted conversion rate.

| Persona | Job | First impression | Trust break | Biggest objection | Score | Decision |
|---|---|---|---|---|---:|---|

## Persona journeys
### 1. [Persona]
- Context:
- What they understand:
- Where they hesitate:
- Evidence:
- Decision:

## Top five fixes
| Rank | Change | Personas helped | Impact | Effort | Confidence |
|---|---|---|---|---|---|

## Fastest experiment
[Hypothesis, page change, event to measure, success signal]

## Limits
[Unknowns and real research needed]
```
