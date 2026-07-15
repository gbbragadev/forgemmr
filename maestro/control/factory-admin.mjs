import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  TEAM_ROLES,
  activateProfile,
  buildProfileMd,
  composeTeam,
  importActiveProfile,
  listProfiles,
  slugify,
} from "../engine.mjs";
import { createBlueprintAdmin } from "./blueprint-admin.mjs";

export const PROVIDER_CATALOG = [
  {
    id: "grok",
    cli: "grok",
    face: "⚡",
    color: "#22d3ee",
    loginArgs: ["login"],
    efforts: ["high", "medium", "low"],
    models: [{ id: "default", label: "Grok 4.5" }],
  },
  {
    id: "codex",
    cli: "codex",
    face: "⚙️",
    color: "#38bdf8",
    loginArgs: ["login"],
    efforts: ["medium", "high", "xhigh", "max", "low"],
    models: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    ],
  },
  {
    id: "claude",
    cli: "claude",
    face: "🎨",
    color: "#f59e0b",
    loginArgs: ["auth", "login"],
    efforts: ["high", "xhigh", "medium", "low"],
    models: [
      { id: "claude-fable-5", label: "Claude Fable 5" },
      { id: "opus", label: "Claude Opus" },
      { id: "sonnet", label: "Claude Sonnet" },
    ],
  },
  {
    id: "glm",
    cli: "claude",
    envName: "glm",
    face: "🖌️",
    color: "#00b8a9",
    loginArgs: null,
    efforts: ["max", "high", "medium", "low"],
    models: [{ id: "opus", label: "GLM 5.2" }],
  },
  {
    id: "gemini",
    cli: "gemini",
    executable: "agy",
    face: "✨",
    color: "#a78bfa",
    loginArgs: null,
    efforts: ["medium"],
    models: [
      { id: "default", label: "Antigravity (automático)" },
      { id: "Gemini 3.1 Pro (High)", label: "Gemini 3.1 Pro (High)" },
      { id: "Gemini 3.1 Pro (Low)", label: "Gemini 3.1 Pro (Low)" },
      { id: "Gemini 3.5 Flash (High)", label: "Gemini 3.5 Flash (High)" },
      { id: "Gemini 3.5 Flash (Medium)", label: "Gemini 3.5 Flash (Medium)" },
      { id: "Gemini 3.5 Flash (Low)", label: "Gemini 3.5 Flash (Low)" },
    ],
  },
];

function safeOneLine(value, label, { min = 1, max = 80 } = {}) {
  const text = String(value || "").replace(/[\r\n`]+/g, " ").trim();
  if (text.length < min || text.length > max) throw new Error(`${label} precisa ter ${min}–${max} caracteres`);
  return text;
}

function findExecutable(command, { env, platform }) {
  const pathValue = env.PATH || env.Path || env.path || "";
  const extensions = platform === "win32"
    ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const names = platform === "win32" && path.extname(command)
    ? [command]
    : [command, ...extensions.map((extension) => `${command}${extension.toLowerCase()}`), ...extensions.map((extension) => `${command}${extension.toUpperCase()}`)];
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      try {
        fs.accessSync(candidate, platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
        return candidate;
      } catch {
        // tenta o próximo nome/PATH
      }
    }
  }
  return null;
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, file);
}

function readRoster(root) {
  const file = path.join(root, "maestro", "roster.json");
  const roster = JSON.parse(fs.readFileSync(file, "utf8"));
  roster.players = Array.isArray(roster.players) ? roster.players : [];
  roster.teams = roster.teams && typeof roster.teams === "object" ? roster.teams : {};
  return { file, roster };
}

export function createFactoryAdmin({
  root,
  env = process.env,
  platform = process.platform,
  spawnImpl = spawn,
} = {}) {
  const blueprints = createBlueprintAdmin({ root });

  function blueprintDraft(input) {
    let jobs = input?.jobs;
    if (typeof jobs === "string") {
      const text = jobs.trim();
      jobs = text.startsWith("[")
        ? JSON.parse(text)
        : text.split(/[\r\n,]+/).map((job) => job.trim()).filter(Boolean);
    }
    let jobSpecs = input?.jobSpecs;
    if (typeof jobSpecs === "string") jobSpecs = JSON.parse(jobSpecs || "{}");
    return { name: input?.name, title: input?.title, purpose: input?.purpose, jobs, jobSpecs };
  }

  function providerState(definition) {
    const executable = findExecutable(definition.executable || definition.cli, { env, platform });
    return {
      id: definition.id,
      cli: definition.cli,
      installed: Boolean(executable),
      executable,
      loginSupported: Boolean(definition.loginArgs),
      models: definition.models,
      efforts: definition.efforts,
    };
  }

  return {
    listProfiles: () => listProfiles(root),
    createProfile(input) {
      const name = safeOneLine(input?.name, "nome", { min: 2, max: 60 });
      const slug = slugify(name) || "default";
      const i18nRule = input?.i18nRule || "single";
      if (!["single", "bilingual"].includes(i18nRule)) throw new Error("regra de idioma inválida");
      const profile = buildProfileMd({
        name,
        namespace: safeOneLine(input?.namespace || "@forge", "namespace", { min: 2, max: 40 }),
        niche: safeOneLine(input?.niche || "generic", "nicho", { min: 2, max: 40 }),
        baseUrl: safeOneLine(input?.baseUrl || "example.com", "domínio", { min: 3, max: 80 }),
        i18nRule,
        context: String(input?.context || "").slice(0, 5000),
      });
      const file = path.join(root, "profiles", slug, "profile.md");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, profile, "utf8");
      activateProfile(root, slug);
      return { slug, active: true };
    },
    activateProfile(slug) {
      return { slug: activateProfile(root, safeOneLine(slug, "slug", { max: 60 })), active: true };
    },
    importActiveProfile() {
      const slug = importActiveProfile(root);
      return { slug, imported: Boolean(slug) };
    },
    listBlueprints: (options) => blueprints.list(options),
    saveBlueprint(input) {
      return blueprints.save(blueprintDraft(input), {
        id: input?.id || undefined,
        reason: input?.reason || "studio-save",
      });
    },
    deriveBlueprint(input) {
      return blueprints.derive(input?.source, blueprintDraft(input), {
        reason: input?.reason || "studio-derive",
      });
    },
    archiveBlueprint: (id) => blueprints.archive(id),
    restoreBlueprint: (id) => blueprints.restore(id),
    migrateBlueprint: (id) => blueprints.migrate(id),
    saveTeam(input) {
      const name = safeOneLine(input?.name, "nome do time", { min: 2, max: 60 });
      const emoji = safeOneLine(input?.emoji || "🎼", "símbolo", { max: 8 });
      if (!Array.isArray(input?.members) || input.members.length < 1 || input.members.length > 8) {
        throw new Error("time precisa de 1–8 músicos");
      }
      const roleIds = new Set(TEAM_ROLES.map((role) => role.id));
      const musicians = input.members.map((member, index) => {
        const provider = PROVIDER_CATALOG.find((candidate) => candidate.id === member?.provider);
        if (!provider) throw new Error(`músico ${index + 1}: provider desconhecido`);
        const model = provider.models.find((candidate) => candidate.id === member.model);
        if (!model) throw new Error(`músico ${index + 1}: modelo inválido`);
        if (!provider.efforts.includes(member.effort)) throw new Error(`músico ${index + 1}: effort inválido`);
        if (!Array.isArray(member.roles) || !member.roles.length || member.roles.some((role) => !roleIds.has(role))) {
          throw new Error(`músico ${index + 1}: papéis inválidos`);
        }
        return {
          provider: provider.id,
          cli: provider.cli,
          ...(provider.envName ? { env: provider.envName } : {}),
          model: model.id,
          modelLabel: model.label,
          effort: member.effort,
          roles: [...new Set(member.roles)],
          face: provider.face,
          color: provider.color,
        };
      });
      const composed = composeTeam(name, musicians, emoji);
      const fallbackPolicy = input?.fallbackPolicy || "fallback";
      if (!["strict", "fallback"].includes(fallbackPolicy)) throw new Error("política de fallback inválida");
      composed.team.fallbackPolicy = fallbackPolicy;
      if (fallbackPolicy === "strict") {
        composed.team.fallbacks = Object.fromEntries(composed.players.map((player) => [player.id, []]));
      }
      const { file, roster } = readRoster(root);
      roster.players = roster.players.filter((player) => !(player.generated && player.id.startsWith(`${composed.teamId}-`)));
      const players = new Map(roster.players.map((player) => [player.id, player]));
      for (const player of composed.players) players.set(player.id, player);
      roster.players = [...players.values()];
      roster.teams[composed.teamId] = composed.team;
      writeJsonAtomic(file, roster);
      return composed;
    },
    listProviders() {
      return PROVIDER_CATALOG.map(providerState);
    },
    startProviderLogin(providerId) {
      const definition = PROVIDER_CATALOG.find((provider) => provider.id === providerId);
      if (!definition) throw new Error(`provider desconhecido: ${providerId}`);
      const state = providerState(definition);
      if (!state.installed) throw new Error(`${providerId} não está instalado nesta máquina`);
      if (!definition.loginArgs) throw new Error(`${providerId} não possui login interativo allowlisted`);
      const child = spawnImpl(state.executable, definition.loginArgs.slice(), {
        cwd: root,
        env: { ...process.env, ...env },
        shell: false,
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      });
      child.unref?.();
      return { provider: providerId, started: true, pid: child.pid || null };
    },
  };
}
