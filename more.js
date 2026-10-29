/* 已上线的小游戏互相引流。页面上放 data-play-more="自己的 id"。 */
(function () {
  'use strict';

  var GAMES = [
    {
      id: 'water-sort',
      href: 'https://frankxulock.github.io/water-sort/',
      mark: '💧',
      name: {
        'zh-CN': '倒水排序', 'zh-TW': '倒水排序', en: 'Water Sort', ja: '水ソート', ko: '물정렬',
        ru: 'Вода', es: 'Agua', pt: 'Água', vi: 'Xếp nước', id: 'Air', th: 'เรียงน้ำ', tr: 'Su'
      }
    },
    {
      id: 'cinderwell',
      href: 'https://frankxulock.github.io/cinderwell/',
      mark: '🏮',
      name: {
        'zh-CN': '烬井', 'zh-TW': '燼井', en: 'Cinderwell', ja: '燼井', ko: '신더웰',
        ru: 'Огонёк', es: 'Cinderwell', pt: 'Cinderwell', vi: 'Cinderwell', id: 'Cinderwell', th: 'Cinderwell', tr: 'Cinderwell'
      }
    },
    {
      id: 'whack',
      href: 'https://frankxulock.github.io/game-whack-mole/',
      mark: '🔨',
      name: {
        'zh-CN': '打地鼠', 'zh-TW': '打地鼠', en: 'Whack-a-Mole', ja: 'モグラたたき', ko: '두더지',
        ru: 'Крот', es: 'Topos', pt: 'Toupeira', vi: 'Đập chuột', id: 'Tikus', th: 'ตุ่น', tr: 'Köstebek'
      }
    }
  ];

  var LABEL = {
    'zh-CN': '也来玩', 'zh-TW': '也來玩', en: 'Also play', ja: 'ほかのゲーム', ko: '다른 게임',
    ru: 'Ещё игры', es: 'También', pt: 'Também', vi: 'Chơi thêm', id: 'Lainnya', th: 'เกมอื่น', tr: 'Diğer'
  };

  var selfId = '';

  function code() {
    var raw = '';
    try {
      if (window.WaterI18n && window.WaterI18n.code) raw = window.WaterI18n.code();
      else if (window.CinderwellI18n && window.CinderwellI18n.getLang) raw = window.CinderwellI18n.getLang();
    } catch (e) {}
    if (!raw) raw = document.documentElement.lang || (navigator.language || 'en');
    raw = String(raw).toLowerCase();
    if (raw.indexOf('zh') === 0) return /tw|hk|mo|hant/.test(raw) ? 'zh-TW' : 'zh-CN';
    var base = raw.split('-')[0];
    return LABEL[base] ? base : 'en';
  }

  function paint() {
    var nodes = document.querySelectorAll('[data-play-more]');
    if (!nodes.length) return;
    if (!selfId) selfId = nodes[0].getAttribute('data-play-more') || '';
    var lang = code();
    var label = LABEL[lang] || LABEL.en;
    var html = '<span class="more-label">' + label + '</span>';
    var g;
    for (g = 0; g < GAMES.length; g++) {
      var game = GAMES[g];
      if (game.id === selfId) continue;
      var name = game.name[lang] || game.name.en;
      var href = game.href + '?from=' + encodeURIComponent(selfId);
      html += '<a class="more-link" href="' + href + '">' + game.mark + ' ' + name + '</a>';
    }
    var i;
    for (i = 0; i < nodes.length; i++) nodes[i].innerHTML = html;
  }

  document.addEventListener('click', function (e) {
    var node = e.target;
    while (node && node !== document) {
      if (node.classList && node.classList.contains('more-link')) break;
      node = node.parentNode;
    }
    if (!node || node === document) return;
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData && typeof tg.openLink === 'function') {
      e.preventDefault();
      tg.openLink(node.href);
    }
  });

  function boot() {
    var first = document.querySelector('[data-play-more]');
    if (first) selfId = first.getAttribute('data-play-more') || '';
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.PlayMore = { paint: paint };
})();
