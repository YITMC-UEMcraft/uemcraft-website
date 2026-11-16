/* ============================================================
   members.js — 关于我们页「全体成员」墙
   数据：/api/user.php?action=members（仅公开主页用户，按加入时间排序）
   每格为整卡链接 → /profile/?id=N；空态与加载失败都有兜底文案。
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/user.php?action=members';
  var wall = document.getElementById('membersWall');
  if (!wall) return;

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  fetch(API).then(function (res) {
    return res.json().then(function (json) {
      if (!res.ok || !json.success) throw new Error(json.error || '加载失败');
      return json.data || [];
    });
  }).then(function (members) {
    var count = document.getElementById('membersCount');
    if (count) count.textContent = members.length ? members.length + ' 人' : '';

    if (!members.length) {
      wall.style.display = 'none';
      var empty = document.getElementById('membersStatus');
      if (empty) empty.style.display = '';
      return;
    }

    var html = '';
    members.forEach(function (m) {
      html += '<a class="member-row" href="/profile/?id=' + encodeURIComponent(m.id) + '">';
      html += '<img class="member-row-avatar" src="' + escapeAttr(m.avatar || '') + '" alt="" loading="lazy">';
      html += '<span class="member-row-main">';
      html += '<span class="member-row-name" title="' + escapeAttr(m.nickname || '') + '">' + escapeHtml(m.nickname || '未命名用户') + '</span>';
      if (m.player_name) {
        html += '<span class="member-row-player" title="' + escapeAttr(m.player_name) + '">' + escapeHtml(m.player_name) + '</span>';
      }
      html += '</span>';
      html += '<span class="member-row-arrow" aria-hidden="true">→</span>';
      html += '</a>';
    });
    wall.innerHTML = html;
  }).catch(function () {
    wall.style.display = 'none';
    var empty = document.getElementById('membersStatus');
    if (empty) {
      empty.style.display = '';
      empty.textContent = '成员列表加载失败，请稍后刷新重试';
    }
  });
})();
