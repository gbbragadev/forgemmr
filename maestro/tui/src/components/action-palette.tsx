import React from 'react';
import {Box, Text} from 'ink';
import type {CatalogAction} from '../client.js';

export function ActionPalette({open, actions, selected}: {open: boolean; actions: CatalogAction[]; selected: number}) {
	if (!open) return null;
	const action = actions[selected] || null;
	return <Box flexDirection="column" borderStyle="double" borderColor="magenta" paddingX={1}>
		<Text bold color="magenta">COMMAND PALETTE · ↑↓ seleciona · Enter executa</Text>
		{actions.map((item, index) => <Text key={item.id} inverse={index === selected} color={item.enabled ? 'white' : 'gray'}>{index === selected ? '›' : ' '} {item.label} [{item.risk}] {item.enabled ? '' : `· ${item.blockedReason}`}</Text>)}
		{action ? <Text color="cyan">FIELDS: {action.fields.map(field => `${field.label}${field.required ? '*' : ''}`).join(' · ') || 'nenhum'}</Text> : null}
	</Box>;
}
