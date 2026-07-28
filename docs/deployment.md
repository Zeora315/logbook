# 部署到 Cloudflare（前后端分离）

这个项目采用前后端分离架构：

- **前端**：Cloudflare Pages 托管静态文件（`public/` 目录）
- **后端**：独立 Cloudflare Worker + KV（`worker.js`）

## 架构说明

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Pages                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  public/                                                     │ │
│  │  ├── index.html          首页                               │ │
│  │  ├── admin.html          后台                               │ │
│  │  ├── author.html         作者页                             │ │
│  │  ├── tag.html            标签页                             │ │
│  │  ├── config.js           API 地址配置                        │ │
│  │  └── assets/                                               │ │
│  │      ├── styles.css                                        │ │
│  │      ├── app.js                                            │ │
│  │      ├── admin.js                                          │ │
│  │      ├── author.js                                         │ │
│  │      └── tag.js                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 调用 API
┌─────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  worker.js                处理所有 /api/* 请求               │ │
│  │  ├── GET  /api/posts         获取公开日志列表               │ │
│  │  ├── GET  /api/feed.json     JSON Feed                      │ │
│  │  ├── GET  /api/admin/posts   管理员查看所有日志             │ │
│  │  ├── POST /api/admin/posts   创建日志                       │ │
│  │  ├── GET  /api/admin/posts/:id   查看单条日志               │ │
│  │  ├── PUT  /api/admin/posts/:id   更新日志                   │ │
│  │  └── DELETE /api/admin/posts/:id 归档日志                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↓ 绑定                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  LOG_KV                   Cloudflare KV 存储日志数据         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 准备

- Cloudflare 账号（免费版即可）
- GitHub 账号
- 本项目代码已推送到 GitHub 仓库

---

## 第一部分：部署后端 Worker

### 1. 创建 KV Namespace

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **KV**
3. 点击 **Create a namespace**
4. 名称填：

```txt
LOG_KV
```

5. 点击 **Add**

### 2. 部署 Worker

在本地执行：

```bash
# 安装依赖
npm install

# 登录 Cloudflare（如果没有登录过）
npx wrangler login

# 部署 Worker
npm run deploy:worker
```

第一次部署会提示创建 Worker，按提示操作即可。部署成功后会输出 Worker 地址，类似：

```txt
https://logbook-api.你的账号.workers.dev
```

记下这个地址，后面前端配置要用。

### 3. 配置 Worker 环境变量

1. 进入 Cloudflare Dashboard → **Workers & Pages** → **logbook-api**
2. 点击 **Settings** → **Variables**
3. 添加以下变量：

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 后台登录用户名 | `zeora` |
| `ADMIN_PASSWORD` | 后台登录密码，建议 32 位以上 | `your-long-random-password` |
| `SITE_TITLE` | 站点标题 | `我的更新日志` |
| `SITE_DESCRIPTION` | 站点描述 | `记录 Zeora 和虾米的更新、发布与想法。` |
| `FRONTEND_ORIGIN` | 前端地址，用于 CORS | `https://logbook.pages.dev` |

### 4. 绑定 KV

1. 仍在 Worker 设置页面
2. 点击 **Settings** → **Bindings**
3. 找到 **KV Namespace bindings**
4. 添加绑定：

| Variable name | KV namespace |
| --- | --- |
| `LOG_KV` | 选择刚才创建的 `LOG_KV` |

5. 保存后重新部署一次 Worker：

```bash
npm run deploy:worker
```

---

## 第二部分：部署前端 Pages

### 1. 上传代码到 GitHub

确保项目已推送到 GitHub 仓库，例如 `zeora315/logbook`。

### 2. 创建 Pages 项目

1. 进入 Cloudflare Dashboard → **Workers & Pages**
2. 点击 **Create application** → **Pages** → **Connect to Git**
3. 选择你的 GitHub 仓库

### 3. 配置构建设置

填写：

| 设置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run check` |
| Build output directory | `public` |
| Root directory | `/` |

**重要**：如果 **Deploy command** 自动填入了 `npx wrangler deploy`，**删除它**，让字段留空。前端是纯静态部署，不需要执行部署命令。

点击 **Save and Deploy**。

### 4. 配置前端 API 地址

部署成功后，有两种方式连接前端和后端：

#### 方式 A：同一个域名（推荐）

如果你把前端和 Worker 放在同一个域名下，不需要修改 `config.js`，前端会自动使用相对路径 `/api/...`。

要做到这一点，需要在 Worker 里添加路由：

1. 进入 Cloudflare Dashboard → **Workers & Pages** → **logbook-api**
2. 点击 **Settings** → **Triggers**
3. 在 **Routes** 里添加：

```txt
你的域名/api/*
```

例如：`logbook.example.com/api/*`

4. 把前端 Pages 项目绑定到 `logbook.example.com`

这样前端访问 `https://logbook.example.com/api/posts` 时，会自动路由到 Worker。

#### 方式 B：跨域访问（简单）

修改 `public/config.js`，填入 Worker 地址：

```js
window.LOGBOOK_API_BASE = 'https://logbook-api.你的账号.workers.dev';
```

然后重新推送代码，Pages 会自动重新部署。

### 5. 测试

- 前台：`https://你的域名/`
- 后台：`https://你的域名/admin.html`

打开后台，输入用户名和密码，测试是否能正常登录和保存日志。

---

## 可选：使用自定义域名

### 为 Worker 配置域名

1. 进入 Worker → **Settings** → **Triggers**
2. 在 **Custom Domains** 里添加你的域名，例如 `api.logbook.example.com`
3. 然后修改 `public/config.js`：

```js
window.LOGBOOK_API_BASE = 'https://api.logbook.example.com';
```

### 为 Pages 配置域名

1. 进入 Pages 项目 → **Settings** → **Custom domains**
2. 添加你的域名，例如 `logbook.example.com`

---

## 以后更新

### 更新前端

```bash
git add .
git commit -m "Update frontend"
git push
```

Cloudflare Pages 会自动重新部署。

### 更新后端

```bash
npm run deploy:worker
```

---

## 常见问题

### 前端调用 API 报 CORS 错误

确认 Worker 的 `FRONTEND_ORIGIN` 变量设置了正确的域名，或者设置为 `*` 允许所有来源。

### 后台登录失败

检查 Worker 的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 是否正确。

### Worker 保存日志失败

检查 Worker 是否已绑定 `LOG_KV`。

### Pages 部署失败

如果提示 `wrangler deploy` 错误，确认 Pages 构建设置里的 **Deploy command** 字段是空的。