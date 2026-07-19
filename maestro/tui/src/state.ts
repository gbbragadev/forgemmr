import type {CatalogAction, DiscoveryEvent, Snapshot} from './client.js';

export type UiState = {
	snapshot: Snapshot | null;
	selectedRoomId: string | null;
	selectedThesisId: string | null;
	room: any | null;
	thesis: any | null;
	stream: string;
	status: string;
	error: string | null;
	paletteOpen: boolean;
	focus: 'navigation' | 'chat' | 'context' | 'status';
};

export const initialState: UiState = {snapshot: null, selectedRoomId: null, selectedThesisId: null, room: null, thesis: null, stream: '', status: 'conectando', error: null, paletteOpen: false, focus: 'navigation'};

export function applyEvent(state: UiState, event: DiscoveryEvent): UiState {
	if (event.type === 'chat.chunk' && (!state.selectedRoomId || event.roomId === state.selectedRoomId)) return {...state, stream: state.stream + (event.text || ''), status: 'streaming'};
	if (event.type === 'chat.finished') return {...state, status: event.status || 'done'};
	if (event.type === 'operation') return {...state, status: event.status || state.status};
	return state;
}

export function actionById(snapshot: Snapshot | null, id: string): CatalogAction | null {
	return snapshot?.actions.find(action => action.id === id) || null;
}

export function validateAction(action: CatalogAction, input: Record<string, unknown>) {
	if (!action.enabled) throw new Error(action.blockedReason || 'Ação bloqueada.');
	for (const field of action.fields) {
		const value = input[field.name];
		if (field.required && (value === undefined || value === null || value === '')) throw new Error(`${field.label} é obrigatório.`);
	}
	if (/^(pipeline\.kill|override\.|spend\.)/.test(action.id) && !String(input.why || '').trim()) throw new Error('why é obrigatório.');
}

export function needsConfirmation(action: CatalogAction) {
	return ['external', 'destructive'].includes(action.risk) || ['thesis.confirm', 'build.propose', 'discovery.build.start'].includes(action.id);
}
