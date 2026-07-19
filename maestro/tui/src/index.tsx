import React from 'react';
import {render} from 'ink';
import {ForgeTui} from './app.js';
import {createMaestroClient} from './client.js';
import {resolveForgeRoot} from './root.js';

const root = resolveForgeRoot();
const client = createMaestroClient({root});
render(<ForgeTui client={client}/>);
