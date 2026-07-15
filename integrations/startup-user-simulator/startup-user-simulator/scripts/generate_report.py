#!/usr/bin/env python3
"""Generate a polished standalone HTML report from simulation JSON."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any


DIMENSION_LABELS = {
    "clarity": "Clarity",
    "relevance": "Relevance",
    "trust": "Trust",
    "friction": "Low friction",
    "value_confidence": "Value confidence",
    "cta_fit": "CTA fit",
}


def esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def clamp_score(value: Any, maximum: int = 100) -> int:
    try:
        number = round(float(value))
    except (TypeError, ValueError):
        number = 0
    return max(0, min(maximum, number))


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def tone(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"high", "strong", "continues", "yes"}:
        return "positive"
    if normalized in {"low", "weak", "leaves", "no"}:
        return "negative"
    return "neutral"


def render_dimensions(dimensions: dict[str, Any]) -> str:
    rows = []
    for key, label in DIMENSION_LABELS.items():
        score = clamp_score(dimensions.get(key, 0), 5)
        width = score * 20
        rows.append(
            f"""
            <div class="metric-row">
              <span>{esc(label)}</span>
              <div class="metric-track" aria-label="{esc(label)}: {score} of 5">
                <i style="width:{width}%"></i>
              </div>
              <b>{score}/5</b>
            </div>"""
        )
    return "".join(rows)


def render_persona(persona: dict[str, Any], index: int) -> str:
    score = clamp_score(persona.get("score"))
    evidence = "".join(f"<li>{esc(item)}</li>" for item in as_list(persona.get("evidence")))
    dimensions = persona.get("dimensions") if isinstance(persona.get("dimensions"), dict) else {}
    return f"""
    <article class="persona-card reveal" id="persona-{index}">
      <header class="persona-head">
        <div>
          <span class="eyebrow">Persona {index:02d} · {esc(persona.get('label', 'Simulated customer'))}</span>
          <h3>{esc(persona.get('name', f'Persona {index}'))}</h3>
          <p>{esc(persona.get('job', ''))}</p>
        </div>
        <div class="score-ring" style="--score:{score}" role="img" aria-label="Simulated decision score {score} out of 100">
          <strong>{score}</strong><span>/100</span>
        </div>
      </header>
      <div class="decision"><span>Decision</span><strong>{esc(persona.get('decision', 'Unknown'))}</strong></div>
      <div class="persona-grid">
        <div><span>First impression</span><p>{esc(persona.get('first_impression', ''))}</p></div>
        <div><span>Trust break</span><p>{esc(persona.get('trust_break', ''))}</p></div>
        <div class="wide"><span>Biggest objection</span><p>{esc(persona.get('objection', ''))}</p></div>
      </div>
      <details>
        <summary>Open full decision journey</summary>
        <div class="journey-grid">
          <div><span>Context</span><p>{esc(persona.get('context', ''))}</p></div>
          <div><span>What they understand</span><p>{esc(persona.get('understands', ''))}</p></div>
          <div><span>Where they hesitate</span><p>{esc(persona.get('hesitation', ''))}</p></div>
          <div><span>Observed evidence</span><ul>{evidence or '<li>No evidence supplied</li>'}</ul></div>
        </div>
        <div class="metrics">{render_dimensions(dimensions)}</div>
      </details>
    </article>"""


def render_fix(fix: dict[str, Any], index: int) -> str:
    rank = clamp_score(fix.get("rank", index), 99) or index
    return f"""
    <article class="fix-row reveal">
      <div class="fix-rank">{rank:02d}</div>
      <div class="fix-copy">
        <h3>{esc(fix.get('change', ''))}</h3>
        <p>Helps {esc(fix.get('personas', 'the affected personas'))}</p>
      </div>
      <div class="badges">
        <span class="badge {tone(fix.get('impact'))}">Impact · {esc(fix.get('impact', 'Unknown'))}</span>
        <span class="badge">Effort · {esc(fix.get('effort', 'Unknown'))}</span>
        <span class="badge {tone(fix.get('confidence'))}">Confidence · {esc(fix.get('confidence', 'Unknown'))}</span>
      </div>
    </article>"""


def build_html(data: dict[str, Any]) -> str:
    personas = [item for item in as_list(data.get("personas")) if isinstance(item, dict)]
    fixes = [item for item in as_list(data.get("fixes")) if isinstance(item, dict)]
    scores = [clamp_score(persona.get("score")) for persona in personas]
    average = round(sum(scores) / len(scores)) if scores else 0
    strongest = max(personas, key=lambda item: clamp_score(item.get("score")), default={})
    weakest = min(personas, key=lambda item: clamp_score(item.get("score")), default={})
    leak = data.get("biggest_leak") if isinstance(data.get("biggest_leak"), dict) else {}
    experiment = data.get("experiment") if isinstance(data.get("experiment"), dict) else {}
    limits = "".join(f"<li>{esc(item)}</li>" for item in as_list(data.get("limits")))
    persona_html = "".join(render_persona(persona, index) for index, persona in enumerate(personas, 1))
    fixes_html = "".join(render_fix(fix, index) for index, fix in enumerate(fixes, 1))

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>{esc(data.get('title', 'Startup User Simulation'))}</title>
  <style>
    :root {{ --bg:#0b0d10; --panel:#14171c; --panel-2:#1b1f25; --ink:#f3f0e8; --muted:#a7adb7; --line:#303641; --acid:#d9ff63; --coral:#ff745d; --cyan:#62e6d2; --radius:18px; --shadow:0 22px 70px rgba(0,0,0,.34); }}
    * {{ box-sizing:border-box; }}
    html {{ scroll-behavior:smooth; }}
    body {{ margin:0; background:var(--bg); color:var(--ink); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.55; }}
    body::before {{ content:""; position:fixed; inset:0; pointer-events:none; opacity:.24; background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px); background-size:32px 32px; mask-image:linear-gradient(to bottom,black,transparent 75%); }}
    a {{ color:inherit; }} .skip {{ position:absolute; left:-9999px; }} .skip:focus {{ left:16px; top:16px; z-index:20; background:var(--acid); color:#111; padding:10px 14px; }}
    .shell {{ width:min(1180px,calc(100% - 40px)); margin:auto; position:relative; }}
    .topbar {{ display:flex; align-items:center; justify-content:space-between; padding:22px 0; border-bottom:1px solid var(--line); }}
    .brand {{ display:flex; align-items:center; gap:10px; font-weight:800; letter-spacing:-.02em; }} .brand i {{ width:12px; height:12px; background:var(--acid); border-radius:50%; box-shadow:0 0 24px var(--acid); }}
    .meta {{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }} .chip,.badge {{ border:1px solid var(--line); background:#101318; color:var(--muted); border-radius:999px; padding:7px 10px; font-size:12px; font-weight:750; text-transform:uppercase; letter-spacing:.06em; }}
    button {{ border:1px solid var(--line); background:var(--ink); color:#111; border-radius:999px; padding:9px 14px; font:inherit; font-weight:800; cursor:pointer; }} button:hover {{ transform:translateY(-1px); }} button:focus-visible, summary:focus-visible {{ outline:3px solid var(--cyan); outline-offset:3px; }}
    .hero {{ padding:70px 0 46px; display:grid; grid-template-columns:1.45fr .55fr; gap:38px; align-items:end; }}
    .kicker,.eyebrow {{ color:var(--acid); font:750 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase; letter-spacing:.12em; }}
    h1 {{ margin:12px 0 24px; max-width:900px; font-size:clamp(45px,7vw,92px); line-height:.94; letter-spacing:-.065em; }}
    .verdict {{ font-size:clamp(18px,2vw,25px); max-width:780px; color:#d9dde4; margin:0; }}
    .hero-score {{ background:var(--acid); color:#0b0d10; border-radius:var(--radius); padding:26px; box-shadow:var(--shadow); transform:rotate(1deg); }} .hero-score span {{ font:750 11px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.1em; }} .hero-score strong {{ display:block; font-size:72px; line-height:1; letter-spacing:-.08em; margin:16px 0 8px; }} .hero-score p {{ margin:0; font-size:13px; font-weight:700; }}
    .summary {{ display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; margin-bottom:38px; }} .summary div {{ padding:20px; background:var(--panel); }} .summary div+div {{ border-left:1px solid var(--line); }} .summary span,.persona-grid span,.journey-grid span {{ display:block; color:var(--muted); font:700 11px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; }} .summary strong {{ font-size:18px; }}
    .leak {{ display:grid; grid-template-columns:160px 1fr; gap:28px; padding:28px; border-radius:var(--radius); background:var(--coral); color:#160e0c; box-shadow:var(--shadow); margin:26px 0 70px; }} .leak-label {{ font:800 12px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.1em; }} .leak h2 {{ margin:0 0 8px; font-size:clamp(26px,4vw,46px); line-height:1; letter-spacing:-.04em; }} .leak p {{ margin:8px 0 0; max-width:800px; }}
    .section-head {{ display:flex; justify-content:space-between; align-items:end; gap:24px; padding-bottom:18px; border-bottom:1px solid var(--line); margin-bottom:18px; }} .section-head h2 {{ margin:0; font-size:clamp(32px,5vw,60px); letter-spacing:-.055em; line-height:1; }} .section-head p {{ margin:0; color:var(--muted); max-width:470px; }}
    .persona-list {{ display:grid; gap:16px; margin-bottom:76px; }} .persona-card {{ background:linear-gradient(135deg,var(--panel),#101318); border:1px solid var(--line); border-radius:var(--radius); padding:26px; box-shadow:0 12px 36px rgba(0,0,0,.15); }} .persona-head {{ display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }} .persona-head h3 {{ font-size:30px; letter-spacing:-.04em; margin:7px 0 4px; }} .persona-head p {{ color:var(--muted); margin:0; }}
    .score-ring {{ --score:0; width:92px; height:92px; flex:0 0 92px; border-radius:50%; display:grid; place-content:center; text-align:center; background:radial-gradient(circle at center,var(--panel) 58%,transparent 60%),conic-gradient(var(--acid) calc(var(--score)*1%),var(--line) 0); }} .score-ring strong {{ font-size:27px; line-height:1; }} .score-ring span {{ font-size:10px; color:var(--muted); }}
    .decision {{ display:flex; gap:14px; align-items:center; margin:22px 0; padding:12px 14px; background:var(--panel-2); border-left:4px solid var(--acid); }} .decision span {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }}
    .persona-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }} .persona-grid>div,.journey-grid>div {{ border:1px solid var(--line); border-radius:12px; padding:16px; background:rgba(255,255,255,.018); }} .persona-grid .wide {{ grid-column:1/-1; }} .persona-grid p,.journey-grid p {{ margin:0; }}
    details {{ margin-top:14px; }} summary {{ cursor:pointer; color:var(--acid); font-weight:800; padding:12px 0 2px; }} .journey-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }} .journey-grid ul {{ margin:0; padding-left:18px; }}
    .metrics {{ margin-top:16px; display:grid; gap:9px; }} .metric-row {{ display:grid; grid-template-columns:150px 1fr 42px; align-items:center; gap:12px; font-size:13px; }} .metric-track {{ height:8px; border-radius:8px; background:var(--line); overflow:hidden; }} .metric-track i {{ display:block; height:100%; background:linear-gradient(90deg,var(--cyan),var(--acid)); border-radius:inherit; }}
    .fix-list {{ display:grid; gap:10px; margin-bottom:76px; }} .fix-row {{ display:grid; grid-template-columns:64px 1fr auto; gap:18px; align-items:center; padding:20px; border:1px solid var(--line); background:var(--panel); border-radius:14px; }} .fix-rank {{ font:800 26px ui-monospace,monospace; color:var(--acid); }} .fix-copy h3 {{ margin:0; font-size:18px; }} .fix-copy p {{ margin:3px 0 0; color:var(--muted); }} .badges {{ display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }} .badge.positive {{ border-color:rgba(98,230,210,.45); color:var(--cyan); }} .badge.negative {{ border-color:rgba(255,116,93,.45); color:var(--coral); }}
    .experiment {{ margin-bottom:34px; padding:30px; background:var(--acid); color:#111; border-radius:var(--radius); display:grid; grid-template-columns:.8fr 1.2fr; gap:34px; }} .experiment h2 {{ font-size:38px; line-height:1; letter-spacing:-.045em; margin:10px 0; }} .experiment-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }} .experiment-grid div {{ padding:14px; border:1px solid rgba(0,0,0,.25); border-radius:12px; }} .experiment-grid span {{ display:block; font:750 10px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; }} .experiment-grid p {{ margin:0; }}
    .limits {{ padding:26px; border:1px solid var(--line); border-radius:var(--radius); color:var(--muted); margin-bottom:60px; }} .limits h2 {{ color:var(--ink); margin-top:0; }} .limits li+li {{ margin-top:8px; }}
    footer {{ display:flex; justify-content:space-between; gap:20px; border-top:1px solid var(--line); padding:22px 0 40px; color:var(--muted); font-size:12px; }}
    .reveal {{ animation:rise .45s ease both; }} @keyframes rise {{ from {{ opacity:0; transform:translateY(12px); }} }}
    @media (max-width:820px) {{ .shell {{ width:min(100% - 24px,1180px); }} .hero,.experiment {{ grid-template-columns:1fr; }} .hero {{ padding-top:44px; }} .hero-score {{ transform:none; }} .summary {{ grid-template-columns:1fr; }} .summary div+div {{ border-left:0; border-top:1px solid var(--line); }} .leak {{ grid-template-columns:1fr; }} .fix-row {{ grid-template-columns:44px 1fr; }} .badges {{ grid-column:1/-1; justify-content:flex-start; }} .persona-grid,.journey-grid,.experiment-grid {{ grid-template-columns:1fr; }} .persona-grid .wide {{ grid-column:auto; }} .meta .chip {{ display:none; }} }}
    @media (prefers-reduced-motion:reduce) {{ * {{ scroll-behavior:auto!important; animation:none!important; transition:none!important; }} }}
    @media print {{ body {{ background:white; color:#111; }} body::before,.topbar button {{ display:none; }} .shell {{ width:100%; }} .persona-card,.fix-row,.limits {{ background:white; color:#111; break-inside:avoid; }} .persona-head p,.fix-copy p,.limits {{ color:#444; }} details>summary {{ display:none; }} details>div {{ display:grid; }} }}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to report</a>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><i></i> Startup User Simulator</div>
      <div class="meta"><span class="chip">{esc(data.get('mode', 'quick'))} mode</span><span class="chip">{len(personas)} personas</span><button type="button" onclick="window.print()">Print / Save PDF</button></div>
    </header>
    <main id="main">
      <section class="hero">
        <div><span class="kicker">Simulated customer report · {esc(data.get('generated_at', ''))}</span><h1>{esc(data.get('title', 'Startup User Simulation'))}</h1><p class="verdict">{esc(data.get('verdict', 'No verdict supplied.'))}</p></div>
        <aside class="hero-score"><span>Average decision score</span><strong>{average}</strong><p>Structured simulation, not a predicted conversion rate.</p></aside>
      </section>
      <section class="summary" aria-label="Test summary"><div><span>Tested</span><strong>{esc(data.get('tested', 'Not specified'))}</strong></div><div><span>Conversion goal</span><strong>{esc(data.get('goal', 'Not specified'))}</strong></div><div><span>Mode</span><strong>{esc(str(data.get('mode', 'quick')).title())}</strong></div></section>
      <section class="leak"><div class="leak-label">Biggest conversion leak</div><div><h2>{esc(leak.get('title', 'No conversion leak supplied'))}</h2><p>{esc(leak.get('detail', ''))}</p><p><strong>Evidence:</strong> {esc(leak.get('evidence', 'Not supplied'))}</p></div></section>
      <section><header class="section-head"><h2>Five customers.<br>Five decisions.</h2><p>Each persona uses the same scoring framework but brings a different job, constraint, and threshold for trust.</p></header><div class="persona-list">{persona_html or '<p>No personas supplied.</p>'}</div></section>
      <section><header class="section-head"><h2>What to fix first.</h2><p>Recommendations are ordered by expected impact, implementation effort, and confidence in the observed evidence.</p></header><div class="fix-list">{fixes_html or '<p>No fixes supplied.</p>'}</div></section>
      <section class="experiment"><div><span class="eyebrow" style="color:#111">Fastest measurable experiment</span><h2>{esc(experiment.get('title', 'Run one focused experiment'))}</h2><p>{esc(experiment.get('hypothesis', ''))}</p></div><div class="experiment-grid"><div><span>Change</span><p>{esc(experiment.get('change', ''))}</p></div><div><span>Measure</span><p>{esc(experiment.get('measure', ''))}</p></div><div><span>Success signal</span><p>{esc(experiment.get('success', ''))}</p></div><div><span>Strongest / weakest fit</span><p>{esc(strongest.get('name', 'Unknown'))} / {esc(weakest.get('name', 'Unknown'))}</p></div></div></section>
      <section class="limits"><h2>Read this correctly</h2><ul>{limits or '<li>This is a structured simulation, not observed user behavior.</li>'}</ul></section>
    </main>
    <footer><span>Generated by $startup-user-simulator</span><span>{esc(data.get('tested', ''))}</span></footer>
  </div>
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Path to simulation JSON")
    parser.add_argument("output", type=Path, help="Path to output HTML")
    args = parser.parse_args()

    with args.input.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SystemExit("Input JSON must contain an object at the top level.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_html(data), encoding="utf-8")
    print(f"Created report: {args.output.resolve()}")


if __name__ == "__main__":
    main()
