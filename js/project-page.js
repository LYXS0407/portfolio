/* ============================================================
   项目详情页：根据 ?id= 渲染项目标题与长图堆叠
   ============================================================ */
(function () {
  "use strict";

  var data = window.SITE_DATA;
  var app = document.getElementById("projectApp");
  var loading = document.getElementById("projectLoading");
  if (!data || !app || !loading) return;

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

  var params = new URLSearchParams(window.location.search);
  var id = params.get("id") || "01";
  var index = -1;

  function fill() {
    if (index === -1) {
      loading.querySelector("p").textContent = "项目不存在";
      return;
    }

    var p = data.projects[index];
    loading.hidden = true;
    app.hidden = false;
    document.title = "鹿云先生DESIGN 项目详情";

    document.getElementById("pTitle").textContent = p.title;
    document.getElementById("pDesc").textContent = p.desc;

    var imagesBox = document.querySelector("#projectImages .container");
    imagesBox.innerHTML = "";
    p.images.forEach(function (src) {
      var fig = document.createElement("figure");
      fig.className = "proj-img";
      var img = document.createElement("img");
      img.alt = p.title;
      img.loading = "lazy";
      img.src = src;
      img.addEventListener("load", function () {
        fig.classList.add("is-loaded");
      });
      fig.appendChild(img);
      imagesBox.appendChild(fig);
    });

    var prev = data.projects[(index - 1 + data.projects.length) % data.projects.length];
    var next = data.projects[(index + 1) % data.projects.length];
    document.getElementById("pPrev").href = "project.html?id=" + prev.id;
    document.getElementById("pPrevTitle").textContent = prev.title;
    document.getElementById("pNext").href = "project.html?id=" + next.id;
    document.getElementById("pNextTitle").textContent = next.title;

    window.scrollTo(0, 0);
  }

  function boot(d) {
    if (!d) return;
    data = d;
    index = -1;
    data.projects.forEach(function (p, i) {
      if (p.id === id) index = i;
    });
    fill();
  }

  // 启动：等云端数据渲染一次（loading 态保持）；云端不可用则回退本地数据
  if (window.loadSiteData) {
    window.loadSiteData().then(function (d) {
      boot(d || window.SITE_DATA);
    });
  } else {
    boot(data);
  }
})();
