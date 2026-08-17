/* ============================================================
   作品集管理后台逻辑
   依赖：js/vendor/supabase.min.js + js/site-data-provider.js
   功能：登录 / 作品图 / 项目案例 / 经历 / 品牌 / 站点设置
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.SUPABASE_CONFIG;
  if (!cfg || typeof window.supabase === "undefined") {
    document.getElementById("loginError").textContent = "后台依赖加载失败，请检查文件是否完整。";
    document.getElementById("loginError").hidden = false;
    return;
  }

  var supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg, isErr) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    t.style.background = isErr ? "#e05c5c" : "";
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function lines(v) {
    return String(v || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------- 轻量重试（上传等瞬时失败自动重试，避免弹红色报错） ---------- */
  function withRetry(fn, times, delay) {
    var attempt = 0;
    function tryOnce() {
      return fn().catch(function (err) {
        attempt++;
        if (attempt < times) {
          return new Promise(function (res) { setTimeout(res, delay || 700); }).then(tryOnce);
        }
        throw err;
      });
    }
    return tryOnce();
  }

  function isNetworkErr(err) {
    var m = String((err && (err.message || err.error_description)) || "");
    return /fetch|network|timeout|econn|socket|load failed|failed to connect|abort/i.test(m);
  }

  /* ---------- 图片压缩：等比缩放 + 转 WebP，尽量保持画质 ---------- */
  function compressImage(file, maxDim) {
    return new Promise(function (resolve) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) return resolve(file);
      var name = file.name || "";
      if (/\.gif$/i.test(name) || file.type === "image/gif") return resolve(file);
      if (/\.svg$/i.test(name) || file.type === "image/svg+xml") return resolve(file);
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth || 1;
          var h = im.naturalHeight || 1;
          var scale = Math.min(1, (maxDim || 1600) / Math.max(w, h));
          var tw = Math.max(1, Math.round(w * scale));
          var th = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = tw;
          canvas.height = th;
          canvas.getContext("2d").drawImage(im, 0, 0, tw, th);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return resolve(file);
            var outName = name.replace(/\.[^.]+$/, "") + ".webp";
            resolve(new File([blob], outName, { type: "image/webp" }));
          }, "image/webp", 0.9);
        } catch (err) {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      im.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      im.src = url;
    });
  }

  var state = {
    works: { rows: [], row: null, pendingFiles: {}, removedImages: [] },
    projects: { rows: [], row: null, pendingFiles: {}, removedImages: [] },
    experiences: { rows: [], row: null, pendingFiles: {} },
    brands: { rows: [], row: null, pendingFiles: {} },
    settings: { row: null, pendingFiles: {}, error: null }
  };

  var PAGE_TITLES = {
    dashboard: "数据看板",
    works: "作品图",
    projects: "项目案例",
    experiences: "经历",
    brands: "品牌",
    settings: "站点设置",
    analytics: "访问分析",
    preview: "实时预览"
  };
  function setPageTitle(tab) {
    var el = $("#pageTitle");
    if (el && PAGE_TITLES[tab]) el.textContent = PAGE_TITLES[tab];
  }

  /* ---------- 右侧编辑抽屉 ---------- */
  var drawer = $("#formDrawer");
  function openDrawer(title) {
    $("#drawerTitle").textContent = title;
    var body = $("#drawerBody");
    body.innerHTML = "";
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    return body;
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }
  var drawerCloseBtn = $("#drawerClose");
  if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
  });

  /* ---------- 登录 ---------- */
  function showLogin() {
    $("#loginView").hidden = false;
    $("#editorView").hidden = true;
    $("#logoutBtn").hidden = true;
  }
  function showEditor() {
    $("#loginView").hidden = true;
    $("#editorView").hidden = false;
    $("#logoutBtn").hidden = false;
    loadAll();
  }

  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var errEl = $("#loginError");
    errEl.hidden = true;
    supabase.auth
      .signInWithPassword({
        email: $("#loginEmail").value.trim(),
        password: $("#loginPassword").value
      })
      .then(function (res) {
        if (res.error) {
          errEl.textContent = "登录失败：" + res.error.message;
          errEl.hidden = false;
        }
      });
  });
  $("#logoutBtn").addEventListener("click", function () {
    supabase.auth.signOut();
  });
  supabase.auth.onAuthStateChange(function (event, session) {
    if (session) showEditor();
    else if (event === "SIGNED_OUT") showLogin();
  });
  supabase.auth.getSession().then(function (res) {
    if (res.data && res.data.session) showEditor();
    else showLogin();
  });

  /* ---------- 标签页 ---------- */
  $("#tabs").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-tab]");
    if (!btn) return;
    closeDrawer();
    Array.prototype.forEach.call($("#tabs").children, function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    ["dashboard", "works", "projects", "experiences", "brands", "settings", "analytics", "preview"].forEach(function (t) {
      $("#panel-" + t).hidden = t !== btn.getAttribute("data-tab");
    });
    setPageTitle(btn.getAttribute("data-tab"));
    if (btn.getAttribute("data-tab") === "dashboard") renderDashboard();
    if (btn.getAttribute("data-tab") === "analytics") loadAnalytics("7d");
    if (btn.getAttribute("data-tab") === "settings") renderSettingsInline();
    if (btn.getAttribute("data-tab") === "preview") {
      var frame = $("#previewFrame");
      if (frame && !frame.getAttribute("src")) frame.setAttribute("src", "index.html");
    }
  });

  /* ---------- 上传 ---------- */
  function uploadFile(bucket, file, folder) {
    // 存储对象名只允许安全的 ASCII 字符（中文等会被 Supabase 拒绝）
    var safeName = String(file.name || "file").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
    var path = folder + "/" + Date.now() + "-" + safeName;
    // 网络抖动自动重试（upsert 保证重试不会因对象已存在而报错）
    return withRetry(function () {
      return supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" })
        .then(function (res) {
          if (res.error) throw res.error;
          return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        });
    }, 3, 700);
  }
  function imageRatio(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        resolve(im.naturalWidth / im.naturalHeight);
        URL.revokeObjectURL(url);
      };
      im.onerror = function () { resolve(null); URL.revokeObjectURL(url); };
      im.src = url;
    });
  }

  /* ---------- 列表 ---------- */
  function summarize(table, r) {
    if (table === "works") return { thumb: r.img_url, main: r.title, sub: (r.label || "") + (r.section === "card" ? " · 首页卡片" : " · 瀑布页") };
    if (table === "projects") return { thumb: r.cover_url, main: r.title, sub: [r.category, r.year, r.role].filter(Boolean).join(" · ") };
    if (table === "experiences") return { thumb: null, main: r.company, sub: r.period };
    if (table === "brands") return { thumb: r.logo_url, main: r.name, sub: "" };
    return { thumb: null, main: "", sub: "" };
  }

  function loadList(table) {
    return supabase
      .from(table)
      .select("*")
      .order("sort_order", { ascending: true })
      .then(function (res) {
        var wrap = $("#list-" + table);
        if (!wrap) return;
        if (res.error) {
          wrap.innerHTML = '<p class="adm-empty">加载失败：' + esc(res.error.message) + "（是否已运行 supabase-setup.sql？）</p>";
          return;
        }
        state[table].rows = res.data || [];
        if (!res.data || !res.data.length) {
          wrap.innerHTML = '<p class="adm-empty">还没有内容，点右上角「＋ 新增」添加。</p>';
          return;
        }
        if (table === "works") {
          renderMasonryCards(wrap, res.data);
          attachMasonryDrag(wrap, table);
          bindMasonryResize();
        } else if (table === "brands") {
          renderBrandGrid(wrap, res.data);
          attachMasonryDrag(wrap, table);
        } else {
          wrap.innerHTML = res.data
            .map(function (r, i) {
              var s = summarize(table, r);
              var thumb = "";
              if (table === "experiences") {
                thumb = '<span class="adm-num">' + esc(r.num || i + 1) + "</span>";
              } else {
                thumb = s.thumb
                  ? '<span class="adm-item-thumb"><img src="' + esc(s.thumb) + '" alt="" loading="lazy"></span>'
                  : '<span class="adm-item-thumb blank">无图</span>';
              }
              return (
                '<div class="adm-item" draggable="true" data-id="' + esc(r.id) + '">' +
                '<span class="adm-drag" title="拖拽排序">⠿</span>' +
                thumb +
                '<div class="adm-item-main"><b>' + esc(s.main) + "</b><span>" + esc(s.sub) + "</span></div>" +
                '<div class="adm-row-actions">' +
                '<button class="adm-btn adm-btn-small" data-act="edit">编辑</button>' +
                '<button class="adm-btn adm-btn-danger adm-btn-small" data-act="del">删除</button>' +
                "</div></div>"
              );
            })
            .join("");
          attachDrag(wrap, table);
        }
      });
  }

  /* ---------- 作品瀑布流卡片（与网页一致：先铺满顶部，再依次向下堆） ---------- */
  function masonryColumnCount(wrap) {
    var w = wrap.clientWidth || window.innerWidth || 1200;
    if (w <= 640) return 2;
    if (w <= 1000) return 3;
    if (w <= 1280) return 5;
    return 7;
  }

  function renderMasonryCards(wrap, rows) {
    wrap.innerHTML = "";
    var GAP = 8;
    var cols = masonryColumnCount(wrap);
    var colEls = [];
    var colH = [];
    for (var c = 0; c < cols; c++) {
      var col = document.createElement("div");
      col.className = "adm-masonry-col";
      wrap.appendChild(col);
      colEls.push(col);
      colH.push(0);
    }
    var colW = (wrap.clientWidth - (cols - 1) * GAP) / cols;

    rows.forEach(function (r) {
      var ratio = r.ratio ? Number(r.ratio) : 0.75;
      var tileH = colW / ratio + GAP;
      // 放入当前最矮的一列，保证顶部先铺满（与公开网页瀑布流一致）
      var min = 0;
      for (var k = 1; k < cols; k++) {
        if (colH[k] < colH[min]) min = k;
      }
      var isCard = r.section === "card";
      var item = document.createElement("div");
      item.className = "adm-item";
      item.setAttribute("draggable", "true");
      item.setAttribute("data-id", esc(r.id));
      item.innerHTML =
        '<span class="wf-badge ' + (isCard ? "b-card" : "b-gallery") + '">' + (isCard ? "首页卡片" : "瀑布页") + "</span>" +
        '<span class="wf-grip" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg></span>' +
        '<img src="' + esc(r.img_url) + '" alt="' + esc(r.title) + '" draggable="false" loading="lazy" style="aspect-ratio:' + ratio.toFixed(4) + '">' +
        '<div class="wf-actions">' +
        '<button class="adm-btn adm-btn-small" data-act="edit">编辑</button>' +
        '<button class="adm-btn adm-btn-small adm-btn-danger" data-act="del">删除</button>' +
        "</div>";
      colEls[min].appendChild(item);
      colH[min] += tileH;
    });
  }

  /* ---------- 拖拽排序 ---------- */
  function bindMasonryResize() {
    if (window.__admMasonryResize) return;
    window.__admMasonryResize = true;
    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var w = document.getElementById("list-works");
        if (w && state.works.rows && state.works.rows.length && w.classList.contains("adm-masonry")) {
          renderMasonryCards(w, state.works.rows);
        }
      }, 220);
    });
  }

  function attachDrag(wrap, table) {
    var dragId = null;
    wrap.addEventListener("dragstart", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      var item = e.target.closest(".adm-item");
      if (!item) return;
      dragId = item.getAttribute("data-id");
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", dragId); } catch (err) { /* 忽略 */ }
    });
    wrap.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = wrap.querySelector(".adm-item.dragging");
      if (!dragging) return;
      var after = null;
      Array.prototype.forEach.call(wrap.querySelectorAll(".adm-item:not(.dragging)"), function (item) {
        var r = item.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) after = item;
      });
      if (after) wrap.insertBefore(dragging, after.nextSibling);
      else wrap.insertBefore(dragging, wrap.firstChild);
    });
    wrap.addEventListener("dragend", function () {
      var item = wrap.querySelector(".adm-item.dragging");
      if (item) item.classList.remove("dragging");
      if (!dragId) return;
      var ids = Array.prototype.map.call(wrap.querySelectorAll(".adm-item"), function (el) {
        return el.getAttribute("data-id");
      });
      dragId = null;
      persistOrder(table, ids);
    });
  }

  /* ---------- 瀑布流拖拽排序（按指针位置插入） ---------- */
  function attachMasonryDrag(wrap, table) {
    var dragId = null;
    wrap.addEventListener("dragstart", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      var item = e.target.closest(".adm-item");
      if (!item) return;
      dragId = item.getAttribute("data-id");
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", dragId); } catch (err) { /* 忽略 */ }
    });
    wrap.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = wrap.querySelector(".adm-item.dragging");
      if (!dragging) return;
      var under = document.elementFromPoint(e.clientX, e.clientY);
      var item = under && under.closest ? under.closest(".adm-item") : null;
      if (item && item !== dragging) {
        var rect = item.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) item.parentNode.insertBefore(dragging, item);
        else item.parentNode.insertBefore(dragging, item.nextSibling);
      } else if (!item && under && under.closest) {
        // 指针落在列空隙/列底部：放到该列末尾
        var col = under.closest(".adm-masonry-col");
        if (col) col.appendChild(dragging);
      }
    });
    wrap.addEventListener("dragend", function () {
      var item = wrap.querySelector(".adm-item.dragging");
      if (item) item.classList.remove("dragging");
      if (!dragId) return;
      var ids = [];
      Array.prototype.forEach.call(wrap.querySelectorAll(".adm-masonry-col"), function (col) {
        Array.prototype.forEach.call(col.querySelectorAll(".adm-item"), function (el) {
          ids.push(el.getAttribute("data-id"));
        });
      });
      dragId = null;
      persistOrder(table, ids);
    });
  }

  function persistOrder(table, ids) {
    var tasks = ids.map(function (id, i) {
      return supabase.from(table).update({ sort_order: i }).eq("id", id);
    });
    Promise.all(tasks)
      .then(function (results) {
        if (results.some(function (r) { return r.error; })) {
          toast("排序保存失败", true);
          return;
        }
        toast("排序已保存");
        loadList(table);
      })
      .catch(function () { toast("排序保存失败", true); });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var rowEl = btn.closest(".adm-item");
    var table = rowEl && rowEl.closest("[id^=list-]") ? rowEl.closest("[id^=list-]").id.replace("list-", "") : null;
    if (!table || !rowEl) return;
    var id = rowEl.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "edit") renderForm(table, state[table].rows.find(function (r) { return r.id === id; }));
    else if (act === "del") delRow(table, id);
    else if (act === "up" || act === "down") moveRow(table, id, act === "up" ? -1 : 1);
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-new]");
    if (!btn) return;
    var table = btn.getAttribute("data-new");
    Array.prototype.forEach.call($("#tabs").children, function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-tab") === table);
    });
    ["dashboard", "works", "projects", "experiences", "brands", "settings", "analytics", "preview"].forEach(function (t) {
      $("#panel-" + t).hidden = t !== table;
    });
    setPageTitle(table);
    renderForm(table, null);
  });

  function delRow(table, id) {
    if (!confirm("确定删除这条内容吗？")) return;
    supabase.from(table).delete().eq("id", id).then(function (res) {
      if (res.error) toast("删除失败：" + res.error.message, true);
      else { toast("已删除"); loadList(table); }
    });
  }

  function moveRow(table, id, dir) {
    var rows = state[table].rows;
    var i = rows.findIndex(function (r) { return r.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    var a = rows[i], b = rows[j];
    supabase.from(table).update({ sort_order: b.sort_order }).eq("id", a.id)
      .then(function (r1) {
        if (r1.error) { toast("排序失败：" + r1.error.message, true); return; }
        return supabase.from(table).update({ sort_order: a.sort_order }).eq("id", b.id);
      })
      .then(function (r2) {
        if (r2 && r2.error) { toast("排序失败：" + r2.error.message, true); return; }
        loadList(table);
      });
  }

  /* ---------- 表单 ---------- */
  function fieldHTML(label, input) {
    return '<div class="adm-field"><label>' + label + "</label>" + input + "</div>";
  }
  function textInput(key, val, ph) {
    return '<input type="text" name="' + key + '" value="' + esc(val) + '" placeholder="' + esc(ph || "") + '">';
  }

  function fileFieldHTML(key, label, bucket, current, accept, multi) {
    var cur = "";
    if (current) {
      var isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(current);
      cur =
        '<div class="adm-file-cur">' +
        (isImg ? '<img src="' + esc(current) + '" alt="">' : '<a href="' + esc(current) + '" target="_blank" rel="noopener">' + esc(current.split("/").pop()) + "</a>") +
        '<button type="button" data-clearfile="' + key + '">移除</button></div>';
    }
    return (
      fieldHTML(
        label,
        cur +
          '<input type="file" name="' + key + '" data-bucket="' + bucket + '" accept="' + esc(accept) + '"' +
          (multi ? ' multiple' : "") + ">" +
          '<div class="file-preview" data-preview="' + key + '"></div>'
      )
    );
  }

  /* ---------- 品牌 LOGO：贴边网格 ---------- */
  function renderBrandGrid(wrap, rows) {
    wrap.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="adm-item" draggable="true" data-id="' + esc(r.id) + '">' +
          '<span class="bf-logo"><img src="' + esc(r.logo_url) + '" alt="' + esc(r.name) + '" draggable="false" loading="lazy"></span>' +
          '<span class="bf-name">' + esc(r.name) + "</span>" +
          '<div class="wf-actions">' +
          '<button class="adm-btn adm-btn-small" data-act="edit">编辑</button>' +
          '<button class="adm-btn adm-btn-small adm-btn-danger" data-act="del">删除</button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderForm(table, row) {
    var st = state[table];
    st.row = row;
    st.pendingFiles = {};
    st.removedImages = [];
    var wrap = openDrawer((row ? "编辑" : "新增") + " " + (PAGE_TITLES[table] || ""));
    var html = "";

    if (table === "works") {
      html =
        '<h3>' + (row ? "编辑作品图" : "新增作品图") + "</h3><div class='adm-form-grid'>" +
        fieldHTML("标题", textInput("title", row && row.title, "如 BLENDER MODELING")) +
        fieldHTML("副标题", textInput("label", row && row.label, "如 AIOT 软件登录页")) +
        fieldHTML("位置", '<select name="section"><option value="card"' + (row && row.section === "card" ? " selected" : "") + ">首页横向卡片</option><option value=\"gallery\"" + (row && row.section === "gallery" ? " selected" : "") + ">作品瀑布页</option></select>") +
        fieldHTML("宽高比（宽÷高，上传图片自动填）", '<input type="number" step="0.0001" name="ratio" value="' + esc(row ? row.ratio : "") + '">') +
        "</div>" +
        fileFieldHTML("img_url", "图片（png / jpg / webp）", "images", row && row.img_url, "image/*") +
        '<div class="adm-form-actions"><button class="adm-btn" type="button" data-save="works">保存</button><button class="adm-btn adm-btn-ghost" type="button" data-cancel="works">取消</button></div>';
    } else if (table === "projects") {
      var r = row || {};
      var imgs = (r.images || []).map(function (u) {
        return '<span class="adm-img-item" data-u="' + esc(u) + '"><img src="' + esc(u) + '" alt=""><button type="button" data-rmimg="' + esc(u) + '">×</button></span>';
      }).join("");
      html =
        '<h3>' + (row ? "编辑项目" : "新增项目") + "</h3><div class='adm-form-grid'>" +
        fieldHTML("编号（详情页地址用，如 04）", textInput("num", r.num, "04")) +
        fieldHTML("标题", textInput("title", r.title)) +
        fieldHTML("副标题", textInput("short", r.short)) +
        fieldHTML("分类", textInput("category", r.category)) +
        fieldHTML("年份", textInput("year", r.year)) +
        fieldHTML("角色", textInput("role", r.role)) +
        fieldHTML("标签（逗号分隔）", textInput("tags", (r.tags || []).join("，"))) +
        fieldHTML("简介", '<textarea name="description">' + esc(r.description) + "</textarea>") +
        "</div>" +
        fileFieldHTML("cover_url", "封面图", "images", r.cover_url, "image/*") +
        fieldHTML("详情长图（文件夹内可多选，每张可单独删除）",
          '<div class="adm-img-list" id="projImgs">' + imgs + "</div>" +
          '<div class="adm-add-more"><button class="adm-btn adm-btn-small adm-btn-ghost" type="button" id="addMoreImages">＋ 继续添加图片</button></div>' +
          '<input type="file" name="images" data-bucket="images" accept="image/*" multiple class="adm-hidden-input">') +
        '<div class="adm-form-actions"><button class="adm-btn" type="button" data-save="projects">保存</button><button class="adm-btn adm-btn-ghost" type="button" data-cancel="projects">取消</button></div>';
    } else if (table === "experiences") {
      html =
        '<h3>' + (row ? "编辑经历" : "新增经历") + "</h3><div class='adm-form-grid'>" +
        fieldHTML("编号", textInput("num", row && row.num, "04")) +
        fieldHTML("公司", textInput("company", row && row.company)) +
        fieldHTML("时间", textInput("period", row && row.period, "2022.2–2026.6")) +
        fieldHTML("内容（每行一段）", '<textarea name="paragraphs">' + esc((row && row.paragraphs || []).join("\n")) + "</textarea>") +
        "</div>" +
        '<div class="adm-form-actions"><button class="adm-btn" type="button" data-save="experiences">保存</button><button class="adm-btn adm-btn-ghost" type="button" data-cancel="experiences">取消</button></div>';
    } else if (table === "brands") {
      html =
        '<h3>' + (row ? "编辑品牌" : "新增品牌") + "</h3><div class='adm-form-grid'>" +
        fieldHTML("品牌名称", textInput("name", row && row.name, "如 GEELY 吉利")) +
        "</div>" +
        fileFieldHTML("logo_url", "LOGO 图片（png / svg）", "images", row && row.logo_url, "image/*") +
        '<div class="adm-form-actions"><button class="adm-btn" type="button" data-save="brands">保存</button><button class="adm-btn adm-btn-ghost" type="button" data-cancel="brands">取消</button></div>';
    }
    wrap.innerHTML = html;

    // 文件字段：选择后记录待上传
    Array.prototype.forEach.call(wrap.querySelectorAll("input[type=file]"), function (inp) {
      inp.addEventListener("change", function () {
        var key = inp.getAttribute("name");
        var bucket = inp.getAttribute("data-bucket");
        var files = Array.prototype.slice.call(inp.files || []);
        if (!files.length) return;
        inp.value = ""; // 清空输入框，允许重复选择同一文件
        var MAX = { img_url: 1600, cover_url: 1200, logo_url: 512 }[key] || 1600;
        if (key === "images") {
          // 详情长图：多选，追加到待上传列表并生成可单独删除的预览
          st.pendingFiles.images = st.pendingFiles.images || [];
          var box = wrap.querySelector("#projImgs");
          files.forEach(function (f) {
            var url = URL.createObjectURL(f);
            var entry = { url: url, file: f };
            st.pendingFiles.images.push(entry);
            compressImage(f, 1600).then(function (cf) {
              if (entry.file === f) entry.file = cf;
            });
            if (box) {
              box.insertAdjacentHTML("beforeend",
                '<span class="adm-img-item new" data-u="' + url + '">' +
                '<img src="' + url + '" alt=""><button type="button" data-rmnew="' + url + '" title="删除这张">×</button></span>');
            }
          });
          return;
        }
        // 单图 / 单文件字段：预览 + 可移除
        st.pendingFiles[key] = files[0];
        compressImage(files[0], MAX).then(function (cf) {
          if (st.pendingFiles[key] === files[0]) st.pendingFiles[key] = cf;
        });
        var pv = wrap.querySelector('[data-preview="' + key + '"]');
        if (pv) {
          pv.innerHTML = "";
          var isImg = files[0].type && files[0].type.indexOf("image/") === 0;
          pv.insertAdjacentHTML("beforeend",
            '<span class="fp-item' + (isImg ? "" : " noimg") + '">' +
            (isImg ? '<img src="' + URL.createObjectURL(files[0]) + '">' : "") +
            "<i>" + esc(files[0].name) + "</i>" +
            '<button type="button" data-clearpv="' + key + '" title="移除">×</button></span>');
        }
        if (key === "img_url" && table === "works") {
          imageRatio(files[0]).then(function (ratio) {
            var ratioInput = wrap.querySelector('input[name="ratio"]');
            if (ratio && ratioInput && !ratioInput.value) ratioInput.value = ratio.toFixed(4);
          });
        }
      });
    });
    // 「继续添加图片」按钮 → 触发隐藏的多选文件框
    var addMoreBtn = wrap.querySelector("#addMoreImages");
    var imagesInput = wrap.querySelector('input[name="images"]');
    if (addMoreBtn && imagesInput) {
      addMoreBtn.addEventListener("click", function () { imagesInput.click(); });
    }
    wrap.addEventListener("click", function (e) {
      var clearBtn = e.target.closest("[data-clearfile]");
      if (clearBtn) {
        var k = clearBtn.getAttribute("data-clearfile");
        st.pendingFiles[k] = null;
        clearBtn.parentNode.remove();
        return;
      }
      var rmBtn = e.target.closest("[data-rmimg]");
      if (rmBtn) {
        var u = rmBtn.getAttribute("data-rmimg");
        st.removedImages.push(u);
        rmBtn.closest(".adm-img-item").remove();
        return;
      }
      var rmNew = e.target.closest("[data-rmnew]");
      if (rmNew) {
        var u2 = rmNew.getAttribute("data-rmnew");
        var arr = st.pendingFiles.images || [];
        var fi = arr.findIndex(function (x) { return x.url === u2; });
        if (fi >= 0) {
          try { URL.revokeObjectURL(u2); } catch (err) { /* 忽略 */ }
          arr.splice(fi, 1);
        }
        rmNew.closest(".adm-img-item").remove();
        return;
      }
      var clearPv = e.target.closest("[data-clearpv]");
      if (clearPv) {
        var pk = clearPv.getAttribute("data-clearpv");
        st.pendingFiles[pk] = null;
        var pvBox = wrap.querySelector('[data-preview="' + pk + '"]');
        if (pvBox) pvBox.innerHTML = "";
        return;
      }
      var cancelBtn = e.target.closest("[data-cancel]");
      if (cancelBtn) { closeDrawer(); return; }
      var saveBtn = e.target.closest("[data-save]");
      if (saveBtn) saveForm(table, wrap);
    });
  }

  function saveForm(table, wrap) {
    // 防止重复点击造成多次提交/重复报错
    if (wrap.getAttribute("data-saving") === "1") return;
    wrap.setAttribute("data-saving", "1");
    var saveBtn = wrap.querySelector('[data-save]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "保存中…";
    }
    function done() {
      wrap.setAttribute("data-saving", "0");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "保存";
      }
    }
    var st = state[table];
    var get = function (name) {
      var el = wrap.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : "";
    };
    toast("保存中…");
    var uploads = [];
    var payload = {};

    function doUpload(key) {
      var f = st.pendingFiles[key];
      if (!f) return Promise.resolve(null);
      var bucket = key === "hero_video_url" || key === "hero_poster_url" || key === "resume_url" || key === "portfolio_url" ? "files" : "images";
      var folder = key === "resume_url" || key === "portfolio_url" ? "files" : key === "hero_video_url" || key === "hero_poster_url" ? "hero" : "images";
      return uploadFile(bucket, f, folder);
    }

    if (table === "works") {
      payload = {
        title: get("title"),
        label: get("label"),
        section: get("section") || "gallery",
        ratio: (function () {
          var r = parseFloat(get("ratio"));
          return isFinite(r) ? r : 0.75;
        })(),
        sort_order: st.row ? st.row.sort_order : (state.works.rows.length ? Math.max.apply(null, state.works.rows.map(function (r) { return r.sort_order; })) + 1 : 0)
      };
      uploads.push(doUpload("img_url").then(function (u) {
        if (u) payload.img_url = u;
        else if (st.row && st.row.img_url) payload.img_url = st.row.img_url;
      }));
    } else if (table === "projects") {
      var existing = ((st.row && st.row.images) || []).filter(function (u) { return st.removedImages.indexOf(u) === -1; });
      payload = {
        num: get("num"),
        title: get("title"),
        short: get("short"),
        category: get("category"),
        year: get("year"),
        role: get("role"),
        tags: get("tags").split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
        description: get("description"),
        images: existing,
        sort_order: st.row ? st.row.sort_order : (state.projects.rows.length ? Math.max.apply(null, state.projects.rows.map(function (r) { return r.sort_order; })) + 1 : 0)
      };
      uploads.push(doUpload("cover_url").then(function (u) {
        if (u) payload.cover_url = u;
        else if (st.row && st.row.cover_url) payload.cover_url = st.row.cover_url;
      }));
      uploads.push(Promise.all((st.pendingFiles.images || []).map(function (item) {
        return uploadFile("images", item.file, "projects");
      })).then(function (urls) {
        payload.images = payload.images.concat(urls);
      }));
    } else if (table === "experiences") {
      payload = {
        num: get("num"),
        company: get("company"),
        period: get("period"),
        paragraphs: lines(get("paragraphs")),
        sort_order: st.row ? st.row.sort_order : (state.experiences.rows.length ? Math.max.apply(null, state.experiences.rows.map(function (r) { return r.sort_order; })) + 1 : 0)
      };
    } else if (table === "brands") {
      payload = {
        name: get("name"),
        sort_order: st.row ? st.row.sort_order : (state.brands.rows.length ? Math.max.apply(null, state.brands.rows.map(function (r) { return r.sort_order; })) + 1 : 0)
      };
      uploads.push(doUpload("logo_url").then(function (u) {
        if (u) payload.logo_url = u;
        else if (st.row && st.row.logo_url) payload.logo_url = st.row.logo_url;
      }));
    }

    Promise.all(uploads)
      .then(function () {
        // 必填校验（给出明确提示，避免数据库报错）
        var missing = "";
        if (table === "works") {
          if (!payload.title) missing = "请填写标题";
          else if (!payload.img_url) missing = "请先上传图片";
        } else if (table === "projects") {
          if (!payload.num) missing = "请填写编号";
          else if (!payload.title) missing = "请填写标题";
          else if (!payload.cover_url) missing = "请先上传封面图";
        } else if (table === "experiences") {
          if (!payload.company) missing = "请填写公司";
        } else if (table === "brands") {
          if (!payload.name) missing = "请填写品牌名称";
          else if (!payload.logo_url) missing = "请先上传 LOGO 图片";
        }
        if (missing) { toast(missing, true); return false; }
        var write = function () {
          // supabase 的 insert/update 返回的是 thenable（没有 .catch），
          // 包一层 Promise.resolve 才能安全地 catch 重试
          return Promise.resolve(
            st.row
              ? supabase.from(table).update(payload).eq("id", st.row.id)
              : supabase.from(table).insert(payload)
          );
        };
        // 网络抖动时自动重试一次（仅网络类错误，避免重复插入）
        return write().catch(function (err) {
          if (!isNetworkErr(err)) throw err;
          return new Promise(function (res) { setTimeout(res, 800); }).then(write);
        });
      })
      .then(function (res) {
        done();
        if (res === false) return; // 必填校验未通过，已提示
        if (!res) throw new Error("请求无响应，请重试");
        if (res.error) throw res.error;
        toast("已保存，公开页面下次加载即生效");
        closeDrawer();
        loadList(table);
      })
      .catch(function (err) {
        done();
        toast("保存失败：" + err.message, true);
      });
  }

  /* ---------- 站点设置 ---------- */
  function loadSettings() {
    return supabase.from("site_settings").select("*").limit(1).then(function (res) {
      if (res.error) { state.settings.error = res.error.message; return; }
      var s = res.data && res.data[0];
      state.settings.row = s;
      state.settings.error = null;
    });
  }

  function renderSettingsInline() {
    var box = $("#form-settings");
    if (!box) return;
    if (state.settings.error) {
      box.innerHTML = '<p class="adm-empty">加载失败：' + esc(state.settings.error) + "（是否已运行 supabase-setup.sql？）</p>";
      return;
    }
    if (!state.settings.row) {
      box.innerHTML = '<p class="adm-empty">站点设置不存在，请先运行 supabase-setup.sql。</p>';
      return;
    }
    renderSettingsForm(state.settings.row);
  }

  function renderSettingsForm(s) {
    var st = state.settings;
    st.pendingFiles = {};
    var t = function (k) { return textInput(k, s[k]); };
    var html =
      '<div class="adm-form-grid">' +
      fieldHTML("姓名", t("name")) +
      fieldHTML("英文名", t("name_en")) +
      fieldHTML("中文头衔", t("role_cn")) +
      fieldHTML("英文头衔", t("role_en")) +
      fieldHTML("Slogan", t("slogan")) +
      fieldHTML("Slogan 中文", t("slogan_cn")) +
      fieldHTML("教育经历", t("education")) +
      fieldHTML("个人简介（每行一段）", '<textarea name="about">' + esc((s.about || []).join("\n")) + "</textarea>") +
      fieldHTML("邮箱", t("email")) +
      fieldHTML("微信", t("wechat")) +
      fieldHTML("小红书标题", t("xhs_label")) +
      fieldHTML("小红书账号", t("xhs_account")) +
      fieldHTML("小红书链接", t("xhs_url")) +
      fieldHTML("联系我口号（联系版块下方的小字）", '<textarea name="contact_desc" style="min-height:56px">' + esc(s.contact_desc || "") + "</textarea>") +
      "</div>" +
      fileFieldHTML("portrait_url", "个人形象照（png / jpg / webp）", "images", s.portrait_url, "image/*") +
      fileFieldHTML("hero_video_url", "首页视频（mp4，上传即替换）", "files", s.hero_video_url, "video/mp4") +
      fileFieldHTML("hero_poster_url", "视频封面图", "files", s.hero_poster_url, "image/*") +
      fileFieldHTML("resume_url", "简历 PDF", "files", s.resume_url, "application/pdf") +
      fileFieldHTML("portfolio_url", "作品集 PDF", "files", s.portfolio_url, "application/pdf") +
      '<div class="adm-form-actions"><button class="adm-btn" type="button" id="saveSettings">保存设置</button></div>';
    $("#form-settings").innerHTML = html;
    var wrap = $("#form-settings");
    Array.prototype.forEach.call(wrap.querySelectorAll("input[type=file]"), function (inp) {
      inp.addEventListener("change", function () {
        var key = inp.getAttribute("name");
        var f = inp.files && inp.files[0];
        if (!f) return;
        st.pendingFiles[key] = f;
        var MAX = { portrait_url: 1200, hero_poster_url: 1600 }[key] || 1600;
        compressImage(f, MAX).then(function (cf) {
          if (st.pendingFiles[key] === f) st.pendingFiles[key] = cf;
        });
        var pv = wrap.querySelector('[data-preview="' + key + '"]');
        if (pv) {
          pv.innerHTML = "";
          var isImg = f.type && f.type.indexOf("image/") === 0;
          pv.insertAdjacentHTML("beforeend",
            '<span class="fp-item' + (isImg ? "" : " noimg") + '">' +
            (isImg ? '<img src="' + URL.createObjectURL(f) + '">' : "") +
            "<i>" + esc(f.name) + "</i>" +
            '<button type="button" data-clearpv="' + key + '" title="移除">×</button></span>');
        }
        inp.value = "";
      });
    });
    wrap.addEventListener("click", function (e) {
      var clearBtn = e.target.closest("[data-clearfile]");
      if (clearBtn) {
        var k = clearBtn.getAttribute("data-clearfile");
        st.pendingFiles[k] = null;
        clearBtn.parentNode.remove();
        return;
      }
      var clearPv = e.target.closest("[data-clearpv]");
      if (clearPv) {
        var pk = clearPv.getAttribute("data-clearpv");
        st.pendingFiles[pk] = null;
        var pvBox = wrap.querySelector('[data-preview="' + pk + '"]');
        if (pvBox) pvBox.innerHTML = "";
        return;
      }
      if (e.target.closest("#saveSettings")) saveSettings(wrap);
    });
  }

  function saveSettings(wrap) {
    var st = state.settings;
    var s = st.row || {};
    var get = function (name) {
      var el = wrap.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : "";
    };
    var payload = {
      name: get("name"), name_en: get("name_en"), role_cn: get("role_cn"), role_en: get("role_en"),
      slogan: get("slogan"), slogan_cn: get("slogan_cn"), education: get("education"),
      about: lines(get("about")),
      email: get("email"), wechat: get("wechat"),
      xhs_label: get("xhs_label"), xhs_account: get("xhs_account"), xhs_url: get("xhs_url"),
      contact_desc: get("contact_desc")
    };
    var files = [
      { key: "portrait_url", bucket: "images", folder: "portrait" },
      { key: "hero_video_url", bucket: "files", folder: "hero" },
      { key: "hero_poster_url", bucket: "files", folder: "hero" },
      { key: "resume_url", bucket: "files", folder: "files" },
      { key: "portfolio_url", bucket: "files", folder: "files" }
    ];
    var tasks = files.map(function (file) {
      var k = file.key;
      var f = st.pendingFiles[k];
      if (f) return uploadFile(file.bucket, f, file.folder).then(function (u) { payload[k] = u; });
      if (s[k]) payload[k] = s[k];
      return Promise.resolve();
    });
    toast("保存中…");
    Promise.all(tasks)
      .then(function () {
        return supabase.from("site_settings").update(payload).eq("id", 1);
      })
      .then(function (res) {
        if (res.error) throw res.error;
        toast("设置已保存，公开页面下次加载即生效");
        loadSettings().then(function () { renderSettingsInline(); });
      })
      .catch(function (err) {
        toast("保存失败：" + err.message, true);
      });
  }

  /* ---------- 初始化 ---------- */
  function loadAll() {
    Promise.all([
      loadList("works"),
      loadList("projects"),
      loadList("experiences"),
      loadList("brands"),
      loadSettings()
    ]).then(function () {
      renderDashboard();
    });
  }

  /* ---------- 概览仪表盘 ---------- */
  function barRow(label, count, max, suffix) {
    var pct = max ? Math.round((count / max) * 100) : 0;
    return (
      '<div class="adm-bar-row">' +
      '<span class="adm-bar-label">' + esc(label) + "</span>" +
      '<div class="adm-bar-track"><div class="adm-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="adm-bar-num">' + count + (suffix || "") + "</span></div>"
    );
  }

  function renderDashboard() {
    var w = state.works.rows || [];
    var p = state.projects.rows || [];
    var e = state.experiences.rows || [];
    var b = state.brands.rows || [];
    var s = state.settings.row;

    var updated = "";
    if (s && s.updated_at) {
      try {
        updated = new Date(s.updated_at).toLocaleString("zh-CN", { hour12: false });
      } catch (err) { updated = ""; }
    }

    $("#statsCards").innerHTML =
      statCard("作品图", w.length, "assets/cards/visual.webp") +
      statCard("项目案例", p.length, "assets/covers/01.jpg") +
      statCard("经历", e.length, null, "04") +
      statCard("品牌 LOGO", b.length, "assets/brands/wangyi.png");

    // 项目分类分布
    var catMap = {};
    p.forEach(function (r) { catMap[r.category || "未分类"] = (catMap[r.category || "未分类"] || 0) + 1; });
    var cats = Object.keys(catMap).map(function (k) { return { k: k, n: catMap[k] }; }).sort(function (a, b2) { return b2.n - a.n; });
    var catMax = cats.length ? cats[0].n : 0;
    $("#chartCategory").innerHTML = cats.length
      ? cats.map(function (c) { return barRow(c.k, c.n, catMax, " 个"); }).join("")
      : '<p class="adm-empty">暂无项目数据</p>';

    // 项目年份分布
    var yearMap = {};
    p.forEach(function (r) {
      var y = String(r.year || "").trim().split(/[–—-]/)[0];
      yearMap[y || "未填写"] = (yearMap[y || "未填写"] || 0) + 1;
    });
    var years = Object.keys(yearMap).map(function (k) { return { k: k, n: yearMap[k] }; }).sort(function (a, b2) { return b2.n - a.n; });
    var yearMax = years.length ? years[0].n : 0;
    $("#chartYear").innerHTML = years.length
      ? years.map(function (y) { return barRow(y.k, y.n, yearMax, " 个"); }).join("")
      : '<p class="adm-empty">暂无项目数据</p>';

    // 作品图构成
    var cards = w.filter(function (r) { return r.section === "card"; }).length;
    var gallery = w.length - cards;
    var wMax = Math.max(cards, gallery, 1);
    $("#chartWorks").innerHTML = barRow("首页横向卡片", cards, wMax) + barRow("作品瀑布页", gallery, wMax);

    // 快捷操作
    $("#quickActions").innerHTML =
      '<button class="adm-btn" type="button" data-new="works">＋ 新增作品图</button>' +
      '<button class="adm-btn" type="button" data-new="projects">＋ 新增项目</button>' +
      '<button class="adm-btn" type="button" data-goto="settings">编辑简介 / 视频 / 附件</button>' +
      '<button class="adm-btn" type="button" data-goto="analytics">查看访问分析</button>' +
      '<button class="adm-btn adm-btn-ghost" type="button" data-goto="preview">查看实时预览</button>';

    loadAnalyticsSummary();
  }

  function statCard(label, count, thumb, fallbackText) {
    var img = thumb
      ? '<img src="' + esc(thumb) + '" alt="">'
      : '<span class="adm-stat-fallback">' + esc(fallbackText || "") + "</span>";
    return (
      '<div class="adm-stat">' +
      '<span class="adm-stat-thumb">' + img + "</span>" +
      '<div class="adm-stat-main"><b>' + count + "</b><span>" + esc(label) + "</span></div></div>"
    );
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-goto]");
    if (!btn) return;
    var tab = btn.getAttribute("data-goto");
    closeDrawer();
    Array.prototype.forEach.call($("#tabs").children, function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-tab") === tab);
    });
    ["dashboard", "works", "projects", "experiences", "brands", "settings", "analytics", "preview"].forEach(function (t) {
      $("#panel-" + t).hidden = t !== tab;
    });
    setPageTitle(tab);
    if (tab === "dashboard") renderDashboard();
    if (tab === "analytics") loadAnalytics("7d");
    if (tab === "settings") renderSettingsInline();
    if (tab === "preview") {
      var frame = $("#previewFrame");
      if (frame && !frame.getAttribute("src")) frame.setAttribute("src", "index.html");
    }
  });

  /* ---------- 实时预览刷新 ---------- */
  var previewBtn = $("#previewRefresh");
  if (previewBtn) {
    previewBtn.addEventListener("click", function () {
      var frame = $("#previewFrame");
      if (frame && frame.contentWindow) {
        try { frame.contentWindow.location.reload(); } catch (err) {
          frame.setAttribute("src", frame.getAttribute("src") || "index.html");
        }
      }
    });
  }

  /* ---------- 访问分析 ---------- */
  function rangeStart(range) {
    var now = new Date();
    if (range === "today") { var d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
    if (range === "7d") return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    if (range === "30d") return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    return null;
  }

  function loadAnalytics(range) {
    var q = supabase.from("analytics_events").select("*").order("created_at", { ascending: false }).limit(10000);
    var since = rangeStart(range);
    if (since) q = q.gte("created_at", since.toISOString());
    return q.then(function (res) {
      if (res.error) {
        $("#anStats").innerHTML = '<p class="adm-empty">加载失败：' + esc(res.error.message) + "（是否已运行 analytics 建表 SQL？）</p>";
        return;
      }
      renderAnalytics(res.data || [], range);
    });
  }

  function renderAnalytics(events, range) {
    var pv = events.filter(function (e) { return e.event_type === "pageview"; });
    var sessions = {};
    pv.forEach(function (e) { sessions[e.session_id] = true; });
    var uv = Object.keys(sessions).length;

    var durBySession = {};
    events.forEach(function (e) {
      if (e.event_type === "heartbeat" && e.meta && e.meta.duration_sec) {
        var d = e.meta.duration_sec;
        if (!durBySession[e.session_id] || d > durBySession[e.session_id]) durBySession[e.session_id] = d;
      }
    });
    var durKeys = Object.keys(durBySession);
    var avgDur = durKeys.length
      ? Math.round(durKeys.reduce(function (s, k) { return s + durBySession[k]; }, 0) / durKeys.length)
      : 0;

    var downloads = events.filter(function (e) { return e.event_type === "download"; });
    var copies = events.filter(function (e) { return e.event_type === "copy_contact"; });
    var xhs = events.filter(function (e) { return e.event_type === "click_xhs"; });

    $("#anStats").innerHTML =
      anStat(pv.length, "浏览量 PV") +
      anStat(uv, "独立访客 UV") +
      anStat(avgDur ? Math.floor(avgDur / 60) + "分" + (avgDur % 60) + "秒" : "—", "平均停留") +
      anStat(downloads.length, "简历/作品集下载") +
      anStat(copies.length, "复制联系方式") +
      anStat(xhs.length, "跳转小红书");

    // 趋势（今天按小时，其余按天）
    var fmt = range === "today"
      ? function (d) { return d.getHours() + "时"; }
      : function (d) { return (d.getMonth() + 1) + "/" + d.getDate(); };
    var trendMap = {};
    pv.forEach(function (e) {
      var k = fmt(new Date(e.created_at));
      if (!trendMap[k]) trendMap[k] = { pv: 0, uv: {}, ts: new Date(e.created_at).getTime() };
      trendMap[k].pv++;
      trendMap[k].uv[e.session_id] = true;
    });
    var trend = Object.keys(trendMap).map(function (k) {
      return { k: k, ts: trendMap[k].ts, pv: trendMap[k].pv, uv: Object.keys(trendMap[k].uv).length };
    }).sort(function (a, b) { return a.ts - b.ts; });
    $("#anTrend").innerHTML =
      '<div class="an-legend"><span class="lg-pv">PV</span><span class="lg-uv">独立访客</span></div>' +
      trendSVG(trend);

    // 来源
    var srcMap = {};
    pv.forEach(function (e) {
      var s = classifySource(e.referrer);
      srcMap[s] = (srcMap[s] || 0) + 1;
    });
    var srcs = sortMap(srcMap);
    $("#anSources").innerHTML = srcs.length
      ? srcs.map(function (x) { return barRow(x.k, x.n, srcs[0].n); }).join("")
      : '<p class="adm-empty">暂无数据</p>';

    // 页面
    var pageMap = {};
    pv.forEach(function (e) { pageMap[e.page || "?"] = (pageMap[e.page || "?"] || 0) + 1; });
    var pages = sortMap(pageMap).slice(0, 6);
    $("#anPages").innerHTML = pages.length
      ? pages.map(function (x) { return barRow(x.k, x.n, pages[0].n); }).join("")
      : '<p class="adm-empty">暂无数据</p>';

    // 设备
    var devMap = {};
    pv.forEach(function (e) { devMap[e.device || "未知"] = (devMap[e.device || "未知"] || 0) + 1; });
    var devs = sortMap(devMap);
    $("#anDevices").innerHTML = devs.length
      ? devs.map(function (x) { return barRow(x.k, x.n, devs[0].n); }).join("")
      : '<p class="adm-empty">暂无数据</p>';

    // 热门作品
    var workMap = {};
    events.forEach(function (e) {
      if (e.event_type === "click_project" || e.event_type === "click_work") {
        var label = (e.meta && (e.meta.title || e.meta.id)) || "未命名";
        workMap[label] = (workMap[label] || 0) + 1;
      }
    });
    var works = sortMap(workMap).slice(0, 8);
    $("#anWorks").innerHTML = works.length
      ? works.map(function (x) { return barRow(x.k, x.n, works[0].n, " 次"); }).join("")
      : '<p class="adm-empty">暂无数据</p>';

    // 转化
    var conv = [];
    downloads.forEach(function (e) {
      var f = (e.meta && e.meta.file) || "未知文件";
      conv.push({ label: "下载 " + f, n: 1 });
    });
    copies.forEach(function (e) {
      conv.push({ label: (e.meta && e.meta.type === "wechat" ? "复制微信" : "复制邮箱"), n: 1 });
    });
    xhs.forEach(function () { conv.push({ label: "跳转小红书", n: 1 }); });
    var convMap = {};
    conv.forEach(function (c) { convMap[c.label] = (convMap[c.label] || 0) + c.n; });
    var convs = sortMap(convMap);
    $("#anConv").innerHTML = convs.length
      ? convs.map(function (x) { return barRow(x.k, x.n, convs[0].n, " 次"); }).join("")
      : '<p class="adm-empty">暂无转化数据</p>';
  }

  function anStat(v, label) {
    return (
      '<div class="adm-stat"><div class="adm-stat-main"><b>' + esc(String(v)) + "</b><span>" + esc(label) + "</span></div></div>"
    );
  }

  function classifySource(ref) {
    if (!ref) return "直接访问";
    if (/baidu|google|bing|sogou|so\.com|360|yandex/i.test(ref)) return "搜索引擎";
    try {
      var h = new URL(ref).hostname.replace(/^www\./, "");
      return h;
    } catch (e) {
      return "外部链接";
    }
  }

  function sortMap(map) {
    return Object.keys(map).map(function (k) { return { k: k, n: map[k] }; }).sort(function (a, b) { return b.n - a.n; });
  }

  function trendKey(k) {
    // 用于时间排序：小时格式 "9时" → 数字；日期 "8/16" → 月*100+日
    if (/时$/.test(k)) return parseInt(k, 10);
    var p = k.split("/");
    return parseInt(p[0], 10) * 100 + parseInt(p[1], 10);
  }

  function trendSVG(data) {
    var W = 640, H = 170, PAD = 36;
    if (!data || !data.length) return '<p class="adm-empty">暂无数据</p>';
    var max = Math.max.apply(null, data.map(function (d) { return Math.max(d.pv, d.uv); })) || 1;
    var stepX = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
    function pts(key) {
      return data.map(function (d, i) {
        return (PAD + i * stepX).toFixed(1) + "," + (H - PAD - (d[key] / max) * (H - PAD * 2)).toFixed(1);
      }).join(" ");
    }
    var grid = "";
    for (var g = 0; g <= 4; g++) {
      var gy = PAD + (g / 4) * (H - PAD * 2);
      grid += '<line x1="' + PAD + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PAD) + '" y2="' + gy.toFixed(1) + '" stroke="#232329" stroke-width="1"/>';
    }
    var labels = "";
    var step = Math.max(1, Math.floor(data.length / 6));
    data.forEach(function (d, i) {
      if (i % step === 0 || i === data.length - 1) {
        labels += '<text x="' + (PAD + i * stepX).toFixed(1) + '" y="' + (H - 10) + '" fill="#9a9aa3" font-size="10" text-anchor="middle">' + esc(d.k) + "</text>";
      }
    });
    return (
      '<svg viewBox="0 0 ' + W + " " + H + '" class="an-svg" role="img" aria-label="访问趋势">' +
      '<defs><linearGradient id="anGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>' +
      "</linearGradient></defs>" + grid +
      '<polygon fill="url(#anGrad)" points="' + PAD + "," + (H - PAD) + " " + pts("pv") + " " + (W - PAD) + "," + (H - PAD) + '"/>' +
      '<polyline fill="none" stroke="#ffffff" stroke-width="1.8" points="' + pts("pv") + '"/>' +
      '<polyline fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.8" stroke-dasharray="4 3" points="' + pts("uv") + '"/>' +
      labels + "</svg>"
    );
  }

  /* ---------- 数据看板：近 7 天访问概况 ---------- */
  function loadAnalyticsSummary() {
    var since = rangeStart("7d");
    supabase.from("analytics_events").select("*").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(10000)
      .then(function (res) {
        var statsEl = $("#dashAnalyticsStats");
        var trendEl = $("#dashAnalyticsTrend");
        if (!statsEl || !trendEl) return;
        if (res.error) {
          statsEl.innerHTML = '<p class="adm-empty">请先运行 analytics 建表 SQL</p>';
          return;
        }
        var events = res.data || [];
        var pv = events.filter(function (e) { return e.event_type === "pageview"; });
        var sessions = {};
        pv.forEach(function (e) { sessions[e.session_id] = true; });
        var durBySession = {};
        events.forEach(function (e) {
          if (e.event_type === "heartbeat" && e.meta && e.meta.duration_sec) {
            var d = e.meta.duration_sec;
            if (!durBySession[e.session_id] || d > durBySession[e.session_id]) durBySession[e.session_id] = d;
          }
        });
        var durKeys = Object.keys(durBySession);
        var avgDur = durKeys.length
          ? Math.round(durKeys.reduce(function (s, k) { return s + durBySession[k]; }, 0) / durKeys.length)
          : 0;
        var dl = events.filter(function (e) { return e.event_type === "download"; }).length;
        var cp = events.filter(function (e) { return e.event_type === "copy_contact"; }).length;
        var xhs = events.filter(function (e) { return e.event_type === "click_xhs"; }).length;
        statsEl.innerHTML =
          anStat(pv.length, "浏览量 PV") +
          anStat(Object.keys(sessions).length, "独立访客 UV") +
          anStat(avgDur ? Math.floor(avgDur / 60) + "分" + (avgDur % 60) + "秒" : "—", "平均停留") +
          anStat(dl, "下载") +
          anStat(cp, "复制联系") +
          anStat(xhs, "跳转小红书");

        var trendMap = {};
        pv.forEach(function (e) {
          var d = new Date(e.created_at);
          var k = (d.getMonth() + 1) + "/" + d.getDate();
          if (!trendMap[k]) trendMap[k] = { pv: 0, uv: {}, ts: d.getTime() };
          trendMap[k].pv++;
          trendMap[k].uv[e.session_id] = true;
        });
        var trend = Object.keys(trendMap).map(function (k) {
          return { k: k, ts: trendMap[k].ts, pv: trendMap[k].pv, uv: Object.keys(trendMap[k].uv).length };
        }).sort(function (a, b) { return a.ts - b.ts; });
        trendEl.innerHTML = trendSVG(trend);
      });
  }

  function sumItem(v, label) {
    return '<span class="adm-sum-item"><b>' + v + "</b>" + label + "</span>";
  }

  /* ---------- 访问分析时间段切换 ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-range]");
    if (!btn) return;
    Array.prototype.forEach.call($("#anRange").children, function (x) {
      x.classList.toggle("is-active", x === btn);
    });
    loadAnalytics(btn.getAttribute("data-range"));
  });
})();
