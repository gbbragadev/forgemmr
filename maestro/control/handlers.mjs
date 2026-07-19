/** Handlers explícitos: nenhum valor do browser vira nome de função ou comando. */
export function createEngineActionHandlers({ root, engineManager, factoryAdmin, lifecycleManager, alwaysOnDeployManager, forgeOperator, discoveryWorkspace, chatController, playbookService }) {
  const json = (value, fallback) => {
    if (value === undefined || value === null || value === "") return fallback;
    return typeof value === "string" ? JSON.parse(value) : structuredClone(value);
  };
  return {
    "pipeline.start": () => { throw new Error("Novos produtos exigem discovery.build.start."); },
    "room.create": ({ input }) => discoveryWorkspace.createRoom(input),
    "room.message": ({ input }) => ({
      ...discoveryWorkspace.appendMessage({ ...input, executor: input.executor || null, refs: [] }),
      roomId: input.roomId,
    }),
    "thesis.propose": ({ input }) => discoveryWorkspace.proposeThesis({ roomId: input.roomId, sourceMessageIds: json(input.sourceMessageIds, []), draft: json(input.draft, {}) }),
    "thesis.confirm": ({ input }) => discoveryWorkspace.confirmThesis(input),
    "validation.start": ({ input }) => discoveryWorkspace.startValidation(input),
    "evidence.record": ({ input }) => discoveryWorkspace.recordEvidence({ thesisId: input.thesisId, evidence: json(input.evidence, {}) }),
    "evidence.verify": ({ input }) => discoveryWorkspace.verifyEvidence(input),
    "experiment.create": ({ input }) => discoveryWorkspace.createExperiment({ thesisId: input.thesisId, experiment: json(input.experiment, {}) }),
    "experiment.complete": ({ input }) => discoveryWorkspace.completeExperiment({ ...input, evidenceIds: json(input.evidenceIds, []) }),
    "build.propose": ({ input }) => ({
      ...discoveryWorkspace.proposeBuild({ ...input, brief: json(input.brief, {}) }),
      thesisId: input.thesisId,
    }),
    "discovery.build.start": ({ input }) => discoveryWorkspace.startBuild({ ...input, startOptions: json(input.startOptions, {}) }),
    "build.complete": ({ input }) => discoveryWorkspace.completeBuild(input),
    "build.terminate": ({ input }) => discoveryWorkspace.terminateBuild(input),
    "experiment.validation_asset.attach": ({ input }) => discoveryWorkspace.attachValidationAsset({ ...input, asset: json(input.asset, {}) }),
    "braga.prepare": ({ input }) => discoveryWorkspace.prepareBragaHandoff({
      ...input,
      assets: json(input.assets, []),
      events: json(input.events, []),
      baseline: json(input.baseline, {}),
      budget: json(input.budget, {}),
      legalRestrictions: json(input.legalRestrictions, []),
    }),
    "braga.export": ({ input }) => discoveryWorkspace.exportBragaHandoff(input),
    "acquisition.start": ({ input }) => discoveryWorkspace.startAcquisition(input),
    "acquisition.complete": ({ input }) => discoveryWorkspace.completeAcquisition(input),
    "acquisition.terminate": ({ input }) => discoveryWorkspace.terminateAcquisition(input),
    "spend.approve": ({ input }) => {
      if (input.confirmed !== true) throw new Error("confirmação explícita do gasto é obrigatória");
      const approval = { ...input };
      delete approval.confirmed;
      return discoveryWorkspace.approveSpend(approval);
    },
    "braga.return.import": ({ input }) => discoveryWorkspace.importBragaReturn({ ...input, result: json(input.result, {}) }),
    "chat.send": ({ input }) => chatController.send(input),
    "chat.stop": ({ input }) => chatController.stop(input),
    "playbook.run": ({ input }) => playbookService.start({ ...input, input: json(input.input, {}) }),
    "playbook.import": ({ input }) => playbookService.importOutput(input),
    "playbook.revise": ({ input }) => playbookService.proposeRevision(input),
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
    "always-on.prepare": ({ appId, input }) => alwaysOnDeployManager.prepare({ appId, ...input }),
    "always-on.confirm": ({ appId, input }) => alwaysOnDeployManager.confirm({ appId, ...input }),
    "always-on.publish.record": ({ appId, input }) => alwaysOnDeployManager.recordPublished({ appId, ...input }),
    "always-on.verify": ({ appId, input }) => alwaysOnDeployManager.verify({ appId, ...input }),
  };
}
