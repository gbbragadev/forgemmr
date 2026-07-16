import { activateProfile } from "../engine.mjs";

/** Handlers explícitos: nenhum valor do browser vira nome de função ou comando. */
export function createEngineActionHandlers({ root, engineManager, factoryAdmin, lifecycleManager, forgeOperator }) {
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
        controlMode: input.controlMode || "full_auto",
      });
    },
    "pipeline.feedback": ({ appId, input }) =>
      engineManager.startFeedback({ appId, feedbackText: input.feedback }),
    "pipeline.simulate": ({ appId, input }) =>
      engineManager.startSimulation({ appId, team: input.team, dryRun: Boolean(input.dryRun), controlMode: input.controlMode }),
    "pipeline.ship": ({ appId, input }) =>
      engineManager.startShip({
        appId,
        target: input?.target,
        subdomain: input?.subdomain,
        controlMode: input?.controlMode || "full_auto",
        dryRun: Boolean(input?.dryRun),
      }),
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
    "blueprint.save": ({ input }) => factoryAdmin.saveBlueprint(input),
    "blueprint.derive": ({ input }) => factoryAdmin.deriveBlueprint(input),
    "blueprint.archive": ({ input }) => factoryAdmin.archiveBlueprint(input.blueprint),
    "blueprint.restore": ({ input }) => factoryAdmin.restoreBlueprint(input.blueprint),
    "blueprint.migrate": ({ input }) => factoryAdmin.migrateBlueprint(input.blueprint),
    "team.save": ({ input }) => factoryAdmin.saveTeam(input),
    "providers.refresh": () => factoryAdmin.listProviders(),
    "provider.login": ({ input }) => factoryAdmin.startProviderLogin(input.provider),
    "operator.ingest": ({ input }) => forgeOperator.ingest(input),
    "operator.evolve": ({ input }) => forgeOperator.evolve(input),
    "p4.record": ({ appId, input }) => lifecycleManager.recordP4({ appId, ...input }),
    "p5.decide": ({ appId, input }) => lifecycleManager.decideP5({ appId, ...input }),
  };
}
