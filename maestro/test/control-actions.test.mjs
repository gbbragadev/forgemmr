import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createControlDispatcher, ControlError } from "../control/dispatcher.mjs";
import { createOperationStore } from "../control/store.mjs";
import { createAuditLog } from "../control/audit.mjs";
import { createConfirmationManager } from "../control/confirmations.mjs";

function rootFixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-control-actions-"));
}

function descriptor({ id, scope = "factory", risk = "safe", fields = [] }) {
  return {
    id,
    scope,
    label: id,
    description: id,
    risk,
    enabled: true,
    blockedReason: null,
    expectedEffect: "efeito",
    fields,
  };
}

function fixture({ actions, handlers, now = () => Date.parse("2026-07-14T12:00:00.000Z") }) {
  const root = rootFixture();
  const operations = createOperationStore({ root });
  const audit = createAuditLog({ root, now });
  const confirmations = createConfirmationManager({ now, randomBytes: () => Buffer.from("a".repeat(32)) });
  const dispatcher = createControlDispatcher({
    getSnapshot: () => ({ version: "state-v1", actions }),
    operations,
    audit,
    confirmations,
    handlers,
    now,
    randomUUID: () => "operation-1",
  });
  return { root, operations, audit, confirmations, dispatcher };
}

async function expectControlError(promise, status, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ControlError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test("ação segura é idempotente e repetição conflitante falha fechada", async () => {
  let calls = 0;
  const action = descriptor({
    id: "pipeline.start",
    fields: [{ name: "idea", label: "Ideia", type: "textarea", required: true, options: [] }],
  });
  const fx = fixture({
    actions: [action],
    handlers: {
      "pipeline.start": async ({ input }) => {
        calls++;
        return { appId: input.idea };
      },
    },
  });
  try {
    const request = {
      actionId: "pipeline.start",
      appId: null,
      input: { idea: "probe" },
      stateVersion: "state-v1",
      idempotencyKey: "idem-12345678",
      confirmation: null,
    };
    const first = await fx.dispatcher.execute(request);
    const repeated = await fx.dispatcher.execute(request);
    assert.equal(first.id, "operation-1");
    assert.equal(first.status, "succeeded");
    assert.deepEqual(first.result, { appId: "probe" });
    assert.deepEqual(repeated, first);
    assert.equal(calls, 1);

    await expectControlError(
      fx.dispatcher.execute({ ...request, input: { idea: "outra" } }),
      409,
      "idempotency_conflict",
    );
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test("estado obsoleto, ação desconhecida e campos extras são rejeitados", async () => {
  const action = descriptor({ id: "pipeline.start", fields: [] });
  const fx = fixture({ actions: [action], handlers: { "pipeline.start": () => ({ ok: true }) } });
  const base = {
    actionId: "pipeline.start",
    appId: null,
    input: {},
    stateVersion: "state-v1",
    idempotencyKey: "idem-12345678",
    confirmation: null,
  };
  try {
    await expectControlError(fx.dispatcher.execute({ ...base, stateVersion: "antigo" }), 409, "state_stale");
    await expectControlError(fx.dispatcher.execute({ ...base, actionId: "shell.run" }), 404, "action_unknown");
    await expectControlError(fx.dispatcher.execute({ ...base, input: { command: "rm" } }), 400, "input_unknown_field");
    await expectControlError(fx.dispatcher.execute({ ...base, extra: true }), 400, "request_unknown_field");
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test("campo json aceita objeto tipado ou texto JSON válido e rejeita texto inválido", async () => {
  const action = descriptor({ id: "thesis.propose", fields: [{ name: "draft", label: "Tese", type: "json", required: true, options: [] }] });
  const seen = [];
  const fx = fixture({ actions: [action], handlers: { "thesis.propose": ({ input }) => (seen.push(input.draft), { ok: true }) } });
  try {
    const base = { actionId: action.id, appId: null, stateVersion: "state-v1", confirmation: null };
    await fx.dispatcher.execute({ ...base, input: { draft: { buyer: "PMEs" } }, idempotencyKey: "idem-json-object" });
    await fx.dispatcher.execute({ ...base, input: { draft: "{\"buyer\":\"PMEs\"}" }, idempotencyKey: "idem-json-string" });
    assert.deepEqual(seen, [{ buyer: "PMEs" }, "{\"buyer\":\"PMEs\"}"]);
    await expectControlError(
      fx.dispatcher.execute({ ...base, input: { draft: "{" }, idempotencyKey: "idem-json-invalid" }),
      400,
      "input_type",
    );
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test("ação destrutiva exige nonce preso a ação, app e versão, de uso único", async () => {
  let removals = 0;
  const action = descriptor({ id: "pipeline.remove", scope: "pipeline:probe", risk: "destructive" });
  const fx = fixture({
    actions: [action],
    handlers: { "pipeline.remove": () => ({ ok: true, count: ++removals }) },
  });
  const request = {
    actionId: "pipeline.remove",
    appId: "probe",
    input: {},
    stateVersion: "state-v1",
    idempotencyKey: "idem-remove-1",
    confirmation: null,
  };
  try {
    await expectControlError(fx.dispatcher.execute(request), 409, "confirmation_required");

    const wrong = fx.confirmations.issue({ actionId: "pipeline.remove", appId: "other", stateVersion: "state-v1" });
    await expectControlError(fx.dispatcher.execute({ ...request, confirmation: wrong.nonce }), 409, "confirmation_invalid");

    const valid = fx.dispatcher.issueConfirmation({ actionId: "pipeline.remove", appId: "probe", stateVersion: "state-v1" });
    const result = await fx.dispatcher.execute({ ...request, confirmation: valid.nonce });
    assert.equal(result.status, "succeeded");
    assert.equal(removals, 1);

    await expectControlError(
      fx.dispatcher.execute({ ...request, idempotencyKey: "idem-remove-2", confirmation: valid.nonce }),
      409,
      "confirmation_invalid",
    );
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test("auditoria e erro persistidos são redigidos", async () => {
  const secret = "audit-secret-123456789";
  process.env.CONTROL_AUDIT_SECRET = secret;
  const action = descriptor({ id: "pipeline.start", fields: [] });
  const fx = fixture({
    actions: [action],
    handlers: { "pipeline.start": () => { throw new Error(`falhou ${secret}`); } },
  });
  try {
    await expectControlError(
      fx.dispatcher.execute({
        actionId: "pipeline.start",
        appId: null,
        input: {},
        stateVersion: "state-v1",
        idempotencyKey: "idem-audit-1",
        confirmation: null,
      }),
      409,
      "action_failed",
    );
    const operation = fx.operations.get("operation-1");
    assert.equal(operation.status, "failed");
    assert.doesNotMatch(operation.error, new RegExp(secret));
    const rawAudit = fs.readFileSync(path.join(fx.root, ".control", "audit.jsonl"), "utf8");
    assert.doesNotMatch(rawAudit, new RegExp(secret));
    assert.match(rawAudit, /\[redacted\]/i);
  } finally {
    delete process.env.CONTROL_AUDIT_SECRET;
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});
