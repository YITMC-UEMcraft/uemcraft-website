/* ============================================================
   timeline.js — 关于页「发展历程」时间轴
   数据：/api/timeline.php?action=list（后台「发展历程」可管理）
   接口为空或失败时保留页面内静态条目。
   ============================================================ */
(function () {
  'use strict';

  var wrap = document.getElementById('timelineList');
  if (!wrap) return;

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function render(items) {
    var html = '';
    items.forEach(function (item) {
      html += '<div class="timeline-item">';
      html += '<div class="timeline-date">' + escapeHtml(item.date_label) + '</div>';
      html += '<div class="timeline-title">' + escapeHtml(item.title) + '</div>';
      if (item.description) {
        html += '<div class="timeline-desc">' + escapeHtml(item.description) + '</div>';
      }
      html += '</div>';
    });
    wrap.innerHTML = html;
  }

  fetch('/api/timeline.php?action=list').then(function (res) {
    return res.json();
  }).then(function (json) {
    if (json && json.success && json.data && json.data.length) {
      render(json.data);
    }
  }).catch(function () {});
})();
