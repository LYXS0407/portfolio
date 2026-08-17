/* ============================================================
   数据提供层：优先从 Supabase 云端读取内容
   - 读取失败 / 超时（约 3.5 秒）时自动回退到本地 js/site-data.js，
     保证网站任何情况下都能正常展示。
   - 暴露 window.loadSiteData()，返回 Promise<站点数据 | null>
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    url: "https://ymnmteysdmzxsxkfndie.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltbm10ZXlzZG16eHN4a2ZuZGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzU4NTksImV4cCI6MjEwMjQxMTg1OX0.qWgSW-N9m3se7ZV8UIhd549Q66ua8hebae05MNRXZek"
  };

  window.SUPABASE_CONFIG = CONFIG;

  var client = null;
  function getClient() {
    if (!client && typeof window.supabase !== "undefined" && window.supabase.createClient) {
      client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return client;
  }

  // supabase.min.js 可能被异步加载，等待它就绪后再发起云端请求，
  // 避免首个请求恰好发生在库加载完成前而白白丢失云端数据
  function waitForClient(deadline) {
    deadline = deadline || Date.now() + 1200;
    return new Promise(function (resolve) {
      function check() {
        var c = getClient();
        if (c) return resolve(c);
        if (Date.now() >= deadline) return resolve(null);
        setTimeout(check, 40);
      }
      check();
    });
  }

  function timeout(ms) {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("加载云端数据超时"));
      }, ms);
    });
  }

  function fetchAll(table, order) {
    return getClient()
      .from(table)
      .select("*")
      .order(order, { ascending: true });
  }

  function mapRows(rows) {
    var D = {
      identity: {},
      works: [],
      worksGallery: [],
      projects: [],
      experiences: [],
      brands: [],
      contacts: {},
      downloads: {},
      heroVideo: {}
    };

    (rows.works || []).forEach(function (r) {
      var item = {
        title: r.title || "",
        label: r.label || "",
        img: r.img_url || "",
        ratio: r.ratio ? Number(r.ratio) : null
      };
      if (r.section === "card") D.works.push(item);
      else D.worksGallery.push(item);
    });

    D.projects = (rows.projects || []).map(function (r) {
      return {
        id: String(r.num || ""),
        num: r.num || "",
        title: r.title || "",
        short: r.short || "",
        category: r.category || "",
        year: r.year || "",
        role: r.role || "",
        cover: r.cover_url || "",
        tags: r.tags || [],
        desc: r.description || "",
        images: r.images || []
      };
    });

    D.experiences = (rows.experiences || []).map(function (r) {
      return {
        num: r.num || "",
        company: r.company || "",
        period: r.period || "",
        paragraphs: r.paragraphs || []
      };
    });

    D.brands = (rows.brands || []).map(function (r) {
      return { name: r.name || "", logo: r.logo_url || "" };
    });

    var s = rows.site_settings && rows.site_settings[0];
    if (s) {
      D.identity = {
        name: s.name || "",
        nameEN: s.name_en || "",
        roleCN: s.role_cn || "",
        roleEN: s.role_en || "",
        slogan: s.slogan || "",
        sloganCN: s.slogan_cn || "",
        education: s.education || "",
        about: s.about || []
      };
      D.contacts = {
        email: s.email || "",
        wechat: s.wechat || "",
        xhs: {
          label: s.xhs_label || "",
          account: s.xhs_account || "",
          url: s.xhs_url || ""
        }
      };
      D.downloads = {
        resume: s.resume_url || "",
        portfolio: s.portfolio_url || ""
      };
      D.heroVideo = {
        video: s.hero_video_url || "",
        poster: s.hero_poster_url || ""
      };
      D.portraitUrl = s.portrait_url || "";
      D.contactDesc = s.contact_desc || "";
    }

    return D;
  }

  function loadRemote() {
    return Promise.all([
      fetchAll("works", "sort_order"),
      fetchAll("projects", "sort_order"),
      fetchAll("experiences", "sort_order"),
      fetchAll("brands", "sort_order"),
      fetchAll("site_settings", "id")
    ]).then(function (results) {
      for (var i = 0; i < results.length; i++) {
        if (results[i].error) throw results[i].error;
      }
      return mapRows({
        works: results[0].data,
        projects: results[1].data,
        experiences: results[2].data,
        brands: results[3].data,
        site_settings: results[4].data
      });
    });
  }

  // 同一页面多处（页面渲染脚本 + main.js）都会请求站点数据，
  // 缓存同一个 Promise，避免重复拉取 5 张表
  var dataPromise = null;
  window.loadSiteData = function () {
    if (!dataPromise) {
      dataPromise = waitForClient()
        .then(function (c) {
          if (!c) return null; // 库未就绪/不可用 → 调用方使用本地 site-data.js
          return Promise.race([loadRemote(), timeout(1200)]);
        })
        .catch(function () {
          return null; // 云端不可用 → 调用方使用本地 site-data.js
        });
    }
    return dataPromise;
  };

})();
