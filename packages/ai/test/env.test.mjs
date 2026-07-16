import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getProductAiProvider,
  getProductApiKey,
  getProductModel,
  getZaiApiKey,
  getOpenRouterApiKey,
  ZAI_DEFAULT_MODEL,
} from "../src/env.ts";

// trimHistory vive em index.ts (importa SDKs); cobrir só env aqui evita
// ERR_MODULE_NOT_FOUND de imports relativos sem extensão no Node ESM.

test("getProductAiProvider honra PRODUCT_AI_PROVIDER e aliases", () => {
  assert.equal(getProductAiProvider({ PRODUCT_AI_PROVIDER: "openrouter" }), "openrouter");
  assert.equal(getProductAiProvider({ PRODUCT_AI_PROVIDER: "or" }), "openrouter");
  assert.equal(getProductAiProvider({ PRODUCT_AI_PROVIDER: "zai" }), "zai");
  assert.equal(getProductAiProvider({ PRODUCT_AI_PROVIDER: "glm" }), "zai");
});

test("getProductAiProvider auto: prefere ZAI se key presente", () => {
  assert.equal(
    getProductAiProvider({ ZAI_API_KEY: "z-key-long-enough" }),
    "zai"
  );
  assert.equal(
    getProductAiProvider({ OPEN_ROUTER_API_KEY: "or-key-long" }),
    "openrouter"
  );
  assert.equal(getProductAiProvider({}), "zai");
});

test("getZaiApiKey e getOpenRouterApiKey leem aliases", () => {
  assert.equal(getZaiApiKey({ GLM_API_KEY: "glm-key" }), "glm-key");
  assert.equal(getZaiApiKey({ Z_AI_API_KEY: "z2" }), "z2");
  assert.equal(getOpenRouterApiKey({ OPENROUTER_API_KEY: "or2" }), "or2");
  assert.equal(getOpenRouterApiKey({ OPEN_ROUTER_API_KEY: "or1" }), "or1");
});

test("getProductApiKey e getProductModel por provider", () => {
  const env = {
    ZAI_API_KEY: "zk",
    ZAI_MODEL: "glm-5.2",
    OPEN_ROUTER_API_KEY: "ok",
    OPENROUTER_MODEL: "m",
  };
  assert.equal(getProductApiKey(env, "zai"), "zk");
  assert.equal(getProductApiKey(env, "openrouter"), "ok");
  assert.equal(getProductModel(env, "zai"), "glm-5.2");
  assert.equal(getProductModel({ ZAI_API_KEY: "zk" }, "zai"), ZAI_DEFAULT_MODEL);
});
