import type {CatalogAction, CatalogField} from './client.js';
import {validateAction} from './state.js';

const legacyJsonFields = new Set([
	'input','draft','evidence','experiment','brief','startOptions','evidenceIds',
	'asset','assets','events','baseline','budget','legalRestrictions','result',
]);

type FormContext = {
	roomId?: string | null;
	thesisId?: string | null;
	thesis?: any | null;
	actor?: string;
	today?: string;
	forgeRoot?: string;
	appId?: string | null;
};

type StructuredDefinition = {
	fields: CatalogField[];
	compose: (values: Record<string,string>) => Record<string,unknown>;
};

const formField = (
	name: string,
	label: string,
	type = 'text',
	required = false,
	options: string[] = [],
	help?: string,
): CatalogField => ({name,label,type,required,options,...(help ? {help} : {})});

function splitList(value = '') {
	return value.split(/[\r\n,]+/).map(item=>item.trim()).filter(Boolean);
}

const definitions: Record<string,StructuredDefinition> = {
	'thesis.propose': {
		fields: [
			formField('roomId','Room','text',true),
			formField('draft.buyer','Comprador','text',true),
			formField('draft.user','Usuário','text',true),
			formField('draft.painfulJob','Trabalho doloroso','textarea',true),
			formField('draft.currentAlternative','Alternativa atual','text',true),
			formField('draft.reachableSegment','Segmento alcançável','text',true),
			formField('draft.channel','Canal','text',true),
			formField('draft.fatalAssumption','Assunção fatal','textarea',true),
			formField('draft.offer','Oferta','textarea',true),
			formField('sourceMessageIds','Mensagens de origem','text',false,[],'IDs separados por vírgula; opcional.'),
		],
		compose: values => ({
			roomId: values.roomId,
			draft: {
				buyer: values['draft.buyer'],
				user: values['draft.user'],
				painfulJob: values['draft.painfulJob'],
				currentAlternative: values['draft.currentAlternative'],
				reachableSegment: values['draft.reachableSegment'],
				channel: values['draft.channel'],
				fatalAssumption: values['draft.fatalAssumption'],
				offer: values['draft.offer'],
			},
			...(splitList(values.sourceMessageIds).length ? {sourceMessageIds:splitList(values.sourceMessageIds)} : {}),
		}),
	},
	'evidence.record': {
		fields: [
			formField('thesisId','Tese','text',true),
			formField('evidence.observation','Observação verificável','textarea',true),
			formField('evidence.inference','Inferência','textarea',true),
			formField('evidence.validation','O que valida','select',true,['pain','reach','action','economic','channel_metric']),
			formField('evidence.polarity','Polaridade','select',true,['supporting','contradicting']),
			formField('evidence.source','Fonte','text',true),
			formField('evidence.date','Data','text',true),
			formField('evidence.sensitivity','Sensibilidade','select',true,['public','private','internal']),
			formField('evidence.synthetic','Sintética','checkbox'),
		],
		compose: values => ({
			thesisId: values.thesisId,
			evidence: {
				observation: values['evidence.observation'],
				inference: values['evidence.inference'],
				validation: values['evidence.validation'],
				polarity: values['evidence.polarity'],
				source: values['evidence.source'],
				date: values['evidence.date'],
				sensitivity: values['evidence.sensitivity'],
				synthetic: values['evidence.synthetic'] === 'true',
			},
		}),
	},
	'experiment.create': {
		fields: [
			formField('thesisId','Tese','text',true),
			formField('experiment.hypothesis','Hipótese','textarea',true),
			formField('experiment.method','Método','text',true),
			formField('experiment.audience','Público','text',true),
			formField('experiment.expectedAction','Ação esperada','text',true),
			formField('experiment.successCriteria','Critério de sucesso','textarea',true),
			formField('experiment.killCriteria','Critério de kill','textarea',true),
			formField('experiment.window','Janela','text',true),
			formField('experiment.costCap','Teto de custo','number',true),
		],
		compose: values => ({
			thesisId: values.thesisId,
			experiment: {
				hypothesis: values['experiment.hypothesis'],
				method: values['experiment.method'],
				audience: values['experiment.audience'],
				expectedAction: values['experiment.expectedAction'],
				successCriteria: values['experiment.successCriteria'],
				killCriteria: values['experiment.killCriteria'],
				window: values['experiment.window'],
				costCap: Number(values['experiment.costCap']),
			},
		}),
	},
};

function jsonDefault(fieldName: string) {
	return ['evidenceIds','assets','events','legalRestrictions','sourceMessageIds'].includes(fieldName) ? '[]' : '{}';
}

export function hasStructuredForm(action: CatalogAction | null) {
	return Boolean(action && definitions[action.id]);
}

export function formFieldsFor(action: CatalogAction, advanced = false) {
	return !advanced && definitions[action.id] ? definitions[action.id].fields : action.fields;
}

export function initialFormValues(action: CatalogAction, context: FormContext, advanced = false) {
	const fields = formFieldsFor(action, advanced);
	const thesis = context.thesis || {};
	const appSource = context.forgeRoot && context.appId
		? `${context.forgeRoot}\\apps\\${context.appId}`
		: '';
	return Object.fromEntries(fields.map(field => {
		let value = field.defaultValue || '';
		if (field.name === 'roomId') value = context.roomId || '';
		else if (field.name === 'thesisId') value = context.thesisId || '';
		else if (field.name === 'actor') value = context.actor || '';
		else if (field.name === 'experimentId') value = thesis.experimentIds?.at?.(-1) || '';
		else if (field.name === 'buildId') value = thesis.buildId || '';
		else if (field.name === 'acquisitionId') value = thesis.acquisitionId || '';
		else if (field.name === 'sourceRoot') value = appSource;
		else if (field.name === 'evidence.date') value = context.today || '';
		else if (field.name === 'experiment.costCap') value = '0';
		else if (field.type === 'select' || field.type === 'choice' || field.type === 'hidden') value = field.options[0] || '';
		else if (field.type === 'checkbox') value = 'false';
		else if (field.type === 'json' || legacyJsonFields.has(field.name)) value = jsonDefault(field.name);
		return [field.name,value];
	}));
}

function parseCatalogFields(action: CatalogAction, values: Record<string,string>) {
	const input: Record<string,unknown> = {};
	for (const field of action.fields) {
		const raw = values[field.name] || '';
		if (!raw && !field.required) continue;
		if (field.type === 'number') {
			const value = Number(raw);
			if (!Number.isFinite(value)) throw new Error(`${field.label} precisa ser número.`);
			input[field.name] = value;
		} else if (field.type === 'checkbox') input[field.name] = raw === 'true';
		else if (field.type === 'json' || legacyJsonFields.has(field.name)) {
			try { input[field.name] = JSON.parse(raw); } catch { throw new Error(`${field.label} precisa ser JSON válido.`); }
		} else input[field.name] = raw;
	}
	return input;
}

export function parseFormValues(action: CatalogAction, values: Record<string,string>, advanced = false) {
	const input = !advanced && definitions[action.id]
		? definitions[action.id].compose(values)
		: parseCatalogFields(action, values);
	validateAction(action, input);
	return input;
}
