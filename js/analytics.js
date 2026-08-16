/* ============================================================
   轻量访问埋点：批量上报到 Supabase analytics_events
   - 采集：页面浏览 / 版块曝光 / 滚动深度 / 点击作品 / 下载 /
           复制联系方式 / 跳转小红书 / 视频播放 / 停留时长
   - 匿名会话 ID 存在 localStorage，不采集个人信息
   - 上报失败静默丢弃，绝不阻塞或拖慢页面
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.SUPABASE_CONFIG;
  if (!cfg) return;

  /* ---------- 会话 ID ---------- */
  var SID_KEY = "lfq_analytics_sid";
  var sid = "";
  try {
    sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SID_KEY, sid);
    }
  } catch (e) {
    sid = "s-" + Date.now().toString(36);
  }

  /* ---------- 环境信息 ---------- */
  var page = location.pathname.split("/").pop() || "index.html";
  var title = document.title || "";
  var referrer = document.referrer || "";
  var ua = navigator.userAgent || "";
  var device = /iPad|Tablet/i.test(ua) ? "平板"
    : /Mobile|Android|iPhone/i.test(ua) ? "手机" : "电脑";
  var os = /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad/i.test(ua) ? "iOS" : "其他";
  var browser = /Edg\//i.test(ua) ? "Edge"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari" : "其他";
  var screen = window.screen ? window.screen.width + "x" + window.screen.height : "";

  /* ---------- 队列与批量上报 ---------- */
  var queue = [];
  function push(type, meta) {
    try {
      queue.push({
        event_type: type,
        session_id: sid,
        page: page,
        title: title,
        referrer: referrer,
        device: device,
        os: os,
        browser: browser,
        screen: screen,
        meta: meta || {}
      });
      if (queue.length >= 8) flush(false);
    } catch (e) { /* 忽略 */ }
  }
  function flush(keepalive) {
    if (!queue.length) return;
    var batch = queue;
    queue = [];
    try {
      fetch(cfg.url + "/rest/v1/analytics_events", {
        method: "POST",
        headers: {
          apikey: cfg.anonKey,
          Authorization: "Bearer " + cfg.anonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(batch),
        keepalive: !!keepalive
      }).catch(function () { /* 静默丢弃 */ });
    } catch (e) {
      queue = batch;
    }
  }
  setInterval(function () { flush(false); }, 5000);

  /* ---------- 页面浏览（含 UTM） ---------- */
  var meta = {};
  try {
    var sp = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) {
      var v = sp.get(k);
      if (v) meta[k] = v;
    });
  } catch (e) { /* 忽略 */ }
  push("pageview", meta);

  /* ---------- 版块曝光（仅真实 DOM，排除液态玻璃副本） ---------- */
  if ("IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !seen[en.target.id]) {
          seen[en.target.id] = true;
          push("section_view", { section: en.target.id });
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll("body > main section[id]").forEach(function (s) {
      io.observe(s);
    });
  }

  /* ---------- 滚动深度 ---------- */
  var depths = { 25: false, 50: false, 75: false, 100: false };
  var tick = false;
  window.addEventListener("scroll", function () {
    if (tick) return;
    tick = true;
    requestAnimationFrame(function () {
      tick = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      var p = Math.round((window.scrollY / max) * 100);
      Object.keys(depths).forEach(function (d) {
        if (!depths[d] && p >= +d) {
          depths[d] = true;
          push("scroll_depth", { percent: +d });
        }
      });
    });
  }, { passive: true });

  /* ---------- 点击行为 ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t.closest ? t.closest("a, button") : null;
    if (!a) return;
    var href = a.getAttribute && a.getAttribute("href") || "";

    // 下载简历 / 作品集
    if (/\.pdf$/i.test(href) || a.classList.contains("btn-download") || a.classList.contains("btn-text")) {
      push("download", { file: href.split("/").pop() });
      return;
    }
    // 案例 / 项目点击
    if (a.classList && (a.classList.contains("case-card") || a.classList.contains("project-tile"))) {
      push("click_project", { id: href.split("id=")[1] || "" });
      return;
    }
    // 作品大图（瀑布页灯箱）
    var tile = t.closest ? t.closest(".work-tile") : null;
    if (tile) {
      var img = tile.querySelector("img");
      push("click_work", { title: img ? img.getAttribute("alt") || "" : "" });
      return;
    }
    // 复制邮箱 / 微信
    var copy = t.closest ? t.closest(".cc-copy, .contact-card.is-copy") : null;
    if (copy) {
      var labelEl = copy.querySelector(".cc-label");
      var type = labelEl ? labelEl.textContent : "";
      push("copy_contact", { type: /微信/.test(type) ? "wechat" : "email" });
      return;
    }
    // 跳转小红书
    if (a.classList && a.classList.contains("contact-card") && a.getAttribute("target") === "_blank") {
      push("click_xhs", {});
    }
  });

  /* ---------- 首页视频播放 ---------- */
  var v = document.querySelector("video.hero-video");
  if (v) {
    var vSeen = {};
    v.addEventListener("play", function () { push("video", { action: "play" }); });
    v.addEventListener("timeupdate", function () {
      if (!v.duration) return;
      var pct = Math.round((v.currentTime / v.duration) * 100);
      [25, 50, 75, 100].forEach(function (d) {
        if (!vSeen[d] && pct >= d) {
          vSeen[d] = true;
          push("video", { action: "watched_" + d + "pct" });
        }
      });
    });
  }

  /* ---------- 停留时长（30 秒心跳 + 离开时上报） ---------- */
  var startTs = Date.now();
  function sendDuration() {
    var sec = Math.round((Date.now() - startTs) / 1000);
    if (sec >= 3) push("heartbeat", { duration_sec: sec });
  }
  setInterval(sendDuration, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      sendDuration();
      flush(true);
    }
  });
  window.addEventListener("pagehide", function () {
    sendDuration();
    flush(true);
  });
})();
