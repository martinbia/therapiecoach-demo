import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MockVoiceAdapter} from '../src/voice/mock.ts';
import {AppStore} from '../src/core/store.ts';
import {ActionDispatcher} from '../src/core/dispatcher.ts';
import {SafetyController} from '../src/core/safety.ts';
import {shouldToggleFromKeyboard} from '../src/core/keyboard.ts';

const setup = (delay = 2) => {
  const store = new AppStore(); const dispatcher = new ActionDispatcher(store);
  const mock = new MockVoiceAdapter(async (name,args,gen)=>dispatcher.dispatchTool(name,args,gen));
  mock.connectDelayMs = delay;
  mock.subscribe(event => {if(event.type==='state') store.patch({voice:event.state});if(event.type==='finalUserText') dispatcher.recordFinalUserText(event.text,event.generationId);});
  const media = {stops:0,stopAll(){this.stops++;}};
  const safety = new SafetyController(mock,media,dispatcher);
  return {mock,store,dispatcher,safety,media};
};
const context = {role:'patient' as const,proactivityEnabled:false};
test('connecting -> active -> muted -> unmuted -> off',async()=>{
  const {mock}=setup();
  await mock.start(context);
  assert.equal(mock.getState().phase,'active');
  await mock.setMuted(true);
  assert.deepEqual([mock.getState().userMuted,mock.getState().effectiveMuted],[true,true]);
  await mock.setMuted(false);
  assert.equal(mock.getState().effectiveMuted,false);
  await mock.stop();
  assert.equal(mock.getState().phase,'off');
});
test('STOPP during delayed connection invalidates before promise settles',async()=>{
  const {mock,safety,media}=setup(25);
  const task=mock.start(context);
  safety.stopAll();
  assert.equal(mock.getState().phase,'off');
  assert.equal(media.stops,1);
  await task;
  assert.equal(mock.getState().phase,'off');
});
test('stale agent tool after STOPP is rejected',async()=>{
  const {mock,safety,store}=setup();
  await mock.start(context);
  const delayed=mock.simulateTool('setProactivity',{enabled:true},20);
  safety.stopAll();
  const result=await delayed;
  assert.equal(result.code,'STALE_SESSION');
  assert.equal(store.get().proactivityEnabled,false);
  assert.equal(store.get().logbookEntries.length,2);
});
test('double start only creates one generation',async()=>{
  const {mock}=setup(10);
  const first=mock.start(context);
  const second=mock.start(context);
  await Promise.all([first,second]);
  assert.equal(mock.getState().generationId,1);
  await mock.stop();
});
test('user mute is preserved across video suppression',async()=>{
  const {mock}=setup(); await mock.start(context);
  await mock.setMuted(true);
  await mock.setVideoSuppressed(true);
  await mock.setVideoSuppressed(false);
  assert.equal(mock.getState().userMuted,true);
  assert.equal(mock.getState().effectiveMuted,true);
  await mock.setMuted(false);
  assert.equal(mock.getState().effectiveMuted,false);
  await mock.stop();
});
test('mock failure surfaces error and never goes active',async()=>{
  const {mock}=setup();mock.failNextStart=true;await mock.start(context);
  assert.equal(mock.getState().phase,'error');
  await mock.stop();
});
test('F9 only once, focused, not in inputs or PIN',()=>{
  const event=(target: unknown,repeat=false,code='F9')=>({code,repeat,target,altKey:false,ctrlKey:false,metaKey:false});
  assert.equal(shouldToggleFromKeyboard(event({tagName:'DIV'}),false,true),true);
  assert.equal(shouldToggleFromKeyboard(event({tagName:'INPUT'}),false,true),false);
  assert.equal(shouldToggleFromKeyboard(event({tagName:'DIV'},true),false,true),false);
  assert.equal(shouldToggleFromKeyboard(event({tagName:'DIV'}),true,true),false);
  assert.equal(shouldToggleFromKeyboard(event({tagName:'DIV'}),false,false),false);
  assert.equal(shouldToggleFromKeyboard(event({tagName:'DIV'},false,'F8'),false,true),false);
});
