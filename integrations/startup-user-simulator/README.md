# Codex Startup User Simulator Skill

A Codex skill that tests a startup, SaaS, app, or landing page through five evidence-based simulated customer personas and explains why each would convert, hesitate, or leave.

It inspects the actual page, builds plausible decision-makers from the product's positioning, traces their conversion journeys, and returns prioritized fixes a founder can implement.

## What It Does

- Tests live URLs, localhost apps, screenshots, prototypes, or pasted copy
- Simulates five distinct customer decision journeys
- Finds clarity, relevance, trust, friction, and CTA problems
- Separates observed evidence from inference and unknowns
- Produces a comparable persona scorecard
- Ranks five improvements by impact, effort, and confidence
- Creates a polished standalone HTML report with a clickable Codex file link
- Supports quick, deep, mobile, before/after, and copy modes
- Clearly labels simulation instead of presenting it as real user research

## Installation

```bash
npx --yes codex-startup-user-simulator-skill@latest
```

This installs the skill into:

```text
~/.codex/skills/startup-user-simulator
```

Restart Codex after installation so it can discover the skill.

## Usage

Test a landing page:

```text
Use $startup-user-simulator to test https://example.com with five simulated customer personas.
```

Deep desktop and mobile evaluation:

```text
Use $startup-user-simulator in deep mode to test https://example.com. The target customer is an indie founder and the main conversion goal is starting a free trial.
```

Compare a redesign:

```text
Use $startup-user-simulator in before-after mode to compare these two landing-page versions with the same five personas: [old URL] and [new URL].
```

Focus on copy:

```text
Use $startup-user-simulator in copy mode to explain why customers may not understand this landing page and rewrite the highest-impact sections: [URL].
```

## Output

The default report includes:

1. One-sentence verdict
2. Biggest conversion leak
3. Five-persona scorecard
4. Evidence-backed decision journeys
5. Five prioritized fixes
6. Fastest measurable experiment
7. Simulation limitations

Codex also creates a responsive HTML report in the workspace `outputs/` directory and returns a clickable local link. The report includes expandable persona journeys, score visualizations, prioritized fixes, a printable layout, and a one-click “Save PDF” action.

Scores are structured heuristics, not predicted conversion rates or analytics.

## Modes

- `quick`: primary-page verdict, scorecard, and top fixes
- `deep`: desktop, mobile, pricing, interactions, and CTA destinations
- `mobile`: small-screen conversion journey
- `before-after`: consistent comparison between two versions
- `copy`: positioning, objections, hero, and CTA language

## Manual Installation

```bash
git clone https://github.com/Kappaemme-git/codex-startup-user-simulator-skill.git
mkdir -p ~/.codex/skills
cp -R codex-startup-user-simulator-skill/startup-user-simulator ~/.codex/skills/startup-user-simulator
```

Restart Codex after installation.

## License

MIT
