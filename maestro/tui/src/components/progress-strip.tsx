import React from 'react';
import {Box,Text} from 'ink';
import type {CatalogAction,Snapshot} from '../client.js';

type Progress = {
	index: number;
	total: number;
	label: string;
	gate: string;
	requirement: string;
	nextActionId: string;
};

function actionLabel(snapshot: Snapshot | null, actionId: string, appId: string | null) {
	if (!actionId) return 'Nenhuma — fluxo concluído';
	const scopes = new Set(['factory',...(appId ? [`pipeline:${appId}`] : [])]);
	const action = snapshot?.actions.find(item=>item.id===actionId&&scopes.has(item.scope));
	if (!action) return actionId;
	return action.enabled ? action.label : `${action.label} (bloqueada: ${action.blockedReason})`;
}

export function selectedAppId(thesis: any | null) {
	return thesis?.build?.appId || thesis?.appId || null;
}

export function deriveProgress(snapshot: Snapshot | null, roomId: string | null, thesis: any | null): Progress {
	const appId = selectedAppId(thesis);
	const lifecycle = snapshot?.lifecycle?.find(item=>item.appId===appId);
	const deployment = snapshot?.alwaysOnDeployments?.find(item=>item.appId===appId);
	const gates = thesis?.gates || {};
	if (!roomId) return {index:1,total:8,label:'ROOM',gate:'Entrada',requirement:'Crie uma room focada no problema.',nextActionId:'room.create'};
	if (!thesis) return {index:2,total:8,label:'TESE',gate:'Hipótese explícita',requirement:'Converse e proponha comprador, dor, canal, oferta e risco fatal.',nextActionId:'thesis.propose'};
	if (thesis.stage==='proposed') return {index:2,total:8,label:'TESE',gate:'Confirmação humana',requirement:'Revise a tese proposta antes de validá-la.',nextActionId:'thesis.confirm'};
	if (!gates.e1?.ok || !gates.e2?.ok) {
		const unmet = [...(gates.e1?.unmet||[]),...(gates.e2?.unmet||[])];
		return {index:3,total:8,label:'E1 + E2',gate:'Dor e reach verificadas',requirement:unmet.join(', ')||'Registre e verifique pain + reach externos.',nextActionId:'evidence.record'};
	}
	if (!thesis.experimentIds?.length) return {index:4,total:8,label:'EXPERIMENTO',gate:'Ação observável',requirement:'Defina hipótese, ação, sucesso, kill, janela e teto zero.',nextActionId:'experiment.create'};
	if (!thesis.buildId) return {index:5,total:8,label:'BUILD',gate:'Build mínimo aprovado',requirement:'Proponha o escopo mínimo e inicie somente após revisão.',nextActionId:thesis.buildProposal?'discovery.build.start':'build.propose'};
	if (thesis.build?.status!=='completed') return {index:5,total:8,label:'BUILD',gate:'Instrumentação observada',requirement:'Conclua o mínimo com URL/artefato e evento observado.',nextActionId:'build.complete'};
	if (!gates.e3?.ok || !thesis.acquisitionId) return {index:6,total:8,label:'E3 + AQUISIÇÃO',gate:'Ação pós-build',requirement:'Rode aquisição controlada e registre ação real do experimento.',nextActionId:'acquisition.start'};
	if (!lifecycle?.p5?.decision) return {index:7,total:8,label:'P4 + P5',gate:'Medir e decidir',requirement:'Registre dados reais e escolha kill, iterate ou scale.',nextActionId:'p4.record'};
	const status = deployment?.status;
	const pending = deployment?.verification?.pending || [];
	const actionId = status==='prepared'?'always-on.confirm':status==='confirmed'?'always-on.publish.record':status==='published'||(status==='verified'&&pending.length)?'always-on.verify':status==='verified'?'':'always-on.prepare';
	const requirement = status==='prepared'
		?'Revise identidade, source, exposição, persistência, workload e SLO.'
		:status==='confirmed'
			?'Execute $always-on-deploy e importe revisão, release, tasks e health.'
			:status==='published'
				?'Verifique health, ownership, rota, capacidade e rollback.'
				:status==='verified'
					?(pending.length?`Deploy ativo; ainda pendente: ${pending.join(', ')}.`:'Deploy Always-On verificado sem pendências.')
					:'Prepare o request Always-On sem publicar automaticamente.';
	return {index:8,total:8,label:`DEPLOY · ${status||'pendente'}`,gate:'Always-On',requirement,nextActionId:actionId};
}

export function providerHealthLine(snapshot: Snapshot | null) {
	const providers = snapshot?.providers || [];
	if (!providers.length) return 'executores: diagnóstico indisponível';
	return providers.map(provider=>`${provider.id}:${provider.installed?'cli-pronta':'ausente'}`).join(' · ');
}

export function ProgressStrip({snapshot,roomId,thesis}: {snapshot:Snapshot|null;roomId:string|null;thesis:any|null}) {
	const progress=deriveProgress(snapshot,roomId,thesis);
	const appId=selectedAppId(thesis);
	const next=actionLabel(snapshot,progress.nextActionId,appId);
	return <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
		<Text><Text bold color="cyan">ETAPA {progress.index}/{progress.total} · {progress.label}</Text> · gate: {progress.gate}</Text>
		<Text>falta: {progress.requirement} · próxima: <Text color="yellow">{next}</Text></Text>
		<Text dimColor>HEALTH LOCAL · {providerHealthLine(snapshot)} · “cli-pronta” não comprova login/quota</Text>
	</Box>;
}

export function actionForProgress(actions: CatalogAction[], progress: Progress) {
	return actions.find(action=>action.id===progress.nextActionId)||null;
}
