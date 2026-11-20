/* ============================================================
   members.js — 关于我们页「全体成员」墙
   数据：/api/user.php?action=members（仅公开主页用户，按加入时间排序）
   支持：昵称/角色名/标签搜索 + 标签筛选；每格整卡链接 → /profile/?id=N
   ============================================================ */
(function () {
  'use strict';

  var API = '/api/user.php?action=members';
  var wall = document.getElementById('membersWall');
  if (!wall) return;

  var state = { all: [], query: '', tag: '' };

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

  function tagsOf(member) {
    return Array.isArray(member.tags) ? member.tags : [];
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    return state.all.filter(function (m) {
      var tags = tagsOf(m);
      if (state.tag && tags.indexOf(state.tag) === -1) return false;
      if (!q) return true;
      var hay = [m.nickname || '', m.player_name || ''].concat(tags).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function renderTagFilter() {
    var wrap = document.getElementById('membersTagFilter');
    if (!wrap) return;
    var seen = {};
    var tags = [];
    state.all.forEach(function (m) {
      tagsOf(m).forEach(function (t) {
        if (!seen[t]) { seen[t] = 1; tags.push(t); }
      });
    });
    if (!tags.length) { wrap.innerHTML = ''; return; }
    var html = '';
    tags.forEach(function (t) {
      html += '<button type="button" class="member-tagfilter-btn' + (state.tag === t ? ' is-active' : '') + '"'
        + ' data-tag="' + escapeAttr(t) + '">' + escapeHtml(t) + '</button>';
    });
    wrap.innerHTML = html;
  }

  function renderWall() {
    var list = filtered();
    var count = document.getElementById('membersCount');
    if (count) {
      count.textContent = state.all.length
        ? (list.length === state.all.length ? state.all.length + ' 人' : list.length + ' / ' + state.all.length + ' 人')
        : '';
    }

    var empty = document.getElementById('membersStatus');
    if (!list.length) {
      wall.style.display = 'none';
      if (empty) {
        empty.style.display = '';
        empty.textContent = state.all.length ? '没有匹配的成员' : '还没有公开主页的注册成员';
      }
      return;
    }
    wall.style.display = '';
    if (empty) empty.style.display = 'none';

    var html = '';
    list.forEach(function (m) {
      html += '<a class="member-row" href="/profile/?id=' + encodeURIComponent(m.id) + '">';
      html += '<span class="member-row-head">';
      html += '<img class="member-row-avatar" src="' + escapeAttr(m.avatar || '') + '" alt="" loading="lazy">';
      html += '<span class="member-row-id">';
      html += '<span class="member-row-name" title="' + escapeAttr(m.nickname || '') + '">' + escapeHtml(m.nickname || '未命名用户') + '</span>';
      if (m.player_name) {
        html += '<span class="member-row-player" title="' + escapeAttr(m.player_name) + '">' + escapeHtml(m.player_name) + '</span>';
      }
      html += '</span>';
      html += '<span class="member-row-arrow" aria-hidden="true">→</span>';
      html += '</span>';
      if (m.bio) {
        html += '<span class="member-row-bio" title="' + escapeAttr(m.bio) + '">' + escapeHtml(m.bio) + '</span>';
      } else {
        html += '<span class="member-row-bio is-empty">这个人很懒，还没有写简介。</span>';
      }
      var tags = tagsOf(m);
      if (tags.length) {
        html += '<span class="member-row-tags">';
        tags.forEach(function (t) {
          html += '<span class="member-tag">' + escapeHtml(t) + '</span>';
        });
        html += '</span>';
      }
      html += '</a>';
    });
    wall.innerHTML = html;
  }

  var search = document.getElementById('membersSearch');
  if (search) {
    search.addEventListener('input', function () {
      state.query = search.value;
      renderWall();
    });
  }

  var tagFilter = document.getElementById('membersTagFilter');
  if (tagFilter) {
    tagFilter.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-tag]') : null;
      if (!btn) return;
      var tag = btn.getAttribute('data-tag');
      state.tag = state.tag === tag ? '' : tag;
      renderTagFilter();
      renderWall();
    });
  }

  fetch(API).then(function (res) {
    return res.json().then(function (json) {
      if (!res.ok || !json.success) throw new Error(json.error || '加载失败');
      return json.data || [];
    });
  }).then(function (members) {
    state.all = members;
    renderTagFilter();
    renderWall();
  }).catch(function () {
    wall.style.display = 'none';
    var empty = document.getElementById('membersStatus');
    if (empty) {
      empty.style.display = '';
      empty.textContent = '成员列表加载失败，请稍后刷新重试';
    }
  });
})();
