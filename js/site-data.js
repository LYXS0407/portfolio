/* ============================================================
   个人网站站点数据 — 新增/修改项目只需编辑此文件
   新增项目步骤：
   1. 在 assets/projects/ 下新建文件夹（如 04-新项目），放入长图
   2. 复制一张封面图到 assets/covers/04.jpg
   3. 在下方 PROJECTS 数组里新增一条记录
   ============================================================ */

window.SITE_DATA = {
  /* ---------- 基础信息 ---------- */
  identity: {
    name: "刘富强",
    nameEN: "FUQIANG LIU",
    roleCN: "品牌视觉与 UI 设计师",
    roleEN: "BRAND & UI DESIGNER",
    slogan: "DESIGN PORTFOLIO",
    sloganCN: "设计作品集",
    education: "四川美术学院（本科）· 2016.09 – 2020.06",
    about: [
      "拥有六年品牌与 UI 设计实战经验，熟练掌握 PS、AI、Figma、Blender 主流设计软件；熟练整合 AIGC 工具搭建标准化高效工作流，能够独立操盘完整品牌、UI 设计项目，同步优化创意呈现与交付效率。",
      "深耕科技赛道品牌全案打造，能承接海报、公众号视觉、活动美陈、展会展板等多渠道运营物料设计，熟悉各类落地制作工艺，保障方案高效投产落地。"
    ]
  },

  /* ---------- 作品展示（第 2 版块：横向能力卡片） ---------- */
  works: [
    { title: "BLENDER MODELING", label: "AIOT 软件登录页", img: "assets/cards/blender.webp", ratio: 0.7503 },
    { title: "VISUAL DESIGN", label: "预告长图", img: "assets/cards/visual.webp", ratio: 0.7494 },
    { title: "INTERFACE DESIGN", label: "线上展厅 UI", img: "assets/cards/interface.webp", ratio: 0.7494 },
    { title: "LARGE-SCREEN DESIGN", label: "供应链大屏", img: "assets/cards/largescreen.webp", ratio: 0.7494 },
    { title: "MATERIAL DESIGN", label: "游戏物料", img: "assets/cards/material.webp", ratio: 0.7494 },
    { title: "VISUAL DESIGN", label: "活动视觉", img: "assets/cards/activity.webp", ratio: 0.7494 },
    { title: "BRAND DESIGN", label: "VI 系统", img: "assets/cards/vi.webp", ratio: 0.7494 },
    { title: "MATERIAL DESIGN", label: "产品手册", img: "assets/cards/brochure.webp", ratio: 0.7494 },
    { title: "BRAND DESIGN", label: "伴手礼盒", img: "assets/cards/giftbox.webp", ratio: 0.7494 }
  ],

  /* ---------- 作品展示瀑布页新增图片（后续可接入后台上传） ---------- */
  worksGallery: [
    { title: "3天 2", img: "assets/works/works-01.jpg", ratio: 0.4608 },
    { title: "4.1 4", img: "assets/works/works-02.jpg", ratio: 0.4618 },
    { title: "AI招聘海报3（换风格）", img: "assets/works/works-03.jpg", ratio: 0.1050 },
    { title: "中秋活动海报4", img: "assets/works/works-04.jpg", ratio: 0.4618 },
    { title: "人物海报 8", img: "assets/works/works-05.jpg", ratio: 0.4618 },
    { title: "合作案例头图 13", img: "assets/works/works-06.jpg", ratio: 0.7498 },
    { title: "合作案例头图 14", img: "assets/works/works-07.jpg", ratio: 0.7498 },
    { title: "合作案例头图 18", img: "assets/works/works-08.jpg", ratio: 0.7498 },
    { title: "合作案例头图 6", img: "assets/works/works-09.jpg", ratio: 0.7494 },
    { title: "教师节海报 4", img: "assets/works/works-10.jpg", ratio: 0.4618 },
    { title: "易拉宝2 3", img: "assets/works/works-11.jpg", ratio: 0.4618 },
    { title: "易拉宝2 4", img: "assets/works/works-12.jpg", ratio: 0.4618 },
    { title: "海报6 3", img: "assets/works/works-13.jpg", ratio: 0.4618 },
    { title: "邀请海报", img: "assets/works/works-14.jpg", ratio: 0.4618 },
    { title: "2033", img: "assets/works/works-15.jpg", ratio: 0.4618 },
    { title: "4 75", img: "assets/works/works-16.jpg", ratio: 0.4619 },
    { title: "5周年 KV2", img: "assets/works/works-17.jpg", ratio: 0.4484 },
    { title: "Group 1321318000", img: "assets/works/works-18.jpg", ratio: 0.1235 },
    { title: "Group 427321323", img: "assets/works/works-19.jpg", ratio: 0.7039 },
    { title: "拔河预告", img: "assets/works/works-20.jpg", ratio: 0.5196 },
    { title: "公众号 H5", img: "assets/works/works-21.jpg", ratio: 0.1243 },
    { title: "画板 6", img: "assets/works/works-22.jpg", ratio: 0.4582 },
    { title: "开年红包 06", img: "assets/works/works-23.jpg", ratio: 0.5294 },
    { title: "五周年主KV+线上物料", img: "assets/works/works-24.jpg", ratio: 0.3088 },
    { title: "预告海报 05", img: "assets/works/works-25.jpg", ratio: 0.4619 },
    { title: "主KV 02", img: "assets/works/works-26.jpg", ratio: 1.7738 }
  ],

  /* ---------- 案例展示（第 5 版块 + 瀑布页 + 详情页） ---------- */
  projects: [
    {
      id: "01",
      num: "01",
      title: "传统工业软件向AI转型 全域品牌视觉升级",
      short: "AGYTEK · 品牌升级",
      category: "品牌升级",
      year: "2024 – 2026",
      role: "品牌设计师 / UI 设计师",
      cover: "assets/covers/01.jpg",
      tags: ["品牌视觉", "VI 规范", "AIGC 工作流", "3D 建模"],
      desc: "为广域铭岛马来西亚分公司 AGYTEK 打造全案品牌视觉升级：重构品牌基因与视觉语言、搭建标准化 VI 规范，并建立 AIGC 设计工作流，让传统工业软件的视觉体系整体转向 AI 时代。",
      images: [
        "assets/projects/01/01-品牌设计.jpg",
        "assets/projects/01/02-AIGC设计工作流.jpg",
        "assets/projects/01/03-3D篇.jpg",
        "assets/projects/01/04-物料篇.jpg",
        "assets/projects/01/05-物料篇.jpg",
        "assets/projects/01/06-物料篇.jpg",
        "assets/projects/01/07-媒介外宣.jpg",
        "assets/projects/01/08-简介PPT.jpg"
      ]
    },
    {
      id: "02",
      num: "02",
      title: "广域铭岛五周年 活动物料设计",
      short: "周年庆 · 活动视觉全案",
      category: "周年庆",
      year: "2023 – 2025",
      role: "品牌设计师",
      cover: "assets/covers/02.jpg",
      tags: ["活动物料", "主视觉", "延展设计", "落地执行"],
      desc: "广域铭岛五周年庆典整套视觉物料制作落地：从主视觉创意、延展物料设计到线上预告与线下成果呈现，统一并强化品牌五周年的整体视觉记忆。",
      images: [
        "assets/projects/02/1-周年活动设计.jpg",
        "assets/projects/02/2-主视觉.jpg",
        "assets/projects/02/3-延展物料.jpg",
        "assets/projects/02/4-线上预告.jpg",
        "assets/projects/02/5-落地成果.jpg",
        "assets/projects/02/6-更多视觉.jpg"
      ]
    },
    {
      id: "03",
      num: "03",
      title: "远程LCV汽车工厂 数字孪生大屏",
      short: "数字孪生 · 大屏 UI",
      category: "数字孪生",
      year: "2024 – 2025",
      role: "UI 设计师",
      cover: "assets/covers/03.jpg",
      tags: ["数字孪生", "大屏 UI", "数据可视化", "3D 建模"],
      desc: "吉利 LCV 远程汽车工厂数字孪生可视化大屏项目：负责大屏 UI 设计与交互逻辑，协同团队完成工厂 3D 建模渲染与视觉效果落地交付。",
      images: [
        "assets/projects/03/1-数字孪生工厂.jpg",
        "assets/projects/03/2-数字孪生工厂.jpg",
        "assets/projects/03/3-数字孪生工厂.jpg"
      ]
    }
  ],

  /* ---------- 过往经历（第 4 版块） ---------- */
  experiences: [
    {
      num: "01",
      company: "广域铭岛数字科技有限公司（吉利）",
      period: "2022.2–2026.6",
      paragraphs: [
        "任职品牌平面设计师——全权负责工业互联网品牌视觉体系升级重构，搭建标准化VI规范，统一海内外社媒、宣传画册、H5、伴手礼品、线下展会所有宣传物料视觉风格，塑造统一品牌形象；统筹10+大型活动视觉全案设计，落地国内外顶尖科技展会与公司周年庆典，包含WAIC、天津智博会、新加坡Tech Week科技周、3/4/5周年庆典整套视觉物料制作落地。",
        "任职UI设计师——负责多类B端后台、网页项目全流程UI设计，覆盖AIOT平台、SCRM客户管理系统、低代码搭建平台、企业官网等产品线；把控界面视觉、交互逻辑，保障设计品质与优质用户体验完整落地。同时负责工厂数字孪生可视化大屏UI设计，协同团队完成大屏建模渲染与视觉效果落地交付。"
      ]
    },
    {
      num: "02",
      company: "锐云科技科技有限公司（保利）",
      period: "2021.3–2021.12",
      paragraphs: [
        "负责悦家经纪云、保利悦家云、锐云科技官网、信达地产外拓、新悦置案场管理等多条地产产品线UI设计；牵头锐云官网、新悦置案场两款新品视觉风格搭建，输出设计规范，赋能团队提效。"
      ]
    },
    {
      num: "03",
      company: "重庆小怪兽科技有限公司",
      period: "2020.6–2021.3",
      paragraphs: [
        "主导潮流社交APP《放克》UI设计，对接产品输出界面与交互方案，持续优化用户体验；搭建视觉规范统一设计风格，协同开发、测试完成界面验收与版本迭代上线。"
      ]
    }
  ],

  /* ---------- 服务品牌（第 6 版块） ---------- */
  brands: [
    { name: "GEELY 吉利", logo: "assets/brands/geely.png" },
    { name: "LYNK & CO", logo: "assets/brands/lynkco.png" },
    { name: "远程汽车", logo: "assets/brands/yuancheng.png" },
    { name: "G+ 广域铭岛", logo: "assets/brands/guangyumingdao.png" },
    { name: "AGYTEK", logo: "assets/brands/agytek.png" },
    { name: "保利悦家云", logo: "assets/brands/baoliyuejiayun.png" },
    { name: "Rockchip 瑞芯微", logo: "assets/brands/rockchip.png" },
    { name: "信达地产", logo: "assets/brands/xinda.png" },
    { name: "力帆科技", logo: "assets/brands/lifan.png" },
    { name: "喵喵探案馆", logo: "assets/brands/miaomiao.png" },
    { name: "鼎成集团", logo: "assets/brands/dingcheng.png" },
    { name: "网易游戏", logo: "assets/brands/wangyi.png" }
  ],

  /* ---------- 联系我（第 7 版块） ---------- */
  contacts: {
    email: "1020395408@qq.com",
    wechat: "15922650737",
    xhs: {
      label: "个人设计账号",
      account: "551843669",
      url: "https://xhslink.cn/m/6xrISw2kyS3"
    }
  },

  /* ---------- 下载 ---------- */
  downloads: {
    portfolio: "assets/downloads/刘富强-品牌视觉设计师-作品集.pdf",
    resume: "assets/downloads/刘富强-品牌设计师-简历.pdf"
  }
};
