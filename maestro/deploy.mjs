/**
 * Deploy pipeline — Cloudflare Pages / GitHub Pages / Vercel.
 *
 * Contrato (chamado por engine.mjs):
 *   const { deployApp } = await import("./deploy.mjs");
 *   const result = await deployApp(pipeline, { root, log });
 *   result: { ok, url?, dns?, error?, fallbackSteps? }
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------- helpers ----------

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

/** Executa comando com timeout e captura stderr */
function run(cmd, env = {}, timeout = 5 * 60 * 1000, cwd = process.cwd()) {
  const finalEnv = { ...process.env, ...env };
  const shell = process.platform === "win32" ? "cmd.exe" : "bash";
  const shellArgs = process.platform === "win32" ? ["/c", cmd] : ["-c", cmd];

  try {
    const result = spawnSync(shell, shellArgs, {
      cwd,
      env: finalEnv,
      timeout,
      encoding: "utf8",
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
async function waitUrl(url, delaysMs = [30000, 60000, 120000, 300000]) {
  for (const delay of delaysMs) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch_safe(url, { timeout: 8000 });
      if (res.ok || res.status === 404) return { ok: true, status: res.status };
    } catch {}
  }
  return { ok: false };
}

// ---------- targets ----------

/** Cloudflare Pages + custom domain setup */
async function deployToCloudflarePages(pipeline, { root, log, limits }) {
  const { appId, deploy } = pipeline;
  const outDir = path.join(root, "apps", appId, "out");

  // Valida appId (antes de interpolar em shell)
  if (!/^[a-z0-9-]+$/.test(appId)) {
    return { ok: false, error: `appId inválido: ${appId}`, fallbackSteps: [] };
  }

  // 1. Valida output do build
  if (!fs.existsSync(outDir)) {
    log(`▶ build ${appId} (falta out/)`);
    const buildRes = run(`npm run build -w @forge/${appId}`, {}, limits?.deployBuildTimeoutMs || 10 * 60 * 1000, root);
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
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    const listRes = await cf("/accounts", {});
    if (listRes?.ok && listRes.result?.length > 0) accountId = listRes.result[0].id;
  }
  const wranglerEnv = {
    CLOUDFLARE_API_TOKEN: CF_TOKEN,
    ...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
  };

  // 2. Deploy via wrangler (path relativo sem aspas — cmd.exe /c mastiga aspas em arg)
  log(`▶ wrangler pages deploy → ${appId}`);
  const deployCmd = `npx --yes wrangler@latest pages deploy apps/${appId}/out --project-name ${appId} --commit-dirty=true`;
  const deployRes = run(deployCmd, wranglerEnv, 5 * 60 * 1000, root);

  let deployed = deployRes.ok;
  if (!deployed) {
    const errText = `${deployRes.error || ""} ${deployRes.tail || ""}`;
    // Tenta criar projeto Pages
    if (/no project|not found|does not exist/i.test(errText)) {
      log(`▶ criar projeto Pages ${appId}`);
      const createCmd = `npx --yes wrangler@latest pages project create ${appId} --production-branch master`;
      const createRes = run(createCmd, wranglerEnv, 5 * 60 * 1000, root);
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
      const retryRes = run(deployCmd, wranglerEnv, 5 * 60 * 1000, root);
      if (!retryRes.ok) {
        return {
          ok: false,
          error: `wrangler deploy falhou mesmo após criar projeto: ${retryRes.error}`,
          fallbackSteps: [
            `1. Rode manualmente: npx wrangler pages deploy apps/${appId}/out --project-name ${appId}`,
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
          `1. Rode manualmente: npx wrangler pages deploy apps/${appId}/out --project-name ${appId}`,
          `2. No dash do Pages, adicione o custom domain ${deploy.subdomain}.gbbragadev.com`,
          `3. forge decide <gate> retry quando o site responder`,
        ],
      };
    }
  }

  log(`✓ deployed to Pages`);
  // subdomínio REAL do projeto (nome global pode colidir → CF dá sufixo, ex. anime-quiz-9r7.pages.dev)
  let pagesHost = `${appId}.pages.dev`;
  if (accountId) {
    const projRes = await cf(`/accounts/${accountId}/pages/projects/${appId}`);
    if (projRes?.ok && projRes.result?.subdomain) pagesHost = projRes.result.subdomain;
  }
  const defaultUrl = `https://${pagesHost}`;

  // 3. Custom domain SEMPRE — o objetivo é <subdomain>.<baseUrl> (do profile)
  const zoneName = deploy.baseUrl || "gbbragadev.com";
  const customDomain = `${deploy.subdomain}.${zoneName}`;
  {
    log(`▶ custom domain ${customDomain}`);

    // accountId já resolvido no topo (necessário pro wrangler também)
    if (!accountId) {
      log(`✗ sem account ID — via dash: adicione custom domain ${customDomain} no Pages → Settings`);
      return {
        ok: true,
        url: defaultUrl,
        dns: { status: "propagando", note: "custom domain setup manual" },
      };
    }

    // Cria binding domain
    const domainRes = await cf(`/accounts/${accountId}/pages/projects/${appId}/domains`, {
      method: "POST",
      body: { name: customDomain },
    });
    if (!domainRes.ok) {
      log(`✗ adicionar custom domain ${customDomain} falhou (pode já estar ligado)`);
    }

    // Setup DNS CNAME
    const zoneRes = await cf(`/zones?name=${zoneName}`);
    if (!zoneRes.ok) {
      log(`✗ encontrar zone ${zoneName} falhou`);
      return {
        ok: true,
        url: defaultUrl,
        dns: { status: "propagando", recordId: null },
      };
    }

    const zoneId = zoneRes.result?.[0]?.id;
    if (!zoneId) {
      return {
        ok: true,
        url: defaultUrl,
        dns: { status: "propagando" },
      };
    }

    // CNAME → subdomínio REAL do projeto. Se o registro já existe, corrige o conteúdo (PATCH).
    const existingRes = await cf(`/zones/${zoneId}/dns_records?name=${customDomain}`);
    const existing = existingRes?.ok ? existingRes.result?.[0] : null;
    const recordBody = {
      type: "CNAME",
      name: deploy.subdomain,
      content: pagesHost,
      // DNS-only: proxied trava a validação HTTP do Pages (Error 1014 até ativar);
      // o Pages já está na edge da CF, proxy aqui é redundante.
      proxied: false,
    };
    const recordRes = existing
      ? await cf(`/zones/${zoneId}/dns_records/${existing.id}`, { method: "PATCH", body: recordBody })
      : await cf(`/zones/${zoneId}/dns_records`, { method: "POST", body: recordBody });

    if (recordRes.ok) {
      log(`✓ DNS CNAME criado`);
      return {
        ok: true,
        url: `https://${customDomain}`,
        dns: { status: "propagando", recordId: recordRes.result?.id },
      };
    }

    log(`✗ DNS CNAME falhou (pode já existir)`);
    return {
      ok: true,
      url: `https://${customDomain}`,
      dns: { status: "propagando" },
    };
  }

  return { ok: true, url: defaultUrl, dns: { status: "ok" } };
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

/** Vercel deploy */
async function deployToVercel(pipeline, { root, log, limits }) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      ok: false,
      error: "VERCEL_TOKEN não está no ambiente",
      fallbackSteps: [
        "1. Crie token em vercel.com → Account Settings → Tokens",
        "2. Configure VERCEL_TOKEN no ambiente",
        "3. Redeploy",
      ],
    };
  }

  const { appId } = pipeline;
  log(`▶ vercel deploy --prod ${appId}`);
  const deployCmd = `npx --yes vercel@latest deploy --prod --yes --cwd apps/${appId}`;
  const deployRes = run(deployCmd, { VERCEL_TOKEN: token }, limits?.deployBuildTimeoutMs || 10 * 60 * 1000);

  if (!deployRes.ok) {
    return {
      ok: false,
      error: `vercel deploy falhou: ${deployRes.error}`,
      fallbackSteps: [
        "1. Verifique VERCEL_TOKEN em vercel.com",
        "2. Execute `vercel link` em apps/" + appId,
        "3. Redeploy",
      ],
    };
  }

  const match = deployRes.output.match(/https:\/\/[^\s]+/);
  const url = match ? match[0] : `https://${appId}.vercel.app`;
  log(`✓ ${url}`);
  return { ok: true, url, dns: { status: "ok" } };
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

  log(`🚀 deploy ${appId} via ${deploy.target}`);

  try {
    if (deploy.target === "cf-pages") {
      return await deployToCloudflarePages(pipeline, opts);
    }
    if (deploy.target === "gh-pages-path") {
      return await deployToGitHubPages(pipeline, opts);
    }
    if (deploy.target === "vercel") {
      return await deployToVercel(pipeline, opts);
    }
    return {
      ok: false,
      error: `target desconhecido: ${deploy.target}`,
      fallbackSteps: ['Targets suportados: cf-pages | gh-pages-path | vercel'],
    };
  } catch (e) {
    return {
      ok: false,
      error: `exceção não tratada: ${String(e).slice(0, 200)}`,
      fallbackSteps: ["1. Verifique logs do deploy", "2. Teste manualmente via dashboard"],
    };
  }
}
