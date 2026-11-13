<a id="top"></a>

<p align="center">
  <img src="docs/images/apextv-cover.png" alt="Apex TV 项目封面" width="100%">
</p>

<h1 align="center">Apex TV</h1>

<p align="center">
  <img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-007c76?style=for-the-badge" alt="简体中文">
  &nbsp;
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-102023?style=for-the-badge" alt="English"></a>
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-102023?style=flat-square&amp;logo=nextdotjs" alt="Next.js"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-007c76?style=flat-square&amp;logo=react" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-4.9-102023?style=flat-square&amp;logo=typescript" alt="TypeScript"></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Deployment-007c76?style=flat-square&amp;logo=vercel" alt="Vercel"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-102023?style=flat-square" alt="CC BY-NC-SA 4.0"></a>
</p>

<p align="center">
  <a href="#features">功能介绍</a> &nbsp;·&nbsp; <a href="#interface">界面与设备</a> &nbsp;·&nbsp; <a href="#deploy">快速部署</a> &nbsp;·&nbsp; <a href="#services">服务接入</a>
  <br>
  <a href="#development">本地开发</a> &nbsp;·&nbsp; <a href="#updates">更新维护</a> &nbsp;·&nbsp; <a href="#scope">使用范围</a> &nbsp;·&nbsp; <a href="#license">许可致谢</a>
</p>

---

Apex TV 是一个可自行部署的媒体聚合播放器，基于 [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) 定制。它将影视搜索、私人影库、直播和音乐整合到同一套界面中，适合管理自己的媒体服务和收藏。

本分支围绕 Vercel 部署维护，主要调整了品牌、主题、导航，以及影库、直播和音乐的使用体验。界面采用银灰与青绿配色，支持电脑、手机和平板。

> [!IMPORTANT]
> 仓库不附带影视、直播或音乐资源，也不提供第三方服务账号和访问凭据。部署后需要自行配置有权使用的数据源。

<a id="features"></a>

## 🎬 主要功能

| 功能 | 说明 |
| --- | --- |
| 影视搜索 | 聚合已配置的影视源，支持搜索、选集和换源 |
| 首页与记录 | 轮播推荐、海报列表、收藏和继续观看 |
| 网页播放 | 支持常见流媒体格式、倍速、进度记录及外部播放器跳转 |
| 私人影库 | 接入 OpenList、Emby 或小雅，浏览、搜索自己的收藏 |
| 电视直播 | 配置 M3U 频道源与节目单 |
| 网络直播 | 按平台和房间配置直播来源，展示可获取的房间信息 |
| 音乐 | 连接兼容的音乐后端，使用搜索、榜单、歌单、歌词和播放队列 |
| 管理后台 | 管理用户、权限、媒体来源及站点外观 |
| 多端使用 | 桌面侧边栏、手机底部导航、平板紧凑布局，以及 PWA 安装入口 |

播放记录和收藏等数据可通过持久化数据库在不同设备间使用。具体入口取决于功能开关和账号权限，实际播放能力取决于数据源、后端服务与浏览器。

<details>
<summary>🧩 可选功能</summary>

代码还保留了弹幕、外挂字幕、WebGPU 视频超分、AI 问片、漫画与电子书、观影室、通知、Web TV 大屏页面等功能。部分功能需要额外服务，或有浏览器与设备要求。

视频源脚本属于实验性扩展，接口说明见 [SOURCE_SCRIPT.md](SOURCE_SCRIPT.md)。

本分支已移除上游的原生 Android TV 工程和部分平台发布文件；当前保留的是浏览器内的大屏页面。

</details>

<a id="interface"></a>

## 🎨 界面与设备

首页以推荐海报和继续观看为主，搜索使用独立页面。手机通过底部导航切换主要功能，平板会根据宽度调整侧栏和播放布局。

默认使用浅色主题，点击外观按钮切换深浅色并记住选择。主题切换带有轻量过渡，并尊重系统“减少动态效果”设置。

不同浏览器对视频编码、自动播放和外部播放器唤起的支持存在差异；PWA 安装也不意味着媒体内容已下载到本地。

<a id="deploy"></a>

## 🚀 部署到 Vercel

### 1. 准备与导入

准备 Vercel 账号和持久化数据库。下面以 Upstash Redis REST 接口为例。

将仓库 Fork 或复制到自己的 GitHub 账号，在 Vercel 中导入项目，选择 Next.js。也可以使用部署入口：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJettHayes%2FApexTV)

| 项目设置 | 建议值 |
| --- | --- |
| Framework Preset | Next.js |
| Node.js | 24.x |
| 包管理器 | pnpm，版本由 `package.json` 指定 |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | Next.js 默认设置 |

### 2. 配置环境变量

在 Vercel 的 **Settings → Environment Variables** 中填写：

| 变量 | 说明 |
| --- | --- |
| `USERNAME` | 站长账号 |
| `PASSWORD` | 独立的强密码，同时参与登录凭据签名 |
| `NEXT_PUBLIC_STORAGE_TYPE` | 使用 Upstash 时填写 `upstash` |
| `UPSTASH_URL` | 数据库 REST URL |
| `UPSTASH_TOKEN` | 数据库访问令牌 |

凭据只填写在部署环境或后台，不要提交到仓库。修改环境变量后需要重新部署。

### 3. 登录与配置

部署完成后，使用站长账号登录，从用户菜单或 `/admin` 进入管理后台，配置需要的来源与服务。自定义域名可在 Vercel 的 **Settings → Domains** 中添加。

<details>
<summary>🗃️ 其他存储方式与部署边界</summary>

代码还保留了 Redis、Kvrocks、Postgres、Turso 和 D1／SQLite 适配器，入口见 [src/lib/db.ts](src/lib/db.ts)。采用其他存储方式前，需要核对连接配置与表结构。本分支未保留上游的数据库初始化脚本。

Vercel 部署还需留意：

- 外部服务必须能从部署环境访问，独立服务器或局域网中的服务不会自动连通。
- 音视频代理会消耗相应的流量和函数资源。
- 影库扫描等后台任务受实例生命周期和函数时长影响；当前扫描进度并非持久化任务队列。
- 服务器本地下载依赖持续运行的任务和存储，不适合作为 Vercel 上的持久下载方案。
- 内置实时服务依赖 `server.js`，默认 Next.js 部署不会启动它；观影室等场景需要外部服务或额外适配。

平台能力与配额请以 [Vercel 官方文档](https://vercel.com/docs/functions) 为准。

</details>

<a id="services"></a>

## 🔌 服务接入

所有服务均由部署者自行配置。建议先在原服务中确认内容能正常访问，再接入 Apex TV。

| 模块 | 接入方式 |
| --- | --- |
| 影视来源 | 在后台添加兼容的影视接口，或导入配置 |
| 影片资料 | 按需配置 TMDB、豆瓣等资料来源 |
| 私人影库 | 在后台配置 OpenList、Emby 或小雅 |
| 电视直播 | 导入有权使用的 M3U 频道列表，可附节目单 |
| 网络直播 | 内置虎牙、哔哩哔哩和抖音的适配代码；可用性受接口变化与访问条件影响 |
| 音乐 | 配置兼容的 LX 音乐后端及认证信息 |
| 阅读与其他扩展 | 按功能需要配置对应的阅读、模型、通知或实时服务 |

影片资料和实际播放地址来自不同服务。出现海报不代表有可用片源，能够列出文件也不代表浏览器支持其编码。

第三方服务的接口、权限和访问规则可能变化。本项目不承诺所有来源、地区或设备始终可用。

<details>
<summary>⚙️ 常用可选环境变量</summary>

多数日常设置可以在后台完成。下面列出常用的部署配置，详细字段见 [配置代码](src/lib/config.ts) 和 [配置类型](src/lib/admin.types.ts)。

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SITE_NAME` | 初始站点名称 |
| `NEXT_PUBLIC_SITE_URL` | 对外访问地址 |
| `ANNOUNCEMENT` | 初始公告 |
| `INIT_CONFIG` | 初始 JSON 配置 |
| `CONFIG_SUBSCRIPTION_URL` | 配置订阅地址 |
| `TMDB_API_KEY` | TMDB 密钥 |
| `MUSIC_V2_BASE_URL`、`MUSIC_V2_TOKEN` | 音乐后端地址与令牌 |
| `DANMAKU_API_BASE`、`DANMAKU_API_TOKEN` | 弹幕后端配置 |
| `WATCH_ROOM_ENABLED`、`WATCH_ROOM_SERVER_TYPE` | 观影室开关与服务类型 |
| `WATCH_ROOM_EXTERNAL_SERVER_URL`、`WATCH_ROOM_EXTERNAL_SERVER_AUTH` | 外部观影室配置 |
| `ENABLE_TV_MODE` | Web TV 大屏入口开关 |
| `CRON_PASSWORD` | 定时任务鉴权，需与调度路径一致 |

不要将实际密钥、数据库连接串或包含访问令牌的订阅链接写进公开文档。

</details>

<a id="development"></a>

## 🛠️ 本地开发

使用 **Node.js 24** 和 **pnpm 10.14.0**：

```bash
git clone https://github.com/JettHayes/ApexTV.git
cd ApexTV
pnpm install --frozen-lockfile
```

在项目根目录创建不提交到仓库的 `.env.local`，填写账号和开发数据库配置，然后运行：

```bash
pnpm dev
```

访问 `http://localhost:3000`。本地运行会连接填写的服务，开发时应使用独立数据库。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务 |
| `pnpm build` | 构建应用 |
| `pnpm typecheck` | 类型检查 |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行测试 |
| `pnpm format:check` | 格式检查 |

页面与 API 位于 `src/app`，通用组件位于 `src/components`，服务与存储逻辑位于 `src/lib`，主题样式位于 `src/styles`。

<a id="updates"></a>

## 🔄 更新与维护

仓库保留 [Upstream Sync](.github/workflows/sync_fork.yml) 工作流，用于检查 MoonTVPlus 更新并准备同步 PR。需要配置 `SYNC_TOKEN` 及相应权限，不会直接合入 `main`。

合并前请检查上游与本分支的差异，并按工作流说明使用 **Create a merge commit**。Vercel 是否自动部署，由它连接的仓库与生产分支设置决定。

更新和切换数据库前，先备份重要配置与数据。

<a id="scope"></a>

## 📌 使用范围

项目提供媒体检索和播放界面，第三方服务名称仅用于说明兼容关系，不代表官方合作、授权或背书。

使用接口、媒体内容及相关图片时，应遵守相应服务条款和授权条件。仓库许可证不授予第三方内容或商标的使用权；第三方依赖和素材仍适用各自的许可条件。

<a id="license"></a>

## 📄 许可与致谢

Apex TV 中由 [JettHayes](https://github.com/JettHayes) 创作的原创新增与修改部分 © 2026 JettHayes。原有代码及第三方内容的权利归各自权利人所有。

本项目采用 **[CC BY-NC-SA 4.0](LICENSE)** 许可证。

感谢 **[MoonTVPlus](https://github.com/mtvpls/MoonTVPlus)** 提供的基础实现。

<p align="center"><a href="#top">↑ 回到顶部</a></p>
