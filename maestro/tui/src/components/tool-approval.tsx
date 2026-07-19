import React from 'react';
import {Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/tool-approval.tsx (MIT). */
export function ToolApproval({approved, focused}: {approved: boolean; focused: boolean}) {
	return <Text inverse={focused}>Approval: {approved ? 'aprovado' : 'pendente'} (Enter aprova)</Text>;
}
