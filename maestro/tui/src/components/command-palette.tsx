import React from 'react';
import {Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/command-palette.tsx (MIT). */
export function CommandPalette({open}: {open: boolean}) {
	return open ? <Text color="magenta">Command palette: abrir fonte | aprovar evidência</Text> : null;
}
