import crypto from "node:crypto";

export function createConfirmationManager({
  now = () => Date.now(),
  ttlMs = 2 * 60 * 1000,
  randomBytes = crypto.randomBytes,
} = {}) {
  const pending = new Map();

  function issue({ actionId, appId = null, stateVersion }) {
    if (!actionId || !stateVersion) throw new Error("actionId e stateVersion são obrigatórios");
    const nonce = randomBytes(24).toString("hex");
    const issuedAt = now();
    const record = {
      nonce,
      actionId,
      appId: appId || null,
      stateVersion,
      issuedAt,
      expiresAt: issuedAt + ttlMs,
    };
    pending.set(nonce, record);
    return { nonce, expiresAt: new Date(record.expiresAt).toISOString() };
  }

  function consume({ nonce, actionId, appId = null, stateVersion }) {
    const record = pending.get(String(nonce || ""));
    if (!record) return false;
    pending.delete(record.nonce);
    if (record.expiresAt < now()) return false;
    return (
      record.actionId === actionId &&
      record.appId === (appId || null) &&
      record.stateVersion === stateVersion
    );
  }

  return { issue, consume };
}
