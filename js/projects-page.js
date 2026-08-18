/* ============================================================
   全部项目瀑布页：卡片瀑布（后续新增项目自动出现）
   ============================================================ */
(function () {
  "use strict";

  var data = window.SITE_DATA;
  var waterfall = document.getElementById("waterfall");
  var countEl = document.getElementById("galleryCount");
  if (!data || !waterfall) return;

  /* 返回上一页：电脑端点标题区域 / 移动端点左上角返回箭头（无历史则回首页），与作品展示页一致 */
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

  // 启动：等云端数据渲染一次（与作品页/首页一致）；云端不可用则回退本地
  if (window.loadSiteData) {
    waterfall.innerHTML = '<p class="wf-loading">项目加载中…</p>';
    window.loadSiteData().then(function (d) {
      boot(d || window.SITE_DATA);
    });
  } else {
    boot(data);
  }
})();
