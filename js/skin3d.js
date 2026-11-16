/*
 * skin3d.js — Minecraft 皮肤 → 3D 模型渲染核心（基于 Three.js）
 *
 * 功能：
 *  - 按官方皮肤模板把 64×64（现代）/ 64×32（旧版）纹理逐面映射到玩家模型
 *  - 支持双层皮肤（帽子 / 外套 / 袖口 / 裤裆…）、纤细(Alex)与经典(Steve)手臂
 *  - 旧版皮肤左右肢体自动镜像复用右侧纹理（与原版行为一致）
 *  - 行走动画、头部跟随鼠标、自动旋转、前后左右顶视角、快照导出
 *
 * 坐标约定：y 轴向上，地面 y=0，模型总高 32px；角色面向 +z（默认相机方向）。
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 皮肤模板常量（单位：纹理像素 / 模型像素，1:1）                      *
   * ------------------------------------------------------------------ */

  // 各部件：uv = 盒子展开图左上角，size = [宽w 高h 厚d]，pivot = 旋转轴(世界坐标)
  // center = 盒子中心相对 pivot 的偏移
  var PARTS = {
    head: { uv: [0, 0],    size: [8, 8, 8],   pivot: [0, 24, 0],    center: [0, 4, 0] },
    body: { uv: [16, 16],  size: [8, 12, 4],  pivot: [0, 12, 0],    center: [0, 6, 0] },
    armR: { uv: [40, 16],  size: [4, 12, 4],  pivot: [-5, 22, 0],   center: [-1, -4, 0] },
    armL: { uv: [32, 48],  size: [4, 12, 4],  pivot: [5, 22, 0],    center: [1, -4, 0] },
    legR: { uv: [0, 16],   size: [4, 12, 4],  pivot: [-1.9, 12, 0], center: [-0.1, -6, 0] },
    legL: { uv: [16, 48],  size: [4, 12, 4],  pivot: [1.9, 12, 0],  center: [0.1, -6, 0] }
  };

  // 第二层（外层）展开图位置；inflate 为每侧外扩量（与原版一致：帽子0.5其余0.25）
  var OVERLAYS = {
    head: { uv: [32, 0],    inflate: 0.5 },
    body: { uv: [16, 32],   inflate: 0.25 },
    armR: { uv: [40, 32],   inflate: 0.25 },
    armL: { uv: [48, 48],   inflate: 0.25 },
    legR: { uv: [0, 32],    inflate: 0.25 },
    legL: { uv: [0, 48],    inflate: 0.25 }
  };

  // 原版游戏内的面向亮度：顶1.0 / 底0.5 / 前后0.8 / 左右0.6
  var SHADE = { top: 1.0, bottom: 0.5, z: 0.8, x: 0.6 };

  var SLIM_ARM_W = 3; // 纤细手臂宽度

  /* ------------------------------------------------------------------ *
   * 盒子几何构建                                                        *
   * ------------------------------------------------------------------ */

  // 构建一个带模板 UV 的盒子 BufferGeometry。
  // w,h,d —— 盒子尺寸；u,v —— 展开图左上角（纹理像素）；
  // mirror —— 旧版皮肤镜像（左右肢体复用对侧纹理）；
  // inflate —— 每侧外扩量（用于外层）。
  function buildBoxGeometry(w, h, d, u, v, texW, texH, mirror, inflate) {
    inflate = inflate || 0;
    var hx = w / 2 + inflate, hy = h / 2 + inflate, hz = d / 2 + inflate;

    // 六个面的纹理区域 [x, y, 宽, 高]（图像像素坐标，y 向下）
    var rRight  = [u,             v + d, d, h]; // 角色 -x 侧（角色右手边）
    var rFront  = [u + d,         v + d, w, h]; // +z 正面
    var rLeft   = [u + d + w,     v + d, d, h]; // 角色 +x 侧（角色左手边）
    var rBack   = [u + d + w + d, v + d, w, h]; // -z 背面
    var rTop    = [u + d,         v,     w, d]; // 顶面
    var rBottom = [u + d + w,     v,     w, d]; // 底面

    // 镜像：-x 面取左列区域、+x 面取右列区域，且所有面水平翻转（与原版 mirror 一致）
    function flipX(rect) { return { rect: rect, flip: true, vflip: false }; }
    function norm(rect)  { return { rect: rect, flip: !!mirror, vflip: false }; }

    var faceDefs = [
      { // -x（角色右）—— 观察者位于 -x 处：贴图左缘 = 角色背侧
        shade: SHADE.x, uv: mirror ? flipX(rLeft) : norm(rRight),
        pos: [-hx, -hy, -hz,  -hx, -hy,  hz,  -hx,  hy,  hz,  -hx,  hy, -hz]
      },
      { // +x（角色左）—— 贴图左缘 = 角色面侧
        shade: SHADE.x, uv: mirror ? flipX(rRight) : norm(rLeft),
        pos: [ hx, -hy,  hz,   hx, -hy, -hz,   hx,  hy, -hz,   hx,  hy,  hz]
      },
      { // +y（顶）—— 贴图上缘 = 背侧，贴图左缘 = 角色右
        shade: SHADE.top, uv: norm(rTop),
        pos: [-hx,  hy,  hz,   hx,  hy,  hz,   hx,  hy, -hz,  -hx,  hy, -hz]
      },
      { // -y（底）—— 与原版一致：相对其他面垂直翻转（贴图上缘 = 背侧）
        shade: SHADE.bottom, uv: { rect: rBottom, flip: !!mirror, vflip: true },
        pos: [-hx, -hy, -hz,   hx, -hy, -hz,   hx, -hy,  hz,  -hx, -hy,  hz]
      },
      { // +z（正面）
        shade: SHADE.z, uv: norm(rFront),
        pos: [-hx, -hy,  hz,   hx, -hy,  hz,   hx,  hy,  hz,  -hx,  hy,  hz]
      },
      { // -z（背面）—— 从背后看时贴图正常显示
        shade: SHADE.z, uv: norm(rBack),
        pos: [ hx, -hy, -hz,  -hx, -hy, -hz,  -hx,  hy, -hz,   hx,  hy, -hz]
      }
    ];

    var positions = [], uvs = [], colors = [], indices = [];
    var vertBase = 0;

    faceDefs.forEach(function (f) {
      var rx = f.uv.rect[0], ry = f.uv.rect[1], rw = f.uv.rect[2], rh = f.uv.rect[3];
      // 角顺序：BL, BR, TR, TL（从面外侧看为逆时针 => 正面朝外）
      var uArr, vArr;
      if (f.uv.flip) { uArr = [rx + rw, rx, rx, rx + rw]; }
      else           { uArr = [rx, rx + rw, rx + rw, rx]; }
      if (f.uv.vflip) { vArr = [ry, ry, ry + rh, ry + rh]; }
      else            { vArr = [ry + rh, ry + rh, ry, ry]; }

      for (var i = 0; i < 4; i++) {
        positions.push(f.pos[i * 3], f.pos[i * 3 + 1], f.pos[i * 3 + 2]);
        uvs.push(uArr[i] / texW, 1 - vArr[i] / texH); // flipY 纹理：v 取反
        colors.push(f.shade, f.shade, f.shade);
      }
      indices.push(vertBase, vertBase + 1, vertBase + 2,
                   vertBase, vertBase + 2, vertBase + 3);
      vertBase += 4;
    });

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  /* ------------------------------------------------------------------ *
   * 轨道视角控制（拖拽旋转 / 滚轮缩放 / 右键平移 / 触屏双指）           *
   * ------------------------------------------------------------------ */

  function OrbitControls(camera, dom) {
    var self = this;
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(0, 16, 0);
    this.theta = 0;          // 方位角（0 = 正前方）
    this.phi = 1.35;         // 极角（0 = 正上方）
    this.radius = 46;
    this.minRadius = 18;
    this.maxRadius = 140;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.45; // rad/s
    this.enabled = true;

    var pointers = new Map();
    var lastPinchDist = 0;
    var velTheta = 0, velPhi = 0;
    var dragging = false, panBtn = false;
    var lastX = 0, lastY = 0;

    function updateCamera() {
      var sp = Math.sin(self.phi), cp = Math.cos(self.phi);
      camera.position.set(
        self.target.x + self.radius * sp * Math.sin(self.theta),
        self.target.y + self.radius * cp,
        self.target.z + self.radius * sp * Math.cos(self.theta)
      );
      camera.lookAt(self.target);
    }

    this.update = function (dt) {
      if (this.autoRotate && !dragging) {
        this.theta -= this.autoRotateSpeed * dt;
      }
      if (!dragging) { // 松手惯性
        this.theta += velTheta * dt;
        this.phi = THREE.MathUtils.clamp(this.phi + velPhi * dt, 0.08, Math.PI - 0.08);
        velTheta *= Math.pow(0.0025, dt);
        velPhi   *= Math.pow(0.0025, dt);
      }
      updateCamera();
    };

    this.snapTo = function (theta, phi) {
      this.theta = theta; this.phi = phi;
      velTheta = velPhi = 0;
      updateCamera();
    };

    this.isDragging = function () { return dragging; };

    function onPointerDown(e) {
      if (!self.enabled) return;
      dom.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true; panBtn = (e.button === 2);
        lastX = e.clientX; lastY = e.clientY;
        velTheta = velPhi = 0;
      } else if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        lastPinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) { // 双指缩放
        var p = Array.from(pointers.values());
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (lastPinchDist > 0) {
          self.radius = THREE.MathUtils.clamp(self.radius * lastPinchDist / d, self.minRadius, self.maxRadius);
        }
        lastPinchDist = d;
        return;
      }
      if (!dragging) return;

      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;

      if (panBtn || e.buttons === 2) { // 右键平移
        var k = self.radius * 0.0016;
        var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        var up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        self.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
        self.target.x = THREE.MathUtils.clamp(self.target.x, -40, 40);
        self.target.y = THREE.MathUtils.clamp(self.target.y, -20, 60);
        self.target.z = THREE.MathUtils.clamp(self.target.z, -40, 40);
      } else { // 左键旋转
        var s = Math.PI * 2 / dom.clientHeight;
        var dTheta = -dx * s, dPhi = -dy * s;
        self.theta += dTheta;
        self.phi = THREE.MathUtils.clamp(self.phi + dPhi, 0.08, Math.PI - 0.08);
        velTheta = dTheta * 60; velPhi = dPhi * 60; // 供松手惯性（粗略帧率折算）
      }
    }

    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = false;
      lastPinchDist = 0;
    }

    function onWheel(e) {
      e.preventDefault();
      if (!self.enabled) return;
      self.radius = THREE.MathUtils.clamp(
        self.radius * Math.exp(e.deltaY * 0.0012), self.minRadius, self.maxRadius);
    }

    function onCtxMenu(e) { e.preventDefault(); }

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onCtxMenu);

    updateCamera();
  }

  /* ------------------------------------------------------------------ *
   * 皮肤查看器                                                          *
   * ------------------------------------------------------------------ */

  function regionFullyTransparent(canvas, rx, ry, rw, rh) {
    var s = canvas.width / 64;
    var ctx = canvas.getContext('2d');
    try {
      var data = ctx.getImageData(rx * s, ry * s, rw * s, rh * s).data;
      for (var i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    } catch (e) { return false; } // 跨域污染时按不透明处理
  }

  function hasAnyTransparency(canvas) {
    try {
      var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (var i = 3; i < data.length; i += 4) if (data[i] !== 255) return true;
      return false;
    } catch (e) { return true; }
  }

  /* 全不透明皮肤（常见于旧版 BMP 转换）清空外层区域，避免帽子层渲染杂色。
     与 skinview-utils 的 fixOpaqueSkin 行为一致。 */
  var OVERLAY_CLEAR_AREAS_MODERN = [
    [32, 0, 32, 16],   // 帽
    [0, 32, 16, 16],   // 右腿外
    [16, 32, 24, 16],  // 身体外
    [40, 32, 16, 16],  // 右臂外
    [0, 48, 16, 16],   // 左腿外
    [48, 48, 16, 16]   // 左臂外
  ];

  function clearOverlayAreas(canvas, legacy) {
    var s = canvas.width / 64;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(32 * s, 0, 32 * s, 16 * s); // 帽层（旧版也有）
    if (!legacy) {
      OVERLAY_CLEAR_AREAS_MODERN.slice(1).forEach(function (a) {
        ctx.clearRect(a[0] * s, a[1] * s, a[2] * s, a[3] * s);
      });
    }
  }

  /* 按官方规则从纹理推断纤细/经典手臂：
     纤细展开比经典少两块区域，若这些区域透明、或四块全黑/全白，则为纤细。 */
  var SLIM_UNUSED_AREAS = [[50, 16, 2, 4], [54, 20, 2, 12], [42, 48, 2, 4], [46, 52, 2, 12]];

  function detectSlim(canvas) {
    var s = canvas.width / 64;
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return false; }
    function readArea(x, y, w, h) {
      try { return ctx.getImageData(x * s, y * s, w * s, h * s).data; }
      catch (e) { return null; }
    }
    var areas = SLIM_UNUSED_AREAS.map(function (a) { return readArea(a[0], a[1], a[2], a[3]); });
    if (areas.some(function (d) { return d === null; })) return false;

    var allBlack = true, allWhite = true;
    for (var i = 0; i < areas.length; i++) {
      var d = areas[i];
      for (var p = 0; p < d.length; p += 4) {
        if (d[p + 3] !== 255) return true; // 任一透明像素必为纤细（基础层不允许透明）
        if (!(d[p] === 0 && d[p + 1] === 0 && d[p + 2] === 0)) allBlack = false;
        if (!(d[p] === 255 && d[p + 1] === 255 && d[p + 2] === 255)) allWhite = false;
      }
    }
    return allBlack || allWhite;
  }

  function SkinViewer(container) {
    var self = this;
    this.container = container;

    // —— 渲染器 ——
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      container.innerHTML = '<div class="webgl-fallback">当前浏览器不支持 WebGL，无法显示 3D 模型。</div>';
      throw e;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.classList.add('stage-canvas');
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);

    // —— 模型 ——
    this.model = new THREE.Group();
    this.scene.add(this.model);
    this.parts = {};        // pivot 组
    this.meshes = [];       // 便于销毁重建
    this.anchors = {};      // 盒子几何挂载点（pivot 内的偏移组）

    // 建立骨架：pivot（动画旋转轴）→ anchor（几何偏移）→ 网格
    Object.keys(PARTS).forEach(function (name) {
      var def = PARTS[name];
      var pivot = new THREE.Group();
      pivot.position.set(def.pivot[0], def.pivot[1], def.pivot[2]);
      var anchor = new THREE.Group();
      anchor.position.set(def.center[0], def.center[1], def.center[2]);
      pivot.add(anchor);
      self.model.add(pivot);
      self.parts[name] = pivot;
      self.anchors[name] = anchor;
    });

    this.texCanvas = null;
    this.texture = null;
    this.slim = false;
    this.legacy = false;
    this.mirrorLeft = { armL: false, legL: false }; // 左肢体是否镜像复用右侧纹理
    this.overlayVisible = true;
    this.walking = false;

    // —— 材质 ——
    this.baseMat = new THREE.MeshBasicMaterial({ vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
    this.overlayMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, alphaTest: 0.02,
      depthWrite: true, side: THREE.DoubleSide
    });

    this.controls = new OrbitControls(this.camera, renderer.domElement);

    // —— 头部跟随鼠标 ——
    this.headTarget = { yaw: 0, pitch: 0 };
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var camPlane = new THREE.Plane();
    var camHit = new THREE.Vector3();

    function onAim(e) {
      var rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1,
              -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, self.camera);
      // 与「穿过头部、面向相机」的平面求交
      camPlane.setFromNormalAndCoplanarPoint(
        self.camera.getWorldDirection(new THREE.Vector3()).negate(),
        new THREE.Vector3(0, 27, 0));
      if (raycaster.ray.intersectPlane(camPlane, camHit)) {
        var p = self.parts.head.worldToLocal(camHit.clone());
        var yaw = Math.atan2(p.x, p.z);
        var pitch = Math.atan2(-p.y, Math.hypot(p.x, p.z));
        self.headTarget.yaw = THREE.MathUtils.clamp(yaw, -0.85, 0.85);
        self.headTarget.pitch = THREE.MathUtils.clamp(pitch, -0.5, 0.55);
      }
    }
    function onAimEnd() { self.headTarget.yaw = 0; self.headTarget.pitch = 0; }

    renderer.domElement.addEventListener('pointermove', onAim);
    renderer.domElement.addEventListener('pointerleave', onAimEnd);

    // —— 尺寸自适应 ——
    function resize() {
      var w = container.clientWidth || 1, h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      self.camera.aspect = w / h;
      self.camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);
    resize();

    // —— 主循环 ——
    this._t = 0;
    this._last = performance.now();
    function loop(now) {
      self._raf = requestAnimationFrame(loop);
      var dt = Math.min((now - self._last) / 1000, 0.1);
      self._last = now;
      self._tick(dt);
    }
    this._tick = function (dt) {
      this._t += dt;
      var t = this._t;

      // 行走 / 待机动画
      if (this.walking) {
        var s = Math.sin(t * 6.2) * 0.72;
        this.parts.armR.rotation.x = s;
        this.parts.armL.rotation.x = -s;
        this.parts.legR.rotation.x = -s * 0.88;
        this.parts.legL.rotation.x = s * 0.88;
        this.model.position.y = Math.abs(Math.cos(t * 6.2)) * 0.35;
      } else {
        var sway = Math.sin(t * 1.4) * 0.035;
        this.parts.armR.rotation.x = sway;
        this.parts.armL.rotation.x = -sway;
        this.parts.armR.rotation.z = -0.04 + Math.sin(t * 1.1) * 0.02;
        this.parts.armL.rotation.z = 0.04 - Math.sin(t * 1.1) * 0.02;
        this.parts.legR.rotation.x = 0;
        this.parts.legL.rotation.x = 0;
        this.model.position.y = 0;
      }

      // 头部缓动跟随
      var head = this.parts.head;
      head.rotation.y += (this.headTarget.yaw - head.rotation.y) * Math.min(1, dt * 9);
      head.rotation.x += (this.headTarget.pitch - head.rotation.x) * Math.min(1, dt * 9);

      this.controls.update(dt);
      renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(loop);
  }

  SkinViewer.prototype = {
    /* 根据当前纹理 / slim / 镜像标记重建全部几何 */
    _rebuild: function () {
      var self = this;
      this.meshes.forEach(function (m) {
        m.parent.remove(m);
        m.geometry.dispose();
      });
      this.meshes = [];

      var texW = this.texCanvas.width, texH = this.texCanvas.height;
      var armW = this.slim ? SLIM_ARM_W : 4;

      Object.keys(PARTS).forEach(function (name) {
        var def = PARTS[name];
        var w = (name === 'armR' || name === 'armL') ? armW : def.size[0];
        var mirror = (name === 'armL' || name === 'legL') && self.mirrorLeft[name];
        var uv = (name === 'armL' || name === 'legL') && mirror
          ? PARTS[name === 'armL' ? 'armR' : 'legR'].uv : def.uv;

        // 基础层
        var base = new THREE.Mesh(
          buildBoxGeometry(w, def.size[1], def.size[2], uv[0], uv[1], texW, texH, mirror, 0),
          self.baseMat);
        // 外层：旧版皮肤只有帽层区域，其余外层不存在（避免 UV 越界采样）
        var ov = OVERLAYS[name];
        var hasOverlay = self.legacy ? (name === 'head') : true;
        var overlay = hasOverlay ? new THREE.Mesh(
          buildBoxGeometry(w, def.size[1], def.size[2], ov.uv[0], ov.uv[1], texW, texH, mirror, ov.inflate),
          self.overlayMat) : null;

        var anchor = self.anchors[name];
        anchor.add(base);
        self.meshes.push(base);
        if (overlay) { anchor.add(overlay); self.meshes.push(overlay); }
      });

      this.setOverlayVisible(this.overlayVisible);
    },

    /* 加载皮肤（HTMLImageElement 或 canvas）。
       opts.slim：true/false 强制指定；缺省时自动检测（仅现代格式可检测）。
       返回 { legacy, slim, autoSlim }。 */
    setSkin: function (source, opts) {
      var w = source.width, h = source.height;
      if (w % 64 !== 0 || (h !== w && h * 2 !== w)) {
        throw new Error('皮肤尺寸不支持：应为 64×64 / 64×32（或对应的 HD 倍数），当前 ' + w + '×' + h);
      }
      if (!this.texCanvas) this.texCanvas = document.createElement('canvas');
      this.texCanvas.width = w; this.texCanvas.height = h;
      var ctx = this.texCanvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0);

      this.legacy = (h * 2 === w);

      // 全不透明皮肤：清空外层区域，避免旧皮肤帽子层渲染杂色
      if (!hasAnyTransparency(this.texCanvas)) clearOverlayAreas(this.texCanvas, this.legacy);

      this.mirrorLeft.armL = this.legacy || regionFullyTransparent(this.texCanvas, 32, 48, 16, 16);
      this.mirrorLeft.legL = this.legacy || regionFullyTransparent(this.texCanvas, 16, 48, 16, 16);

      var autoSlim = this.legacy ? false : detectSlim(this.texCanvas);
      var slim = (opts && typeof opts.slim === 'boolean') ? opts.slim : autoSlim;
      var slimChanged = (slim !== this.slim);
      this.slim = slim;

      // 刷新纹理
      if (this.texture) this.texture.dispose();
      var tex = new THREE.CanvasTexture(this.texCanvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      this.texture = tex;
      this.baseMat.map = tex;       this.baseMat.needsUpdate = true;
      this.overlayMat.map = tex;    this.overlayMat.needsUpdate = true;

      this._rebuild();
      return { legacy: this.legacy, slim: this.slim, autoSlim: autoSlim };
    },

    setSlim: function (v) {
      this.slim = !!v;
      if (this.texCanvas) this._rebuild();
    },

    setOverlayVisible: function (v) {
      this.overlayVisible = !!v;
      this.meshes.forEach(function (m) {
        if (m.material === this.overlayMat) m.visible = this.overlayVisible;
      }, this);
    },

    setWalking: function (v) { this.walking = !!v; this._t = 0; },
    setAutoRotate: function (v) { this.controls.autoRotate = !!v; },

    /* 预设视角：front/back/left/right/top */
    setView: function (name) {
      var map = { front: [0, 1.35], back: [Math.PI, 1.35], left: [Math.PI / 2, 1.35],
                  right: [-Math.PI / 2, 1.35], top: [0, 0.18] };
      if (!map[name]) return;
      this.controls.snapTo(map[name][0], map[name][1]);
    },

    /* 渲染当前帧并导出 PNG dataURL */
    snapshot: function () {
      this.controls.update(0);
      this.scene.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
      var gl = this.renderer;
      gl.render(this.scene, this.camera);
      return gl.domElement.toDataURL('image/png');
    },

    dispose: function () {
      cancelAnimationFrame(this._raf);
      this.meshes.forEach(function (m) { m.geometry.dispose(); });
      if (this.texture) this.texture.dispose();
      this.renderer.dispose();
    }
  };

  /* ------------------------------------------------------------------ *
   * 3D 头像生成（单帧离屏渲染，透明背景 PNG）                          *
   * ------------------------------------------------------------------ */

  var _avatarRenderer = null; // 复用同一个 WebGL 上下文，避免超出浏览器上下文数上限

  // texCanvas: 皮肤画布；opts: { size, yaw, pitch, overlay }
  // 返回 canvas（RGBA，透明背景）。
  function renderHeadAvatar(texCanvas, opts) {
    opts = opts || {};
    var size = opts.size || 512;
    var yaw = opts.yaw !== undefined ? opts.yaw : 0.62;     // 水平角（正值=看到角色左侧）
    var pitch = opts.pitch !== undefined ? opts.pitch : 0.34; // 俯仰角（正值=俯视）
    var overlay = opts.overlay !== false;

    var texW = texCanvas.width, texH = texCanvas.height;
    var tex = new THREE.CanvasTexture(texCanvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;

    var baseMat = new THREE.MeshBasicMaterial({
      vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, map: tex
    });
    var ovMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, alphaTest: 0.02,
      depthWrite: true, side: THREE.DoubleSide, map: tex
    });

    var geos = [];
    var group = new THREE.Group();
    var head = new THREE.Mesh(
      buildBoxGeometry(8, 8, 8, 0, 0, texW, texH, false, 0), baseMat);
    geos.push(head.geometry);
    group.add(head);
    if (overlay) {
      var hat = new THREE.Mesh(
        buildBoxGeometry(8, 8, 8, 32, 0, texW, texH, false, 0.5), ovMat);
      geos.push(hat.geometry);
      group.add(hat);
    }

    var scene = new THREE.Scene();
    scene.add(group);

    var camera = new THREE.PerspectiveCamera(25, 1, 0.1, 300);
    var r = 46;
    camera.position.set(
      r * Math.cos(pitch) * Math.sin(yaw),
      r * Math.sin(pitch),
      r * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.lookAt(0, 0, 0);

    if (!_avatarRenderer) {
      _avatarRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      _avatarRenderer.setPixelRatio(1);
    }
    var renderer = _avatarRenderer;
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size, false);
    renderer.render(scene, camera);

    var out = document.createElement('canvas');
    out.width = size; out.height = size;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0, size, size);

    geos.forEach(function (g) { g.dispose(); });
    tex.dispose();
    return out;
  }

  global.MCSkin3D = {
    SkinViewer: SkinViewer,
    OrbitControls: OrbitControls,
    PARTS: PARTS,
    OVERLAYS: OVERLAYS,
    detectSlim: detectSlim,
    regionFullyTransparent: regionFullyTransparent,
    renderHeadAvatar: renderHeadAvatar
  };
})(window);
