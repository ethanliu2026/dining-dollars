const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../account-store.js');

function harness(rows = new Map(), drafts = new Map()) {
  const events = [], states = [];
  const control = { fail: false, beforeWrite: null };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const client = {
    from() {
      let operation = 'read', payload, id, version;
      return {
        select() { return this; },
        eq(key, value) { if (key === 'user_id') id = value; if (key === 'version') version = value; return this; },
        insert(value) { operation = 'insert'; payload = value; id = value.user_id; return this; },
        update(value) { operation = 'update'; payload = value; return this; },
        async maybeSingle() {
          if (operation !== 'read' && control.beforeWrite) await control.beforeWrite();
          if (control.fail) return { error: { message: 'offline' } };
          if (operation === 'read') return { data: clone(rows.get(id)) || null };
          if (operation === 'insert' && rows.has(id)) return { error: { code: '23505' } };
          if (operation === 'update' && rows.get(id)?.version !== version) return { data: null };
          rows.set(id, clone(payload));
          return { data: { version: payload.version } };
        },
      };
    },
  };
  const store = new globalThis.AccountStore({ client, delay: 60000,
    storage: { getItem: k => drafts.get(k), setItem: (k, v) => drafts.set(k, v), removeItem: k => drafts.delete(k) },
    onState: value => states.push(clone(value)),
    onStatus: (kind, message) => events.push({ kind, message }),
  });
  return { store, rows, drafts, events, states, control };
}

test('switching accounts clears previous data before loading the new account', async () => {
  const h = harness(new Map([['alice', { state: { txns: ['private'] }, version: 1 }]]));
  await h.store.connect('alice');
  assert.deepEqual(h.states.at(-1), { txns: ['private'] });
  const connection = h.store.connect('bob');
  assert.equal(h.states.at(-1), null);
  await connection;
  assert.equal(h.states.at(-1), null);
  assert.equal(h.rows.has('bob'), false);
});

test('writes use the current user ID and do not change another user’s records', async () => {
  const h = harness(new Map([['alice', { state: { txns: ['private'] }, version: 1 }]]));
  await h.store.connect('bob');
  h.store.save({ txns: ['lunch'] });
  await h.store.flush();
  assert.deepEqual(h.rows.get('bob').state, { txns: ['lunch'] });
  assert.deepEqual(h.rows.get('alice').state, { txns: ['private'] });
  assert.equal(h.drafts.size, 0);
});

test('failed writes preserve a draft, which a new page can recover and retry', async () => {
  const h = harness();
  await h.store.connect('alice');
  h.control.fail = true;
  h.store.save({ txns: ['offline lunch'] });
  await assert.rejects(h.store.flush());
  assert.equal(h.events.at(-1).kind, 'error');
  const restored = harness(h.rows, h.drafts);
  await restored.store.connect('alice');
  assert.deepEqual(restored.rows.get('alice').state, { txns: ['offline lunch'] });
  assert.equal(restored.drafts.size, 0);
});

test('stale devices cannot overwrite a newer cloud version', async () => {
  const rows = new Map([['alice', { state: { txns: [] }, version: 1 }]]);
  const first = harness(rows), second = harness(rows);
  await first.store.connect('alice'); await second.store.connect('alice');
  first.store.save({ txns: ['first device'] }); await first.store.flush();
  second.store.save({ txns: ['second device'] });
  await assert.rejects(second.store.flush(), /CONFLICT/);
  assert.deepEqual(rows.get('alice').state, { txns: ['first device'] });
  assert.equal(second.store.pending.state.txns[0], 'second device');
  await second.store.loadCloud();
  assert.equal(second.store.pending, null);
  assert.deepEqual(second.states.at(-1), { txns: ['first device'] });
});

test('two devices creating the first record cannot overwrite each other', async () => {
  const rows = new Map(), first = harness(rows), second = harness(rows);
  await first.store.connect('alice'); await second.store.connect('alice');
  first.store.save({ txns: ['first'] }); second.store.save({ txns: ['second'] });
  await first.store.flush();
  await assert.rejects(second.store.flush(), /CONFLICT/);
  assert.equal(rows.get('alice').state.txns[0], 'first');
});

test('failed initial reads never create or overwrite a cloud record', async () => {
  const h = harness(); h.control.fail = true;
  await h.store.connect('alice');
  h.store.save({ txns: ['must not save'] });
  await h.store.flush();
  assert.equal(h.store.ready, false);
  assert.equal(h.rows.size, 0);
  assert.equal(h.events.at(-1).kind, 'error');
});

test('an in-flight save does not restore a previous account after sign-out', async () => {
  const h = harness();
  await h.store.connect('alice');
  let release;
  h.control.beforeWrite = () => new Promise(resolve => { release = resolve; });
  h.store.save({ txns: ['private'] });
  const saving = h.store.flush();
  await h.store.connect(null);
  release(); await saving;
  assert.equal(h.store.userId, null);
  assert.equal(h.states.at(-1), null);
  assert.equal(h.events.at(-1).kind, 'guest');
});

test('edits made during a save are serialized and both reach the cloud', async () => {
  const h = harness();
  await h.store.connect('alice');
  let release;
  h.control.beforeWrite = () => new Promise(resolve => { release = resolve; });
  h.store.save({ txns: ['one'] });
  const saving = h.store.flush();
  h.store.save({ txns: ['one', 'two'] });
  h.control.beforeWrite = null;
  release(); await saving;
  assert.deepEqual(h.rows.get('alice').state.txns, ['one', 'two']);
  assert.equal(h.rows.get('alice').version, 2);
  assert.equal(h.store.pending, null);
});

test('a recovered draft based on an older version is surfaced as a conflict', async () => {
  const h = harness(new Map([['alice', { state: { txns: ['cloud'] }, version: 3 }]]),
    new Map([['ddt.account-draft.alice', JSON.stringify({ version: 2, state: { txns: ['draft'] } })]]));
  await h.store.connect('alice');
  assert.equal(h.store.conflict, true);
  assert.deepEqual(h.states.at(-1), { txns: ['draft'] });
  assert.deepEqual(h.rows.get('alice').state, { txns: ['cloud'] });
});
