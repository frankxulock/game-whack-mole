/* TGMP 游戏 SDK v1 */
(function (root) {
  'use strict';

  var NS = 'tgmp';
  var VER = 1;
  var hash = parseHash(root.location ? root.location.hash : '');
  var nonce = hash.nonce || '';
  var parentOrigin = hash.po || '';
  var embedded = !!(root.parent && root.parent !== root && nonce && parentOrigin);

  var game = null;
  var ctx = null;
  var state = 'idle'; // 生命周期状态
  var listeners = [];
  var timers = [];
  var pausedByHost = false;
  var pausedByVisibility = false;

  function parseHash(h) {
    var out = {};
    (h || '').replace(/^#/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      if (i < 0) return;
      try {
        out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      } catch (e) { /* 忽略坏参数 */ }
    });
    return out;
  }

  function post(type, payload) {
    if (!embedded) return;
    try {
      root.parent.postMessage({ ns: NS, v: VER, type: type, nonce: nonce, payload: payload || {} }, parentOrigin);
    } catch (e) { /* 宿主已卸载 */ }
  }

  function call(name, arg) {
    if (game && typeof game[name] === 'function') {
      try { game[name](arg); } catch (e) { if (root.console) console.error('[tgmp]', name, e); }
    }
  }

  function applyPause() {
    var want = pausedByHost || pausedByVisibility;
    if (want && state === 'running') { state = 'paused'; call('pause'); }
    else if (!want && state === 'paused') { state = 'running'; call('resume'); }
  }

  function boot(c) {
    if (ctx || state === 'destroyed') return;
    ctx = Object.freeze(c);
    call('initialize', ctx);
    state = 'running';
    call('start');
    post('started', {});
    applyPause();
  }

  function destroy() {
    if (state === 'destroyed') return;
    state = 'destroyed';
    call('destroy');
    timers.forEach(function (t) { t.kind === 'i' ? clearInterval(t.id) : clearTimeout(t.id); });
    timers = [];
    listeners.forEach(function (l) { l.target.removeEventListener(l.type, l.fn, l.opts); });
    listeners = [];
  }

  function onHostMessage(ev) {
    if (ev.source !== root.parent || ev.origin !== parentOrigin) return;
    var m = ev.data;
    if (!m || m.ns !== NS || m.v !== VER || m.nonce !== nonce || typeof m.type !== 'string') return;
    var p = m.payload || {};
    switch (m.type) {
      case 'init':
        if (typeof p.sessionId !== 'string' || typeof p.gameCode !== 'string') return;
        boot({
          gameCode: p.gameCode, buildId: String(p.buildId || ''), sessionId: p.sessionId,
          progress: p.progress && typeof p.progress === 'object' ? p.progress : null,
          theme: p.theme || {}, standalone: false, build: root.TGMP_BUILD || {}
        });
        break;
      case 'pause': pausedByHost = true; applyPause(); break;
      case 'resume': pausedByHost = false; applyPause(); break;
      case 'destroy': destroy(); break;
    }
  }

  function localKey() {
    var b = root.TGMP_BUILD || {};
    return 'tgmp:progress:' + (b.gameCode || 'game');
  }

  var TGMP = {
    embedded: embedded,
    /** 注册游戏生命周期 */
    createGame: function (g) {
      if (game) throw new Error('game already registered');
      game = g;
      if (embedded) {
        root.addEventListener('message', onHostMessage);
        post('ready', {});
      } else {
        var b = root.TGMP_BUILD || {};
        var saved = null;
        try { saved = JSON.parse(root.localStorage.getItem(localKey()) || 'null'); } catch (e) { saved = null; }
        boot({ gameCode: b.gameCode || '', buildId: b.buildId || '', sessionId: 'standalone',
          progress: saved, theme: {}, standalone: true, build: b });
      }
      return TGMP;
    },
    reportEvent: function (name, data) {
      if (typeof name !== 'string' || !/^[a-z0-9_.]{1,40}$/.test(name)) return;
      post('event', { name: name, data: data || {} });
    },
    saveProgress: function (data) {
      var json;
      try { json = JSON.stringify(data); } catch (e) { return; }
      if (!json || json.length > 16000) return;
      if (embedded) post('progress', { data: data });
      else { try { root.localStorage.setItem(localKey(), json); } catch (e) { /* 无存储 */ } }
    },
    gameOver: function (score) { post('gameover', { score: Number(score) || 0 }); },
    exit: function () { post('exit', {}); },
    on: function (target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push({ target: target, type: type, fn: fn, opts: opts });
    },
    setTimeout: function (fn, ms) {
      var id = root.setTimeout(function () {
        timers = timers.filter(function (t) { return t.id !== id; });
        fn();
      }, ms);
      timers.push({ id: id, kind: 't' });
      return id;
    },
    setInterval: function (fn, ms) {
      var id = root.setInterval(fn, ms);
      timers.push({ id: id, kind: 'i' });
      return id;
    },
    clearTimer: function (id) {
      timers = timers.filter(function (t) {
        if (t.id === id) { t.kind === 'i' ? clearInterval(id) : clearTimeout(id); return false; }
        return true;
      });
    },
    get state() { return state; },
    get context() { return ctx; }
  };

  if (root.document) {
    root.document.addEventListener('visibilitychange', function () {
      pausedByVisibility = root.document.visibilityState === 'hidden';
      applyPause();
    });
    root.addEventListener('pagehide', destroy);
  }
  root.TGMP = TGMP;
})(typeof window !== 'undefined' ? window : this);
