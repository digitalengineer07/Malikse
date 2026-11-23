const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: sleep } = require("node:timers/promises");
const { ChatOutbox } = require("../src/features/chat/chatOutbox.ts");
const { InboxFeed } = require("../src/features/chat/inboxFeed.ts");
const { parseInbox, confirmedMessage, retryDelay, chatRetryDelay } = require("../src/features/chat/chatWire.ts");

const draft = id => ({ id, thread: "thread", key: "key-" + id, text: "test",
  createdAt: new Date().toISOString(), attempts: 0, retryAt: 0 });
const ack = item => ({ _id: item.id, senderId: "advisor", text: item.text, createdAt: item.createdAt });
async function until(predicate) {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    assert(Date.now() < deadline, "Timed out waiting for state change");
    await sleep(5);
  }
}
function disk(send, classify = () => ({ delay: 15 })) {
  let data = [];
  return { read: async () => structuredClone(data), save: async rows => { data = structuredClone(rows); }, send, classify };
}

test("failed first read, failed refresh and genuine empty inbox remain distinguishable", async () => {
  let response = "<html>unavailable</html>", calls = 0;
  const feed = new InboxFeed(async () => { calls++; return parseInbox(response); });
  await Promise.all([feed.refresh(), feed.refresh()]);
  assert.equal(calls, 1);
  assert.equal(feed.snapshot().rows, undefined);
  response = [{ _id: "conversation" }];
  await feed.refresh();
  response = null;
  await feed.refresh();
  assert.equal(feed.snapshot().rows[0]._id, "conversation");
  response = [];
  await feed.refresh();
  assert.deepEqual(feed.snapshot(), { rows: [], failures: 0 });
});

test("an unconfirmed commit survives restart, replays once with the same key, and keeps send order", async t => {
  const committed = new Map(), calls = [];
  const transport = disk(async item => {
    calls.push(item.key);
    committed.set(item.key, ack(item));
    if (calls.length === 1) throw Error("response lost");
    return confirmedMessage({ messages: [committed.get(item.key)] }, item.id);
  }, () => ({ delay: 150 }));
  const first = new ChatOutbox(transport);
  t.after(() => first.close());
  await Promise.all([first.enqueue(draft("a")), first.enqueue(draft("b"))]);
  first.setActive(true);
  await until(() => first.snapshot()[0]?.attempts === 1);
  await first.close();
  const second = new ChatOutbox(transport);
  t.after(() => second.close());
  second.setActive(true);
  await until(() => calls.length === 3 && !second.snapshot().length);
  assert.deepEqual(calls, ["key-a", "key-a", "key-b"]);
  assert.equal(committed.size, 2);
  assert.deepEqual(await transport.read(), []);
});

test("transcript confirmation cancels replay and only clears the matching message", async t => {
  const box = new ChatOutbox(disk(() => { throw Error("offline"); }));
  t.after(() => box.close());
  await box.enqueue(draft("a"));
  await box.enqueue(draft("b"));
  await box.reconcile("another thread", [ack(draft("a"))]);
  assert.equal(box.snapshot().length, 2);
  await box.reconcile("thread", [ack(draft("a"))]);
  assert.deepEqual(box.snapshot().map(row => row.id), ["b"]);
});

test("rejected sends stop, later messages continue, and a manual retry reuses its key", async t => {
  const calls = [];
  const box = new ChatOutbox(disk(async item => {
    calls.push(item.key);
    if (calls.length === 1) throw Error("Conversation is read-only");
    return ack(item);
  }, error => ({ failure: error.message })));
  t.after(() => box.close());
  await box.enqueue(draft("a"));
  await box.enqueue(draft("b"));
  box.setActive(true);
  await until(() => calls.length === 2 && box.snapshot().length === 1);
  assert.equal(box.snapshot()[0].failure, "Conversation is read-only");
  await box.retry("a");
  await until(() => !box.snapshot().length);
  assert.deepEqual(calls, ["key-a", "key-b", "key-a"]);
});

test("a missing or unrelated acknowledgement cannot confirm a send and Retry-After is a floor", () => {
  assert.throws(() => confirmedMessage("<html/>", "a"));
  assert.throws(() => confirmedMessage({ messages: [ack(draft("b"))] }, "a"));
  assert(retryDelay(0, "45") >= 45000);
  const now = Date.UTC(2026, 0, 1);
  assert(retryDelay(1, new Date(now + 90000).toUTCString(), now) >= 90000);
  assert(chatRetryDelay(0, 429) >= 30000);
  assert(chatRetryDelay(1, 429) >= 60000);
  assert(chatRetryDelay(2, 429, "300") >= 300000);
});

test("a throttled transcript suppresses poll and history requests until Retry-After expires", async () => {
  const fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript");
  const file = require.resolve("../src/features/chat/chatApi.ts");
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let calls = 0, now = Date.now();
  const mockApi = { get: async () => {
    if (++calls === 1) throw Object.assign(Error("429"), { response: { status: 429, headers: { "retry-after": "75" } } });
    return { data: { messages: [] } };
  } };
  const deps = {
    "../../services/authService": { __esModule: true, default: mockApi }, "./chatWire": require("../src/features/chat/chatWire.ts"),
    "../../store/authStore": { useAuthStore: { subscribe() {}, getState: () => ({ user: { id: "buyer" } }) } },
    axios: { isAxiosError: error => Boolean(error.response) },
  };
  const output = {};
  vm.runInNewContext(js, { exports: output, require: key => deps[key], console: { warn() {} },
    Date: class extends Date { static now() { return now; } } });
  const { chatApi, transcriptRetryAt } = output;
  await assert.rejects(chatApi.getMessages("thread"), /429/);
  assert(transcriptRetryAt("thread") >= now + 75000);
  now += 70000;
  await assert.rejects(chatApi.getMessages("thread"), /deferred/);
  await assert.rejects(chatApi.getMessages("thread", 12), /deferred/);
  assert.equal(calls, 1);
  now += 6000;
  await chatApi.getMessages("thread");
  assert.equal(transcriptRetryAt("thread"), 0);
  assert.equal(calls, 2);
});
