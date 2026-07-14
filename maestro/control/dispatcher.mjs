import crypto from "node:crypto";

import { makeRedactor } from "../adapters.mjs";

const REQUEST_FIELDS = new Set(["actionId", "appId", "input", "stateVersion", "idempotencyKey", "confirmation"]);
const CONFIRMATION_RISKS = new Set(["external", "destructive"]);

export class ControlError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "ControlError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(request) {
  return crypto.createHash("sha256").update(JSON.stringify(stable({
    actionId: request.actionId,
    appId: request.appId || null,
    input: request.input || {},
    stateVersion: request.stateVersion,
  }))).digest("hex");
}

function sanitize(value, redact) {
  return JSON.parse(redact(JSON.stringify(value)));
}

function findAction(snapshot, actionId, appId) {
  const scope = appId ? `pipeline:${appId}` : "factory";
  return snapshot.actions.find((action) => action.id === actionId && action.scope === scope) || null;
}

function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new ControlError(400, "request_invalid", "O corpo da ação precisa ser um objeto JSON.");
  }
  for (const key of Object.keys(request)) {
    if (!REQUEST_FIELDS.has(key)) throw new ControlError(400, "request_unknown_field", `Campo desconhecido: ${key}`);
  }
  if (typeof request.actionId !== "string" || !request.actionId) throw new ControlError(400, "action_required", "actionId é obrigatório.");
  if (request.appId !== null && request.appId !== undefined && !/^[a-z0-9-]+$/.test(request.appId)) {
    throw new ControlError(400, "app_invalid", "appId inválido.");
  }
  if (!request.input || typeof request.input !== "object" || Array.isArray(request.input)) {
    throw new ControlError(400, "input_invalid", "input precisa ser um objeto.");
  }
  if (typeof request.stateVersion !== "string" || !request.stateVersion) throw new ControlError(400, "state_version_required", "stateVersion é obrigatório.");
  if (typeof request.idempotencyKey !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(request.idempotencyKey)) {
    throw new ControlError(400, "idempotency_key_invalid", "idempotencyKey inválida.");
  }
}

function validateInput(action, input) {
  const allowed = new Map((action.fields || []).map((field) => [field.name, field]));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new ControlError(400, "input_unknown_field", `Campo não permitido para ${action.id}: ${key}`);
  }
  for (const field of allowed.values()) {
    const value = input[field.name];
    if (field.required && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) {
      throw new ControlError(400, "input_required", `${field.label || field.name} é obrigatório.`);
    }
    if (value === undefined || value === null) continue;
    if (field.type === "team-members") {
      if (!Array.isArray(value)) throw new ControlError(400, "input_type", `${field.name} precisa ser uma lista.`);
      continue;
    }
    if (field.type === "checkbox" && typeof value !== "boolean") {
      throw new ControlError(400, "input_type", `${field.name} precisa ser booleano.`);
    }
    if (field.type !== "checkbox" && typeof value !== "string") {
      throw new ControlError(400, "input_type", `${field.name} precisa ser texto.`);
    }
    if (field.options?.length && !field.options.includes(value)) {
      throw new ControlError(400, "input_option", `${field.name} fora das opções permitidas.`);
    }
  }
}

export function createControlDispatcher({
  getSnapshot,
  operations,
  audit,
  confirmations,
  handlers,
  emitEvent = () => {},
  now = () => Date.now(),
  randomUUID = crypto.randomUUID,
}) {
  const redact = makeRedactor();

  function issueConfirmation({ actionId, appId = null, stateVersion }) {
    const snapshot = getSnapshot();
    if (snapshot.version !== stateVersion) {
      throw new ControlError(409, "state_stale", "O estado mudou; revise a ação antes de confirmar.", { currentVersion: snapshot.version });
    }
    const action = findAction(snapshot, actionId, appId);
    if (!action) throw new ControlError(404, "action_unknown", "Ação não disponível para este escopo.");
    if (!action.enabled) throw new ControlError(409, "action_disabled", action.blockedReason || "Ação indisponível.");
    if (!CONFIRMATION_RISKS.has(action.risk)) {
      throw new ControlError(400, "confirmation_not_required", "Esta ação não exige confirmação reforçada.");
    }
    return confirmations.issue({ actionId, appId, stateVersion });
  }

  async function execute(request) {
    validateRequest(request);
    const requestFingerprint = fingerprint(request);
    const previous = operations.findByIdempotencyKey(request.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== requestFingerprint) {
        throw new ControlError(409, "idempotency_conflict", "A mesma idempotencyKey já foi usada com outro payload.");
      }
      return previous;
    }

    const snapshot = getSnapshot();
    if (snapshot.version !== request.stateVersion) {
      throw new ControlError(409, "state_stale", "O estado da central mudou; recarregue antes de executar.", { currentVersion: snapshot.version });
    }
    const action = findAction(snapshot, request.actionId, request.appId);
    if (!action) throw new ControlError(404, "action_unknown", "Ação não registrada para este escopo.");
    if (!action.enabled) throw new ControlError(409, "action_disabled", action.blockedReason || "Ação indisponível.");
    validateInput(action, request.input);

    if (
      CONFIRMATION_RISKS.has(action.risk) &&
      !confirmations.consume({
        nonce: request.confirmation,
        actionId: request.actionId,
        appId: request.appId,
        stateVersion: request.stateVersion,
      })
    ) {
      throw new ControlError(409, request.confirmation ? "confirmation_invalid" : "confirmation_required", "Confirmação ausente, expirada ou vinculada a outro estado.");
    }

    const handler = handlers[request.actionId];
    if (typeof handler !== "function") throw new ControlError(501, "action_not_implemented", "Ação registrada sem handler allowlisted.");

    const createdAt = new Date(now()).toISOString();
    let operation = {
      id: randomUUID(),
      idempotencyKey: request.idempotencyKey,
      fingerprint: requestFingerprint,
      actionId: request.actionId,
      appId: request.appId || null,
      risk: action.risk,
      status: "running",
      createdAt,
      updatedAt: createdAt,
    };
    operations.put(operation);
    emitEvent("operation", operation);

    try {
      const result = await handler({ appId: request.appId || null, input: structuredClone(request.input), action, operation });
      operation = {
        ...operation,
        status: "succeeded",
        result: sanitize(result ?? { ok: true }, redact),
        updatedAt: new Date(now()).toISOString(),
      };
      operations.put(operation);
      audit.append({ operationId: operation.id, actionId: operation.actionId, appId: operation.appId, risk: operation.risk, status: operation.status });
      emitEvent("operation", operation);
      return operation;
    } catch (error) {
      const message = redact(error instanceof Error ? error.message : String(error));
      operation = { ...operation, status: "failed", error: message, updatedAt: new Date(now()).toISOString() };
      operations.put(operation);
      audit.append({ operationId: operation.id, actionId: operation.actionId, appId: operation.appId, risk: operation.risk, status: operation.status, error: message });
      emitEvent("operation", operation);
      throw new ControlError(409, "action_failed", message, { operationId: operation.id });
    }
  }

  return {
    execute,
    issueConfirmation,
    getOperation: (id) => operations.get(id),
  };
}
