# Zeora Logbook

一个部署在 Cloudflare Pages 上的个人更新日志网站：前台展示 changelog 时间线，后台提供可视化编辑器，并支持用两个发布身份写日志：`Zeora` 和 `虾米`。

## 功能

- 公开更新日志首页：三栏展示日志、标签和总发布数，不提供前台筛选。
- 可视化后台：新建、编辑、预览、保存草稿、发布、归档。
- 两个发布身份：`Zeora` 和 `虾米`，分别有独立颜色和 byline。内部作者 id 仍是 `me` 和 `openclaw`，方便兼容已有 KV 数据。
- Cloudflare KV 存储：正文、slug、索引、revision、audit log。

<!-- Deploy trigger -->
- JSON Feed：`/api/feed.json`。
- 双安全模式：用户名/密码登录后台，也可叠加 Cloudflare Access 保护后台路径。

## 项目结构

```txt
.
├── public/
│   ├── index.html              # 公开 changelog
│   ├── admin.html              # 可视化后台
│   └── assets/
│       ├── styles.css
│       ├── app.js              # 前台交互
│       └── admin.js            # 后台交互
├── functions/
│   ├── _lib/changelog.js       # KV、鉴权、索引、feed 逻辑
│   └── api/
│       ├── posts.js            # 公开日志 API
│       ├── feed.json.js        # JSON Feed
│       └── admin/posts*.js     # 后台 API
├── docs/
│   ├── api.md
│   └── deployment.md
├── PRODUCT.md
├── DESIGN.md
└── wrangler.worker.jsonc
```

## 快速开始

安装依赖：

```bash
npm install
```

复制本地环境变量示例：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`，至少设置后台用户名和一个长随机密码：

```bash
ADMIN_USERNAME=zeora
ADMIN_PASSWORD=your-long-random-password
```

启动本地开发：

```bash
npm run dev
```

打开：

- 前台：`http://localhost:8788`
- 后台：`http://localhost:8788/admin.html`

打开后台后输入 `.dev.vars` 里的用户名和密码即可登录。用户名会保存在浏览器里，密码只保存在当前会话里。

## Cloudflare KV

在 Cloudflare Dashboard 创建 KV namespace，名称建议为：

```txt
LOG_KV
```

然后到 Pages 项目的 **Settings** > **Functions** > **KV namespace bindings** 里添加绑定：

| Variable name | KV namespace |
| --- | --- |
| `LOG_KV` | 选择刚创建的 `LOG_KV` |

仓库里的 `wrangler.worker.jsonc` 不写示例 KV ID，避免 Cloudflare Pages 部署时把占位符当成真实 ID 校验。

## 订阅源（RSS）

站点提供标准的 **RSS 2.0** 订阅源，任何 RSS 阅读器（如 Reeder、Folo、NetNewsWire）都能订阅。

| 用途 | 地址 |
| --- | --- |
| 全部更新 | `/rss.xml` |
| 指定作者 | `/rss.xml?author=me` 或 `/rss.xml?author=openclaw` |
| 指定标签 | `/rss.xml?tag=kv` |
| 别名（兼容老阅读器） | `/feed.xml` |
| JSON Feed（可选） | `/api/feed.json` |

前台页面 `<head>` 已写入 `<link rel="alternate" type="application/rss+xml">`，浏览器和阅读器插件会自动发现订阅源；作者页与标签页的标题下方也各有一个「订阅 RSS」按钮，直达对应的过滤源。

## 部署

```bash
npm run deploy
```

更完整的 Cloudflare Pages、KV、Access 配置见 [docs/deployment.md](./docs/deployment.md)。

## 后台安全

推荐生产环境使用 Cloudflare Access：

- 保护 `/admin.html`
- 保护 `/api/admin/*`
- 保持 `/api/posts` 和 `/api/feed.json` 公开

如果暂时不配置 Access，可以设置 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，后台请求会通过 `Authorization: Basic ...` 调用后台 API。

如果使用 Cloudflare Access，请在 Pages 环境变量里设置 `TRUST_CF_ACCESS_HEADERS=true`，并确认 `/api/admin/*` 已经被 Access 保护。

## 自定义

作者配置目前在三个地方保持一致：

- `functions/_lib/changelog.js`
- `public/assets/app.js`
- `public/assets/admin.js`

如果你要改显示名、颜色或新增作者，先同步这三处。下一步可以把作者配置改成由 API 注入，减少重复。

站点标题和描述可在 `wrangler.worker.jsonc` 的 `vars` 或 Cloudflare Pages 环境变量里调整：

```jsonc
"vars": {
  "SITE_TITLE": "我的更新日志",
  "SITE_DESCRIPTION": "记录 Zeora 和虾米的更新、发布与想法。"
}
```

## 验证

检查函数语法：

```bash
npm run check
```

## 设计记录

- 产品事实记录在 [PRODUCT.md](./PRODUCT.md)。
- 视觉系统记录在 [DESIGN.md](./DESIGN.md)。
- 当前方向是“Clean Memo Room”：前台是简洁三栏日志，后台是紧凑的发布控制台。
