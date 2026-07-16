/**
 * Deploy pipeline — Cloudflare Pages / GitHub Pages / Cloudflare Workers.
 *
 * Contrato (chamado por engine.mjs):
 *   const { deployApp } = await import("./deploy.mjs");
 *   const result = await deployApp(pipeline, { root, log });
 *   result: { ok, url?, dns?, error?, fallbackSteps? }
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Pins deliberados: deploy nunca executa código flutuante com tokens de produção.
const WRANGLER = "wrangler@4.108.0"; // Pages (pin histórico comprovado)
const OPENNEXT_CF = "@opennextjs/cloudflare@1.20.1"; // alinhado a apps chat no lockfile
const CLOUDFLARE_PAGES_PRODUCTION_BRANCH = "master";
/** Alvos oficiais: CF Pages (static) · CF Workers (API/SSR) · GH Pages. Domínio = baseUrl do profile (ex.: gbbragadev.com). */
const SUPPORTED_TARGETS = "cf-pages | cf-workers | gh-pages";

// ---------- helpers ----------

/** Nome de env var seguro p/ interpolar em shell (wrangler secret put). */
export function assertSafeEnvKey(name) {
  const key = String(name || "").trim();
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)) {
    throw new Error(`ai.envKey inválido: ${key.slice(0, 40)}`);
  }
  return key;
}

/** Fetch wrapper com timeout e retry automático para rate-limit */
async function fetch_safe(url, opts = {}, retryCount = 0) {
  const { timeout = 10000, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.status === 429 && retryCount < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1)));
      return fetch_safe(url, opts, retryCount + 1);
    }
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Token CF com permissão de escrita: CF_GBBRAGADEV_ADM (admin da conta gbbragadev).
// CLOUDFLARE_API_TOKEN é read-only — fica como fallback de leitura.
const CF_TOKEN = process.env.CF_GBBRAGADEV_ADM || process.env.CLOUDFLARE_API_TOKEN;

/** Chamadas à API Cloudflare */
async function cf(pathname, opts = {}) {
  const token = CF_TOKEN;
  if (!token) return null;
  const { method = "GET", body, timeout = 30000 } = opts;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const url = `https://api.cloudflare.com/client/v4${pathname}`;
  try {
    const res = await fetch_safe(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeout,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, text, errors: [] };
    }
    const data = await res.json();
    if (!data.success) return { ok: false, errors: data.errors || [] };
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Executa comando com timeout e captura stderr. `input` vai pelo STDIN (segredo nunca em argv/log). */
function run(cmd, env = {}, timeout = 5 * 60 * 1000, cwd = process.cwd(), input = undefined) {
  const finalEnv = { ...process.env, ...env };
  const shell = process.platform === "win32" ? "cmd.exe" : "bash";
  const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];

  try {
    const result = spawnSync(shell, shellArgs, {
      cwd,
      env: finalEnv,
      timeout,
      encoding: "utf8",
      ...(input !== undefined ? { input } : {}),
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      const stderr = result.stderr ? String(result.stderr).slice(-1000) : "";
      const stdout = result.stdout ? String(result.stdout).slice(-1000) : "";
      throw new Error(stderr || stdout || `exit code ${result.status}`);
    }
    return { ok: true, output: result.stdout.trim() };
  } catch (e) {
    const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");
    const tail = strip(e).slice(-500);
    return { ok: false, error: strip(e.message ?? e).slice(0, 300), tail };
  }
}

/** Verifica URL com retry/backoff */
export async function waitUrl(url, delaysMs = [30000, 60000, 120000, 300000]) {
  for (const delay of delaysMs) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch_safe(url, { timeout: 8000 });
      if (res.ok) return { ok: true, status: res.status };
    } catch {}
  }
  return { ok: false };
}

function isSafePagesBranch(branch) {
  const value = String(branch || "");
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(value) && !value.includes("..") && !value.includes("//") && !value.includes("@{");
}

export function cloudflarePagesDeployCommand(appId, productionBranch = CLOUDFLARE_PAGES_PRODUCTION_BRANCH) {
  if (!/^[a-z0-9-]+$/.test(appId)) throw new Error(`appId inválido: ${appId}`);
  if (!isSafePagesBranch(productionBranch)) throw new Error(`branch de produção Pages inválida: ${productionBranch}`);
  return `npx --yes ${WRANGLER} pages deploy apps/${appId}/out --project-name ${appId} --branch ${productionBranch} --commit-dirty=true`;
}

function sameHostname(left, right) {
  const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\.$/, "");
  return normalize(left) === normalize(right);
}

function isExpectedPagesCname(record, pagesHost) {
  return record?.type === "CNAME" && sameHostname(record.content, pagesHost);
}

// ---------- targets ----------

/** Cloudflare Pages + custom domain setup */
export async function deployToCloudflarePages(pipeline, { root, log, limits, runtime = {} }) {
  const { appId, deploy } = pipeline;
  const outDir = path.join(root, "apps", appId, "out");
  const runCommand = runtime.run || run;
  const cfRequest = runtime.cf || cf;
  const waitForUrl = runtime.waitUrl || waitUrl;

  // Valida appId (antes de interpolar em shell)
  if (!/^[a-z0-9-]+$/.test(appId)) {
    return { ok: false, error: `appId inválido: ${appId}`, fallbackSteps: [] };
  }

  // 1. Valida output do build
  if (!fs.existsSync(outDir)) {
    log(`▶ build ${appId} (falta out/)`);
    const buildRes = runCommand(`npm run build -w @forge/${appId}`, {}, limits?.deployBuildTimeoutMs || 10 * 60 * 1000, root);
    if (!buildRes.ok) {
      return {
        ok: false,
        error: "build falhou",
        fallbackSteps: [`1. Verifique \`npm run build -w @forge/${appId}\` localmente`],
      };
    }
    if (!fs.existsSync(outDir)) {
      return {
        ok: false,
        error: "build saiu mas out/ não apareceu",
        fallbackSteps: [`1. Verifique o build path em apps/${appId}/wrangler.toml`],
      };
    }
  }
  log(`✓ output ready: ${path.relative(root, outDir)}`);

  // Account ID antes do wrangler: token multi-conta trava sem ele em modo não-interativo
  let accountId = Object.hasOwn(runtime, "accountId") ? runtime.accountId : process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    const listRes = await cfRequest("/accounts", {});
    if (listRes?.ok && listRes.result?.length > 0) accountId = listRes.result[0].id;
  }
  if (!accountId) {
    return {
      ok: false,
      error: "não foi possível identificar a conta Cloudflare para comprovar o deploy de produção",
      fallbackSteps: ["1. Configure CLOUDFLARE_ACCOUNT_ID", "2. Tente o deploy novamente"],
    };
  }
  const wranglerEnv = {
    CLOUDFLARE_API_TOKEN: CF_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: accountId,
  };

  const projectPath = `/accounts/${accountId}/pages/projects/${appId}`;
  const projectBefore = await cfRequest(projectPath);
  if (!projectBefore?.ok && projectBefore?.status !== 404) {
    return {
      ok: false,
      error: "não foi possível consultar a configuração de produção do projeto Pages",
      fallbackSteps: ["1. Confirme Pages:Read no token Cloudflare", "2. Tente o deploy novamente"],
    };
  }
  const productionBranch = projectBefore?.ok
    ? projectBefore.result?.production_branch || CLOUDFLARE_PAGES_PRODUCTION_BRANCH
    : CLOUDFLARE_PAGES_PRODUCTION_BRANCH;
  if (!isSafePagesBranch(productionBranch)) {
    return { ok: false, error: `branch de produção Pages inválida: ${productionBranch}`, fallbackSteps: [] };
  }
  const previousCanonicalDeploymentId = projectBefore?.ok ? projectBefore.result?.canonical_deployment?.id || null : null;

  // 2. Deploy via wrangler (path relativo sem aspas — cmd.exe /c mastiga aspas em arg)
  log(`▶ wrangler pages deploy → ${appId} · produção ${productionBranch}`);
  const deployCmd = cloudflarePagesDeployCommand(appId, productionBranch);
  const deployRes = runCommand(deployCmd, wranglerEnv, 5 * 60 * 1000, root);

  let deployed = deployRes.ok;
  if (!deployed) {
    const errText = `${deployRes.error || ""} ${deployRes.tail || ""}`;
    // Tenta criar projeto Pages
    if (/no project|not found|does not exist/i.test(errText)) {
      log(`▶ criar projeto Pages ${appId}`);
      const createCmd = `npx --yes ${WRANGLER} pages project create ${appId} --production-branch ${productionBranch}`;
      const createRes = runCommand(createCmd, wranglerEnv, 5 * 60 * 1000, root);
      if (!createRes.ok) {
        return {
          ok: false,
          error: "wrangler deploy falhou + criar projeto Pages falhou",
          fallbackSteps: [
            `1. Acesse dashboard.cloudflare.com → Pages`,
            `2. Create project → Connect to Git (selecione anime-forge)`,
            `3. Nome do projeto: ${appId}`,
          ],
        };
      }
      // Retry deploy após criar projeto
      const retryRes = runCommand(deployCmd, wranglerEnv, 5 * 60 * 1000, root);
      if (!retryRes.ok) {
        return {
          ok: false,
          error: `wrangler deploy falhou mesmo após criar projeto: ${retryRes.error}`,
          fallbackSteps: [
            `1. Rode manualmente: npx wrangler pages deploy apps/${appId}/out --project-name ${appId} --branch ${productionBranch}`,
            `2. Dash Pages → custom domain ${deploy.subdomain}.gbbragadev.com`,
            `3. forge decide <gate> retry`,
          ],
        };
      }
      deployed = true; // criou + deployou — segue pro custom domain
    } else if (/403|unauthorized|authentication error|code:\s*10000|invalid.*token|read.?only/i.test(errText)) {
      return {
        ok: false,
        error: "CLOUDFLARE_API_TOKEN sem permissão de escrita (read-only)",
        fallbackSteps: [
          `1. dash.cloudflare.com → My Profile → API Tokens → edite o token e adicione Cloudflare Pages:Edit + Zone DNS:Edit (zona gbbragadev.com)`,
          `2. Atualize a env CLOUDFLARE_API_TOKEN no Windows com o novo valor e reinicie o server (npm run maestro)`,
          `3. Re-decida o gate: forge decide <gate> retry`,
        ],
      };
    }
    if (!deployed) {
      return {
        ok: false,
        error: `wrangler deploy falhou: ${deployRes.error}`,
        fallbackSteps: [
          `1. Rode manualmente: npx wrangler pages deploy apps/${appId}/out --project-name ${appId} --branch ${productionBranch}`,
          `2. No dash do Pages, adicione o custom domain ${deploy.subdomain}.gbbragadev.com`,
          `3. forge decide <gate> retry quando o site responder`,
        ],
      };
    }
  }

  log(`✓ deployed to Pages`);
  const projectAfter = await cfRequest(projectPath);
  if (!projectAfter?.ok) {
    return {
      ok: false,
      error: "deploy enviado, mas o projeto Pages não pôde ser revalidado",
      fallbackSteps: ["1. Confirme Pages:Read no token Cloudflare", "2. Tente o deploy novamente"],
    };
  }
  const canonicalDeploymentId = projectAfter.result?.canonical_deployment?.id || null;
  if (!canonicalDeploymentId || canonicalDeploymentId === previousCanonicalDeploymentId) {
    return {
      ok: false,
      error: "deploy enviado, mas a produção canônica não avançou",
      fallbackSteps: [`1. Confirme a production branch ${productionBranch} no projeto Pages`, "2. Tente o deploy novamente"],
    };
  }
  if (projectAfter.result?.production_branch !== productionBranch) {
    return {
      ok: false,
      error: `production branch mudou durante o deploy (${projectAfter.result?.production_branch || "ausente"})`,
      fallbackSteps: ["1. Reabra a configuração do projeto Pages", "2. Tente o deploy novamente"],
    };
  }

  // subdomínio REAL do projeto (nome global pode colidir → CF dá sufixo, ex. anime-quiz-9r7.pages.dev)
  const pagesHost = projectAfter.result?.subdomain;
  if (!pagesHost) return { ok: false, error: "projeto Pages sem subdomain verificável", fallbackSteps: [] };

  // 3. Custom domain SEMPRE — o objetivo é <subdomain>.<baseUrl> (do profile)
  const zoneName = deploy.baseUrl || "gbbragadev.com";
  const customDomain = `${deploy.subdomain}.${zoneName}`;
  log(`▶ custom domain ${customDomain}`);

  const domainsPath = `${projectPath}/domains`;
  const domainRes = await cfRequest(domainsPath, { method: "POST", body: { name: customDomain } });
  if (!domainRes?.ok) {
    const domainsRes = await cfRequest(domainsPath);
    const alreadyBound = domainsRes?.ok && domainsRes.result?.some((domain) => sameHostname(domain.name, customDomain));
    if (!alreadyBound) {
      return {
        ok: false,
        error: `não foi possível vincular o custom domain ${customDomain}`,
        fallbackSteps: [`1. Pages → ${appId} → Custom domains → adicione ${customDomain}`, "2. Tente o deploy novamente"],
      };
    }
    log(`✓ custom domain ${customDomain} já vinculado`);
  } else {
    log(`✓ custom domain ${customDomain} vinculado`);
  }

  // Setup DNS CNAME. Nenhum 200 antigo pode mascarar falha nesta etapa.
  const zoneRes = await cfRequest(`/zones?name=${zoneName}`);
  const zoneId = zoneRes?.ok ? zoneRes.result?.[0]?.id : null;
  if (!zoneId) {
    return {
      ok: false,
      error: `não foi possível comprovar a zone Cloudflare ${zoneName}`,
      fallbackSteps: ["1. Confirme Zone:Read + DNS:Edit no token Cloudflare", "2. Tente o deploy novamente"],
    };
  }

  const recordsPath = `/zones/${zoneId}/dns_records`;
  const existingRes = await cfRequest(`${recordsPath}?name=${customDomain}`);
  if (!existingRes?.ok) {
    return { ok: false, error: `não foi possível consultar o CNAME ${customDomain}`, fallbackSteps: [] };
  }
  const existing = existingRes.result?.[0] || null;
  const recordBody = {
    type: "CNAME",
    name: deploy.subdomain,
    content: pagesHost,
    // DNS-only: proxied trava a validação HTTP do Pages (Error 1014 até ativar);
    // o Pages já está na edge da CF, proxy aqui é redundante.
    proxied: false,
  };

  let recordId = existing?.id || null;
  if (isExpectedPagesCname(existing, pagesHost)) {
    log(`✓ DNS CNAME já aponta para ${pagesHost}`);
  } else {
    const recordRes = existing
      ? await cfRequest(`${recordsPath}/${existing.id}`, { method: "PATCH", body: recordBody })
      : await cfRequest(recordsPath, { method: "POST", body: recordBody });
    if (!recordRes?.ok || !isExpectedPagesCname(recordRes.result, pagesHost)) {
      return {
        ok: false,
        error: `não foi possível publicar o CNAME ${customDomain} → ${pagesHost}`,
        fallbackSteps: ["1. Confirme DNS:Edit no token Cloudflare", "2. Corrija o registro e tente o deploy novamente"],
      };
    }
    recordId = recordRes.result.id || recordId;
    log(`✓ DNS CNAME publicado`);
  }

  const publicUrl = `https://${customDomain}`;
  const configuredDelays = limits?.deployRetryDelaysMs || [5000, 15000, 30000];
  const health = await waitForUrl(publicUrl, [0, ...configuredDelays.filter((delay) => delay > 0).slice(0, 3)]);
  if (!health.ok) {
    return {
      ok: false,
      error: `deploy publicado, mas ${publicUrl} não respondeu HTTP 2xx`,
      fallbackSteps: [
        `1. Confirme que o deploy de produção usa --branch ${productionBranch}`,
        `2. Confira o custom domain ${customDomain} no Pages`,
        "3. Tente o deploy novamente",
      ],
    };
  }

  const finalDomains = await cfRequest(domainsPath);
  const activeBinding = finalDomains?.ok && finalDomains.result?.some(
    (domain) => sameHostname(domain.name, customDomain) && domain.status === "active",
  );
  if (!activeBinding) {
    return {
      ok: false,
      error: `custom domain ${customDomain} respondeu, mas o binding Pages não está ativo`,
      fallbackSteps: ["1. Confira o status do custom domain no Pages", "2. Tente o deploy novamente"],
    };
  }

  log(`✓ ${publicUrl} no ar (HTTP ${health.status}) · produção ${canonicalDeploymentId}`);
  return {
    ok: true,
    url: publicUrl,
    dns: { status: "ok", recordId },
  };
}

/** GitHub Pages — fallback (CI automático via workflow) */
async function deployToGitHubPages(pipeline, { root, log, limits, profileDeploy }) {
  const { appId } = pipeline;
  const workflowPath = path.join(root, ".github", "workflows", "*.yml");

  // Procura workflow que faz deploy
  const workflowsDir = path.join(root, ".github", "workflows");
  let hasPagesDeploy = false;
  if (fs.existsSync(workflowsDir)) {
    const files = fs.readdirSync(workflowsDir);
    hasPagesDeploy = files.some((f) => {
      const content = fs.readFileSync(path.join(workflowsDir, f), "utf8");
      return /deploy-pages|github.pages|pages.dev/.test(content);
    });
  }

  if (!hasPagesDeploy) {
    return {
      ok: false,
      error: "workflow de Pages não encontrado em .github/workflows/",
      fallbackSteps: [
        "1. Crie .github/workflows/deploy-pages.yml (veja deploy-anime-quiz.yml como template)",
        "2. Configure Settings → Pages → Build from GitHub Actions",
        "3. Push para master para disparar o workflow",
      ],
    };
  }

  log(`▶ GitHub Pages (CI automático)`);
  const baseUrl = profileDeploy?.ghPagesUrl || "https://gbbragadev.github.io/anime-forge";
  const urlCheck = await waitUrl(baseUrl, (limits?.deployRetryDelaysMs || [30000, 60000, 120000, 300000]).slice(0, 3));

  if (urlCheck.ok) {
    log(`✓ ${baseUrl} acessível`);
    return { ok: true, url: baseUrl, dns: { status: "ok" } };
  }

  // URL ainda não está disponível — workflow pode estar rodando
  return {
    ok: true,
    url: baseUrl,
    dns: { status: "propagando", note: "workflow pode estar em progresso" },
  };
}

/**
 * Cloudflare Workers via OpenNext — Next.js COM rotas de API (SSR) rodando no Cloudflare.
 * (cf-pages só serve export estático: um app com /api/* perderia as rotas.)
 * Domínio: `<subdomain>.<baseUrl>` (ex.: app.gbbragadev.com ou domínio custom no wrangler).
 */
async function deployToCloudflareWorkers(pipeline, { root, log, limits, aiEnvKey }) {
  const { appId, deploy } = pipeline;
  if (!/^[a-z0-9-]+$/.test(appId)) return { ok: false, error: `appId inválido: ${appId}`, fallbackSteps: [] };
  if (!CF_TOKEN) {
    return {
      ok: false,
      error: "token da Cloudflare não está no ambiente (CF_GBBRAGADEV_ADM)",
      fallbackSteps: ["1. Exporte CF_GBBRAGADEV_ADM (token com Edit em Workers/Pages/DNS)", "2. retry"],
    };
  }
  const appDir = path.join(root, "apps", appId);
  const domain = `${deploy.subdomain}.${deploy.baseUrl}`;

  // 1. dependências do adapter (idempotente — só instala o que faltar)
  const pkgPath = path.join(appDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const need = ["@opennextjs/cloudflare", "wrangler"].filter((d) => !pkg.devDependencies?.[d] && !pkg.dependencies?.[d]);
  if (need.length) {
    log(`▶ instalando adapter Cloudflare: ${need.join(" ")}`);
    const r = run(`npm install -D ${need.join(" ")} -w @forge/${appId}`, {}, limits?.deployBuildTimeoutMs || 10 * 60 * 1000, root);
    if (!r.ok) return { ok: false, error: `npm install do adapter falhou: ${r.error}`, fallbackSteps: [`Rode: npm install -D ${need.join(" ")} -w @forge/${appId}`] };
  }

  // 2. config do worker (cria se faltar; se existir, só corrige routes.pattern se estiver errado)
  const wranglerPath = path.join(appDir, "wrangler.jsonc");
  const wranglerScaffold = {
    $schema: "node_modules/wrangler/config-schema.json",
    name: appId,
    main: ".open-next/worker.js",
    compatibility_date: "2025-03-01",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
    assets: { directory: ".open-next/assets", binding: "ASSETS" },
    services: [{ binding: "WORKER_SELF_REFERENCE", service: appId }],
    routes: [{ pattern: domain, custom_domain: true }],
  };
  if (!fs.existsSync(wranglerPath)) {
    fs.writeFileSync(wranglerPath, JSON.stringify(wranglerScaffold, null, 2), "utf8");
    log(`✓ wrangler.jsonc criado (domínio ${domain})`);
  } else {
    try {
      const raw = fs.readFileSync(wranglerPath, "utf8");
      // jsonc: remove comentários de linha simples o suficiente p/ parse
      const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
      const pattern = cfg?.routes?.[0]?.pattern;
      if (pattern && pattern !== domain) {
        cfg.routes = [{ pattern: domain, custom_domain: true }];
        cfg.name = cfg.name || appId;
        fs.writeFileSync(wranglerPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
        log(`✓ wrangler.jsonc domínio atualizado: ${pattern} → ${domain}`);
      }
    } catch (e) {
      log(`⚠ wrangler.jsonc existente não atualizado: ${String(e).slice(0, 120)}`);
    }
  }
  const openNextPath = path.join(appDir, "open-next.config.ts");
  if (!fs.existsSync(openNextPath)) {
    fs.writeFileSync(
      openNextPath,
      'import { defineCloudflareConfig } from "@opennextjs/cloudflare";\n\nexport default defineCloudflareConfig();\n',
      "utf8"
    );
  }

  // 3. build do worker (OpenNext converte o Next em Worker)
  log(`▶ opennextjs-cloudflare build (${appId})`);
  const build = run(`npx --yes ${OPENNEXT_CF} build`, {}, limits?.deployBuildTimeoutMs || 10 * 60 * 1000, appDir);
  if (!build.ok) {
    return {
      ok: false,
      error: "build do OpenNext falhou",
      errorTail: build.tail,
      fallbackSteps: [
        `1. cd apps/${appId} && npx ${OPENNEXT_CF} build`,
        "2. Rotas com APIs Node podem exigir ajuste (nodejs_compat já está ligado)",
      ],
    };
  }

  // 4. secrets do produto (stdin; envKey allowlist — nunca metacaracteres de shell)
  let aiKey;
  try {
    aiKey = assertSafeEnvKey(aiEnvKey || "ZAI_API_KEY");
  } catch (e) {
    return { ok: false, error: String(e.message || e), fallbackSteps: ["Corrija profile.ai.envKey para [A-Z][A-Z0-9_]*"] };
  }
  if (process.env[aiKey]) {
    const put = run(`npx --yes ${WRANGLER} secret put ${aiKey} --name ${appId}`, { CLOUDFLARE_API_TOKEN: CF_TOKEN }, 2 * 60 * 1000, appDir, process.env[aiKey]);
    log(put.ok ? `✓ secret ${aiKey} publicado no worker` : `⚠ secret ${aiKey} não publicado (${String(put.error).slice(0, 60)}) — o app pode falhar em runtime`);
  } else {
    log(`⚠ ${aiKey} não está no ambiente — publique depois: wrangler secret put ${aiKey} --name ${appId}`);
  }

  // 5. deploy
  log(`▶ wrangler deploy → ${domain}`);
  const dep = run(`npx --yes ${WRANGLER} deploy`, { CLOUDFLARE_API_TOKEN: CF_TOKEN }, limits?.deployBuildTimeoutMs || 10 * 60 * 1000, appDir);
  if (!dep.ok) {
    return {
      ok: false,
      error: "wrangler deploy falhou",
      errorTail: dep.tail,
      fallbackSteps: [`1. cd apps/${appId} && npx wrangler deploy`, "2. Confira o custom domain no dash (Workers → Settings → Domains)"],
    };
  }

  const url = `https://${domain}`;
  const check = await waitUrl(url, (limits?.deployRetryDelaysMs || [30000, 60000, 120000]).slice(0, 3));
  log(check.ok ? `✓ ${url} no ar` : `· ${url} ainda propagando (DNS do custom domain)`);
  return { ok: true, url, dns: { status: check.ok ? "ok" : "propagando" } };
}

// ---------- main ----------

/**
 * @param {any} pipeline
 * @param {{ root: string, log: (line: string) => void }} opts
 * @returns {Promise<{ ok: boolean, url?: string, dns?: any, error?: string, fallbackSteps?: string[] }>}
 */
export async function deployApp(pipeline, opts) {
  const { deploy, appId } = pipeline;
  const { log } = opts;

  // Legado: pipelines antigas com target vercel → Workers no domínio do profile (não Vercel).
  if (deploy.target === "vercel") {
    log(`⚠ target "vercel" foi removido — usando cf-workers em ${deploy.subdomain || appId}.${deploy.baseUrl || "domínio do profile"}`);
    deploy.target = "cf-workers";
  }

  log(`🚀 deploy ${appId} via ${deploy.target}`);

  try {
    if (deploy.target === "cf-pages") {
      return await deployToCloudflarePages(pipeline, opts);
    }
    if (deploy.target === "gh-pages" || deploy.target === "gh-pages-path") {
      return await deployToGitHubPages(pipeline, opts);
    }
    if (deploy.target === "cf-workers") {
      return await deployToCloudflareWorkers(pipeline, opts);
    }
    return {
      ok: false,
      error: `target desconhecido: ${deploy.target}`,
      fallbackSteps: [`Targets suportados: ${SUPPORTED_TARGETS}`],
    };
  } catch (e) {
    return {
      ok: false,
      error: `exceção não tratada: ${String(e).slice(0, 200)}`,
      fallbackSteps: ["1. Verifique logs do deploy", "2. Teste manualmente via dashboard"],
    };
  }
}
