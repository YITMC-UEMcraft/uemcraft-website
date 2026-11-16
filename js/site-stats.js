/* ============================================================
   site-stats.js — 首页 Hero 社团数据
   数据：/api/stats.php?action=list（后台「首页数据」可管理）
   接口为空或失败时回退到内置默认值，保证首页不空白。
   数值中的数字带滚动跳动动画（与 reveal.js 同款缓动，1500ms）。
   ============================================================ */
(function () {
  'use strict';

  var wrap = document.getElementById('heroStats');
  if (!wrap) return;

  var FALLBACK = [
    { label: '注册成员', value: '150+' },
    { label: '建筑作品', value: '1+' },
    { label: '已办活动', value: '5+' }
  ];
  var DURATION = 1500;

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  /* 把 "150+" 拆成 前缀 + 数字 + 后缀：数字部分做跳动动画，其余原样保留 */
  function renderValue(value) {
    var match = /(\d+)/.exec(String(value));
    if (!match) return escapeHtml(value);
    var prefix = value.slice(0, match.index);
    var suffix = value.slice(match.index + match[1].length);
    return escapeHtml(prefix)
      + '<span class="stat-count" data-target="' + match[1] + '">0</span>'
      + escapeHtml(suffix);
  }

  function render(list) {
    var html = '';
    list.forEach(function (stat) {
      html += '<div class="hero-stat">'
        + '<div class="hs-num">' + renderValue(stat.value) + '</div>'
        + '<div class="hs-lbl">' + escapeHtml(stat.label) + '</div>'
        + '</div>';
    });
    wrap.innerHTML = html;
    animateCounts();
  }

  /* 数字跳动：IntersectionObserver 进入视口后播放（与 reveal.js 同款缓动） */
  function animateCounts() {
    var counters = wrap.querySelectorAll('.stat-count[data-target]');
    if (!counters.length) return;

    function play(el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(target)) return;
      var start = performance.now();
      function tick(now) {
        var elapsed = now - start;
        var progress = Math.min(elapsed / DURATION, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target;
      }
      requestAnimationFrame(tick);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(function (el) { el.textContent = el.getAttribute('data-target'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          play(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { obs.observe(el); });
  }

  render(FALLBACK);

  fetch('/api/stats.php?action=list').then(function (res) {
    return res.json();
  }).then(function (json) {
    if (json && json.success && json.data && json.data.length) {
      render(json.data);
    }
  }).catch(function () {});
})();
