/* ============================================================
   profile-skin.js — 用户主页「角色模型」3D 展示
   数据：/api/user.php?action=skin&id=N（服务端代理皮肤站贴图，同源无跨域污染）
   渲染：js/skin3d.js（Three.js，UV 映射/纤细检测/拖拽旋转/滚轮缩放）
   失败时保持整节隐藏，不影响档案其余内容。
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('skinStage');
  var section = document.getElementById('skinSection');
  if (!stage || !section) return;

  var id = new URLSearchParams(window.location.search).get('id') || '';
  if (!/^\d+$/.test(id)) return;
  if (!window.THREE || !window.MCSkin3D) return;

  var viewer = null;
  var img = new Image();

  img.onload = function () {
    try {
      viewer = new MCSkin3D.SkinViewer(stage);
      viewer.setSkin(img);
      viewer.setView('front');
      viewer.setAutoRotate(true);
    } catch (e) {
      if (viewer) { try { viewer.dispose(); } catch (e2) {} }
      return;
    }

    section.style.display = '';
    var body = document.querySelector('.profile-body');
    if (body) body.classList.add('has-skin');

    var resetBtn = document.getElementById('skinReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        viewer.controls.target.set(0, 16, 0);
        viewer.controls.radius = 46;
        viewer.setView('front');
      });
    }
  };

  img.onerror = function () {
    // 没有角色 / 皮肤获取失败：保持隐藏
  };

  img.src = '/api/user.php?action=skin&id=' + encodeURIComponent(id);
})();
