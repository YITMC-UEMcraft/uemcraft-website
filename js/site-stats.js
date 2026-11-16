/* ============================================================
   site-stats.js — 首页 Hero 社团数据
   数据：/api/stats.php?action=list（后台「首页数据」可管理）
   接口为空或失败时回退到内置默认值，保证首页不空白。
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

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function render(list) {
    var html = '';
    list.forEach(function (stat) {
      html += '<div class="hero-stat">'
        + '<div class="hs-num">' + escapeHtml(stat.value) + '</div>'
        + '<div class="hs-lbl">' + escapeHtml(stat.label) + '</div>'
        + '</div>';
    });
    wrap.innerHTML = html;
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
