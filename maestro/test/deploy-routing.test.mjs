import { test } from "node:test";
import assert from "node:assert/strict";

import { applyDeployDestination, applyDeployFeedback } from "../engine.mjs";

function pipeline(capability = "chat") {
  return {
    appId: "pmoc-acceptance-gate",
    capability,
    deploy: {
      target: "cf-pages",
      autoTarget: true,
      subdomain: "pmoc-acceptance-gate",
      baseUrl: "example.com",
      url: "https://old.example.com",
      dns: { status: "ok" },
    },
  };
}

test("domínio completo vira subdomain + baseUrl, não um slug único", () => {
  const deploy = pipeline().deploy;

  const result = applyDeployDestination(deploy, "https://pmco.gbbragadev.com/alguma-rota");

  assert.equal(result.changed, true);
  assert.equal(deploy.subdomain, "pmco");
  assert.equal(deploy.baseUrl, "gbbragadev.com");
  assert.equal(deploy.url, null);
  assert.deepEqual(deploy.dns, { status: "pending" });
});

test("domínio raiz troca baseUrl e preserva o subdomínio já escolhido", () => {
  const deploy = pipeline().deploy;
  deploy.subdomain = "pmco";

  applyDeployDestination(deploy, "gbbragadev.com");

  assert.equal(deploy.subdomain, "pmco");
  assert.equal(deploy.baseUrl, "gbbragadev.com");
});

test("feedback de deploy combina domínio e Cloudflare conforme a capability", () => {
  const chat = pipeline("chat");
  const chatResult = applyDeployFeedback(chat, "deploy em pmco.gbbragadev.com no CF", { deployContext: true });

  assert.equal(chatResult.changed, true);
  assert.equal(chat.deploy.target, "cf-workers");
  assert.equal(chat.deploy.autoTarget, false);
  assert.equal(chat.deploy.subdomain, "pmco");
  assert.equal(chat.deploy.baseUrl, "gbbragadev.com");

  const staticApp = pipeline("static");
  applyDeployFeedback(staticApp, "publicar no Cloudflare em landing.gbbragadev.com", { deployContext: true });
  assert.equal(staticApp.deploy.target, "cf-pages");
});

test("feedback fora de deploy não altera roteamento por acidente", () => {
  const current = pipeline("chat");
  const before = structuredClone(current.deploy);

  const result = applyDeployFeedback(current, "deixe o texto do relatório mais claro");

  assert.equal(result.changed, false);
  assert.deepEqual(current.deploy, before);
});
