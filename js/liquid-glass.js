/* ============================================================
   Liquid Glass Cursor
   原生实现，还原 React Bits <FluidGlass /> 的通透液体玻璃质感：
   - 通过实时 DOM 副本 + SVG feDisplacementMap 做真实折射位移，
     中心几乎不变形，边缘强烈扭曲（放大折射）；
   - 叠加边缘高光、镜面反光，模拟液态玻璃；
   - 位移图带轻微时变噪声，玻璃有缓慢的"液面微动"。
   依赖：无（纯 Vanilla JS / CSS / SVG）
   ============================================================ */
(function () {
  "use strict";

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE =
    window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var SUPPORTED =
    typeof SVGFEDisplacementMapElement !== "undefined" &&
    typeof ImageData !== "undefined" &&
    typeof document.createElement("canvas").getContext === "function";
  if (REDUCED || !FINE || !SUPPORTED) return;
  // 轻量模式（弱设备 / 老内核 / 360）：液态玻璃透镜每帧克隆整页，最吃性能，直接关闭
  if (window.__LITE_MODE) return;

  var LENS_D = 64;        // 可见玻璃直径（px）
  var MAP_SIZE = 64;      // 位移图分辨率（透镜仅 64px，64 已 1:1 足够）
  var DISP_SCALE = 34;    // feDisplacementMap scale（px）
  var MAP_BASE = 0.07;    // 基础放大（整个透镜轻微放大，更像真实透镜）
  var MAP_MAX = 0.5;      // 边缘最大位移（相对 scale 的比例）
  var MAP_EXP = 2.2;      // 位移越靠边缘越强
  var WOBBLE = 0.03;      // 液面微动幅度
  var EASE = 0.16;        // 光标跟随缓动
  var IDLE_MS = 900;      // 停止动画帧的闲置阈值
  var SYNC_MS = 300;      // 副本状态同步间隔
  var WOBBLE_MS = 400;    // 液面微动刷新间隔

  var DYNAMIC_SELECTOR =
    ".work-card, #aboutPhoto, .exp-item, .contact-card, .nav-capsule, #navEffectFilter, .hero-tags, .works-title, .works-transition, .wt-block, .wt-text, [data-reveal], [data-split]";

  var oldGlass = document.getElementById("cursorGlass");
  var lens = null;
  var clip = null;
  var copy = null;
  var dispImg = null;
  var pairs = [];
  var videos = [];
  var fixedEls = [];
  var docW = 0;
  var scrollX = 0;
  var scrollY = 0;
  var cx = window.innerWidth / 2;
  var cy = window.innerHeight / 2;
  var px = cx;
  var py = cy;
  var tx = cx;
  var ty = cy;
  var raf = null;
  var wobbleTimer = 0;
  var syncTimer = 0;
  var lastActivity = 0;
  var built = false;

  /* ---------- 位移图生成：径向放大 + 时变噪声 ---------- */
  function buildDispMap(t) {
    var c = document.createElement("canvas");
    c.width = c.height = MAP_SIZE;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    var ctr = (MAP_SIZE - 1) / 2;
    var rMax = MAP_SIZE / 2;
    var data = img.data;
    for (var y = 0; y < MAP_SIZE; y++) {
      for (var x = 0; x < MAP_SIZE; x++) {
        var dx = x - ctr;
        var dy = y - ctr;
        var r = Math.sqrt(dx * dx + dy * dy) / rMax;
        var rr = Math.min(1, r);
        var f = MAP_BASE + Math.pow(rr, MAP_EXP) * MAP_MAX;
        if (WOBBLE > 0 && t !== null) {
          var nx = dx / rMax;
          var ny = dy / rMax;
          var wob =
            Math.sin(nx * 2.6 + ny * 1.4 + t * 0.55) * 0.6 +
            Math.sin(nx * 5.1 - ny * 3.2 + t * 0.9) * 0.3 +
            Math.sin((nx + ny) * 8.0 - t * 1.4) * 0.1;
          f += wob * WOBBLE * rr;
        }
        var i = (y * MAP_SIZE + x) * 4;
        data[i] = Math.max(0, Math.min(255, Math.round(128 - (dx / rMax) * f * 127.5)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(128 - (dy / rMax) * f * 127.5)));
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  /* ---------- 生成折射滤镜 ---------- */
  function buildFilter() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "liquid-lens-defs");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");

    var defs = document.createElementNS(ns, "defs");
    var filter = document.createElementNS(ns, "filter");
    filter.setAttribute("id", "lgRefract");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    dispImg = document.createElementNS(ns, "feImage");
    dispImg.setAttribute("result", "lgDisp");
    dispImg.setAttribute("preserveAspectRatio", "none");

    var dm = document.createElementNS(ns, "feDisplacementMap");
    dm.setAttribute("in", "SourceGraphic");
    dm.setAttribute("in2", "lgDisp");
    dm.setAttribute("scale", String(DISP_SCALE));
    dm.setAttribute("xChannelSelector", "R");
    dm.setAttribute("yChannelSelector", "G");

    filter.appendChild(dispImg);
    filter.appendChild(dm);
    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  function setDispMap(url) {
    dispImg.setAttribute("href", url);
    try {
      dispImg.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
    } catch (e) {
      /* 忽略 */
    }
  }

  /* ---------- 透镜 DOM ---------- */
  function buildLens() {
    lens = document.createElement("div");
    lens.className = "liquid-lens";
    lens.setAttribute("id", "liquidLens");
    lens.setAttribute("aria-hidden", "true");

    clip = document.createElement("div");
    clip.className = "liquid-lens-clip";

    copy = document.createElement("div");
    copy.className = "liquid-lens-copy";
    copy.id = "liquidLensCopy";
    clip.appendChild(copy);

    var rim = document.createElement("div");
    rim.className = "liquid-lens-rim";

    var gloss = document.createElement("div");
    gloss.className = "liquid-lens-gloss";

    var dot = document.createElement("div");
    dot.className = "liquid-lens-dot";

    lens.appendChild(clip);
    lens.appendChild(rim);
    lens.appendChild(gloss);
    lens.appendChild(dot);
    document.body.appendChild(lens);
  }

  /* ---------- 固定/吸附元素：转成文档坐标的绝对定位 ---------- */
  function convertFixed(real, clone) {
    // 找到副本中该元素的最近定位祖先（containing block），
    // 因为 absolute 的 top/left 是相对它计算的，而不是相对文档
    var ancClone = clone.parentElement;
    var ancReal = real.parentElement;
    var ancLeft = 0;
    var ancTop = 0;
    while (ancClone && ancClone !== copy) {
      var pos = "";
      try {
        pos = window.getComputedStyle(ancClone).position;
      } catch (e) {
        /* 忽略 */
      }
      if (pos !== "static") {
        var ar = ancReal.getBoundingClientRect();
        ancLeft = ar.left + scrollX;
        ancTop = ar.top + scrollY;
        break;
      }
      ancClone = ancClone.parentElement;
      ancReal = ancReal.parentElement;
    }
    var r = real.getBoundingClientRect();
    clone.style.position = "absolute";
    clone.style.left = Math.round(r.left + scrollX - ancLeft) + "px";
    clone.style.top = Math.round(r.top + scrollY - ancTop) + "px";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.width = Math.round(r.width) + "px";
    clone.style.height = Math.round(r.height) + "px";
    clone.style.margin = "0";
    fixedEls.push({ real: real, clone: clone, ancLeft: ancLeft, ancTop: ancTop });
  }

  /* ---------- 构建页面实时副本 ---------- */
  function buildCopy() {
    var docEl = document.body.cloneNode(true);

    // 从副本中移除不应出现的内容
    var killers = docEl.querySelectorAll(
      "script, noscript, #cursorGlass, #liquidLens, .liquid-lens-defs, .liquid-lens, .liquid-lens-clip, .liquid-lens-copy"
    );
    for (var i = 0; i < killers.length; i++) {
      if (killers[i].parentNode) killers[i].parentNode.removeChild(killers[i]);
    }

    // 视频：静音并暂停，后续同步帧
    var cloneVideos = docEl.querySelectorAll("video");
    for (var v = 0; v < cloneVideos.length; v++) {
      var cv = cloneVideos[v];
      cv.autoplay = false;
      cv.loop = false;
      cv.muted = true;
      cv.setAttribute("muted", "");
      cv.pause();
      try { cv.currentTime = 0; } catch (e) { /* 忽略 */ }
    }

    // 图片保持浏览器默认懒加载，避免副本把整页图片提前下载
    var imgs = docEl.querySelectorAll("img");
    for (var g = 0; g < imgs.length; g++) {
      try { imgs[g].decoding = "async"; } catch (e) { /* 忽略 */ }
    }

    // 把副本内容移入透镜内的容器
    while (docEl.firstChild) {
      copy.appendChild(docEl.firstChild);
    }

    // 并行遍历真实 DOM 与副本，建立对应关系
    var realNodes = [];
    var cloneNodes = [];
    collect(document.body, realNodes, true);
    collect(copy, cloneNodes, false);

    var n = Math.min(realNodes.length, cloneNodes.length);
    for (var i = 0; i < n; i++) {
      var real = realNodes[i];
      var cl = cloneNodes[i];
      if (real.nodeType !== 1 || cl.nodeType !== 1) continue;

      var pos = "";
      try {
        pos = window.getComputedStyle(real).position;
      } catch (e) {
        /* 忽略 */
      }
      if (pos === "fixed" || pos === "sticky") {
        convertFixed(real, cl);
      }
      if (real.nodeName === "VIDEO") {
        videos.push({ real: real, clone: cl });
      }
      if (real.matches && real.matches(DYNAMIC_SELECTOR)) {
        pairs.push({ real: real, clone: cl });
      }
    }

    // 副本中的关键词改为挂在副本根节点，按文档坐标定位（与真实页面 fixed 保持一致）
    for (var ti = 0; ti < pairs.length; ti++) {
      var tReal = pairs[ti].real;
      if (tReal.classList && tReal.classList.contains("hero-tags")) {
        var tClone = pairs[ti].clone;
        if (tClone.parentNode && tClone.parentNode !== copy) {
          tClone.parentNode.removeChild(tClone);
          copy.appendChild(tClone);
        }
        tClone.style.position = "absolute";
        tClone.style.left = "0px";
        tClone.style.top = "0px";
        tClone.style.right = "auto";
        tClone.style.bottom = "auto";
        tClone.style.margin = "0";
        break;
      }
    }

    // 记录真实页面视频（副本可能不在其中时直接引用）
    if (!videos.length) {
      var realVideos = document.querySelectorAll("video");
      for (var rv = 0; rv < realVideos.length; rv++) {
        videos.push({ real: realVideos[rv], clone: null });
      }
    }
  }

  function collect(root, out, skipLens) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (node) {
        if (node.id === "liquidLens" || node.id === "cursorGlass") {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.classList && node.classList.contains("liquid-lens-defs")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.nodeName === "SCRIPT" || node.nodeName === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node = walker.nextNode();
    while (node) {
      out.push(node);
      node = walker.nextNode();
    }
  }

  /* ---------- 状态同步 ---------- */
  function syncState() {
    if (document.hidden) return;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      if (p.clone.className !== p.real.className) {
        p.clone.className = p.real.className;
      }
      var realStyle = p.real.getAttribute && p.real.getAttribute("style");
      var cloneStyle = p.clone.getAttribute && p.clone.getAttribute("style");
      if (realStyle !== cloneStyle) {
        if (realStyle) p.clone.setAttribute("style", realStyle);
        else p.clone.removeAttribute("style");
      }
      if (p.real.hasAttribute && p.real.hasAttribute("data-reveal")) {
        var cs = window.getComputedStyle(p.real);
        p.clone.style.opacity = cs.opacity;
        p.clone.style.transform = cs.transform === "none" ? "" : cs.transform;
      }
      // 首页关键词：按文档坐标同步（真实元素为 fixed，副本需换算成文档坐标）
      if (p.real.classList && p.real.classList.contains("hero-tags") && p.real.hasAttribute("data-lg-x")) {
        p.clone.style.position = "absolute";
        p.clone.style.left = "0px";
        p.clone.style.top = "0px";
        p.clone.style.right = "auto";
        p.clone.style.bottom = "auto";
        p.clone.style.margin = "0";
        p.clone.style.transformOrigin = "0 0";
        p.clone.style.transform =
          "translate3d(" + p.real.getAttribute("data-lg-x") + "px, " +
          p.real.getAttribute("data-lg-y") + "px, 0) scale(" + p.real.getAttribute("data-lg-scale") + ")";
        p.clone.style.opacity = window.getComputedStyle(p.real).opacity;
      }
      // 过渡大字：同步逐字状态，让透镜里也能看到逐字浮现
      if (p.real.classList && p.real.classList.contains("wt-text")) {
        var rChars = p.real.querySelectorAll(".wt-char");
        var cChars = p.clone.querySelectorAll(".wt-char");
        for (var k = 0; k < rChars.length && k < cChars.length; k++) {
          cChars[k].style.cssText = rChars[k].getAttribute("style") || "";
        }
      }
    }
    for (var v = 0; v < videos.length; v++) {
      var vp = videos[v];
      if (!vp.clone) continue;
      var t;
      try {
        t = vp.real.currentTime;
      } catch (e) {
        continue;
      }
      if (isFinite(t) && Math.abs(vp.clone.currentTime - t) > 0.12) {
        try {
          vp.clone.currentTime = t;
        } catch (e) {
          /* 忽略 */
        }
      }
    }
  }

  function updateFixed() {
    for (var i = 0; i < fixedEls.length; i++) {
      var f = fixedEls[i];
      var r = f.real.getBoundingClientRect();
      f.clone.style.left = Math.round(r.left + scrollX - f.ancLeft) + "px";
      f.clone.style.top = Math.round(r.top + scrollY - f.ancTop) + "px";
      f.clone.style.width = Math.round(r.width) + "px";
      f.clone.style.height = Math.round(r.height) + "px";
    }
  }

  /* ---------- 动画帧 ---------- */
  var lastScrollX = 0;
  var lastScrollY = 0;
  function frame(now) {
    raf = null;
    if (document.hidden) return;
    var moving = Math.abs(tx - px) > 0.05 || Math.abs(ty - py) > 0.05;
    px += (tx - px) * EASE;
    py += (ty - py) * EASE;

    var h = window.innerHeight;
    var w = window.innerWidth;
    scrollX = window.pageXOffset || 0;
    scrollY = window.pageYOffset || 0;

    lens.style.left = Math.round(px - LENS_D / 2) + "px";
    lens.style.top = Math.round(py - LENS_D / 2) + "px";
    copy.style.transform =
      "translate3d(" +
      (LENS_D / 2 - px - scrollX).toFixed(2) +
      "px, " +
      (LENS_D / 2 - py - scrollY).toFixed(2) +
      "px, 0)";

    if (scrollX !== lastScrollX || scrollY !== lastScrollY) {
      updateFixed();
      lastScrollX = scrollX;
      lastScrollY = scrollY;
    }

    if (now - lastActivity > IDLE_MS || (!moving && now - lastActivity > 120)) {
      if (!moving) return;
    }
    if (moving || now - lastActivity < IDLE_MS) {
      raf = requestAnimationFrame(frame);
    }
  }

  function kick() {
    lastActivity = performance.now();
    if (!raf && lens) raf = requestAnimationFrame(frame);
  }

  function wobbleTick() {
    if (!built || document.hidden) return;
    setDispMap(buildDispMap(performance.now() / 1000));
    syncState();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      buildFilter();
      buildLens();
      setDispMap(buildDispMap(null));
      buildCopy();
      docW = Math.max(1280, Math.round(document.body.getBoundingClientRect().width));
      copy.style.width = docW + "px";

      // 隐藏旧的毛玻璃指针
      if (oldGlass) oldGlass.style.display = "none";
      built = true;

      document.addEventListener("mousemove", function (e) {
        tx = e.clientX;
        ty = e.clientY;
        kick();
      }, { passive: true });
      window.addEventListener("scroll", kick, { passive: true });
      window.addEventListener("resize", function () {
        docW = Math.max(1280, Math.round(document.body.getBoundingClientRect().width));
        copy.style.width = docW + "px";
        syncState();
        updateFixed();
        kick();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          if (raf) { cancelAnimationFrame(raf); raf = null; }
          if (syncTimer) { clearInterval(syncTimer); syncTimer = 0; }
          if (wobbleTimer) { clearInterval(wobbleTimer); wobbleTimer = 0; }
        } else {
          syncState();
          updateFixed();
          if (!syncTimer) syncTimer = setInterval(syncState, SYNC_MS);
          if (!wobbleTimer) wobbleTimer = setInterval(wobbleTick, WOBBLE_MS);
          kick();
        }
      });

      wobbleTimer = setInterval(wobbleTick, WOBBLE_MS);
      syncTimer = setInterval(syncState, SYNC_MS);
      requestAnimationFrame(function () {
        frame(performance.now());
        syncState();
      });

      window.__liquidGlass = {
        moveTo: function (x, y) {
          tx = x;
          ty = y;
          kick();
        },
        hide: function () {
          if (lens) lens.style.display = "none";
        },
        show: function () {
          if (lens) lens.style.display = "block";
        }
      };
    } catch (err) {
      if (window.console && console.warn) {
        console.warn("Liquid glass cursor disabled:", err);
      }
      cleanup();
    }
  }

  function cleanup() {
    if (lens && lens.parentNode) lens.parentNode.removeChild(lens);
    var defs = document.querySelector(".liquid-lens-defs");
    if (defs && defs.parentNode) defs.parentNode.removeChild(defs);
    if (wobbleTimer) clearInterval(wobbleTimer);
    if (syncTimer) clearInterval(syncTimer);
    if (oldGlass) oldGlass.style.display = "";
    built = false;
  }

  /* 等主页面渲染完成后再克隆，确保透镜里能看到 JS 渲染的内容 */
  function startLiquid() {
    if (window.__siteRendered) {
      boot();
      return;
    }
    function tryBoot() {
      if (window.__siteRendered) boot();
      else document.addEventListener("site:rendered", boot);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryBoot);
    } else {
      tryBoot();
    }
  }
  startLiquid();

  /* 云端数据到达后页面内容会重绘一次，重新克隆副本保持透镜同步 */
  function rebuildCopy() {
    if (!built || !copy) return;
    while (copy.firstChild) copy.removeChild(copy.firstChild);
    pairs = [];
    videos = [];
    fixedEls = [];
    buildCopy();
    docW = Math.max(1280, Math.round(document.body.getBoundingClientRect().width));
    copy.style.width = docW + "px";
    updateFixed();
    syncState();
  }
  document.addEventListener("site:content-updated", rebuildCopy);
})();
