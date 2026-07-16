/**
 * Executor fake — dry-run da pipeline (cli: "fake" no roster).
 * Recebe o prompt envelope como argv[2], extrai Job/App e gera os artefatos
 * mínimos que o verify espera, sem tocar em código real.
 *
 * FORGE_FAKE_FAIL no prompt → exit 1 (testa retry/rollback/L2).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDocRel } from "./engine.mjs";

const ROOT = process.env.FORGE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** docs do run vivem no repo do app — garante o dir e devolve o path absoluto */
function docPath(appId, kind) {
  const p = path.join(ROOT, runDocRel(appId, kind));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}
// prompt grande vem por arquivo (externalizePrompt) — o argv carrega só a referência
const goal =
  process.env.FORGE_PROMPT_FILE && fs.existsSync(process.env.FORGE_PROMPT_FILE)
    ? fs.readFileSync(process.env.FORGE_PROMPT_FILE, "utf8")
    : process.argv[2] || "";

const job = (goal.match(/^Job:\s*(\S+)/m) || [])[1] || "?";
const appId = (goal.match(/^App:\s*(\S+)/m) || [])[1] || "fake-app";

console.log(`▶ fake-exec: job=${job} app=${appId}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// modo prompt-improver (dry-run / teste): devolve o prompt original + 1 linha, escolhe ferramentas fake
const improveOut = process.env.FORGE_IMPROVE_OUTFILE;
if (improveOut) {
  const m = goal.match(/<<<PROMPT_ORIGINAL>>>\r?\n([\s\S]*?)\r?\n<<<FIM_PROMPT_ORIGINAL>>>/);
  const original = m ? m[1] : goal;
  fs.mkdirSync(path.dirname(improveOut), { recursive: true });
  fs.writeFileSync(
    improveOut,
    JSON.stringify({
      prompt: original + "\n\n[dry-run: prompt-improver simulado — nada foi reescrito]",
      skills: ["frontend-fable"],
      agents: ["agency-mobile"],
      notes: "dry-run: improver fake",
    }),
    "utf8"
  );
  console.log("✓ fake-exec: prompt-improver simulado");
  process.exit(0);
}

await sleep(800);

if (process.env.FORGE_FAKE_ECHO !== undefined) console.log(goal.slice(0, 2000));

if (/FORGE_FAKE_FAIL/.test(goal)) {
  console.error("✗ fake-exec: falha simulada (FORGE_FAKE_FAIL)");
  process.exit(1);
}

// Escreve artefato declarativo quando FORGE_FAKE_OUTFILE é set (dry-run de gameads etc.)
const outFile = process.env.FORGE_FAKE_OUTFILE;
if (outFile) {
  const target = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
  const sections = (process.env.FORGE_FAKE_SECTIONS || "").split("|").filter(Boolean);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const lines = [`# ${job} — ${appId} (dry-run)`];
  for (const section of sections) {
    lines.push(
      `\n## ${section}`,
      `Conteúdo do ${section} para o dry-run: descreve objetivo, decisões, restrições e critério observável com detalhe suficiente para provar o contrato do artefato.`
    );
  }
  fs.writeFileSync(target, lines.join("\n"), "utf8");
  console.log(`✓ escreveu ${path.relative(ROOT, target)}`);
}

if (job === "L0/P0") {
  const p = docPath(appId, "scorecard");
  // tipo derivado da IDEIA (não do goal inteiro — o boilerplate menciona static|quiz|chat)
  const idea = (goal.match(/^Ideia do app:\s*(.*)$/m) || [])[1] || "";
  const tipo = /\bchat\b/i.test(idea) ? "chat" : /\bquiz\b/i.test(idea) ? "quiz" : "static";
  const verdict = /\bGO(?:\s*-\s*|\s+)condicionado\b/i.test(idea) ? "GO condicionado" : "GO";
  fs.writeFileSync(
    p,
    `# Scorecard — ${appId} (dry-run)\n\n**${verdict}**\n\nTipo: ${tipo}\n\n## Mercado\n\n- **Comprador:** fãs de anime que organizam sessões semanais com amigos\n- **Canal:** comunidades de Discord e vídeos orgânicos no TikTok\n- **Preço-alvo:** R$ 9,90/mês — custa menos que um lanche da sessão\n- **Recorrência:** novos quizzes e rankings semanais trazem o grupo de volta\n\n| critério | nota |\n|---|---|\n| hook / valor | 4 |\n| custo | 5 |\n| fit ao nicho | 4 |\n\n- gerado pelo fake-exec para teste da pipeline\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "FOUNDATION") {
  const p = docPath(appId, "system-design");
  fs.writeFileSync(
    p,
    `# System Design — ${appId} (dry-run)\n\n## Arquitetura\nFrontend estático com estado local, componentes puros e limites explícitos entre apresentação, domínio e persistência temporária do navegador.\n\n## Dados\nlocalStorage; entidades mínimas.\n\n## Decisões\nEscolhemos localStorage no v0 para reduzir operação e validar o fluxo; banco entra somente após sinal real de retenção e necessidade multi-device.\n\n## Design patterns\nComponentes puros + hook de estado.\n\n## Riscos\nEscopo v0; sem conta/backend.\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "DS-GEN") {
  const propDir = path.join(ROOT, "maestro", "proposals", appId);
  fs.mkdirSync(propDir, { recursive: true });
  const dirs = ["minimalista", "vibrante", "editorial"];
  for (let n = 1; n <= 3; n++) {
    fs.writeFileSync(
      path.join(propDir, `proposal-${n}.html`),
      `<!doctype html><meta charset="utf-8"><title>${appId} — proposta ${n} (dry-run)</title>` +
        `<style>body{font-family:system-ui;background:#0a0612;color:#f5f0ff;padding:24px}` +
        `.sw{display:inline-block;width:48px;height:48px;border-radius:8px;margin:4px}` +
        `.btn{padding:8px 16px;border-radius:10px;border:0;background:#c44dff;color:#fff}</style>` +
        `<h1>${appId} — direção ${n}: ${dirs[n - 1]} (dry-run)</h1>` +
        `<p>Paleta:</p><span class="sw" style="background:#c44dff"></span><span class="sw" style="background:#38bdf8"></span>` +
        `<span class="sw" style="background:#34d399"></span><p><button class="btn">Botão primário</button></p>` +
        `<section><h2>Direção visual</h2><p>Proposta ${dirs[n - 1]} com hierarquia clara, contraste acessível, espaçamento consistente e componentes mobile-first.</p>` +
        `<p>O hero demonstra tipografia, CTA e paleta; os estados interativos preservam foco visível e leitura em telas pequenas.</p>` +
        `<p>Este conteúdo detalhado existe para o dry-run provar uma proposta renderizável, não apenas um arquivo HTML vazio.</p></section>`,
      "utf8"
    );
  }
  const md = docPath(appId, "design-system");
  fs.writeFileSync(
    md,
    `# Design System — ${appId} (dry-run)\n\n` +
      dirs
        .map(
          (d, i) =>
            `## Proposta ${i + 1}: ${d}\n| token | valor |\n|---|---|\n| primária | #c44dff |\n| bg | #0a0612 |\n| radius | 10px |\n| font | system-ui |\n\nQuando escolher: exemplo dry-run.\n`
        )
        .join("\n") + "\n## Recomendação automática\n\nRecomendação automática: proposta 2\n\nEquilibra clareza, adequação ao nicho e execução no dry-run.\n",
    "utf8"
  );
  console.log(`✓ escreveu 3 propostas + ${path.relative(ROOT, md)}`);
} else if (job === "L0/P1") {
  const p = docPath(appId, "content-hooks");
  fs.writeFileSync(
    p,
    `# Content hooks — ${appId} (dry-run)\n\n${Array.from({ length: 15 }, (_, i) => `${i + 1}. Hook ${i + 1}: descubra uma experiência original do app, compartilhe com amigos e acesse pelo link na bio. #anime #otaku`).join("\n")}\n`,
    "utf8"
  );
  console.log(`✓ escreveu ${path.relative(ROOT, p)}`);
} else if (job === "SIMULATE") {
  const runId = (goal.match(/docs\/simulations\/([^\s]+)\.json/) || [])[1] || "dry-run";
  const dir = path.join(ROOT, "apps", appId, "docs", "simulations");
  fs.mkdirSync(dir, { recursive: true });
  const personas = ["Maior fit", "Avaliador cético", "Comprador econômico", "Comprador sem tempo", "Usuário adjacente"].map((label, index) => ({
    name: label,
    label,
    job: `Validar a proposta ${index + 1}`,
    score: 58 + index * 6,
    decision: index < 2 ? "Continua, mas hesita" : "Sai sem prova suficiente",
    first_impression: "A proposta principal é visível no primeiro contato.",
    trust_break: "O dry-run não contém evidência comportamental real.",
    objection: "Preciso ver prova específica antes de agir.",
    context: "Persona simulada para verificar o contrato da pipeline.",
    understands: "O resultado central do app.",
    hesitation: "A evidência ainda é simulada.",
    evidence: ["Hero", "CTA primário"],
    dimensions: { clarity: 4, relevance: 3, trust: 2, friction: 4, value_confidence: 3, cta_fit: 3 },
  }));
  const report = {
    title: `Startup User Simulation — ${appId}`,
    tested: `preview:${appId}`,
    goal: "Executar a ação primária",
    mode: "quick",
    generated_at: new Date().toISOString().slice(0, 10),
    verdict: "A persona de maior fit continua, enquanto as demais pedem prova mais específica.",
    biggest_leak: { title: "Prova insuficiente", detail: "A proposta aparece antes da evidência.", evidence: "Hero e CTA do dry-run." },
    personas,
    fixes: [
      { rank: 1, change: "Clarificar a evidência ao lado do CTA", personas: "4 de 5", impact: "High", effort: "Small", confidence: "High", auto_apply: true },
      { rank: 2, change: "Adicionar estado vazio explicativo", personas: "3 de 5", impact: "Medium", effort: "Small", confidence: "High", auto_apply: true },
      { rank: 3, change: "Alterar pricing", personas: "2 de 5", impact: "High", effort: "Small", confidence: "High", auto_apply: false, protected_reason: "pricing" },
      { rank: 4, change: "Aproximar exemplo do CTA", personas: "4 de 5", impact: "Medium", effort: "Small", confidence: "Medium", auto_apply: false },
      { rank: 5, change: "Testar onboarding mais curto", personas: "3 de 5", impact: "Medium", effort: "Medium", confidence: "Medium", auto_apply: false },
    ],
    experiment: { title: "Prova junto do CTA", hypothesis: "Evidência reduz hesitação.", change: "Mostrar exemplo.", measure: "CTA click-through", success: "Melhora relativa observável." },
    limits: ["This is a structured simulation, not observed user behavior.", "Validate with analytics or real users."],
  };
  const json = path.join(dir, `${runId}.json`);
  const html = path.join(dir, `${runId}.html`);
  fs.writeFileSync(json, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><title>${report.title}</title><style>body{font-family:system-ui;background:#111;color:#eee;max-width:900px;margin:auto;padding:40px}.persona{border:1px solid #555;padding:18px;margin:12px 0}</style></head><body><h1>${report.title}</h1><p>${report.verdict}</p>${personas.map((persona) => `<article class="persona"><h2>${persona.name}</h2><strong>Simulated decision score — not a predicted conversion rate: ${persona.score}</strong><p>${persona.objection}</p><p>${persona.evidence.join(", ")}</p></article>`).join("")}<h2>Limits</h2><p>This is a structured simulation, not observed user behavior or real-user research. Validate findings with analytics and real users.</p></body></html>`, "utf8");
  console.log(`✓ escreveu ${path.relative(ROOT, json)} + HTML`);
} else {
  console.log(`· fake-exec: job ${job} simulado (sem artefato)`);
}

await sleep(400);
console.log("✓ fake-exec done");
