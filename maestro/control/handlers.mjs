import { activateProfile } from "../engine.mjs";

/** Handlers explícitos: nenhum valor do browser vira nome de função ou comando. */
export function createEngineActionHandlers({ root, engineManager, factoryAdmin }) {
  return {
    "pipeline.start": ({ input }) => {
      if (input.profile) activateProfile(root, input.profile);
      return engineManager.start({
        idea: input.idea,
        team: input.team,
        blueprint: input.blueprint || "generic",
        capability: input.capability === "auto" ? undefined : input.capability,
        target: input.target === "auto" ? undefined : input.target,
        dryRun: Boolean(input.dryRun),
        controlMode: input.controlMode || "autopilot_to_gate",
      });
    },
    "pipeline.feedback": ({ appId, input }) =>
      engineManager.startFeedback({ appId, feedbackText: input.feedback }),
    "gate.decide": ({ appId, input }) =>
      engineManager.decide(appId, input.gateId, input.choice, input.feedback),
    "pipeline.stop": ({ appId }) => engineManager.stop(appId),
    "pipeline.resume": ({ appId }) => engineManager.resume(appId),
    "pipeline.control_mode": ({ appId, input }) =>
      engineManager.setControlMode(appId, input.mode),
    "pipeline.continue": ({ appId }) => engineManager.continuePipeline(appId),
    "pipeline.target": ({ appId, input }) =>
      engineManager.setTarget(appId, input.target, input.subdomain),
    "pipeline.kill": ({ appId }) => engineManager.kill(appId),
    "pipeline.remove": ({ appId, input }) =>
      engineManager.removeApp(appId, { force: Boolean(input.force) }),
    "profile.create": ({ input }) => factoryAdmin.createProfile(input),
    "profile.activate": ({ input }) => factoryAdmin.activateProfile(input.slug),
    "profile.import": () => factoryAdmin.importActiveProfile(),
    "team.save": ({ input }) => factoryAdmin.saveTeam(input),
    "providers.refresh": () => factoryAdmin.listProviders(),
    "provider.login": ({ input }) => factoryAdmin.startProviderLogin(input.provider),
  };
}
