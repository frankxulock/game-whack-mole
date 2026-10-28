/* 打地鼠界面 */
(function () {
  'use strict';

  var W = window.WhackMoleLogic;
  var T = window.TGMP;
  var HOLES = 9;
  var TICK_MS = 50;
  var BONK_MS = 220;

  var el = {};
  var holes = [];
  var classCache = [];
  var bonkUntil = [];
  var bonkGold = [];
  var engine = null;
  var loopId = null;
  var best = 0;
  var rounds = 0;
  var hostPaused = false;
  var ctxRef = null;

  function $(id) { return document.getElementById(id); }

  function now() {
    var p = window.performance;
    return p && typeof p.now === 'function' ? p.now() : Date.now();
  }

  function newEngine() {
    return W.createEngine({ durationMs: 30000, holes: HOLES, rng: Math.random, spawnIntervalMs: 850, upTimeMs: 1150 });
  }

  function buildField() {
    var html = '';
    for (var i = 0; i < HOLES; i++) {
      html += '<div class="hole" data-i="' + i + '"><div class="mound"></div><div class="pit">' +
        '<div class="mole"><svg viewBox="0 0 100 100"><use xlink:href="#mole" href="#mole"></use></svg></div>' +
        '</div></div>';
    }
    el.field.innerHTML = html;
    holes = [];
    for (var j = 0; j < HOLES; j++) {
      holes.push(el.field.children[j]);
      classCache.push('');
      bonkUntil.push(0);
      bonkGold.push(false);
    }
  }

  function computeLayout() {
    var w = el.stage.clientWidth;
    var h = el.stage.clientHeight;
    var size = Math.max(180, Math.min(w, h, 480));
    el.field.style.width = size + 'px';
    el.field.style.height = size + 'px';
  }

  function render() {
    var st = engine.getState();
    var t = now();
    for (var i = 0; i < HOLES; i++) {
      var bonk = bonkUntil[i] > t;
      var cls = 'hole';
      if (st.moles[i]) cls += ' up';
      else if (bonk) cls += ' up bonk';
      if (st.golden[i] || (bonk && !st.moles[i] && bonkGold[i])) cls += ' gold';
      if (cls !== classCache[i]) {
        holes[i].className = cls;
        classCache[i] = cls;
      }
    }
    var sec = Math.ceil(st.remainingMs / 1000);
    el.time.textContent = String(sec);
    el.timeBox.className = 'stat' + (st.status === 'running' && sec <= 5 ? ' warn' : '');
    el.score.textContent = String(st.score);
    el.best.textContent = String(Math.max(best, st.score));
    el.bar.style.width = (st.remainingMs / st.durationMs * 100).toFixed(1) + '%';
  }

  function startLoop() {
    if (loopId !== null) return;
    loopId = T.setInterval(onTick, TICK_MS);
  }

  function stopLoop() {
    if (loopId === null) return;
    T.clearTimer(loopId);
    loopId = null;
  }

  function onTick() {
    var st = engine.tick(now());
    render();
    if (st.status === 'ended') endRound();
  }

  function showOverlay(title, html, btn) {
    el.ovTitle.textContent = title;
    el.ovText.innerHTML = html;
    el.ovBtn.textContent = btn;
    el.overlay.className = 'overlay';
  }

  function overlayOpen() { return el.overlay.className.indexOf('hidden') < 0; }

  function startRound() {
    if (hostPaused) return;
    engine = newEngine();
    for (var i = 0; i < HOLES; i++) { bonkUntil[i] = 0; bonkGold[i] = false; }
    engine.start(now());
    el.overlay.className = 'overlay hidden';
    render();
    startLoop();
    T.reportEvent('game.start', { round: rounds + 1 });
  }

  function endRound() {
    stopLoop();
    var st = engine.getState();
    rounds++;
    var isNew = st.score > best;
    if (isNew) best = st.score;
    T.saveProgress({ v: 1, best: best, lastScore: st.score, rounds: rounds });
    T.reportEvent('game.over', { score: st.score, hits: st.hits, misses: st.misses, best: best });
    T.gameOver(st.score);
    render();
    T.setTimeout(render, BONK_MS + 20);
    showOverlay('时间到！',
      '本局得分 <b>' + st.score + '</b><br>' + (isNew && st.score > 0 ? '新纪录！' : '最高分 ' + best) +
      '<br>命中 ' + st.hits + ' · 落空 ' + st.misses,
      '再玩一次');
  }

  function popText(i, pts, gold) {
    var d = document.createElement('div');
    d.className = 'pop' + (gold ? ' gold' : '');
    d.textContent = '+' + pts;
    holes[i].appendChild(d);
    T.setTimeout(function () {
      if (d.parentNode) d.parentNode.removeChild(d);
    }, 620);
  }

  function whack(i) {
    if (!engine || hostPaused) return;
    if (engine.getState().status !== 'running') return;
    var r = engine.hit(i, now());
    if (r.hit) {
      bonkUntil[i] = now() + BONK_MS;
      bonkGold[i] = !!r.golden;
      popText(i, r.points, r.golden);
    }
    render();
    if (engine.getState().status === 'ended') endRound();
  }

  function holeIndex(target) {
    var n = target;
    while (n && n !== el.field) {
      if (n.getAttribute && n.getAttribute('data-i') !== null) return parseInt(n.getAttribute('data-i'), 10);
      n = n.parentNode;
    }
    return -1;
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var i = holeIndex(e.target);
    if (i < 0) return;
    if (e.cancelable) e.preventDefault();
    whack(i);
  }

  function onTouchStart(e) {
    if (e.cancelable) e.preventDefault();
    for (var k = 0; k < e.changedTouches.length; k++) {
      var t = e.changedTouches[k];
      var node = document.elementFromPoint(t.clientX, t.clientY) || e.target;
      var i = holeIndex(node);
      if (i >= 0) whack(i);
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    var i = holeIndex(e.target);
    if (i >= 0) whack(i);
  }

  // 数字键对应洞
  var KEYMAP = { '7': 0, '8': 1, '9': 2, '4': 3, '5': 4, '6': 5, '1': 6, '2': 7, '3': 8 };
  var LETTERS = { q: 0, w: 1, e: 2, a: 3, s: 4, d: 5, z: 6, x: 7, c: 8 };

  function onKey(e) {
    if (overlayOpen()) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        startRound();
      }
      return;
    }
    var k = String(e.key || '').toLowerCase();
    var i = KEYMAP.hasOwnProperty(k) ? KEYMAP[k] : LETTERS.hasOwnProperty(k) ? LETTERS[k] : -1;
    if (i >= 0) {
      e.preventDefault();
      whack(i);
    }
  }

  function setupTelegram() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) {}
  }

  function bind() {
    var opt = { passive: false };
    if (window.PointerEvent) {
      T.on(el.field, 'pointerdown', onPointerDown, opt);
    } else {
      T.on(el.field, 'touchstart', onTouchStart, opt);
      T.on(el.field, 'mousedown', onMouseDown);
    }
    T.on(document, 'touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, opt);
    T.on(document, 'gesturestart', function (e) { e.preventDefault(); }, opt);
    T.on(el.field, 'contextmenu', function (e) { e.preventDefault(); });
    T.on(el.ovBtn, 'click', startRound);
    T.on(window, 'keydown', onKey);
    T.on(window, 'resize', function () { T.setTimeout(computeLayout, 60); });
    T.on(window, 'orientationchange', function () { T.setTimeout(computeLayout, 200); });
    T.on(window, 'load', computeLayout);
  }

  T.createGame({
    initialize: function (ctx) {
      ctxRef = ctx;
      var b = ctx.build || window.TGMP_BUILD || {};
      document.body.className = 'theme-' + (b.theme || 'meadow');
      el.stage = $('stage');
      el.field = $('field');
      el.time = $('time');
      el.timeBox = el.time.parentNode;
      el.score = $('score');
      el.best = $('best');
      el.bar = $('bar');
      el.overlay = $('overlay');
      el.ovTitle = $('ov-title');
      el.ovText = $('ov-text');
      el.ovBtn = $('ov-btn');
      var badge = $('badge');
      badge.textContent = b.label || (b.version ? 'v' + b.version : '本地版');
      badge.title = (b.gameCode || '') + ' ' + (b.buildId || '');
      var p = ctx.progress;
      if (p && typeof p === 'object') {
        if (typeof p.best === 'number' && isFinite(p.best) && p.best > 0) best = Math.floor(p.best);
        if (typeof p.rounds === 'number' && isFinite(p.rounds) && p.rounds > 0) rounds = Math.floor(p.rounds);
      }
      engine = newEngine();
      buildField();
      setupTelegram();
      bind();
    },
    start: function () {
      computeLayout();
      T.setTimeout(computeLayout, 300);
      render();
      T.reportEvent('game.ready', { best: best, build: ctxRef && ctxRef.buildId ? ctxRef.buildId : '' });
    },
    pause: function () {
      hostPaused = true;
      if (engine && engine.getState().status === 'running') engine.pause(now());
      stopLoop();
    },
    resume: function () {
      hostPaused = false;
      if (engine && engine.getState().status === 'paused') {
        engine.resume(now());
        startLoop();
      }
    },
    destroy: function () {
      stopLoop();
      hostPaused = true;
    }
  });
})();
