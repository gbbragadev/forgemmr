import React from 'react';
import {Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/tabs.tsx (MIT). */
export function Tabs({active, focused}: {active: string; focused: boolean}) {
	return <Text inverse={focused}> {active} | {active === 'Descoberta' ? 'Evidências' : 'Descoberta'} </Text>;
}
