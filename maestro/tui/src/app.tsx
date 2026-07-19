import React, {useEffect, useReducer, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import type {CatalogAction, MaestroClient, Snapshot} from './client.js';
import {applyEvent, initialState, needsConfirmation} from './state.js';
import {RoomsScreen} from './screens/rooms.js';
import {ChatScreen} from './screens/chat.js';
import {ContextScreen} from './screens/context.js';
import {ActionPalette} from './components/action-palette.js';
import {ActionForm} from './components/action-form.js';
import {ProgressStrip,selectedAppId} from './components/progress-strip.js';
import {formFieldsFor,hasStructuredForm,initialFormValues,parseFormValues} from './structured-form.js';

export const paletteActionIds = ['room.create','chat.send','chat.stop','thesis.propose','thesis.confirm','playbook.run','playbook.import','playbook.revise','evidence.record','evidence.verify','experiment.create','experiment.complete','build.propose','discovery.build.start','build.complete','build.terminate','experiment.validation_asset.attach','braga.prepare','braga.export','braga.return.import','acquisition.start','acquisition.complete','acquisition.terminate','spend.approve','p4.record','p5.decide','always-on.prepare','always-on.confirm','always-on.publish.record','always-on.verify'];
type Mode = 'browse'|'palette'|'form'|'review';

export function parseForm(action: CatalogAction, values: Record<string,string>, advanced = false) {
	return parseFormValues(action,values,advanced);
}

export async function submitCatalogAction({client,snapshot,action,input}: {client:MaestroClient;snapshot:Snapshot;action:CatalogAction;input:Record<string,unknown>}) {
	let confirmation: string|undefined;
	const appId=action.scope.startsWith('pipeline:')?action.scope.slice('pipeline:'.length):null;
	if (needsConfirmation(action) && ['external','destructive'].includes(action.risk)) {
		confirmation = (await client.confirm({actionId:action.id,appId,stateVersion:snapshot.version})).nonce;
	}
	return client.execute({actionId:action.id,appId,input,stateVersion:snapshot.version,idempotencyKey:`tui-${Date.now()}-${action.id}`,confirmation});
}

export function defaultChatPlayer(snapshot:Snapshot,action?:CatalogAction|null){
	const options=action?.fields.find(field=>field.name==='playerId')?.options||[];
	const installed=new Set((snapshot.providers||[]).filter(provider=>provider.installed).map(provider=>provider.id));
	return ['codex','claude','grok','gemini','glm'].find(id=>installed.has(id)&&options.includes(id))||options.find(id=>installed.has(id))||options[0]||'codex';
}

export function ForgeTui({client}: {client:MaestroClient}) {
	const {exit}=useApp();
	const [state,dispatch]=useReducer((current:typeof initialState,action:any)=>action.type==='event'?applyEvent(current,action.event):{...current,...action.patch},initialState);
	const [mode,setMode]=useState<Mode>('browse');
	const [actionIndex,setActionIndex]=useState(0);
	const [fieldIndex,setFieldIndex]=useState(0);
	const [values,setValues]=useState<Record<string,string>>({});
	const [roomIndex,setRoomIndex]=useState(0);
	const [thesisIndex,setThesisIndex]=useState(0);
	const [advanced,setAdvanced]=useState(false);
	const [composer,setComposer]=useState('');
	const [busy,setBusy]=useState(false);
	const [showHelp,setShowHelp]=useState(false);
	const submitting=useRef(false);

	async function refresh(preferredRoomId=state.selectedRoomId,preferredThesisId=state.selectedThesisId){
		const snapshot=await client.snapshot();
		const roomId=preferredRoomId&&snapshot.discovery.rooms.some(item=>item.id===preferredRoomId)?preferredRoomId:snapshot.discovery.rooms[0]?.id||null;
		const theses=snapshot.discovery.theses.filter(item=>item.roomId===roomId);
		const thesisId=preferredThesisId&&theses.some(item=>item.id===preferredThesisId)?preferredThesisId:theses[0]?.id||null;
		const [room,thesis]=await Promise.all([roomId?client.room(roomId):null,thesisId?client.thesis(thesisId):null]);
		dispatch({patch:{snapshot,selectedRoomId:roomId,selectedThesisId:thesisId,room,thesis,status:'online',error:null}});
	}

	useEffect(()=>{let mounted=true;const controller=new AbortController();client.snapshot().then(async snapshot=>{if(!mounted)return;const roomId=snapshot.discovery.rooms[0]?.id||null;const thesisId=snapshot.discovery.theses.find(item=>item.roomId===roomId)?.id||null;const [room,thesis]=await Promise.all([roomId?client.room(roomId):null,thesisId?client.thesis(thesisId):null]);dispatch({patch:{snapshot,selectedRoomId:roomId,selectedThesisId:thesisId,room,thesis,status:'online'}});}).catch(error=>dispatch({patch:{error:error.message,status:'erro'}}));client.events(event=>dispatch({type:'event',event}),controller.signal).catch(error=>{if(!controller.signal.aborted)dispatch({patch:{error:error.message,status:'desconectado'}});});return()=>{mounted=false;controller.abort();};},[client]);

	const appId=selectedAppId(state.thesis);
	const actionScopes=new Set(['factory',...(appId?[`pipeline:${appId}`]:[])]);
	const actions=(state.snapshot?.actions||[]).filter(action=>actionScopes.has(action.scope)&&paletteActionIds.includes(action.id));
	const selectedAction=actions[actionIndex]||null;
	const chatAction=actions.find(action=>action.id==='chat.send')||null;
	const chatPlayer=state.snapshot?defaultChatPlayer(state.snapshot,chatAction):'codex';
	const formFields=selectedAction?formFieldsFor(selectedAction,advanced):[];
	const selectedField=formFields[fieldIndex]||null;
	const actor=process.env.FORGE_ACTOR||process.env.USERNAME||process.env.USER||'guilherme';
	const formContext={roomId:state.selectedRoomId,thesisId:state.selectedThesisId,thesis:state.thesis,actor,today:new Date().toISOString().slice(0,10),forgeRoot:process.env.FORGE_ROOT,appId};

	async function loadRoom(index:number){const rooms=state.snapshot?.discovery.rooms||[];if(!rooms.length)return;const next=Math.max(0,Math.min(index,rooms.length-1));setRoomIndex(next);const roomId=rooms[next].id;const theses=(state.snapshot?.discovery.theses||[]).filter(item=>item.roomId===roomId);const thesisId=theses[0]?.id||null;try{const [room,thesis]=await Promise.all([client.room(roomId),thesisId?client.thesis(thesisId):null]);setThesisIndex(0);dispatch({patch:{selectedRoomId:roomId,selectedThesisId:thesisId,room,thesis,error:null}});}catch(error){dispatch({patch:{error:(error as Error).message,status:'erro'}});}}
	async function loadThesis(index:number){const theses=(state.snapshot?.discovery.theses||[]).filter(item=>item.roomId===state.selectedRoomId);if(!theses.length)return;const next=Math.max(0,Math.min(index,theses.length-1));setThesisIndex(next);try{dispatch({patch:{selectedThesisId:theses[next].id,thesis:await client.thesis(theses[next].id),error:null}});}catch(error){dispatch({patch:{error:(error as Error).message,status:'erro'}});}}
	function openForm(action=selectedAction){if(!action)return;if(!action.enabled){dispatch({patch:{error:action.blockedReason||'Ação bloqueada.',status:'erro'}});return;}const index=actions.findIndex(item=>item.id===action.id);if(index>=0)setActionIndex(index);setAdvanced(false);setValues(initialFormValues(action,formContext,false));const fields=formFieldsFor(action,false);setFieldIndex(action.id==='chat.send'?Math.max(0,fields.findIndex(field=>field.name==='text')):0);setMode('form');}
	function toggleAdvanced(){if(!selectedAction||!hasStructuredForm(selectedAction))return;const next=!advanced;setAdvanced(next);setValues(initialFormValues(selectedAction,formContext,next));setFieldIndex(0);setMode('form');dispatch({patch:{error:null,status:next?'JSON avançado':'campos guiados'}});}
	async function submit(){if(!selectedAction||!state.snapshot||submitting.current)return;submitting.current=true;setBusy(true);try{const input=parseForm(selectedAction,values,advanced);await submitCatalogAction({client,snapshot:state.snapshot,action:selectedAction,input});await refresh();dispatch({patch:{status:'ação concluída',error:null}});setMode('browse');}catch(error){dispatch({patch:{status:'erro',error:(error as Error).message}});setMode('form');}finally{submitting.current=false;setBusy(false);}}
	async function sendComposer(){
		const text=composer.trim();
		if(!text||submitting.current||!state.snapshot)return;
		submitting.current=true;
		setBusy(true);
		dispatch({patch:{status:'enviando…',error:null}});
		try{
			let currentSnapshot=state.snapshot;
			let roomId=state.selectedRoomId;
			if(!roomId){
				const roomAction=currentSnapshot.actions.find(action=>action.id==='room.create');
				if(!roomAction||!roomAction.enabled)throw new Error(roomAction?.blockedReason||'Não foi possível criar a primeira room.');
				const existingIds=new Set(currentSnapshot.discovery.rooms.map(room=>room.id));
				const operation=await submitCatalogAction({client,snapshot:currentSnapshot,action:roomAction,input:{title:text.replace(/\s+/g,' ').slice(0,72)}});
				currentSnapshot=await client.snapshot();
				roomId=operation?.result?.id||currentSnapshot.discovery.rooms.find(room=>!existingIds.has(room.id))?.id||null;
				if(!roomId)throw new Error('A room foi criada, mas não pôde ser selecionada.');
			}
			const action=currentSnapshot.actions.find(item=>item.id==='chat.send');
			if(!action||!action.enabled)throw new Error(action?.blockedReason||'Envio de mensagem indisponível.');
			await submitCatalogAction({client,snapshot:currentSnapshot,action,input:{roomId,text,playerId:defaultChatPlayer(currentSnapshot,action)}});
			setComposer('');
			await refresh(roomId,null);
			dispatch({patch:{status:'mensagem enviada',error:null}});
		}catch(error){
			dispatch({patch:{status:'erro',error:(error as Error).message}});
		}finally{
			submitting.current=false;
			setBusy(false);
		}
	}

	useInput((input,key)=>{
		if(key.ctrl&&input==='c')return exit();
		if(key.ctrl&&input.toLowerCase()==='j'&&(mode==='form'||mode==='review'))return toggleAdvanced();
		if(key.escape){if(mode==='review')return setMode('form');if(mode!=='browse'){setMode('browse');return;}if(composer){setComposer('');return;}setShowHelp(false);return;}
		if(mode==='browse'){
			if((input===':'&&!composer)||(key.ctrl&&input.toLowerCase()==='p')){setMode('palette');setShowHelp(false);return;}
			if(key.ctrl&&input.toLowerCase()==='n'){const action=actions.find(item=>item.id==='room.create');openForm(action);return;}
			if(input==='?'&&!composer){setShowHelp(current=>!current);return;}
			if(key.ctrl&&input.toLowerCase()==='u'){setComposer('');return;}
			if(key.return){void sendComposer();return;}
			if(key.backspace||key.delete){setComposer(current=>current.slice(0,-1));return;}
			if(key.downArrow)return void loadRoom(roomIndex+1);
			if(key.upArrow)return void loadRoom(roomIndex-1);
			if(key.rightArrow)return void loadThesis(thesisIndex+1);
			if(key.leftArrow)return void loadThesis(thesisIndex-1);
			if(key.tab)return;
			if(input&&!key.ctrl&&!key.meta)setComposer(current=>current+input);
			return;
		}
		if(mode==='palette'){
			if(key.downArrow)return setActionIndex(current=>Math.min(actions.length-1,current+1));
			if(key.upArrow)return setActionIndex(current=>Math.max(0,current-1));
			if(key.return)return openForm();
			return;
		}
		if(mode==='review'){
			if(key.return||input==='y')void submit();
			return;
		}
		if(!selectedField)return;
		if(key.tab||key.downArrow){setFieldIndex(current=>(current+1)%formFields.length);return;}
		if(key.upArrow){setFieldIndex(current=>(current-1+formFields.length)%formFields.length);return;}
		if(key.return){if(fieldIndex<formFields.length-1){setFieldIndex(current=>current+1);return;}try{parseForm(selectedAction!,values,advanced);setMode('review');dispatch({patch:{error:null}});}catch(error){dispatch({patch:{error:(error as Error).message,status:'erro'}});}return;}
		if(['select','choice','checkbox'].includes(selectedField.type)&&(key.leftArrow||key.rightArrow||input===' ')){const options=selectedField.type==='checkbox'?['false','true']:selectedField.options;const current=Math.max(0,options.indexOf(values[selectedField.name]));const next=(current+(key.rightArrow||input===' '?1:-1)+options.length)%options.length;setValues(old=>({...old,[selectedField.name]:options[next]}));return;}
		if(key.backspace||key.delete){setValues(old=>({...old,[selectedField.name]:(old[selectedField.name]||'').slice(0,-1)}));return;}
		if(input&&!key.ctrl&&!key.meta)setValues(old=>({...old,[selectedField.name]:(old[selectedField.name]||'')+input}));
	});

	return <Box flexDirection="column" width="100%">
		<Text bold color="cyan">FORGE NEXUS // DIGITE E PRESSIONE ENTER</Text>
		<Text dimColor>Digite direto · Enter envia · ↑↓ rooms · ←→ teses · : ações · Ctrl+N nova room · ? ajuda</Text>
		{showHelp?<Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column"><Text bold>AJUDA RÁPIDA</Text><Text>Não precisa clicar nem usar Tab: basta digitar e pressionar Enter.</Text><Text>O mouse não é usado nesta interface de terminal. Para ações avançadas, pressione :.</Text><Text>Esc limpa o texto ou fecha painéis · Ctrl+U limpa o prompt · Ctrl+C sai.</Text></Box>:null}
		<ProgressStrip snapshot={state.snapshot} roomId={state.selectedRoomId} thesis={state.thesis}/>
		<Box flexGrow={1}>
			<RoomsScreen rooms={state.snapshot?.discovery.rooms||[]} theses={state.snapshot?.discovery.theses||[]} selectedRoomId={state.selectedRoomId} selectedThesisId={state.selectedThesisId}/>
			<ChatScreen room={state.room} stream={state.stream} composer={composer} busy={busy} playerId={chatPlayer}/>
			<ContextScreen thesis={state.thesis} actions={actions}/>
		</Box>
		<Text inverse> {state.status} · {mode==='browse'?'DIGITE + ENTER':mode.toUpperCase()} · ↑↓ rooms · : ações · ? ajuda {state.error?`· ${state.error}`:''}</Text>
		<ActionPalette open={mode==='palette'} actions={actions} selected={actionIndex}/>
		{selectedAction&&(mode==='form'||mode==='review')?<ActionForm action={selectedAction} fields={formFields} values={values} fieldIndex={fieldIndex} confirmation={mode==='review'} advanced={advanced} structured={hasStructuredForm(selectedAction)}/>:null}
	</Box>;
}
