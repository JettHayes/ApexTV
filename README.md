<a id="top"></a>

<p align="center">
  <img src="docs/images/apextv-cover.png" alt="Apex TV 项目封面" width="100%">
</p>

<h1 align="center">Apex TV</h1>

<p align="center">
  <img src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-007D78?style=for-the-badge" alt="简体中文">
  &nbsp;
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-101619?style=for-the-badge" alt="English"></a>
</p>

<p align="center">
  <a href="src/lib/version.ts"><img src="https://img.shields.io/badge/Apex_TV-2.0.0-007D78?style=flat-square" alt="Apex TV 2.0.0"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-101619?style=flat-square&amp;logo=nextdotjs" alt="Next.js"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-007D78?style=flat-square&amp;logo=react" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-4.9-101619?style=flat-square&amp;logo=typescript" alt="TypeScript"></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Deployment-007D78?style=flat-square&amp;logo=vercel" alt="Vercel"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-101619?style=flat-square" alt="CC BY-NC-SA 4.0"></a>
</p>

<p align="center">
  <a href="#features">功能介绍</a> &nbsp;·&nbsp; <a href="#interface">界面与设备</a> &nbsp;·&nbsp; <a href="#deploy">快速部署</a> &nbsp;·&nbsp; <a href="#services">服务接入</a>
  <br>
  <a href="#development">本地开发</a> &nbsp;·&nbsp; <a href="#scope">使用范围</a> &nbsp;·&nbsp; <a href="#license">许可致谢</a>
</p>

---

Apex TV 是一个可自行部署的媒体聚合播放器，基于 [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) 定制。影视、私人影库、直播、音乐和阅读共用一套界面，也可以用收藏、片单和观看计划整理自己的内容。

项目以 Vercel 为主要部署环境，采用银灰、石墨灰与青绿配色，适配电脑、手机、平板和浏览器内的 TV 大屏。

> [!IMPORTANT]
> 仓库不附带媒体资源、第三方账号或访问凭据。部署后需要自行配置有权使用的来源与服务。

<a id="features"></a>

## 🎬 主要功能

| 模块 | 说明 |
| --- | --- |
| 影视与短剧 | 聚合搜索、分类浏览、选集换源，以及独立的短剧浏览与播放页面 |
| 网页播放器 | 倍速、进度记录、弹幕、外挂字幕、视频超分及外部播放器跳转 |
| 我的内容 | 收藏、最近观看、自建片单，以及稍后看、正在看、已看完、暂时搁置等观看计划 |
| 私人影库 | 接入 OpenList、Emby 或小雅，浏览、搜索并播放自己的媒体 |
| 电视直播 | M3U 频道列表、分类切换、收藏与节目单 |
| 网络直播 | 多平台直播间与自定义直播流，展示可获取的主播资料、画质及线路 |
| 音乐空间 | 搜索、榜单、歌单、歌词、播放队列与悬浮播放控制 |
| 电子书馆 | OPDS 书库与兼容的 Legado 书源，支持搜索、目录、阅读、书架、历史及听书 |
| 漫画书库 | 推荐、搜索、详情、章节阅读、书架与阅读记录 |
| AI 与观影室 | AI 问片、共同观影、音乐同步及屏幕共享，按需连接对应服务 |
| 管理后台 | 用户权限、内容来源、站点外观、服务接入与通知设置 |

功能入口由站点开关和账号权限控制。持久化存储可让收藏、播放记录等账号数据在多台设备间使用；个人偏好和阅读设置按各功能的设置范围保存。

<a id="interface"></a>

## 🎨 界面与设备

首页以推荐和继续观看为主，搜索使用独立页面。桌面端按浏览与播放场景安排侧栏或顶栏；手机使用底部导航，平板根据屏幕宽度调整列表、面板与播放器布局。Web TV 提供大屏页面与遥控器导航。

主界面默认浅色，可手动切换深色。两套主题共用青绿强调色，阅读器保留独立的纸色和排版设置。支持的浏览器使用整页主题切换动画，并尊重“减少动态效果”设置。

视频编码、自动播放、画中画、超分和外部播放器唤起能力取决于设备与浏览器。PWA 可安装到设备，但安装本身不会下载媒体内容。

<a id="deploy"></a>

## 🚀 部署到 Vercel

准备 Vercel 账号和持久化数据库，将仓库 Fork 或复制到自己的 GitHub 账号，再导入 Vercel。也可以使用下面的入口：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJettHayes%2FApexTV)

选择 **Next.js**、**Node.js 24.x**，保留默认输出目录。包管理器版本由 `package.json` 指定；安装与构建命令分别为 `pnpm install --frozen-lockfile`、`pnpm build`。

以 Upstash Redis 为例，在 **Settings → Environment Variables** 中填写：

| 变量 | 说明 |
| --- | --- |
| `USERNAME` | 站长账号 |
| `PASSWORD` | 独立的强密码，同时用于登录凭据签名 |
| `NEXT_PUBLIC_STORAGE_TYPE` | 填写 `upstash` |
| `UPSTASH_URL` | 数据库 REST URL |
| `UPSTASH_TOKEN` | 数据库访问令牌 |

部署完成后使用站长账号登录，从用户菜单进入管理后台，配置需要的媒体来源和服务。自定义域名在 Vercel 的 **Settings → Domains** 中添加；环境变量变更需要重新部署。

<details>
<summary>🗃️ 存储与部署边界</summary>

代码保留了 Redis、Kvrocks、Postgres、Turso 和 D1／SQLite 等存储适配器，参见 [存储实现](src/lib/db.ts)。使用其他后端前需确认运行环境、连接配置与数据库初始化方式。

Vercel 上的扫描和代理受函数时长、实例生命周期及流量配额限制；服务器本地下载不适合作为持久下载方案。观影室的实时同步需要外部实时服务，默认 Next.js 部署不会启动 `server.js` 中的内置服务。

</details>

<a id="services"></a>

## 🔌 服务接入

| 模块 | 接入方式 |
| --- | --- |
| 影视与短剧 | 添加兼容的影视接口或导入配置；短剧分类需要来源提供相应内容 |
| 影片资料 | 按需配置 TMDB、豆瓣等资料来源 |
| 私人影库 | 在后台连接 OpenList、Emby 或小雅 |
| 电视直播 | 导入有权使用的 M3U 频道列表，可附节目单 |
| 网络直播 | 虎牙、哔哩哔哩、抖音、斗鱼适配，以及 YouTube Live、Twitch 官方播放器嵌入；也可添加自定义直播流 |
| 音乐 | 连接兼容的 LX 音乐后端并配置认证信息 |
| 电子书 | 添加 OPDS 书库或导入 Legado JSON 订阅 |
| 漫画 | 连接兼容的漫画服务，或使用已配置的漫画解析来源 |
| AI 与通知 | 按需配置模型、邮件、Telegram 或其他通知服务 |

影片资料与播放地址来自不同服务，有海报不代表有可用片源。直播画质、平台嵌入和媒体播放受来源权限、网络与浏览器支持影响。

Legado 兼容仍处于实验阶段，只支持部分解析规则；依赖 Android、WebView 或交互登录的书源可能无法使用。订阅导入成功不代表目录、正文和封面都可访问。

日常配置以后台为主，环境变量与字段定义可查阅 [配置代码](src/lib/config.ts) 和 [配置类型](src/lib/admin.types.ts)。视频源脚本接口见 [SOURCE_SCRIPT.md](SOURCE_SCRIPT.md)。

<a id="development"></a>

## 🛠️ 本地开发

使用 **Node.js 24** 的安全补丁版本，以及 `package.json` 指定的 **pnpm**：

```bash
git clone https://github.com/JettHayes/ApexTV.git
cd ApexTV
pnpm install --frozen-lockfile
```

在根目录创建不提交到仓库的 `.env.local`，填写登录与开发数据库配置，然后运行 `pnpm dev`，访问 `http://localhost:3000`。开发环境应使用独立数据库。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务 |
| `pnpm build` | 构建应用 |
| `pnpm typecheck` | 类型检查 |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行测试 |
| `pnpm format:check` | 格式检查 |

页面与 API 位于 `src/app`，通用组件位于 `src/components`，服务与存储逻辑位于 `src/lib`，主题样式位于 `src/styles`。

仓库提供可选的 [上游同步工作流](.github/workflows/sync_fork.yml)，用于准备同步 PR，合并前需自行审查差异。更新或更换数据库前请备份重要配置与数据。

<a id="scope"></a>

## 📌 使用范围

项目提供媒体检索和播放界面。第三方服务名称仅用于说明兼容关系，不代表官方合作、授权或背书。

使用接口、媒体及相关素材时，应遵守各自的服务条款与授权条件。仓库许可证不授予第三方内容或商标的使用权，依赖与素材仍适用各自的许可。

<a id="license"></a>

## 📄 许可与致谢

Apex TV 中由 [JettHayes](https://github.com/JettHayes) 创作的原创新增与修改部分 © 2026 JettHayes。原有代码及第三方内容的权利归各自权利人所有。

本项目采用 **[CC BY-NC-SA 4.0](LICENSE)** 许可证。

感谢 **[MoonTVPlus](https://github.com/mtvpls/MoonTVPlus)** 提供的基础实现。

<p align="center"><a href="#top">↑ 回到顶部</a></p>
