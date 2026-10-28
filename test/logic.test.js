'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../logic.js');

function engine(extra) {
  return W.createEngine(Object.assign({
    durationMs: 30000, holes: 9, rng: W.seededRng(42),
    spawnIntervalMs: 800, upTimeMs: 1100, goldenChance: 0
  }, extra || {}));
}

function firstUp(st) { return st.moles.indexOf(true); }

function runUntilMole(e, t0) {
  let t = t0;
  for (let i = 0; i < 200; i++) {
    t += 50;
    const st = e.tick(t);
    if (firstUp(st) >= 0) return t;
  }
  throw new Error('no mole');
}

test('初始为 ready', () => {
  const st = engine().getState();
  assert.equal(st.status, 'ready');
  assert.equal(st.remainingMs, 30000);
  assert.equal(st.moles.length, 9);
});

test('30 秒整结束', () => {
  const e = engine();
  e.start(1000);
  let st = e.tick(1000 + 29999);
  assert.equal(st.status, 'running');
  assert.equal(st.remainingMs, 1);
  st = e.tick(1000 + 30000);
  assert.equal(st.status, 'ended');
  assert.equal(st.remainingMs, 0);
  assert.ok(st.moles.every((m) => !m));
  st = e.tick(1000 + 90000);
  assert.equal(st.remainingMs, 0);
});

test('小步推进同样结束', () => {
  const e = engine();
  e.start(0);
  let st;
  for (let t = 50; t <= 30000; t += 50) st = e.tick(t);
  assert.equal(st.status, 'ended');
  assert.equal(st.remainingMs, 0);
});

test('暂停时间不计', () => {
  const e = engine();
  e.start(0);
  e.tick(10000);
  let st = e.pause(10000);
  assert.equal(st.status, 'paused');
  st = e.tick(50000);
  assert.equal(st.remainingMs, 20000);
  assert.equal(e.hit(0, 50000).hit, false);
  st = e.resume(60000);
  assert.equal(st.status, 'running');
  st = e.tick(60000 + 19999);
  assert.equal(st.status, 'running');
  assert.equal(st.remainingMs, 1);
  st = e.tick(80000);
  assert.equal(st.status, 'ended');
});

test('命中地鼠得分并隐藏', () => {
  const e = engine();
  e.start(0);
  const t = runUntilMole(e, 0);
  const idx = firstUp(e.getState());
  const r = e.hit(idx, t);
  assert.equal(r.hit, true);
  assert.equal(r.score, 1);
  const st = e.getState();
  assert.equal(st.moles[idx], false);
  assert.equal(st.hits, 1);
});

test('重复点击不重复得分', () => {
  const e = engine();
  e.start(0);
  const t = runUntilMole(e, 0);
  const idx = firstUp(e.getState());
  e.hit(idx, t);
  const r2 = e.hit(idx, t + 10);
  assert.equal(r2.hit, false);
  assert.equal(r2.score, 1);
  assert.equal(e.getState().score, 1);
});

test('空洞不得分', () => {
  const e = engine();
  e.start(0);
  const t = runUntilMole(e, 0);
  const st = e.getState();
  const empty = st.moles.indexOf(false);
  const r = e.hit(empty, t);
  assert.equal(r.hit, false);
  assert.equal(r.score, 0);
  assert.equal(e.getState().misses, 1);
  assert.equal(e.hit(99, t).hit, false);
});

test('结束后不能得分', () => {
  const e = engine();
  e.start(0);
  e.tick(30000);
  for (let i = 0; i < 9; i++) assert.equal(e.hit(i, 30001).hit, false);
  assert.equal(e.getState().score, 0);
  assert.equal(e.getState().status, 'ended');
});

test('地鼠到时缩回', () => {
  const e = engine({ spawnIntervalMs: 100000, speedUp: 0 });
  e.start(0);
  let st = e.tick(300);
  assert.equal(st.moles.filter(Boolean).length, 1);
  st = e.tick(300 + 1099);
  assert.equal(st.moles.filter(Boolean).length, 1);
  st = e.tick(300 + 1100);
  assert.equal(st.moles.filter(Boolean).length, 0);
});

test('同种子出地鼠可复现', () => {
  function trace(step) {
    const e = engine({ rng: W.seededRng(7), goldenChance: 0.1 });
    e.start(0);
    const out = [];
    for (let t = step; t <= 30000; t += step) {
      const st = e.tick(t);
      if (t % 1000 === 0) out.push(st.moles.map((m) => (m ? 1 : 0)).join('') + st.golden.map((g) => (g ? 1 : 0)).join(''));
    }
    return { out, spawned: e.getState().spawned };
  }
  const a = trace(50);
  const b = trace(50);
  const c = trace(250);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  assert.ok(a.spawned > 30);
  const d = (() => {
    const e = engine({ rng: W.seededRng(8) });
    e.start(0);
    const o = [];
    for (let t = 1000; t <= 30000; t += 1000) o.push(e.tick(t).moles.join());
    return o;
  })();
  assert.notDeepEqual(a.out, d);
});

test('金色地鼠加分', () => {
  const e = engine({ goldenChance: 1, spawnIntervalMs: 100000 });
  e.start(0);
  const st = e.tick(300);
  const idx = firstUp(st);
  assert.equal(st.golden[idx], true);
  const r = e.hit(idx, 300);
  assert.equal(r.points, 3);
  assert.equal(r.score, 3);
});

test('后期变快', () => {
  const e = engine();
  e.start(0);
  e.tick(10000);
  const early = e.getState().spawned;
  e.tick(30000);
  const late = e.getState().spawned - early;
  assert.ok(late > early * 2);
});

test('可重新开始', () => {
  const e = engine();
  e.start(0);
  e.tick(30000);
  const st = e.start(40000);
  assert.equal(st.status, 'running');
  assert.equal(st.remainingMs, 30000);
  assert.equal(st.score, 0);
});
