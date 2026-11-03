import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ElevenLabsAdapter} from '../src/voice/elevenlabs.ts';
import {ActionDispatcher} from '../src/core/dispatcher.ts';
import {AppStore} from '../src/core/store.ts';

type SdkOptions = {
  conversationToken: string;
  connectionType: string;
  dynamicVariables: Record<string,unknown>;
  clientTools: Record<string, (args: unknown) => Promise<string>>;
  onMessage?: (message: {role:string;message:string}) => void;
  onDisconnect?: () => void;
};
type Session = {
  setMicMuted(muted:boolean): Promise<void>;
  setVolume(value: {volume:number}): Promise<void>;
  endSession(): Promise<void>;
  sendContextualUpdate(text: string): void;
};
type MockProvider = {startSession(options:SdkOptions): Promise<Session>};
const sdkGlobal = globalThis as typeof globalThis & {__fakeElevenLabs:MockProvider};
const createSession = () => {
  const commands:string[]=[];
  const session:Session = {
    async setMicMuted(muted) { commands.push('mic:'+muted); },
    async setVolume({volume}) { commands.push('volume:'+volume); },
    async endSession() { commands.push('end'); },
    sendContextualUpdate() {commands.push('context');},
  };
  return {session,commands};
};
const setup = () => {
  const store=new AppStore();
  const dispatcher=new ActionDispatcher(store);
  const adapter=new ElevenLabsAdapter(async ()=>'offline-fake-token',async (name,args,generationId)=>dispatcher.dispatchTool(name,args,generationId));
  const events:string[]=[];
  adapter.subscribe(event=>{
    if(event.type==='state') store.patch({voice:event.state});
    if(event.type==='finalUserText') {events.push('final');dispatcher.recordFinalUserText(event.text,event.generationId);}
  });
  return {adapter,store,dispatcher,events};
};
const context={role:'caregiver' as const,proactivityEnabled:false};

test('SDK simulation: exact token, WebRTC, variables and all six callbacks',async()=>{
  const {session}=createSession();
  let opts!:SdkOptions;
  sdkGlobal.__fakeElevenLabs={async startSession(options){opts=options;return session;}};
  const {adapter,store}=setup();
  await adapter.start(context);
  assert.equal(adapter.getState().phase,'active');
  assert.equal(opts.conversationToken,'offline-fake-token');
  assert.equal(opts.connectionType,'webrtc');
  assert.deepEqual(opts.dynamicVariables,{role:'caregiver',proactivity_enabled:false});
  assert.deepEqual(Object.keys(opts.clientTools).sort(), ['openInfo','openVideo','openLogbook','proposeLogEntry','confirmLogEntry','setProactivity'].sort());
  assert.equal(JSON.parse(await opts.clientTools.openInfo({topicId:'stairs'})).code,'OK');
  assert.equal(store.get().view,'info');
  assert.equal(JSON.parse(await opts.clientTools.openVideo({videoId:'INVALID'})).code,'UNKNOWN_ID');
  assert.equal(store.get().view,'info');
  await adapter.stop();
});

test('SDK onMessage is not proven final: NO voice-only logbook commit',async()=>{
  const {session}=createSession();
  let opts!:SdkOptions;
  sdkGlobal.__fakeElevenLabs={async startSession(options){opts=options;return session;}};
  const {adapter,store,events}=setup();
  await adapter.start(context);
  assert.equal(JSON.parse(await opts.clientTools.proposeLogEntry({exerciseId:'stairs',when:'heute',comment:'Demo'})).code,'PENDING_CONFIRMATION');
  opts.onMessage?.({role:'user',message:'Ja'});
  assert.deepEqual(events,[]);
  assert.equal(JSON.parse(await opts.clientTools.confirmLogEntry({confirmed:true})).code,'CONFIRMATION_REQUIRED');
  assert.equal(store.get().logbookEntries.length,2);
  await adapter.stop();
});

test('SDK STOPP blocks tool callbacks synchronously and does not reconnect',async()=>{
  const {session,commands}=createSession();
  let opts!:SdkOptions;
  let requests=0;
  sdkGlobal.__fakeElevenLabs={async startSession(options){requests++;opts=options;return session;}};
  const {adapter,store}=setup();
  await adapter.start(context);
  const stopPromise=adapter.stop();
  assert.notEqual(adapter.getState().phase,'active');
  assert.equal(JSON.parse(await opts.clientTools.setProactivity({enabled:true})).code,'STALE_SESSION');
  await stopPromise;
  assert.equal(adapter.getState().phase,'off');
  assert.equal(store.get().proactivityEnabled,false);
  assert.equal(requests,1);
  assert.ok(commands.includes('mic:true') && commands.includes('volume:0') && commands.includes('end'));
});

test('SDK STOPP during delayed startup ends late session, never activates',async()=>{
  const {session,commands}=createSession();
  let resolveStart!: (value:Session)=>void;
  sdkGlobal.__fakeElevenLabs={async startSession(){return new Promise<Session>(resolve=>{resolveStart=resolve;});}};
  const {adapter}=setup();
  const task=adapter.start(context);
  // The TokenProvider is asynchronous; flush it before the fake SDK starts.
  await new Promise<void>(resolve=>setImmediate(resolve));
  const stop=adapter.stop();
  assert.notEqual(adapter.getState().phase,'active');
  resolveStart(session);
  await Promise.all([stop,task]);
  assert.equal(adapter.getState().phase,'off');
  assert.ok(commands.includes('end') && commands.includes('mic:true') && commands.includes('volume:0'));
});

test('SDK STUMM applies bidirectional audio controls',async()=>{
  const {session,commands}=createSession();
  sdkGlobal.__fakeElevenLabs={async startSession(){return session;}};
  const {adapter}=setup();
  await adapter.start(context);
  await adapter.setMuted(true);
  assert.equal(adapter.getState().effectiveMuted,true);
  assert.deepEqual(commands.slice(-2),['mic:true','volume:0']);
  await adapter.setMuted(false);
  assert.equal(adapter.getState().effectiveMuted,false);
  assert.deepEqual(commands.slice(-2),['mic:false','volume:1']);
  await adapter.stop();
});
