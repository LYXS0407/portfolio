/* ============================================================
   作品展示瀑布页：纯图片展示 + 点击放大查看（灯箱）
   数据来自 site-data.js 的 works + worksGallery
   （后续接入后台后由接口提供）
   ============================================================ */
(function () {
  "use strict";

  var data = window.SITE_DATA;
  var waterfall = document.getElementById("worksWaterfall");

  /* 返回上一页：电脑端点标题区域 / 移动端点左上角返回箭头（无历史则回首页） */
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "index.html";
    }
  }
  var backBtn = document.getElementById("navBack");
  if (backBtn && window.innerWidth >= 1100) {
    backBtn.addEventListener("click", goBack);
    backBtn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goBack();
      }
    });
  }
  var backHeader = document.getElementById("navBackHeader");
  if (backHeader && window.innerWidth < 1100) {
    backHeader.addEventListener("click", goBack);
  }

  if (!data || !waterfall) return;

  var items = [];

  function renderFrom(d) {
    if (!d) return;
    data = d;
    // 首页作品卡片 + 作品瀑布页图片
    items = [];
    if (data.works) items = items.concat(data.works);
    if (data.worksGallery) items = items.concat(data.worksGallery);
    buildMasonry();
  }

  // ---------- 渲染瀑布流（优先铺满上方每一列，再往下铺） ----------
  var GAP = 20;

  function columnCount() {
    var w = window.innerWidth;
    if (w <= 1100) return 2;
    if (w <= 1280) return 5;
    return 7;
  }

  function buildMasonry() {
    waterfall.innerHTML = "";
    var cols = columnCount();
    var colEls = [];
    var colH = [];
    for (var c = 0; c < cols; c++) {
      var col = document.createElement("div");
      col.className = "work-column";
      waterfall.appendChild(col);
      colEls.push(col);
      colH.push(0);
    }
    var colW = (waterfall.clientWidth - (cols - 1) * GAP) / cols;

    // 数据里已带 ratio（宽/高），无需再 new Image() 探针预下载整页图片，
    // 图片可保持真正的懒加载，滚动到哪加载到哪
    function placeTile(w, i, ratio) {
      var tileH = ratio ? colW / ratio : colW * 1.3;
      // 放入当前最矮的一列，保证顶部先铺满
      var min = 0;
      for (var k = 1; k < cols; k++) {
        if (colH[k] < colH[min]) min = k;
      }
      var tile = document.createElement("div");
      tile.className = "work-tile tile-in";
      tile.style.animationDelay = Math.min(i * 0.04, 0.6) + "s";
      var img = document.createElement("img");
      img.alt = w.title || "作品";
      img.loading = "lazy";
      if (i < 8) {
        try { img.fetchPriority = "high"; } catch (e) { /* 忽略 */ }
      }
      try { img.decoding = "async"; } catch (e) { /* 忽略 */ }
      if (ratio) img.style.aspectRatio = ratio.toFixed(4);
      img.src = w.img;
      tile.appendChild(img);
      tile.addEventListener("click", function () {
        openLightbox(i);
      });
      colEls[min].appendChild(tile);
      colH[min] += tileH + GAP;
    }

    items.forEach(function (w, i) {
      if (w.ratio) {
        placeTile(w, i, w.ratio);
      } else {
        // 兼容旧数据：缺 ratio 时退回探针方式
        var probe = new Image();
        probe.onload = function () {
          placeTile(w, i, probe.naturalWidth / probe.naturalHeight);
        };
        probe.src = w.img;
      }
    });
  }

  // 启动：只等云端数据渲染一次；云端不可用时回退本地数据
  if (window.loadSiteData) {
    waterfall.innerHTML = '<p class="wf-loading">作品加载中…</p>';
    window.loadSiteData().then(function (d) {
      renderFrom(d || window.SITE_DATA);
    });
  } else {
    renderFrom(data);
  }
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildMasonry, 200);
  });

  // ---------- 灯箱：放大查看 / 左右切换 / 关闭 ----------
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var counterEl = document.getElementById("lightboxCounter");
  if (!lightbox || !lightboxImg) return;

  var current = 0;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var MIN_SCALE = 1;
  var MAX_SCALE = 8;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function resetZoom() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function applyTransform() {
    lightboxImg.style.transformOrigin = "0 0";
    lightboxImg.style.transform = "translate3d(" + tx + "px, " + ty + "px, 0) scale(" + scale + ")";
    lightboxImg.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }

  // 限制拖动范围：缩放后图片至少保留一部分在可视区域内
  function clampPan() {
    var w = lightboxImg.offsetWidth * scale;
    var h = lightboxImg.offsetHeight * scale;
    var nl = (window.innerWidth - lightboxImg.offsetWidth) / 2;
    var nt = (window.innerHeight - lightboxImg.offsetHeight) / 2;
    tx = clamp(tx, -nl - w + 80, window.innerWidth - 80 - nl);
    ty = clamp(ty, -nt - h + 80, window.innerHeight - 80 - nt);
    applyTransform();
  }

  function zoomAt(px, py, factor) {
    var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    if (newScale === scale) return;
    var r = lightboxImg.getBoundingClientRect();
    var ix = (px - r.left) / scale;
    var iy = (py - r.top) / scale;
    tx = tx + ix * (scale - newScale);
    ty = ty + iy * (scale - newScale);
    scale = newScale;
    clampPan();
  }

  function zoomIn() {
    var r = lightboxImg.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.45);
  }

  function zoomOut() {
    var r = lightboxImg.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.45);
  }

  function show() {
    var w = items[current];
    lightboxImg.src = w.img;
    lightboxImg.alt = w.title || "作品";
    if (counterEl) counterEl.textContent = current + 1 + " / " + items.length;
    resetZoom();
  }

  function openLightbox(i) {
    current = i;
    show();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-open");
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-open");
  }

  function prev() {
    current = (current - 1 + items.length) % items.length;
    show();
  }

  function next() {
    current = (current + 1) % items.length;
    show();
  }

  var closeBtn = document.getElementById("lightboxClose");
  var prevBtn = document.getElementById("lightboxPrev");
  var nextBtn = document.getElementById("lightboxNext");
  var zoomInBtn = document.getElementById("lightboxZoomIn");
  var zoomOutBtn = document.getElementById("lightboxZoomOut");
  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);

  // 滚轮缩放（以光标为中心）
  lightbox.addEventListener("wheel", function (e) {
    if (!lightbox.classList.contains("is-open")) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
  }, { passive: false });

  // 拖动平移（放大后）
  var dragging = false;
  var moved = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var startTx = 0;
  var startTy = 0;

  // 整个灯箱区域都可拖（放大后），避免在图片上触发原生拖拽
  lightbox.addEventListener("pointerdown", function (e) {
    if (scale <= 1) return;
    if (e.target.closest && e.target.closest(".lightbox-btn")) return;
    dragging = true;
    moved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startTx = tx;
    startTy = ty;
    lightboxImg.style.cursor = "grabbing";
    e.preventDefault();
  });

  lightbox.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    tx = startTx + dx;
    ty = startTy + dy;
    clampPan();
  });

  function endDrag() {
    if (dragging) {
      dragging = false;
      applyTransform();
    }
  }
  lightbox.addEventListener("pointerup", endDrag);
  lightbox.addEventListener("pointercancel", endDrag);

  // 双击重置缩放
  lightboxImg.addEventListener("dblclick", function () {
    resetZoom();
  });

  // 点击放大镜：单击图片放大（放大后再单击复位）
  lightboxImg.addEventListener("click", function (e) {
    if (moved) return;
    if (scale <= 1) {
      zoomAt(e.clientX, e.clientY, 2);
    } else {
      resetZoom();
    }
  });

  lightbox.addEventListener("click", function (e) {
    var wasMoved = moved;
    moved = false;
    if (wasMoved) return; // 拖拽后不触发关闭
    if (e.target === lightbox || e.target.classList.contains("lightbox-backdrop")) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });
})();
