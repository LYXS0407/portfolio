/* ============================================================
   主交互脚本：作品横向滚动 / 经历 hover 展开 / 入场动画 / 导航高亮
   ============================================================ */
(function () {
  "use strict";

  var data = window.SITE_DATA;
  var worksInited = false; // initWorks 重复调用时不再重复挂监听

  /* ---------- 数据替换：云端数据就绪后更新（保留本地兜底） ---------- */
  function useData(d) {
    if (!d) return;
    data = d;
    window.SITE_DATA = d;
  }

  /* ---------- 移动端判断（与 CSS 断点一致） ---------- */
  function isMobile() {
    return window.innerWidth < 1100;
  }

  /* ---------- 移动端汉堡菜单 ---------- */
  function initMobileNav() {
    var burger = document.getElementById("navBurger");
    var menu = document.getElementById("mobileMenu");
    var closeBtn = document.getElementById("mobileMenuClose");
    if (!burger || !menu) return;

    function open() {
      menu.classList.add("is-open");
      burger.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      menu.setAttribute("aria-hidden", "false");
      document.body.classList.add("menu-open");
    }
    function close() {
      menu.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
    }

    burger.addEventListener("click", function () {
      if (menu.classList.contains("is-open")) close();
      else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    menu.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) close();
    });
  }

  /* ---------- 通用：滚动入场动画 ---------- */
  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-revealed");
      });
      return;
    }

    if (isMobile()) {
      // 移动端：按版块触发，滑到版块时内容依次出场（动画参考首屏主标题）
      var revealables = document.querySelectorAll(
        "section:not(#home) [data-reveal], section:not(#home) [data-split], section:not(#home) .exp-item.exp-reveal"
      );
      if (!revealables.length) return;
      var sections = [];
      revealables.forEach(function (el) {
        var sec = el.closest("section") || document.body;
        if (sections.indexOf(sec) === -1) sections.push(sec);
      });
      function revealSection(sec) {
        var els = sec.querySelectorAll("[data-reveal], [data-split], .exp-item.exp-reveal");
        els.forEach(function (el, i) {
          el.style.setProperty("--reveal-delay", String(i));
          el.classList.add("is-revealed");
        });
      }
      var mIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              revealSection(entry.target);
              mIo.unobserve(entry.target);
            }
          });
        },
        { threshold: 0, rootMargin: "0px 0px -12% 0px" }
      );
      sections.forEach(function (sec) {
        mIo.observe(sec);
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.7, rootMargin: "0px 0px 0px 0px" }
    );
    items.forEach(function (el) {
      var delay = el.getAttribute("data-delay") || "0";
      el.style.setProperty("--reveal-delay", delay);
      io.observe(el);
    });
  }

  /* ---------- SplitText：文字逐字上浮入场 ---------- */
  function initSplitText() {
    var items = document.querySelectorAll("[data-split]");
    if (!items.length) return;
    if (isMobile()) return; // 移动端不拆字，直接展示
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    items.forEach(function (el) {
      var nodes = Array.prototype.slice.call(el.childNodes);
      var frag = document.createDocumentFragment();
      nodes.forEach(function (node) {
        if (node.nodeType === 3) {
          // 清理排版缩进产生的空白（换行/多余空格），保留字间空格
          var text = node.textContent.replace(/\s+/g, " ").trim();
          if (!text) return;
          for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            var span = document.createElement("span");
            span.className = "split-char";
            span.textContent = ch === " " ? "\u00A0" : ch;
            frag.appendChild(span);
          }
        } else {
          frag.appendChild(node);
        }
      });
      el.innerHTML = "";
      el.appendChild(frag);

      var base = parseInt(el.getAttribute("data-split-delay") || "0", 10);
      var chars = el.querySelectorAll(".split-char");
      chars.forEach(function (c, i) {
        c.style.transitionDelay = base + i * 70 + "ms";
      });

      if (reduce) el.classList.add("is-split");
    });

    if (reduce) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-split");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.7, rootMargin: "0px 0px 0px 0px" }
    );
    items.forEach(function (el) {
      if (!el.classList.contains("is-split")) io.observe(el);
    });
  }

  /* ---------- 液态玻璃指针跟随 ---------- */
  function initCursorGlass() {
    var glass = document.getElementById("cursorGlass");
    if (!glass) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var size = 90;
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    var tx = x;
    var ty = y;
    var raf = null;

    function frame() {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      glass.style.transform = "translate3d(" + (x - size / 2).toFixed(2) + "px, " + (y - size / 2).toFixed(2) + "px, 0)";
      raf = null;
      if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) {
        raf = requestAnimationFrame(frame);
      }
    }

    document.addEventListener("mousemove", function (e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    });
  }

  /* ---------- Aurora：网页底部弥散动画背景（WebGL） ---------- */
  function initAurora() {
    var container = document.getElementById("auroraBg");
    if (!container) return;
    if (isMobile()) return; // 移动端去掉底部弥散渐变动效

    var VERT = "#version 300 es\n" +
      "in vec2 position;\n" +
      "void main() {\n" +
      "  gl_Position = vec4(position, 0.0, 1.0);\n" +
      "}\n";

    var FRAG = "#version 300 es\n" +
      "precision highp float;\n" +
      "uniform float uTime;\n" +
      "uniform float uAmplitude;\n" +
      "uniform vec3 uColorStops[3];\n" +
      "uniform vec2 uResolution;\n" +
      "uniform float uBlend;\n" +
      "out vec4 fragColor;\n" +
      "vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }\n" +
      "float snoise(vec2 v){\n" +
      "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n" +
      "  vec2 i  = floor(v + dot(v, C.yy));\n" +
      "  vec2 x0 = v - i + dot(i, C.xx);\n" +
      "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n" +
      "  vec4 x12 = x0.xyxy + C.xxzz;\n" +
      "  x12.xy -= i1;\n" +
      "  i = mod(i, 289.0);\n" +
      "  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n" +
      "  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);\n" +
      "  m = m * m; m = m * m;\n" +
      "  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n" +
      "  vec3 h = abs(x) - 0.5;\n" +
      "  vec3 ox = floor(x + 0.5);\n" +
      "  vec3 a0 = x - ox;\n" +
      "  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);\n" +
      "  vec3 g;\n" +
      "  g.x  = a0.x  * x0.x  + h.x  * x0.y;\n" +
      "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n" +
      "  return 130.0 * dot(m, g);\n" +
      "}\n" +
      "struct ColorStop { vec3 color; float position; };\n" +
      "#define COLOR_RAMP(colors, factor, finalColor) { int index = 0; for (int i = 0; i < 2; i++) { ColorStop currentColor = colors[i]; bool isInBetween = currentColor.position <= factor; index = int(mix(float(index), float(i), float(isInBetween))); } ColorStop currentColor = colors[index]; ColorStop nextColor = colors[index + 1]; float range = nextColor.position - currentColor.position; float lerpFactor = (factor - currentColor.position) / range; finalColor = mix(currentColor.color, nextColor.color, lerpFactor); }\n" +
      "void main() {\n" +
      "  vec2 uv = vec2(gl_FragCoord.x / uResolution.x, 1.0 - gl_FragCoord.y / uResolution.y);\n" +
      "  ColorStop colors[3];\n" +
      "  colors[0] = ColorStop(uColorStops[0], 0.0);\n" +
      "  colors[1] = ColorStop(uColorStops[1], 0.5);\n" +
      "  colors[2] = ColorStop(uColorStops[2], 1.0);\n" +
      "  vec3 rampColor;\n" +
      "  COLOR_RAMP(colors, uv.x, rampColor);\n" +
      "  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;\n" +
      "  height = exp(height);\n" +
      "  height = (uv.y * 2.0 - height + 0.2);\n" +
      "  float intensity = 0.6 * height;\n" +
      "  float midPoint = 0.20;\n" +
      "  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);\n" +
      "  vec3 auroraColor = intensity * rampColor;\n" +
      "  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);\n" +
      "}\n";

    var canvas = document.createElement("canvas");
    container.appendChild(canvas);
    var gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
      container.style.display = "none";
      return;
    }

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("Aurora shader error:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    var program = gl.createProgram();
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    var positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    var posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(program, "uTime");
    var uAmplitude = gl.getUniformLocation(program, "uAmplitude");
    var uColorStops = gl.getUniformLocation(program, "uColorStops");
    var uResolution = gl.getUniformLocation(program, "uResolution");
    var uBlend = gl.getUniformLocation(program, "uBlend");

    var gray = 45 / 255; // #2d2d2d
    var stops = [
      [gray, gray, gray],
      [gray, gray, gray],
      [gray, gray, gray]
    ];

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      var w = container.clientWidth || window.innerWidth;
      var h = container.clientHeight || 480;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    gl.uniform1f(uAmplitude, 1.0);
    gl.uniform1f(uBlend, 0.5);
    gl.uniform3fv(uColorStops, new Float32Array(stops[0].concat(stops[1], stops[2])));

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var raf = 0;
    var auroraVisible = false;
    function render(t) {
      raf = requestAnimationFrame(render);
      gl.uniform1f(uTime, (t * 0.01 * 0.5 * 0.1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function setRendering(on) {
      if (on === auroraVisible) return;
      auroraVisible = on;
      if (reduced) return;
      if (on) {
        if (!raf) raf = requestAnimationFrame(render);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    if (reduced) {
      gl.uniform1f(uTime, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      // 仅在容器进入视口且页面可见时渲染，避免后台/离开视口时持续占 GPU
      if ("IntersectionObserver" in window) {
        var auroraIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            setRendering(entry.isIntersecting);
          });
        }, { threshold: 0 });
        auroraIO.observe(container);
        document.addEventListener("visibilitychange", function () {
          if (document.hidden) {
            setRendering(false);
          } else if (!auroraVisible &&
            container.getBoundingClientRect().top < window.innerHeight) {
            setRendering(true);
          }
        });
      } else {
        setRendering(true);
      }
    }
  }

  /* ---------- 01 · 个人简介文案 ---------- */
  function renderAbout() {
    var descs = document.querySelectorAll(".about-desc");
    if (!descs.length || !data || !data.identity) return;
    data.identity.about.forEach(function (text, i) {
      if (descs[i]) descs[i].textContent = text;
    });
  }

  /* ---------- TiltedCard：照片卡片随鼠标 3D 倾斜 ---------- */
  function initTiltCard() {
    var card = document.getElementById("aboutPhoto");
    if (!card) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var amplitude = 10;
    var scaleHover = 1.06;
    var target = { rx: 0, ry: 0, s: 1 };
    var current = { rx: 0, ry: 0, s: 1 };
    var raf = null;

    function frame() {
      current.rx += (target.rx - current.rx) * 0.12;
      current.ry += (target.ry - current.ry) * 0.12;
      current.s += (target.s - current.s) * 0.12;
      card.style.transform =
        "rotateX(" + current.rx.toFixed(3) + "deg) rotateY(" + current.ry.toFixed(3) + "deg) scale(" + current.s.toFixed(3) + ")";
      if (
        Math.abs(target.rx - current.rx) > 0.01 ||
        Math.abs(target.ry - current.ry) > 0.01 ||
        Math.abs(target.s - current.s) > 0.0005
      ) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = null;
      }
    }

    function start() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    var wrap = card.parentElement;
    wrap.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var offsetX = e.clientX - rect.left - rect.width / 2;
      var offsetY = e.clientY - rect.top - rect.height / 2;
      target.ry = (offsetX / (rect.width / 2)) * amplitude;
      target.rx = (offsetY / (rect.height / 2)) * -amplitude;
      start();
    });
    wrap.addEventListener("mouseenter", function () {
      target.s = scaleHover;
      start();
    });
    wrap.addEventListener("mouseleave", function () {
      target.rx = 0;
      target.ry = 0;
      target.s = 1;
      start();
    });
  }

  /* ---------- 02 · 作品展示：从右错落入场 → 第一张卡停在距左 200px 等齐 → 整排向左滑出 ---------- */
  function initWorks() {
    var track = document.getElementById("worksTrack");
    var viewport = document.querySelector(".works-viewport");
    var section = document.querySelector(".works");
    var moreBtn = document.querySelector(".works-more");
    if (!track || !viewport || !section || !data) return;

    var CARD_W = 320;          // 卡片宽
    var GAP = 20;              // 卡片间距
    var ANCHOR_LEFT = 200;     // 第一张卡停靠位置：左缘距视口左侧 200px
    var FINAL_RIGHT = 200;     // 结束位置：最右卡片右缘距视口右侧 200px
    var STAGGER = [0, 55, 92, 55, 0, 55, 92, 55, 0]; // 上下波浪式错落（参考图2）
    var STEP = 0.01;           // 出场启动间隔（进度单位，越小卡片越紧凑）
    var PHASE_A = 0.45;        // 出场阶段结束
    var PHASE_B = 0.55;        // 停顿等待结束，之后整排一起左滑
    var DIST = 1600;           // 固定滚动距离
    var LEAD_RATIO = 0.55;     // 提前启动：版块进入视口时动画已开始

    var total = 0;       // 整行宽度
    var anchorTx = 200;  // 出场停靠：所有卡片整体右移 200px（第一张卡左缘距左 200px）
    var finalTx = 0;     // 最终：整行相对位置
    var shift = 0;       // 停靠 → 最终的位移量
    var durA = 1;
    var distance = 0;
    var sectionTop = 0;
    var winStart = 0;
    var winLen = 1;
    var moreShown = false;
    var narrowMode = false;

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function buildCards() {
      track.innerHTML = "";
      data.works.forEach(function (item, i) {
        var card = document.createElement("div");
        card.className = "work-card";
        card.setAttribute("data-index", i);
        card.style.setProperty("--stagger", STAGGER[i % STAGGER.length] + "px");
        var img = document.createElement("img");
        img.alt = item.title;
        img.loading = "lazy";
        img.src = item.img;
        card.appendChild(img);
        track.appendChild(card);
      });
    }

    function applyFrame(p) {
      var cards = track.children;
      var vw = window.innerWidth;
      // 卡片接近滚动完成时，提前缓慢显示“更多作品”
      if (moreBtn && !moreShown && p >= 0.6) {
        moreShown = true;
        moreBtn.classList.add("is-visible");
      }
      for (var i = 0; i < cards.length; i++) {
        var tx;
        if (p < PHASE_A) {
          // 阶段一：卡片从右缘错落入场，整行停到第一张卡距左 200px 的位置
          var t = clamp((p - i * STEP) / durA, 0, 1);
          var initialTx = vw - i * (CARD_W + GAP);
          tx = initialTx + (anchorTx - initialTx) * easeInOut(t);
        } else if (p < PHASE_B) {
          // 阶段二：第一张卡停住，等后面卡片到齐
          tx = anchorTx;
        } else {
          // 阶段三：整排一起向左滑出，直到最右卡片距右侧 200px
          var q = clamp((p - PHASE_B) / (1 - PHASE_B), 0, 1);
          tx = anchorTx - shift * easeInOut(q);
        }
        cards[i].style.setProperty("--tx", Math.round(tx) + "px");
      }
    }

    var scrollRaf = null;
    function onScrollUpdate() {
      if (narrowMode) return; // 移动端横向滚动，不走滚动驱动动画
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        var p = (window.scrollY - winStart) / winLen;
        applyFrame(clamp(p, 0, 1));
      });
    }

    function layout() {
      var vh = window.innerHeight;
      var vw = window.innerWidth;
      var rect = section.getBoundingClientRect();
      sectionTop = rect.top + window.scrollY;

      // 窄屏回退：不启用滚动驱动动画，直接展示最终错落布局并可横向滑动
      if (vw < 1100) {
        narrowMode = true;
        distance = 0;
        var cards = track.children;
        for (var i = 0; i < cards.length; i++) {
          cards[i].style.setProperty("--tx", "0px");
        }
        section.style.setProperty("--works-distance", "0px");
        if (moreBtn) {
          moreShown = true;
          moreBtn.classList.add("is-visible");
        }
        return;
      }
      narrowMode = false;

      distance = DIST;
      section.style.setProperty("--works-distance", distance + "px");

      var n = track.children.length;
      total = n * CARD_W + (n - 1) * GAP;
      anchorTx = ANCHOR_LEFT;
      finalTx = vw - FINAL_RIGHT - total;
      shift = anchorTx - finalTx;
      durA = PHASE_A - (n - 1) * STEP;

      var leadIn = vh * LEAD_RATIO;
      winStart = sectionTop - leadIn;
      winLen = distance + leadIn;

      onScrollUpdate();
    }

    buildCards();
    layout();
    if (!worksInited) {
      worksInited = true;
      window.addEventListener("scroll", onScrollUpdate, { passive: true });
      var resizeTimer;
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 180);
      });
    }
  }

  /* ---------- 03 · 过往经历：默认展示 01，hover 展开 ---------- */
  /* ---------- 02b ---------- */
  function initTagTravel() {
    var tags = document.querySelector(".hero-tags");
    var title = document.getElementById("worksTitle");
    var works = document.getElementById("works");
    var inner = document.querySelector(".hero-inner");
    if (!tags || !title || !works || !inner) return;

    var TITLE_LEFT = 200;    // 与卡片左边缘对齐
    var TITLE_TOP = 170;     // 卡片区左上角
    var TITLE_SCALE = 1.5;   // 48 / 32

    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    var startLeft = 0;
    var startTop = 0;
    var worksTop = 0;
    var vw = window.innerWidth;
    var raf = null;
    var movedToBody = false;
    var entranceUntil = performance.now() + 1600;

    function measure() {
      vw = window.innerWidth;
      var tr = inner.getBoundingClientRect();
      startLeft = tr.right - tags.offsetWidth;
      startTop = tr.bottom - 76 - tags.offsetHeight;
      var wr = works.getBoundingClientRect();
      worksTop = wr.top + (window.scrollY || 0);
      if (vw < 1100) {
        // 移动端：隐藏首页关键词，作品区标题保留
        tags.style.display = "none";
        title.style.display = "";
        return;
      }
      // 移到 body 并改为 fixed，避免被首页 overflow:hidden 裁剪
      if (!movedToBody) {
        movedToBody = true;
        document.body.appendChild(tags);
        tags.style.position = "fixed";
        tags.style.left = "0px";
        tags.style.top = "0px";
        tags.style.right = "auto";
        tags.style.bottom = "auto";
        tags.style.margin = "0";
        tags.style.zIndex = "60";
      }
    }

    function apply() {
      var sy = window.scrollY || 0;
      var p = clamp(sy / Math.max(1, worksTop), 0, 1);
      var desiredLeft = startLeft + (TITLE_LEFT - startLeft) * p;
      var desiredTop = startTop + (TITLE_TOP - startTop) * p;
      var tx = desiredLeft;   // fixed 元素锚在 (0,0)，直接平移到目标位置
      var ty = desiredTop;
      var scale = 1 + (TITLE_SCALE - 1) * p;
      var tagsOp, titleOp;
      if (p >= 1) {
        // 交接完成：关键词隐藏，标题常驻（随作品区滚动）
        tagsOp = 0;
        titleOp = 1;
      } else {
        // 按关键词与标题的距离收敛来交叉淡入淡出，避免中途出现双影
        var titlePosY = TITLE_TOP + worksTop - sy;
        var dist = Math.max(Math.abs(desiredLeft - TITLE_LEFT), Math.abs(desiredTop - titlePosY));
        tagsOp = clamp((dist - 8) / 90, 0, 1);
        titleOp = 1 - tagsOp;
      }

      tags.style.transformOrigin = "0 0";
      tags.style.transform =
        "translate3d(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px, 0) scale(" + scale.toFixed(4) + ")";
      if (performance.now() >= entranceUntil) {
        tags.style.opacity = tagsOp.toFixed(3);
      }

      title.style.transformOrigin = "0 0";
      title.style.transform = "scale(" + (scale / TITLE_SCALE).toFixed(4) + ")";
      title.style.opacity = titleOp.toFixed(3);

      // 供鼠标透镜同步（文档坐标）
      tags.setAttribute("data-lg-x", (desiredLeft + (window.pageXOffset || 0)).toFixed(1));
      tags.setAttribute("data-lg-y", (desiredTop + sy).toFixed(1));
      tags.setAttribute("data-lg-scale", scale.toFixed(4));
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (vw >= 1100) apply();
      });
    }

    measure();

    // 入场淡入（仅控制透明度，避免与滚动位移冲突）
    tags.style.opacity = "0";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        tags.style.transition = "opacity 1.1s ease 0.2s";
        tags.style.opacity = "1";
        setTimeout(function () {
          tags.style.transition = "none";
        }, 1700);
      });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      measure();
      if (vw >= 1100) apply();
    });
    if (vw >= 1100) apply();
  }

  /* ---------- 02c ---------- */
  function initWorksTransition() {
    var overlay = document.getElementById("worksTransition");
    var block = document.getElementById("wtBlock");
    var text = document.getElementById("wtText");
    var works = document.getElementById("works");
    var about = document.getElementById("about");
    var grid = document.querySelector(".about-grid");
    var aboutCopy = document.querySelector(".about-copy");
    var photo = document.querySelector(".about-photo");
    var titleHolder = document.getElementById("aboutTitle");
    if (!overlay || !block || !text || !works || !about || !grid || !aboutCopy || !photo || !titleHolder) return;

    var TEXT_SCALE = 58 / 110; // 大字 110px → 标题 58px
    var RADIUS = 22;           // 与形象照圆角一致

    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }
    function easeInOut(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    var vh = 0;
    var vw = 0;
    var worksTop = 0;
    var distance = 0;
    var start = 0;
    var boxW = 0;
    var boxH = 0;
    var narrow = window.innerWidth < 1100;
    var raf = null;
    var done = false;
    var hiddenTitle = false;
    var chars = [];

    // 把大字拆成逐字（SplitText 风格）
    function buildChars() {
      var lines = text.children;
      for (var l = 0; l < lines.length; l++) {
        var line = lines[l];
        var nodes = Array.prototype.slice.call(line.childNodes);
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          if (node.nodeType !== 3) continue;
          var frag = document.createDocumentFragment();
          var textChars = node.textContent.split("");
          for (var c = 0; c < textChars.length; c++) {
            var s = document.createElement("span");
            s.className = "wt-char";
            s.textContent = textChars[c];
            frag.appendChild(s);
            chars.push(s);
          }
          line.replaceChild(frag, node);
        }
      }
    }

    function layout() {
      vh = window.innerHeight;
      vw = window.innerWidth;
      narrow = vw < 1100;
      worksTop = works.getBoundingClientRect().top + (window.scrollY || 0);
      var dist = window.getComputedStyle(works).getPropertyValue("--works-distance") || "0px";
      distance = parseFloat(dist) || 0;
      start = worksTop + distance;
      if (narrow) {
        overlay.style.visibility = "hidden";
        document.body.classList.remove("is-wt-active");
        if (hiddenTitle) {
          titleHolder.style.visibility = "";
          hiddenTitle = false;
        }
      }
    }

    function apply() {
      if (narrow) return;
      var sy = window.scrollY || 0;
      var p1 = clamp((sy - start) / Math.max(1, vh), 0, 1);
      if (p1 <= 0) {
        if (done) undoHandoff();
        overlay.style.visibility = "hidden";
        document.body.classList.remove("is-wt-active");
        if (hiddenTitle) {
          titleHolder.style.visibility = "";
          hiddenTitle = false;
        }
        return;
      }

      // 阶段二以个人简介标题落到屏幕正中央为完成点，形变更快
      var tr0 = titleHolder.getBoundingClientRect();
      var titleCenterY = tr0.top + tr0.height / 2;
      var p2 = clamp(1 - (titleCenterY - vh / 2) / (vh * 0.55), 0, 1);

      if (done && p2 < 1) {
        undoHandoff();
      }
      if (done) {
        // 已完成交接且未回退，不再渲染
        return;
      }

      overlay.style.visibility = "visible";
      document.body.classList.add("is-wt-active");
      if (!hiddenTitle) {
        titleHolder.style.visibility = "hidden";
        hiddenTitle = true;
      }

      if (!boxW) {
        boxW = text.offsetWidth;
        boxH = text.offsetHeight;
      }

      var blockTop = vh * (1 - p1);

      // 阶段一：色块从底部向上覆盖作品卡片（卡片随页面正常上移消失）
      block.style.left = "0px";
      block.style.top = "0px";
      block.style.width = "100%";
      block.style.height = "100%";
      block.style.borderRadius = "0px";
      block.style.transform = "translateY(" + blockTop.toFixed(2) + "px)";

      // 大字与色块一起上移，并逐字浮现（SplitText 风格）
      text.style.transformOrigin = "0 0";
      var textY = (vh + blockTop) / 2 - boxH / 2;
      text.style.transform =
        "translate3d(" + ((vw - boxW) / 2).toFixed(2) + "px, " + textY.toFixed(2) + "px, 0)";
      text.style.opacity = "1";
      text.style.textAlign = "center";
      for (var ci = 0; ci < chars.length; ci++) {
        var ct = clamp((p1 - (0.45 + ci * 0.018)) / 0.13, 0, 1);
        var ce = 1 - Math.pow(1 - ct, 3);
        chars[ci].style.opacity = ce.toFixed(3);
        chars[ci].style.transform = "translateY(" + (42 * (1 - ce)).toFixed(2) + "px)";
      }

      if (p2 <= 0) {
        return;
      }

      // 阶段二：色块缩到形象照、大字缩到标题位
      var e2 = easeInOut(p2);
      var pr = photo.getBoundingClientRect();
      var tr = titleHolder.getBoundingClientRect();

      block.style.transform = "none";
      block.style.left = (pr.left * e2).toFixed(2) + "px";
      block.style.top = (pr.top * e2).toFixed(2) + "px";
      block.style.width = (vw + (pr.width - vw) * e2).toFixed(2) + "px";
      block.style.height = (vh + (pr.height - vh) * e2).toFixed(2) + "px";
      block.style.borderRadius = (RADIUS * e2).toFixed(2) + "px";

      var s = 1 + (TEXT_SCALE - 1) * e2;
      var cx0 = (vw - boxW * s) / 2;
      var cy0 = (vh - boxH * s) / 2;
      var tx = cx0 + (tr.left - cx0) * e2;
      var ty = cy0 + (tr.top - cy0) * e2;
      text.style.transform =
        "translate3d(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px, 0) scale(" + s.toFixed(4) + ")";
      text.style.textAlign = e2 > 0.8 ? "left" : "center";

      if (p2 >= 1) {
        done = true;
        handoff();
      }
    }

    function handoff() {
      // 大字成为个人介绍标题（替换原占位标题）
      text.className = "about-title";
      text.removeAttribute("style");
      if (titleHolder.parentNode) {
        titleHolder.parentNode.replaceChild(text, titleHolder);
      }
      // 色块：隐藏（形象照本身已是 #161616 圆角背景）
      block.style.display = "none";
      overlay.style.display = "none";
      overlay.style.visibility = "hidden";
      document.body.classList.remove("is-wt-active");
    }

    function undoHandoff() {
      done = false;
      // 大字移回过渡层
      if (text.parentNode) {
        text.parentNode.removeChild(text);
      }
      overlay.appendChild(text);
      text.className = "wt-text";
      text.style.opacity = "1";
      // 恢复占位标题，保持个人介绍布局
      if (titleHolder.parentNode !== aboutCopy) {
        aboutCopy.insertBefore(titleHolder, aboutCopy.firstChild);
      }
      // 恢复色块与过渡层
      block.style.display = "";
      overlay.style.display = "";
      overlay.style.visibility = "visible";
      document.body.classList.add("is-wt-active");
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        apply();
      });
    }

    buildChars();
    layout();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      layout();
      apply();
    });
    apply();
  }

  function renderExperiences() {
    var list = document.getElementById("expList");
    if (!list || !data) return;

    list.innerHTML = "";
    data.experiences.forEach(function (exp, i) {
      var item = document.createElement("div");
      item.className = "exp-item" + (i === 0 ? " is-active" : "");
      item.setAttribute("tabindex", "0");
      item.setAttribute("data-index", i);

      var company = document.createElement("p");
      company.className = "exp-company";
      company.textContent = exp.company;
      var period = document.createElement("p");
      period.className = "exp-period";
      var periodParts = String(exp.period).split(/[–—-]/);
      if (periodParts.length >= 2) {
        var periodStart = document.createElement("span");
        periodStart.className = "exp-period-start";
        periodStart.textContent = periodParts[0].trim() + "-";
        var periodEnd = document.createElement("span");
        periodEnd.className = "exp-period-end";
        periodEnd.textContent = periodParts[1].trim();
        period.appendChild(periodStart);
        period.appendChild(periodEnd);
      } else {
        period.textContent = exp.period;
      }

      var right = document.createElement("div");
      right.className = "exp-desc";
      var inner = document.createElement("div");
      inner.className = "exp-desc-inner";
      exp.paragraphs.forEach(function (p) {
        var para = document.createElement("p");
        para.textContent = p;
        inner.appendChild(para);
      });
      right.appendChild(inner);

      var num = document.createElement("span");
      num.className = "exp-num";
      num.textContent = exp.num;

      var left = document.createElement("div");
      left.className = "exp-left";
      left.appendChild(company);
      left.appendChild(period);

      var track = document.createElement("div");
      track.className = "exp-track";
      var trackLine = document.createElement("span");
      trackLine.className = "exp-track-line";
      var trackDot = document.createElement("span");
      trackDot.className = "exp-track-dot";
      track.appendChild(trackLine);
      track.appendChild(trackDot);

      if (isMobile()) {
        // 移动端时间轴：时间 | 进度条 | 公司+详情
        var time = document.createElement("div");
        time.className = "exp-time";
        time.appendChild(period);
        var main = document.createElement("div");
        main.className = "exp-main";
        main.appendChild(company);
        main.appendChild(right);
        item.appendChild(time);
        item.appendChild(track);
        item.appendChild(main);
      } else {
        item.appendChild(left);
        item.appendChild(right);
        item.appendChild(num);
        item.appendChild(track);
      }
      list.appendChild(item);
    });

    var items = list.querySelectorAll(".exp-item");
    var activeIndex = 0;
    var activeAt = 0;
    var lastMove = 0;
    var lastMouse = null;
    var pendingIndex = -1;
    var pendingTimer = null;
    var suppressUntil = 0;
    var settleTimer = null;

    if (isMobile()) {
      // 移动端：直接平铺展示全部经历
      items.forEach(function (el) {
        el.classList.add("is-active");
        el.classList.add("exp-reveal");
      });
    } else {
      // 入场动画：三个经历卡片交错滑入（右 → 左 → 右）
      items.forEach(function (el, i) {
        el.classList.add("exp-reveal");
        el.setAttribute("data-dir", i % 2 === 0 ? "right" : "left");
        el.style.setProperty("--reveal-delay", i * 0.28 + "s");
      });
      if ("IntersectionObserver" in window) {
        var expIO = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-revealed");
                expIO.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.4, rootMargin: "0px 0px -12% 0px" }
        );
        items.forEach(function (el) {
          expIO.observe(el);
        });
      } else {
        items.forEach(function (el) {
          el.classList.add("is-revealed");
        });
      }
    }

    function clearPending() {
      pendingIndex = -1;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    function settleCheck() {
      settleTimer = null;
      if (!lastMouse) return;
      // 过渡结束后校正：若光标在激活之后确实发生了移动，跟随光标当前所指的卡片
      if (lastMove <= activeAt) return;
      var item = itemAt(lastMouse.x, lastMouse.y);
      if (!item) return;
      var idx = parseInt(item.getAttribute("data-index"), 10);
      if (idx !== activeIndex) setActiveSingle(idx);
    }

    function itemAt(x, y) {
      var el = document.elementFromPoint(x, y);
      var item = el && el.closest ? el.closest(".exp-item") : null;
      if (item) return item;
      // 光标落在卡片之间的缝隙时，就近取最近的卡片
      var best = null;
      var bestD = Infinity;
      items.forEach(function (it) {
        var r = it.getBoundingClientRect();
        if (y < r.top - 24 || y > r.bottom + 24) return;
        var d = Math.abs(y - (r.top + r.height / 2));
        if (d < bestD) {
          bestD = d;
          best = it;
        }
      });
      return best;
    }

    function setActiveSingle(index) {
      activeIndex = index;
      activeAt = Date.now();
      clearPending();
      // 过渡期内屏蔽 hover 目标变化：展开/收起引起的布局跳动会触发伪 hover
      suppressUntil = activeAt + 450;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(settleCheck, 460);
      items.forEach(function (el, i) {
        el.classList.toggle("is-active", i === index);
      });
    }

    if (isMobile()) return; // 移动端平铺展示，不绑定 hover 交互

    var expRaf = null;
    list.addEventListener("mousemove", function (e) {
      lastMove = Date.now();
      lastMouse = { x: e.clientX, y: e.clientY };
      // 过渡期内忽略目标变化（布局跳动产生的伪目标）
      if (lastMove < suppressUntil) {
        clearPending();
        return;
      }
      if (expRaf) return;
      expRaf = requestAnimationFrame(function () {
        expRaf = null;
        if (!lastMouse) return;
        var item = itemAt(lastMouse.x, lastMouse.y);
        if (!item) {
          clearPending();
          return;
        }
        var idx = parseInt(item.getAttribute("data-index"), 10);
        if (idx === activeIndex) {
          clearPending();
          return;
        }
        if (idx !== pendingIndex) {
          pendingIndex = idx;
          if (pendingTimer) clearTimeout(pendingTimer);
          pendingTimer = setTimeout(function () {
            pendingTimer = null;
            // 光标真实移动进入该项并稳定片刻后，切换到该项
            if (pendingIndex === idx) setActiveSingle(idx);
          }, 150);
        }
      });
    });

    items.forEach(function (el) {
      el.addEventListener("focus", function () {
        setActiveSingle(parseInt(el.getAttribute("data-index"), 10));
      });
      el.addEventListener("click", function () {
        setActiveSingle(parseInt(el.getAttribute("data-index"), 10));
      });
    });
    // 离开范围用整个版块而非列表本身：
    // 展开/收起时列表高度会变化，光标可能短暂落在列表外，不能因此就重置
    var zone = list.closest(".experience") || list;
    zone.addEventListener("mouseleave", function () {
      clearPending();
      // 未 hover 任何经历时全部收起，不自动展开第一个
      items.forEach(function (el) {
        el.classList.remove("is-active");
      });
      activeIndex = -1;
      activeAt = Date.now();
      suppressUntil = Date.now() + 350;
    });
  }

  /* ---------- 04 · 案例展示 ---------- */
  function renderCases() {
    var grid = document.getElementById("caseGrid");
    if (!grid || !data) return;

    grid.innerHTML = "";
    data.projects.forEach(function (p, i) {
      var a = document.createElement("a");
      a.className = "case-card";
      a.href = "project.html?id=" + p.id;
      a.setAttribute("data-reveal", "right");
      a.setAttribute("data-delay", String(i));
      var img = document.createElement("img");
      img.alt = p.title;
      img.loading = "lazy";
      try { img.decoding = "async"; } catch (e) { /* 忽略 */ }
      img.src = p.cover;
      a.appendChild(img);
      grid.appendChild(a);
    });
  }

  /* ---------- 04b · 案例卡片：黑白马赛克加载 → 清晰黑白照 → hover 变彩色（仅电脑端） ---------- */
  var CASE_PX_MAX = 22;   // 初始马赛克块大小（CSS px）
  function initCasePixelation() {
    if (isMobile()) return;
    var cards = document.querySelectorAll("#caseGrid .case-card");
    cards.forEach(function (card) {
      var img = card.querySelector("img");
      if (!img || img._pxInited) return;
      img._pxInited = true;
      // 系统减少动态效果：跳过马赛克动画，直接显示清晰黑白图
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (img.complete && img.naturalWidth) {
        setupPxCard(card, img);
      } else {
        img.addEventListener("load", function () {
          setupPxCard(card, img);
        }, { once: true });
      }
    });
  }

  function setupPxCard(card, img) {
    var dispW = card.clientWidth || 800;
    var SCALE = 2; // 画布内部分辨率 = 显示尺寸 × 2，清晰态交给原图
    var cw = Math.max(1, Math.round(dispW * SCALE));
    var ch = Math.round(cw * 9 / 16);
    var canvas = document.createElement("canvas");
    canvas.className = "case-px";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = cw;
    canvas.height = ch;
    card.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var raf = 0;
    var started = false;

    function draw(cell) {
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      if (!iw || !ih) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cw, ch);
      // 与 CSS object-fit: cover 一致的居中裁剪
      var s = Math.max(cw / iw, ch / ih);
      var sw = cw / s;
      var sh = ch / s;
      var sx = (iw - sw) / 2;
      var sy = (ih - sh) / 2;
      var bw = Math.max(1, Math.round(cw / cell));
      var bh = Math.max(1, Math.round(ch / cell));
      // 先缩成小块，再最近邻放大 → 马赛克
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, bw, bh);
      ctx.drawImage(canvas, 0, 0, bw, bh, 0, 0, cw, ch);
    }

    function play() {
      if (started) return;
      started = true;
      var DUR = 1600; // 初次加载动画时长（放慢，约 1.6s）
      var t0 = performance.now();
      function frame(t) {
        var p = Math.min(1, (t - t0) / DUR);
        var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        draw(Math.max(1, CASE_PX_MAX * SCALE + (1 - CASE_PX_MAX * SCALE) * e));
        if (p < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          // 动画完成：淡出马赛克层，露出清晰黑白图（黑白由 CSS filter 负责）
          canvas.style.transition = "opacity 0.5s ease";
          canvas.style.opacity = "0";
          setTimeout(function () {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          }, 600);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    draw(CASE_PX_MAX * SCALE);

    // 卡片滚动到视口中心附近时播放一次加载动画
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            io.unobserve(en.target);
            play();
          }
        });
      }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
      io.observe(card);
    } else {
      play();
    }
  }

  /* ---------- 05 · 服务品牌 ---------- */
  function renderBrands() {
    var wrap = document.getElementById("brandGrid");
    if (!wrap || !data) return;

    wrap.innerHTML = "";

    // 移动端：静态三列展示
    if (isMobile()) {
      var grid = document.createElement("div");
      grid.className = "brand-grid-mobile";
      data.brands.forEach(function (b) {
        var div = document.createElement("div");
        div.className = "brand-item";
        var img = document.createElement("img");
        img.alt = b.name;
        img.loading = "lazy";
        try { img.decoding = "async"; } catch (e) { /* 忽略 */ }
        img.src = b.logo;
        div.appendChild(img);
        grid.appendChild(div);
      });
      wrap.appendChild(grid);
      return;
    }

    var n = data.brands.length;
    function buildTrack(order, cls) {
      var track = document.createElement("div");
      track.className = "brand-track" + (cls ? " " + cls : "");
      // 复制两份实现无缝循环
      for (var dup = 0; dup < 2; dup++) {
        order.forEach(function (idx) {
          var b = data.brands[idx];
          var div = document.createElement("div");
          div.className = "brand-item";
          var img = document.createElement("img");
          img.alt = b.name;
          img.loading = "lazy";
          try { img.decoding = "async"; } catch (e) { /* 忽略 */ }
          img.src = b.logo;
          div.appendChild(img);
          track.appendChild(div);
        });
      }
      return track;
    }

    // 第一排：原顺序，向左滚动
    var orderA = [];
    for (var i = 0; i < n; i++) orderA.push(i);
    wrap.appendChild(buildTrack(orderA, "brand-track-a"));

    // 第二排：反序，让两排出现顺序不同，向右滚动
    var orderB = [];
    for (var j = n - 1; j >= 0; j--) orderB.push(j);
    wrap.appendChild(buildTrack(orderB, "brand-track-b"));
  }

  /* ---------- 06 · 联系我 ---------- */
  var copyToast = null;
  function showCopyToast(text) {
    if (!copyToast) {
      copyToast = document.createElement("div");
      copyToast.className = "copy-toast";
      document.body.appendChild(copyToast);
    }
    copyToast.textContent = text;
    copyToast.classList.add("is-show");
    clearTimeout(copyToast._timer);
    copyToast._timer = setTimeout(function () {
      copyToast.classList.remove("is-show");
    }, 1600);
  }

  function copyText(text, toastText) {
    function done() {
      showCopyToast(toastText);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        // 忽略
      }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallback();
        done();
      });
    } else {
      fallback();
      done();
    }
  }

  function renderContacts() {
    var wrap = document.getElementById("contactCards");
    if (!wrap || !data) return;

    var c = data.contacts;
    var cards = [
      {
        type: "mail",
        icon: "assets/contacts/mail.png",
        label: "邮箱 Email",
        value: c.email,
        copy: c.email
      },
      {
        type: "wechat",
        icon: "assets/contacts/wechat.png",
        label: "微信 WeChat",
        value: c.wechat,
        copy: c.wechat
      },
      {
        type: "xhs",
        icon: "assets/contacts/xhs.png",
        label: "小红书 RedNote",
        value: c.xhs.label + " " + c.xhs.account,
        href: c.xhs.url,
        external: true,
        arrow: true
      }
    ];

    wrap.innerHTML = "";
    function attachGlow(card) {
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var dx = x - cx;
        var dy = y - cy;
        var kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
        var ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
        var edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
        var angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;
        card.style.setProperty("--edge-proximity", (edge * 100).toFixed(3));
        card.style.setProperty("--cursor-angle", angle.toFixed(3) + "deg");
      });
    }

    cards.forEach(function (card) {
      var el = document.createElement(card.href ? "a" : "div");
      el.className = "contact-card";
      el.setAttribute("data-reveal", "up");
      if (card.href) {
        el.href = card.href;
        if (card.external) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      }

      var edge = document.createElement("span");
      edge.className = "edge-light";
      edge.setAttribute("aria-hidden", "true");
      el.appendChild(edge);

      var icon = document.createElement("span");
      icon.className = "cc-icon";
      var img = document.createElement("img");
      img.src = card.icon;
      img.alt = card.label;
      icon.appendChild(img);

      var body = document.createElement("div");
      body.className = "cc-body";
      var label = document.createElement("p");
      label.className = "cc-label";
      label.textContent = card.label;
      var value = document.createElement("p");
      value.className = "cc-value";
      value.textContent = card.value;
      body.appendChild(label);
      body.appendChild(value);

      el.appendChild(icon);
      el.appendChild(body);

      if (card.copy) {
        el.classList.add("is-copy");
        var toastText = card.type === "wechat" ? "已复制微信" : "已复制邮箱";
        var btn = document.createElement("button");
        btn.className = "cc-copy";
        btn.type = "button";
        btn.setAttribute("aria-label", "复制" + card.label);
        var copyImg = document.createElement("img");
        copyImg.src = "assets/contacts/copy.svg";
        copyImg.alt = "复制";
        btn.appendChild(copyImg);
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          copyText(card.copy, toastText);
        });
        el.addEventListener("click", function () {
          copyText(card.copy, toastText);
        });
        el.appendChild(btn);
      } else if (card.arrow) {
        var arrow = document.createElement("span");
        arrow.className = "cc-arrow";
        var arrowImg = document.createElement("img");
        arrowImg.src = "assets/contacts/arrow.svg";
        arrowImg.alt = "跳转";
        arrow.appendChild(arrowImg);
        el.appendChild(arrow);
      }
      wrap.appendChild(el);
      attachGlow(el);
    });
  }

  /* ---------- 07 · Gooey 导航切换效果 ---------- */
  function initGooeyNav() {
    var capsule = document.querySelector(".nav-capsule");
    if (!capsule) return;
    var filterEl = document.getElementById("navEffectFilter");
    var lis = Array.prototype.slice.call(capsule.querySelectorAll(".gooey-nav > li"));
    if (!filterEl || !lis.length) return;

    var ANIMATION_TIME = 600;
    var PARTICLE_COUNT = 15;
    var PARTICLE_DISTANCES = [90, 10];
    var PARTICLE_R = 100;
    var TIME_VARIANCE = 300;
    var COLORS = [1, 2, 3, 1, 2, 3, 1, 4];

    function noise(n) {
      return n / 2 - Math.random() * n;
    }

    function getXY(distance, pointIndex, totalPoints) {
      var angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
      return [distance * Math.cos(angle), distance * Math.sin(angle)];
    }

    function createParticle(i, t, d, r) {
      var rotate = noise(r / 10);
      return {
        start: getXY(d[0], PARTICLE_COUNT - i, PARTICLE_COUNT),
        end: getXY(d[1] + noise(7), PARTICLE_COUNT - i, PARTICLE_COUNT),
        time: t,
        scale: 1 + noise(0.2),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10
      };
    }

    function makeParticles(element) {
      var d = PARTICLE_DISTANCES;
      var r = PARTICLE_R;
      var bubbleTime = ANIMATION_TIME * 2 + TIME_VARIANCE;
      element.style.setProperty("--time", bubbleTime + "ms");

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        (function (idx) {
          var t = ANIMATION_TIME * 2 + noise(TIME_VARIANCE * 2);
          var p = createParticle(idx, t, d, r);
          setTimeout(function () {
            var particle = document.createElement("span");
            var point = document.createElement("span");
            particle.classList.add("particle");
            particle.style.setProperty("--start-x", p.start[0] + "px");
            particle.style.setProperty("--start-y", p.start[1] + "px");
            particle.style.setProperty("--end-x", p.end[0] + "px");
            particle.style.setProperty("--end-y", p.end[1] + "px");
            particle.style.setProperty("--time", p.time + "ms");
            particle.style.setProperty("--scale", String(p.scale));
            particle.style.setProperty("--color", "var(--color-" + p.color + ", #fff)");
            particle.style.setProperty("--rotate", p.rotate + "deg");
            point.classList.add("point");
            particle.appendChild(point);
            element.appendChild(particle);
            requestAnimationFrame(function () {
              element.classList.add("active");
            });
            setTimeout(function () {
              try {
                element.removeChild(particle);
              } catch (e) {
                // 已被移除则忽略
              }
            }, Math.max(0, t));
          }, 30);
        })(i);
      }
    }

    function updateEffectPosition(li) {
      var containerRect = capsule.getBoundingClientRect();
      var pos = li.getBoundingClientRect();
      var styles = {
        left: Math.round(pos.x - containerRect.x) + "px",
        top: Math.round(pos.y - containerRect.y) + "px",
        width: pos.width + "px",
        height: pos.height + "px"
      };
      var key;
      for (key in styles) {
        filterEl.style[key] = styles[key];
      }
    }

    function switchTo(index, withParticles) {
      lis.forEach(function (li, i) {
        li.classList.toggle("active", i === index);
        var a = li.querySelector("a");
        if (a) a.classList.toggle("is-active", i === index);
      });
      updateEffectPosition(lis[index]);

      filterEl.querySelectorAll(".particle").forEach(function (p) {
        filterEl.removeChild(p);
      });

      filterEl.classList.remove("active");
      if (withParticles) {
        makeParticles(filterEl);
      } else {
        void filterEl.offsetWidth;
        filterEl.classList.add("active");
      }
    }

    lis.forEach(function (li, index) {
      var a = li.querySelector("a");
      a.addEventListener("click", function () {
        // 点击切换后短暂锁定滚动高亮，避免平滑滚动过程中来回跳动
        window.__gooeyLock = Date.now() + 700;
        switchTo(index, true);
      });
    });

    var initIndex = 0;
    lis.forEach(function (li, i) {
      if (li.classList.contains("active")) initIndex = i;
    });
    updateEffectPosition(lis[initIndex]);
    filterEl.classList.add("active");

    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        var activeLi = capsule.querySelector(".gooey-nav > li.active");
        if (activeLi) updateEffectPosition(activeLi);
      });
      ro.observe(capsule);
    }

    window.__gooeyNav = {
      setActive: function (index, withParticles) {
        switchTo(index, !!withParticles);
      }
    };
  }

  /* ---------- 08 · 导航滚动高亮 ---------- */
  function initNavSpy() {
    var capsule = document.querySelector(".nav-capsule");
    var capsuleNatural = 0;

    function updateCapsule() {
      if (!capsule) return;
      var headerW = window.innerWidth;
      var progress = Math.max(0, Math.min(1, window.scrollY / 260));
      if (!capsuleNatural) {
        capsule.style.width = "auto";
        capsuleNatural = capsule.getBoundingClientRect().width;
        capsule.style.minWidth = capsuleNatural + "px";
      }
      // 胶囊自身从自然宽度向两侧扩展，扩展后左右各留 70px
      var expandedW = headerW - 140;
      var w = capsuleNatural + Math.max(0, expandedW - capsuleNatural) * progress;
      w = Math.max(capsuleNatural, Math.round(w));
      capsule.style.width = Math.round(w) + "px";
      capsule.classList.toggle("is-expanded", progress > 0.985);
    }

    var links = Array.prototype.slice.call(capsule.querySelectorAll(".nav-link"));
    var map = {};
    links.forEach(function (link) {
      map[link.getAttribute("data-nav")] = link;
    });
    var ids = Object.keys(map).map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);
    if (!ids.length) {
      window.addEventListener("scroll", updateCapsule, { passive: true });
      window.addEventListener("resize", updateCapsule);
      updateCapsule();
      return;
    }

    var lastIndex = -1;
    var spyRaf = null;
    function onScroll() {
      if (spyRaf) return;
      spyRaf = requestAnimationFrame(function () {
        spyRaf = null;
        if (window.__gooeyLock && Date.now() < window.__gooeyLock) {
          updateCapsule();
          return;
        }
        var pos = window.scrollY + window.innerHeight * 0.35;
        var current = ids[0].id;
        ids.forEach(function (sec) {
          if (sec.offsetTop <= pos) current = sec.id;
        });
        var idx = map[current] ? links.indexOf(map[current]) : 0;
        if (idx !== lastIndex) {
          lastIndex = idx;
          if (window.__gooeyNav) window.__gooeyNav.setActive(idx, false);
        }
        updateCapsule();
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateCapsule);
    updateCapsule();
    onScroll();
  }

  /* ---------- 启动 ---------- */
  /* ---------- 下载按钮：镜面高光跟随鼠标 ---------- */
  function initSpecularButtons() {
    var btns = document.querySelectorAll(".btn-download");
    if (!btns.length) return;
    btns.forEach(function (btn) {
      btn.addEventListener("pointerenter", function () {
        btn.classList.add("is-spec");
      });
      btn.addEventListener("pointerleave", function () {
        btn.classList.remove("is-spec");
      });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var ang = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        ang = (ang + 450) % 360; // 0° = 顶部，顺时针
        btn.style.setProperty("--spec-from", ang - 22 + "deg");
        btn.style.setProperty("--spec-to", ang + 22 + "deg");
      });
    });
  }

  /* ---------- 一次性交互初始化（不依赖内容数据，只跑一次） ---------- */
  function initStatic() {
    initTiltCard();
    initTagTravel();
    initWorksTransition();
    initSplitText();
    initCursorGlass();
    initAurora();
    initGooeyNav();
    initNavSpy();
    initSpecularButtons();
    initMobileNav();
  }

  /* ---------- 数据驱动渲染（云端数据到达后可安全重跑） ---------- */
  function renderContent() {
    renderAbout();
    initWorks();
    renderExperiences();
    renderCases();
    renderBrands();
    renderContacts();
    initCasePixelation();
  }

  function init() {
    // 刷新后始终回到顶部，避免恢复滚动位置导致作品区标题直接出现
    if (document.getElementById("worksTitle")) {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
      // 瞬时回顶，避免页面平滑滚动造成视觉动画
      var htmlEl = document.documentElement;
      var prevBehavior = htmlEl.style.scrollBehavior;
      htmlEl.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      htmlEl.style.scrollBehavior = prevBehavior;
    }
    renderContent();
    initReveal();
    initStatic();
    ensureHeroAutoplay();
    bindHeroAutoplayRetry();
    initOverscrollGuard();
    // 通知液态玻璃等渲染完成后可克隆页面
    window.__siteRendered = true;
    try {
      document.dispatchEvent(new CustomEvent("site:rendered"));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 云端数据到达：增量刷新内容（不重新播放首屏动画） ---------- */
  function applyRemoteData(d) {
    if (!d) return;
    useData(d);
    applyHeroVideo();
    applySiteSettings();
    renderContent();
    initReveal(); // 重绘后的新节点重新挂入场观察器
    try {
      document.dispatchEvent(new CustomEvent("site:content-updated"));
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 首页视频：云端设置里有则替换本地视频 ---------- */
  function applyHeroVideo() {
    var hv = data && data.heroVideo;
    if (!hv || !hv.video) return;
    var v = document.querySelector(".hero-video");
    if (!v) return;
    if (hv.poster) v.setAttribute("poster", hv.poster);
    var src = v.querySelector("source");
    if (src) {
      src.setAttribute("src", hv.video);
    } else {
      src = document.createElement("source");
      src.setAttribute("src", hv.video);
      v.appendChild(src);
    }
    v.load();
    v.muted = true;
    v.play().catch(function () { /* 忽略自动播放拦截 */ });
  }

  /* ---------- 站点设置：形象照 / 联系我口号等 ---------- */
  function applySiteSettings() {
    if (data && data.portraitUrl) {
      var photo = document.querySelector(".about-photo img");
      if (photo) photo.setAttribute("src", data.portraitUrl);
    }
    if (data && data.contactDesc) {
      var desc = document.querySelector(".contact-desc");
      if (desc) desc.textContent = data.contactDesc;
    }
  }

  /* ---------- 首页视频：移动端自动播放兜底（muted + 首次交互重试） ---------- */
  function ensureHeroAutoplay() {
    var v = document.querySelector(".hero-video");
    if (!v) return;
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 被拦截时等首次交互再试 */ });
  }

  function bindHeroAutoplayRetry() {
    var v = document.querySelector(".hero-video");
    if (!v) return;
    function retry() {
      if (v.paused) {
        v.muted = true;
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* 忽略 */ });
      }
    }
    document.addEventListener("touchstart", retry, { once: true, passive: true });
    document.addEventListener("scroll", retry, { once: true, passive: true });
  }

  /* ---------- 移动端：顶部下拉时拦截 iOS 下拉刷新，避免页面回顶/重载 ---------- */
  function initOverscrollGuard() {
    if (!isMobile()) return;
    var startY = 0;
    var doc = document.scrollingElement || document.documentElement;
    document.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) startY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 1 || !e.cancelable) return;
      if (doc.scrollTop <= 0 && e.touches[0].clientY - startY > 0) {
        e.preventDefault(); // 顶部下拉手势：阻止浏览器刷新
      }
    }, { passive: false });
  }

  /* ---------- 启动：先尝试云端数据，失败则用本地数据 ---------- */
  function boot() {
    // 先用本地数据立即渲染 + 播放入场动画，不等网络；
    // 云端数据到达后再做增量刷新（内容一致时用户无感知）
    init();
    if (window.loadSiteData) window.loadSiteData().then(applyRemoteData);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
