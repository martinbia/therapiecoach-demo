import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppStore} from '../src/core/store.ts';
import {ActionDispatcher} from '../src/core/dispatcher.ts';

const init = () => {
  let time = 1000;
  const store = new AppStore();
  const dispatcher = new ActionDispatcher(store, () => ++time);
  store.patch({voice:{phase:'active',generationId:5,userMuted:false,effectiveMuted:false}});
  return {store, dispatcher};
};
test('initial state: no role, proactivity false, two fictional entries; no persistence', () => {
  const first = new AppStore();
  assert.equal(first.get().role, null);
  assert.equal(first.get().proactivityEnabled, false);
  assert.equal(first.get().logbookEntries.length, 2);
  first.patch({logbookEntries:[]});
  const reload = new AppStore();
  assert.equal(reload.get().logbookEntries.length, 2);
});
test('role switch and shared info/video actions', () => {
  const {store,dispatcher:d} = init();
  assert.equal(d.dispatch({type:'SELECT_ROLE',role:'caregiver'}).ok, true);
  assert.equal(store.get().role, 'caregiver');
  assert.equal(d.dispatch({type:'OPEN_INFO',topicId:'stairs'}).ok,true);
  assert.equal(d.dispatchTool('openInfo',{topicId:'chair_rise'},5).ok,true);
  assert.equal(store.get().selectedInfoTopicId,'chair_rise');
  assert.equal(d.dispatchTool('openVideo',{videoId:'stairs_demo'},5).ok,true);
  assert.equal(store.get().selectedVideoId,'stairs_demo');
});
test('all 6 tools validate exact payload schema and unknown IDs', () => {
  const {store,dispatcher:d} = init();
  const results = [
    d.dispatchTool('openInfo',{topicId:'no'},5),
    d.dispatchTool('openVideo',{videoId:'https://example.com'},5),
    d.dispatchTool('openLogbook',{extra:true},5),
    d.dispatchTool('proposeLogEntry',{exerciseId:'chair_rise',when:'x',comment:'x',admin:true},5),
    d.dispatchTool('confirmLogEntry',{confirmed:'true'},5),
    d.dispatchTool('setProactivity',{enabled:1},5),
  ];
  assert.ok(results.every(r=>!r.ok));
  assert.equal(store.get().logbookEntries.length,2);
  assert.equal(d.dispatchTool('setProactivity',{enabled:true},5).ok,true);
  assert.equal(store.get().proactivityEnabled,true);
});
test('proposal alone never creates entry; touch confirmation works', () => {
  const {store,dispatcher:d} = init();
  const proposal = d.dispatchTool('proposeLogEntry',{exerciseId:'chair_rise',when:'heute',comment:'fiktiv'},5);
  assert.equal(proposal.code, 'PENDING_CONFIRMATION');
  assert.equal(store.get().logbookEntries.length,2);
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).code, 'CONFIRMATION_REQUIRED');
  assert.equal(store.get().logbookEntries.length,2);
  assert.equal(d.dispatch({type:'CONFIRM_LOG_ENTRY',confirmed:true}).code,'CONFIRMED');
  assert.equal(store.get().logbookEntries.length,3);
});
test('final short positive transcript after proposal allows exactly one voice commit', () => {
  const {store,dispatcher:d} = init();
  d.dispatchTool('proposeLogEntry',{exerciseId:'chair_rise',when:'heute',comment:''},5);
  d.recordFinalUserText('Ja, das stimmt.',5);
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).code,'CONFIRMED');
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).ok,false);
  assert.equal(store.get().logbookEntries.length,3);
});
test('negation, ambiguous transcript and later nonaffirmation invalidate voice evidence', () => {
  for (const text of ['Nein','Ja, nein','ja aber','ich weiß nicht','Nein, bitte eintragen']) {
    const {store,dispatcher:d} = init();
    d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'heute',comment:'ok'},5);
    d.recordFinalUserText(text,5);
    assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).ok,false,text);
    assert.equal(store.get().logbookEntries.length,2);
  }
  const {dispatcher:d} = init();
  d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'heute',comment:'ok'},5);
  d.recordFinalUserText('Ja',5);
  d.recordFinalUserText('Mal schauen',5);
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).code,'CONFIRMATION_REQUIRED');
});
test('evidence expires after 30 seconds', () => {
  let time = 4000;
  const s = new AppStore(); const d = new ActionDispatcher(s,()=>time);
  s.patch({voice:{phase:'active',generationId:1,userMuted:false,effectiveMuted:false}});
  d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'heute',comment:''},1);
  time = 4001; d.recordFinalUserText('Ja',1);
  time += 30_001;
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},1).code,'CONFIRMATION_REQUIRED');
});
test('stale generation cannot run tool or confirm after COACH AUS', () => {
  const {store,dispatcher:d} = init();
  d.dispatchTool('proposeLogEntry',{exerciseId:'chair_rise',when:'heute',comment:''},5);
  store.patch({voice:{phase:'off',generationId:6,userMuted:false,effectiveMuted:false}});
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:true},5).code,'STALE_SESSION');
  assert.equal(d.dispatch({type:'CONFIRM_LOG_ENTRY',confirmed:true}).code,'CONFIRMED');
});
test('STOPP discards pending proposal but keeps existing fake entries', () => {
  const {store,dispatcher:d} = init();
  d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'heute',comment:'x'},5);
  d.discardPending();
  assert.equal(store.get().pendingLogEntry,null);
  assert.equal(store.get().logbookEntries.length,2);
});
test('second proposal while confirmation pending fails; cancellation works', () => {
  const {store,dispatcher:d} = init();
  d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'heute',comment:''},5);
  assert.equal(d.dispatchTool('proposeLogEntry',{exerciseId:'chair_rise',when:'heute',comment:''},5).code,'CONFIRMATION_PENDING');
  assert.equal(d.dispatchTool('confirmLogEntry',{confirmed:false},5).code,'CANCELLED');
  assert.equal(store.get().pendingLogEntry,null);
});
test('length limits, control characters and no HTML injection through tools', () => {
  const {store,dispatcher:d} = init();
  assert.equal(d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'a'.repeat(81),comment:''},5).ok,false);
  assert.equal(d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'x',comment:'a'.repeat(241)},5).ok,false);
  assert.equal(d.dispatchTool('proposeLogEntry',{exerciseId:'stairs',when:'x',comment:'\u0000'},5).ok,false);
  assert.equal(store.get().pendingLogEntry,null);
});
