/** Offline cross-component integration. Actual browser TokenProvider -> actual
 * Cloudflare Worker handler -> fake ElevenLabs token service -> actual adapter
 * -> fake SDK -> browser ActionDispatcher. No network and no paid provider.
 * Run only after worker 'npm run build:tests'.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleSession } from '../worker/.build/session.js';
import { LimiterStore } from '../worker/.build/limiter-store.js';
import { readLimits } from '../worker/.build/types.js';
import {WorkerSessionTokenProvider} from '../web/src/access/token.ts';
import {ElevenLabsAdapter} from '../web/src/voice/elevenlabs.ts';
import {AppStore} from '../web/src/core/store.ts';
import {ActionDispatcher} from '../web/src/core/dispatcher.ts';

const ORIGIN='https://martinbia.github.io';
function createStore() {
  const db=new DatabaseSync(':memory:');
  const storage={
    sql:{exec(statement,...params) {
      const s=db.prepare(statement);
      if (/^\s*(SELECT|WITH)/i.test(statement)) {
        const rows=s.all(...params);
        return {one:()=>{if(!rows.length)throw Error('No row');return rows[0];},toArray:()=>rows};
      }
      s.run(...params);
      return {one:()=>{throw Error('Not a query');},toArray:()=>[]};
    }},
    transactionSync(callback) {
      db.exec('BEGIN IMMEDIATE');
      try {const res=callback();db.exec('COMMIT');return res;}
      catch(e) {db.exec('ROLLBACK');throw e;}
    },
  };
  return {storage,close:()=>db.close()};
}

test('full offline HTTP/PIN/Token -> WebRTC adapter -> six-tool dispatcher and STOPP',async()=>{
  const {storage,close}=createStore();
  const env={LIVE_ENABLED:'true',ALLOWED_ORIGIN:ORIGIN,AGENT_ID:'agent_FAKEONLY',
    DEMO_PIN:'FICTIONAL-secret-for-tests',ELEVENLABS_API_KEY:'FAKE_TEST',
    IP_HASH_KEY:'FAKE_HMAC_MATERIAL_01234567890123456789'};
  const limiter = new LimiterStore(storage,readLimits(env));
  env.ACCESS_LIMITER={idFromName:()=> 'demo-global',get:()=>({check:(key)=>limiter.check(key), decide:(key,matches)=>limiter.decide(key,matches)})};
  let tokenRequests=0;
  const providerFetch=async()=>{tokenRequests++;return Response.json({token:'ONLY_FAKE_WEBRTC_TOKEN',conversation_id:'never-expose'});};
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async (url,init)=>{
    const req=new Request(url,{method:init.method,headers:{...init.headers,Origin:ORIGIN,'CF-Connecting-IP':'198.51.100.50'},body:init.body,signal:init.signal});
    return handleSession(req,env,providerFetch);
  };
  const status=[];
  try {
    const pinDialog={ask:async()=>env.DEMO_PIN,cancel:()=>undefined};
    const tokens=new WorkerSessionTokenProvider('https://worker.test',pinDialog);
    let sdkOptions;
    const sdkLog=[];
    const session={
      setMicMuted:async v=>{sdkLog.push('mic:'+v);},
      setVolume:async v=>{sdkLog.push('vol:'+v.volume);},
      endSession:async()=>{sdkLog.push('end');},
      sendContextualUpdate:()=>undefined,
    };
    globalThis.__fakeElevenLabs={startSession:async options=>{sdkOptions=options;return session;}};
    const app=new AppStore();
    app.patch({role:'patient'});
    const dispatcher=new ActionDispatcher(app);
    const voice=new ElevenLabsAdapter(()=>tokens.getToken(),async (name,args,gen)=>dispatcher.dispatchTool(name,args,gen));
    voice.subscribe(e=>{if(e.type==='state')app.patch({voice:e.state});if(e.type==='finalUserText')dispatcher.recordFinalUserText(e.text,e.generationId);});
    await voice.start({role:'patient',proactivityEnabled:false});
    assert.equal(voice.getState().phase,'active');
    assert.equal(sdkOptions.conversationToken,'ONLY_FAKE_WEBRTC_TOKEN');
    assert.equal(sdkOptions.connectionType,'webrtc');
    assert.deepEqual(sdkOptions.dynamicVariables,{role:'patient',proactivity_enabled:false});
    assert.equal(tokenRequests,1);
    assert.equal(JSON.parse(await sdkOptions.clientTools.openInfo({topicId:'stairs'})).ok,true);
    assert.equal(app.get().view,'info');
    assert.equal(JSON.parse(await sdkOptions.clientTools.proposeLogEntry({exerciseId:'chair_rise',when:'heute',comment:'fiktiv'})).code,'PENDING_CONFIRMATION');
    assert.equal(JSON.parse(await sdkOptions.clientTools.confirmLogEntry({confirmed:true})).code,'CONFIRMATION_REQUIRED');
    assert.equal(app.get().logbookEntries.length,2);
    assert.equal(dispatcher.dispatch({type:'CONFIRM_LOG_ENTRY',confirmed:true}).code,'CONFIRMED');
    assert.equal(app.get().logbookEntries.length,3);
    const stopper=voice.stop();
    assert.notEqual(voice.getState().phase,'active');
    assert.equal(JSON.parse(await sdkOptions.clientTools.setProactivity({enabled:true})).code,'STALE_SESSION');
    await stopper;
    assert.equal(voice.getState().phase,'off');
    assert.equal(app.get().proactivityEnabled,false);
    assert.deepEqual(sdkLog.slice(-3),['mic:true','vol:0','end']);
    // 401, 403, and 503 checks on the real handler via the same browser bridge.
    pinDialog.ask=async()=> 'wrong-test-passphrase';
    await assert.rejects(tokens.getToken(),e=>e.code==='ACCESS_DENIED');
    env.LIVE_ENABLED='false';
    await assert.rejects(tokens.getToken(),e=>e.code==='SERVICE_UNAVAILABLE');
    assert.equal(tokenRequests,1);
    status.push('HTTP/Provider/SDK/Dispatcher offline integration passed');
  } finally {globalThis.fetch=oldFetch;delete globalThis.__fakeElevenLabs;close();}
  assert.equal(status.length,1);
});
