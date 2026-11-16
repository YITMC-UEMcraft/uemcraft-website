/* ============================================================
   admin-stats.js — 后台「首页数据」管理
   依赖：admin-auth.js（UEMAdminAuth）、api/stats.php（权限节点 stats）
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  var API = '../api/stats.php';
  var listEl = document.getElementById('statList');
  if (!listEl) return;

  var form = document.getElementById('statForm');
  var statusEl = document.getElementById('statStatus');
  var items = [];
  var editingId = null;

  function message(text, type) {
    Auth.showMessage(document.getElementById('statMessage'), text, type);
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
    document.getElementById('statTotal').textContent = items.length;
    if (!items.length) {
      listEl.innerHTML = '<div class="wall-empty">暂无数据，点击右上角「新增数据」</div>';
      return;
    }
    var html = '';
    items.forEach(function (item) {
      html += '<div class="admin-list-row">';
      html += '<div class="admin-list-main">';
      html += '<strong>' + esc(item.label) + '</strong>';
      html += '<div class="text-muted">数值 ' + esc(item.value) + ' - 排序 ' + item.sort_order + '</div>';
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
    document.getElementById('statLabel').value = item ? item.label : '';
    document.getElementById('statValue').value = item ? item.value : '';
    document.getElementById('statSort').value = item ? item.sort_order : 0;
    document.getElementById('statSaveBtn').textContent = item ? '保存修改' : '新增';
    form.style.display = '';
    message('', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeForm() {
    form.style.display = 'none';
    form.reset();
    editingId = null;
  }

  document.getElementById('addStatBtn').addEventListener('click', function () { openForm(null); });
  document.getElementById('statCancelBtn').addEventListener('click', closeForm);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {
      label: document.getElementById('statLabel').value.trim(),
      value: document.getElementById('statValue').value.trim(),
      sort_order: parseInt(document.getElementById('statSort').value, 10) || 0
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
      if (!window.confirm('删除「' + item.label + '」？')) return;
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

  Auth.requireAuth('stats').then(load).catch(function () {});
})();
