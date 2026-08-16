/* ============================================================
   全部项目瀑布页：卡片瀑布（后续新增项目自动出现）
   ============================================================ */
(function () {
  "use strict";

  var data = window.SITE_DATA;
  var waterfall = document.getElementById("waterfall");
  var countEl = document.getElementById("galleryCount");
  if (!data || !waterfall) return;

  var backBtn = document.getElementById("navBack");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  function renderGrid() {
    waterfall.innerHTML = "";
    data.projects.forEach(function (p, i) {
      var a = document.createElement("a");
      a.className = "project-tile tile-in";
      a.href = "project.html?id=" + p.id;
      a.style.animationDelay = Math.min(i * 0.06, 0.6) + "s";

      var media = document.createElement("div");
      media.className = "pt-media";
      var img = document.createElement("img");
      img.src = p.cover;
      img.alt = p.title;
      img.loading = "lazy";
      media.appendChild(img);

      var body = document.createElement("div");
      body.className = "pt-body";
      var title = document.createElement("h3");
      title.className = "pt-title";
      title.textContent = p.title;
      body.appendChild(title);

      a.appendChild(media);
      a.appendChild(body);
      waterfall.appendChild(a);
    });

    if (countEl) {
      countEl.textContent = "共 " + data.projects.length + " 个项目";
    }
  }

  function boot(d) {
    if (!d) return;
    data = d;
    renderGrid();
  }

  // 启动：先用本地数据立即渲染，云端数据到达后再刷新（不阻塞）
  boot(data);
  if (window.loadSiteData) {
    window.loadSiteData().then(function (d) {
      if (d) boot(d);
    });
  }
})();
