import React from 'react';
import {Box, Text} from 'ink';
import type {CatalogAction,CatalogField} from '../client.js';

export function ActionForm({action,fields,values,fieldIndex,confirmation,advanced,structured}: {
	action:CatalogAction;
	fields:CatalogField[];
	values:Record<string,string>;
	fieldIndex:number;
	confirmation:boolean;
	advanced:boolean;
	structured:boolean;
}) {
	return <Box flexDirection="column" borderStyle="double" borderColor="magenta" paddingX={1}>
		<Text bold color="magenta">FORM · {action.label} · {advanced?'JSON AVANÇADO':'CAMPOS GUIADOS'} · ↑↓ campo · ←→ opção · Enter avança</Text>
		{structured?<Text dimColor>Ctrl+J alterna campos guiados ↔ JSON avançado · Esc cancela</Text>:<Text dimColor>Esc cancela</Text>}
		{fields.map((field,index) => <Box key={field.name} flexDirection="column">
			<Text inverse={index===fieldIndex}>
				{field.label}{field.required?'*':''}: {values[field.name] || (['select','choice'].includes(field.type) ? field.options[0] : '…')}
			</Text>
			{index===fieldIndex&&field.help?<Text dimColor>{field.help}</Text>:null}
		</Box>)}
		{confirmation ? <Text color="yellow">REVISÃO: Enter/y confirma · Esc volta</Text> : null}
	</Box>;
}
