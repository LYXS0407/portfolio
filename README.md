# 刘富强个人作品集网站

纯 HTML / CSS / JavaScript 实现的个人作品集网站，无需构建工具，可直接打开或部署到任意静态托管平台。

## 页面结构

```
website/
├── index.html            首页（7 个内容版块 + 毛玻璃导航）
├── projects.html         全部项目卡片瀑布页（支持分类筛选，可随时新增项目）
├── project.html          项目详情页（由项目长图纵向堆叠构成，?id=01/02/03）
├── css/style.css         全部样式（1920px 设计规格，左右间距 200px）
├── js/
│   ├── site-data.js      站点数据（项目 / 经历 / 品牌 / 联系方式，常改）
│   ├── main.js           首页交互（横向滚动、hover 展开、入场动画、导航高亮）
│   ├── projects-page.js  瀑布页渲染与筛选
│   └── project-page.js   项目详情渲染
└── assets/               图片与 PDF 素材
```

## 7 个版块与交互

1. **首页**：左侧个人符号 + 中间胶囊毛玻璃导航 + 右侧「下载作品集」按钮；右侧留空。
2. **作品展示**：页面滚动时卡片从右侧进入、向左侧滑出，右下角提供 ← → 手动翻页。
3. **个人简介**：左文右图，支持下载简历 PDF。
4. **过往经历**：默认只展示 01，hover 任一经历时展开对应详情，其余自动收起。
5. **案例展示**：滚动时从右侧进入，点击卡片进入项目详情页（项目长图堆叠）；「查看更多」跳转瀑布页。
6. **服务品牌**：12 个品牌 LOGO，hover 时 LOGO 周围出现淡淡描边。
7. **联系我**：邮箱 / 微信 / 小红书三张卡片，小红书一键跳转个人主页。

## 如何新增项目（后续加项目只需 3 步）

1. 在 `assets/projects/` 下新建文件夹（如 `04-新项目`），放入项目长图（jpg/png）。
2. 复制一张封面图到 `assets/covers/04.jpg`。
3. 打开 `js/site-data.js`，在 `projects` 数组里按已有格式新增一条记录：

```js
{
  id: "04",
  num: "04",
  title: "项目名称",
  short: "一句话副标题",
  category: "项目分类（会出现在瀑布页筛选里）",
  year: "2026",
  role: "你的角色",
  cover: "assets/covers/04.jpg",
  tags: ["标签A", "标签B"],
  desc: "项目简介，一两句话即可",
  images: ["assets/projects/04/1-图片A.jpg", "assets/projects/04/2-图片B.jpg"]
}
```

保存后，首页案例、瀑布页、详情页会自动同步更新。

## 如何修改联系方式

同样在 `js/site-data.js` 的 `contacts` 中修改邮箱、微信、小红书账号与跳转链接即可。

## 本地预览

方式一：直接双击 `index.html`（推荐 Chrome / Edge）。

方式二：起一个本地静态服务：

```bash
cd website
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 性能优化说明（2026-08）

- 全部图片已压缩/缩放（works 瀑布图最大宽 1000、封面 1200、项目长图最大宽 1600、形象照 1000），
  卡片由 PNG 转 WebP，总量从约 154MB 降到约 14MB。
- 首页视频由 4K/18.8MB 转码为 1080p/3.3MB（H.264，`preload="metadata"` + 海报帧）。
- 作品瀑布页改为数据内嵌宽高比（`ratio`），无需图片探针即可布局并实现真正的懒加载。
- `works/` 原图备份在站点目录外的 `_原始素材备份/works原图/`；其余素材在根目录均有原图
  （`1-首页/`、`5-项目案例文件/`、`3-个人形象照.png`、`首页视频.mp4`）。

## 内容管理后台（Supabase）

网站支持一个管理后台 `admin.html`：登录后可管理作品图、项目案例、经历、品牌 LOGO、
个人简介、首页视频、简历/作品集 PDF（支持图片/文件上传）。

### 第一次初始化（只需一次）

1. 打开 [Supabase 控制台](https://supabase.com/dashboard) → 你的项目 → **SQL Editor** →
   New query，把项目根目录的 `supabase-setup.sql` 全部内容粘贴进去 → **Run**。
2. **Authentication → Users → Add user**，创建一个登录账号（邮箱 + 密码，建议用自己的邮箱）。
3. **Authentication → Providers → Email**，关闭 "Allow new users to sign up"（禁止公开注册，只留你一个账号）。

### 使用

- 部署后访问 `你的域名/admin.html` 登录即可管理内容，公开页面下次加载自动生效。
- 登录信息只保存在浏览器本地，请使用自己的浏览器操作。
- 后台为可视化界面：登录后默认进入「概览」仪表盘（内容统计、分类/年份分布、快捷入口），
  各内容页为卡片式管理，支持拖拽排序；「实时预览」标签可随时查看公开网站效果。

### 技术说明

- 数据优先从 Supabase 读取（超时/失败自动回退到本地 `js/site-data.js`，网站不会白屏）。
- 数据库表：`works`（作品图，含 card/gallery 分区）、`projects`、`experiences`、
  `brands`、`site_settings`（简介/视频/联系方式/附件）。
- 存储桶：`images`（图片）、`files`（视频/PDF），均为公开读、登录可写。
- 前端密钥使用的是浏览器端公开的 anon key，安全性由 RLS 保证（访客只读）。

### 访问分析（埋点）

- 公开页面内置轻量埋点 `js/analytics.js`，匿名统计：页面浏览、版块曝光、滚动深度、
  作品点击、下载、复制联系方式、跳转小红书、视频播放、停留时长。
- 数据存到 `analytics_events` 表（访客可写入、只有登录后台可读），后台「访问分析」
  标签查看可视化看板（趋势图 / 来源 / 页面 / 设备 / 热门作品 / 转化）。

## 部署上线

- **GitHub Pages**：把 `website/` 内内容推到仓库，Settings → Pages 选择分支即可。
- **Netlify / Vercel**：直接把 `website/` 文件夹拖入部署页面。
- **自有服务器**：把 `website/` 目录整个上传到站点根目录。
