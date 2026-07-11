/**
 * Render dos templates IG → PNG (1080×1350 post · 1080×1920 story/capa).
 *
 *   node marketing/ig-kit/render.mjs [--hook "..."] [--sub "..."] [--cta "..."] [--badge "..."] [--label APPS]
 *
 * Usa o Playwright via npx (baixa o Chromium na 1ª vez: npx playwright install chromium).
 * Saída: marketing/ig-kit/renders/*.png (gitignored — arte é artefato, template é fonte).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "renders");
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[++i];
}
const qs = (keys) =>
  keys
    .filter((k) => flags[k])
    .map((k) => `${k}=${encodeURIComponent(flags[k])}`)
    .join("&");

const JOBS = [
  { tpl: "post-app.html", size: "1080,1350", out: "post.png", params: qs(["hook", "sub", "cta", "badge"]) },
  { tpl: "story-app.html", size: "1080,1920", out: "story.png", params: qs(["hook", "sub", "cta", "badge"]) },
  { tpl: "highlight-cover.html", size: "1080,1920", out: "highlight.png", params: qs(["label", "icon"]) },
];

for (const j of JOBS) {
  const url = `file:///${path.join(HERE, j.tpl).replace(/\\/g, "/")}${j.params ? "?" + j.params : ""}`;
  const dest = path.join(OUT, j.out);
  console.log(`▶ ${j.tpl} @ ${j.size} → renders/${j.out}`);
  execFileSync(
    "npx",
    ["--yes", "playwright", "screenshot", `--viewport-size=${j.size}`, "--wait-for-timeout=1500", url, dest],
    { stdio: "inherit", shell: true }
  );
}
console.log("✓ renders prontos em marketing/ig-kit/renders/");
