import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AccessError, WorkerSessionTokenProvider, type PinDialog} from '../src/access/token.ts';

const fakeDialog = (pin = 'test-only-long-pin') => ({
  ask: async () => pin,
  cancel: () => undefined,
}) as unknown as PinDialog;

// No browser DOM and no real Provider endpoint: inspect the actual fetch contract.
test('PIN to Worker: exact API v1.0 payload, no cookies or public-Agent fallback', async () => {
  const oldFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    called++;
    assert.equal(input, 'https://worker.example/api/session');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.referrerPolicy, 'no-referrer');
    assert.equal(init?.headers && (init.headers as Record<string,string>)['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(init?.body)), {pin:'test-only-long-pin'});
    return Response.json({conversationToken:'offline-fake-token'});
  };
  try {
    const service = new WorkerSessionTokenProvider('https://worker.example/', fakeDialog());
    assert.equal(await service.getToken(), 'offline-fake-token');
    assert.equal(called,1);
  } finally { globalThis.fetch = oldFetch; }
});

test('401 wrong PIN is rejected, never replaced with public agent mode', async () => {
  const oldFetch = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {count++;return Response.json({error:'ACCESS_DENIED',message:'Keine Freigabe.'},{status:401});};
  try {
    await assert.rejects(new WorkerSessionTokenProvider('https://worker.example', fakeDialog()).getToken(),
      (e: unknown) => e instanceof AccessError && e.code==='ACCESS_DENIED');
    assert.equal(count,1);
  } finally {globalThis.fetch=oldFetch;}
});

test('429 is fail-closed, no automatic retries', async () => {
  const oldFetch = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {count++;return Response.json({error:'RATE_LIMITED',message:'Gesperrt.'},{status:429});};
  try {
    await assert.rejects(new WorkerSessionTokenProvider('https://worker.example', fakeDialog()).getToken(),
      (e: unknown) => e instanceof AccessError && e.code==='RATE_LIMITED');
    assert.equal(count,1);
  } finally {globalThis.fetch=oldFetch;}
});

test('invalid body and non-HTTPS Worker base fail closed', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({wrong:'field'});
  try {
    await assert.rejects(new WorkerSessionTokenProvider('https://worker.example',fakeDialog()).getToken(),
      (e: unknown) => e instanceof AccessError && e.code==='UPSTREAM_FAILURE');
    await assert.rejects(new WorkerSessionTokenProvider('http://worker.example',fakeDialog()).getToken(),
      (e: unknown) => e instanceof AccessError && e.code==='SERVICE_UNAVAILABLE');
  } finally {globalThis.fetch=oldFetch;}
});
