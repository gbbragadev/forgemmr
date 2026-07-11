import { test } from "node:test";
import assert from "node:assert/strict";

// makeRedactor lê process.env na criação — setar ANTES do import não é preciso
// (import é estático), então setamos antes de CHAMAR makeRedactor.
import { makeRedactor } from "../adapters.mjs";

test("redactor: env com cara de credencial fora da lista fixa é mascarada (pattern-based)", () => {
  process.env.NOVO_PROVIDER_API_KEY = "abcdefgh1234-secreta";
  const redact = makeRedactor();
  const out = redact("erro: chave abcdefgh1234-secreta rejeitada");
  assert.ok(!out.includes("abcdefgh1234-secreta"), "valor deveria estar mascarado");
  assert.ok(out.includes("[redacted]"));
  delete process.env.NOVO_PROVIDER_API_KEY;
});

test("redactor: token de escrita CF (sufixo _ADM) é mascarado", () => {
  process.env.CF_GBBRAGADEV_ADM = "cf-token-de-escrita-12345";
  const redact = makeRedactor();
  assert.ok(!redact("token: cf-token-de-escrita-12345").includes("cf-token-de-escrita-12345"));
  delete process.env.CF_GBBRAGADEV_ADM;
});

test("redactor: valor curto não vira máscara-tudo e env sem cara de segredo fica intacta", () => {
  process.env.FOO_TOKEN = "1"; // curto demais (< 8) — não pode mascarar todo "1" dos logs
  process.env.MEU_DIRETORIO = "valor-comum-com-mais-de-8-chars"; // nome não casa com padrão
  const redact = makeRedactor();
  assert.equal(redact("linha 1 com 1 número"), "linha 1 com 1 número");
  assert.ok(redact("caminho: valor-comum-com-mais-de-8-chars").includes("valor-comum-com-mais-de-8-chars"));
  delete process.env.FOO_TOKEN;
  delete process.env.MEU_DIRETORIO;
});

test("redactor: segredo contido em outro não deixa resíduo (maiores primeiro)", () => {
  process.env.AAA_API_KEY = "chave-curta";
  process.env.BBB_API_KEY = "prefixo-chave-curta-sufixo";
  const redact = makeRedactor();
  const out = redact("x prefixo-chave-curta-sufixo y chave-curta z");
  assert.ok(!out.includes("chave-curta"));
  delete process.env.AAA_API_KEY;
  delete process.env.BBB_API_KEY;
});
