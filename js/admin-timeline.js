/* ============================================================
   admin-timeline.js — 后台「发展历程」时间轴管理
   依赖：admin-auth.js（UEMAdminAuth）、api/timeline.php（权限节点 timeline）
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  var API = '../api/timeline.php';
  var listEl = document.getElementById('timelineList');
  if (!listEl) return;

  var form = document.getElementById('timelineForm');
  var statusEl = document.getElementById('timelineStatus');
  var items = [];
  var editingId = null;

  function message(text, type) {
    Auth.showMessage(document.getElementById('timelineMessage'), text, type);
  }

  function esc(text) {
    return Auth.escapeHtml(text);
  }

  function load() {
    Auth.api(API + '?action=admin_list').then(function (json) {
      if (!json.success) throw new Error(json.error || '加载失败');
      items = json.data || [];
      render();
    }).catch(function (err) {
      statusEl.textContent = (err && err.message) || '加载失败，请刷新重试';
    });
  }

  function render() {
    statusEl.style.display = 'none';
    document.getElementById('timelineTotal').textContent = items.length;
    if (!items.length) {
      listEl.innerHTML = '<div class="wall-empty">暂无节点，点击右上角「新增节点」</div>';
      return;
    }
    var html = '';
    items.forEach(function (item) {
      html += '<div class="admin-list-row">';
      html += '<div class="admin-list-main">';
      html += '<strong>' + esc(item.title) + '</strong>';
      html += '<div class="text-muted">' + esc(item.date_label || '未填日期') + ' - 排序 ' + item.sort_order + '</div>';
      if (item.description) {
        html += '<div class="text-muted">' + esc(item.description) + '</div>';
      }
      html += '</div>';
      html += '<div class="admin-list-actions">';
      html += '<button type="button" class="btn btn-ghost btn-sm" data-act="edit" data-id="' + item.id + '">编辑</button>';
      html += '<button type="button" class="btn btn-ghost btn-sm" data-act="del" data-id="' + item.id + '">删除</button>';
      html += '</div></div>';
    });
    listEl.innerHTML = html;
  }

  function openForm(item) {
    editingId = item ? item.id : null;
    document.getElementById('timelineDate').value = item ? item.date_label : '';
    document.getElementById('timelineTitle').value = item ? item.title : '';
    document.getElementById('timelineDesc').value = item ? item.description : '';
    document.getElementById('timelineSort').value = item ? item.sort_order : 0;
    document.getElementById('timelineSaveBtn').textContent = item ? '保存修改' : '新增';
    form.style.display = '';
    message('', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeForm() {
    form.style.display = 'none';
    form.reset();
    editingId = null;
  }

  document.getElementById('addTimelineBtn').addEventListener('click', function () { openForm(null); });
  document.getElementById('timelineCancelBtn').addEventListener('click', closeForm);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      date_label: document.getElementById('timelineDate').value.trim(),
      title: document.getElementById('timelineTitle').value.trim(),
      description: document.getElementById('timelineDesc').value.trim(),
      sort_order: parseInt(document.getElementById('timelineSort').value, 10) || 0
    };
    var action = editingId ? 'update' : 'create';
    if (editingId) payload.id = editingId;

    message('保存中…', 'info');
    Auth.api(API + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (json) {
      if (!json.success) throw new Error(json.error || '保存失败');
      message('已保存', 'success');
      closeForm();
      load();
    }).catch(function (err) {
      message((err && err.message) || '保存失败', 'error');
    });
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-act]') : null;
    if (!btn) return;
    var id = parseInt(btn.getAttribute('data-id'), 10);
    var act = btn.getAttribute('data-act');
    var item = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) item = items[i];

    if (act === 'edit' && item) {
      openForm(item);
      return;
    }
    if (act === 'del' && item) {
      if (!window.confirm('删除「' + item.title + '」？')) return;
      Auth.api(API + '?action=delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      }).then(function (json) {
        if (!json.success) throw new Error(json.error || '删除失败');
        message('已删除', 'success');
        load();
      }).catch(function (err) {
        message((err && err.message) || '删除失败', 'error');
      });
    }
  });

  Auth.requireAuth('timeline').then(load).catch(function () {});
})();
