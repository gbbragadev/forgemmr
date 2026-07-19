import React from 'react';
import {Box, Text} from 'ink';
import type {CatalogAction} from '../client.js';

export function ContextScreen({thesis, actions}: {thesis: any | null; actions: CatalogAction[]}) {
	return <Box width={34} flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
		<Text bold color="yellow">EVIDENCE / EXPERIMENT / GATES</Text>
		<Text>Tese: {thesis?.stage || '—'}</Text>
		<Text>Evidências: {thesis?.evidenceIds?.length || 0}</Text>
		<Text>Experimentos: {thesis?.experimentIds?.length || 0}</Text>
		<Text dimColor>Ações abaixo abrem com :</Text>
		<Text dimColor>────────────</Text>
		{actions.slice(0, 8).map(action => <Text key={action.id} color={action.enabled ? (action.risk === 'safe' ? 'green' : 'yellow') : 'gray'}>{action.enabled ? '·' : '×'} {action.label}{action.enabled ? '' : ` · ${action.blockedReason}`}</Text>)}
	</Box>;
}
