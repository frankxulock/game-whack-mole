/* 打地鼠纯引擎 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WhackMoleLogic = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // 可复现随机数
  function seededRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createEngine(opts) {
    opts = opts || {};
    var duration = opts.durationMs > 0 ? opts.durationMs : 30000;
    var holes = opts.holes > 0 ? opts.holes : 9;
    var rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    var baseInterval = opts.spawnIntervalMs > 0 ? opts.spawnIntervalMs : 800;
    var baseUp = opts.upTimeMs > 0 ? opts.upTimeMs : 1100;
    var firstSpawn = opts.firstSpawnMs >= 0 ? opts.firstSpawnMs : 300;
    var goldenChance = opts.goldenChance >= 0 ? opts.goldenChance : 0.08;
    var goldenPoints = opts.goldenPoints > 0 ? opts.goldenPoints : 3;
    var speedUp = opts.speedUp >= 0 ? opts.speedUp : 0.45;

    var status = 'ready';
    var elapsed = 0;
    var lastNow = 0;
    var score = 0;
    var hits = 0;
    var misses = 0;
    var spawned = 0;
    var nextSpawnAt = 0;
    var moles = [];

    function resetMoles() {
      moles = [];
      for (var i = 0; i < holes; i++) moles.push({ up: false, until: 0, golden: false });
    }
    resetMoles();

    // 随进度加速
    function factor(t) { return 1 - speedUp * Math.min(1, t / duration); }

    function hideExpired(t) {
      for (var i = 0; i < holes; i++) {
        if (moles[i].up && moles[i].until <= t) moles[i].up = false;
      }
    }

    function spawnAt(t) {
      var empty = [];
      for (var i = 0; i < holes; i++) if (!moles[i].up) empty.push(i);
      if (!empty.length) return;
      var idx = empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))];
      var golden = rng() < goldenChance;
      var up = Math.round(baseUp * factor(t) * (golden ? 0.7 : 1));
      moles[idx] = { up: true, until: t + up, golden: golden };
      spawned++;
    }

    function advance(to) {
      if (to > duration) to = duration;
      while (nextSpawnAt <= to && nextSpawnAt < duration) {
        var t = nextSpawnAt;
        hideExpired(t);
        spawnAt(t);
        nextSpawnAt = t + Math.max(200, Math.round(baseInterval * factor(t)));
      }
      hideExpired(to);
      elapsed = to;
      if (elapsed >= duration) {
        status = 'ended';
        for (var i = 0; i < holes; i++) moles[i].up = false;
      }
    }

    function tick(now) {
      if (status !== 'running') return getState();
      var dt = now - lastNow;
      lastNow = now;
      if (dt > 0) advance(elapsed + dt);
      return getState();
    }

    function start(now) {
      status = 'running';
      elapsed = 0;
      lastNow = now;
      score = 0;
      hits = 0;
      misses = 0;
      spawned = 0;
      nextSpawnAt = firstSpawn;
      resetMoles();
      advance(0);
      return getState();
    }

    function hit(i, now) {
      tick(now);
      if (status !== 'running' || i < 0 || i >= holes || Math.floor(i) !== i) {
        return { hit: false, score: score, points: 0 };
      }
      var m = moles[i];
      if (m.up) {
        var pts = m.golden ? goldenPoints : 1;
        m.up = false;
        score += pts;
        hits++;
        return { hit: true, score: score, points: pts, golden: m.golden };
      }
      misses++;
      return { hit: false, score: score, points: 0 };
    }

    function pause(now) {
      if (status !== 'running') return getState();
      tick(now);
      if (status === 'running') status = 'paused';
      return getState();
    }

    function resume(now) {
      if (status !== 'paused') return getState();
      status = 'running';
      lastNow = now;
      return getState();
    }

    function getState() {
      var up = [];
      var gold = [];
      for (var i = 0; i < holes; i++) {
        up.push(moles[i].up);
        gold.push(moles[i].up && moles[i].golden);
      }
      return {
        status: status,
        remainingMs: Math.max(0, duration - elapsed),
        elapsedMs: elapsed,
        durationMs: duration,
        score: score,
        moles: up,
        golden: gold,
        hits: hits,
        misses: misses,
        spawned: spawned
      };
    }

    return { start: start, tick: tick, hit: hit, pause: pause, resume: resume, getState: getState };
  }

  return { createEngine: createEngine, seededRng: seededRng };
});
