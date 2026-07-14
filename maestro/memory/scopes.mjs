const APP_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function resolveMemoryScope({ appId } = {}) {
  if (appId === undefined || appId === null || appId === "") {
    return { workspace: "forge", project: "factory" };
  }
  if (typeof appId !== "string" || !APP_ID_RE.test(appId)) {
    throw new Error("appId inválido para o escopo de memória.");
  }
  return { workspace: "forge", project: `app-${appId}` };
}
