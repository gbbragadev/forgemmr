# Report Artifact

Create a standalone HTML file for every completed simulation. Use the bundled generator rather than hand-building report markup.

## Workflow

1. Complete the analysis using `evaluation-framework.md`.
2. Serialize the final content to UTF-8 JSON matching the schema below.
3. Run:

```bash
python3 scripts/generate_report.py analysis.json outputs/startup-user-simulation.html
```

4. Verify the output file and return a clickable absolute file link in Codex.

Do not launch an external system browser. Let the Codex app open or preview the local report from the link in the final response.

The generator uses only the Python standard library and embeds all styling in one portable HTML file.

## JSON schema

```json
{
  "title": "Startup User Simulation",
  "tested": "https://example.com",
  "goal": "Start a free trial",
  "mode": "quick",
  "generated_at": "2026-07-12",
  "verdict": "The strongest-fit founder continues, but skeptical buyers leave because the proof is too vague.",
  "biggest_leak": {
    "title": "The hero promises speed without showing the workflow",
    "detail": "Three personas understand the outcome but cannot judge how the product works.",
    "evidence": "The first concrete product explanation appears below the second CTA."
  },
  "personas": [
    {
      "name": "The shipping founder",
      "label": "Strongest fit",
      "job": "Validate a landing page before launch",
      "score": 74,
      "decision": "Continues, but hesitates",
      "first_impression": "The outcome is relevant and immediate.",
      "trust_break": "No example report is visible above the fold.",
      "objection": "Will the feedback be specific enough to act on?",
      "context": "Launching this week with limited research budget.",
      "understands": "The product simulates customer reactions to a landing page.",
      "hesitation": "The methodology and output quality are unclear.",
      "evidence": ["Hero headline", "Primary CTA", "Missing report preview"],
      "dimensions": {
        "clarity": 4,
        "relevance": 5,
        "trust": 2,
        "friction": 4,
        "value_confidence": 3,
        "cta_fit": 4
      }
    }
  ],
  "fixes": [
    {
      "rank": 1,
      "change": "Add an interactive report preview directly below the hero.",
      "personas": "4 of 5",
      "impact": "High",
      "effort": "Small",
      "confidence": "High"
    }
  ],
  "experiment": {
    "title": "Show the output before asking for signup",
    "hypothesis": "A report preview will reduce uncertainty and increase CTA clicks.",
    "change": "Place a real persona scorecard under the hero.",
    "measure": "Hero-to-CTA click-through rate",
    "success": "At least 20% relative improvement over the current page"
  },
  "limits": [
    "This is a structured simulation, not observed user behavior.",
    "Validate the strongest findings with analytics or five real-user interviews."
  ]
}
```

Include exactly five persona objects in normal mode. Keep scores between 0 and 100 and retain the required simulation disclaimer.
