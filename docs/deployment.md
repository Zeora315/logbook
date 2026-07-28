# 部署到 Cloudflare Pages

这份文档教你如何通过 Cloudflare 网页后台部署这个项目，不需要在本地执行 wrangler 命令。

## 准备

- Cloudflare 账号（免费版即可）。
- GitHub 账号。
- 本项目代码已上传到 GitHub 仓库。

## 1. 上传代码到 GitHub

1. 打开 GitHub，新建一个仓库，例如 `zeora-logbook`。
2. 把项目文件推送到仓库。
3. 确保不上传以下文件：
   - `node_modules/`
   - `.dev.vars`
   - `.env`

需要上传的主要文件：

```txt
public/
functions/
docs/
README.md
package.json
wrangler.jsonc
PRODUCT.md
DESIGN.md
.gitignore
.dev.vars.example
```

## 2. 创建 KV Namespace

1. 登录 Cloudflare Dashboard。
2. 进入 **Workers & Pages**。
3. 左侧选择 **KV**。
4. 点击 **Create a namespace**。
5. 名称填：

```txt
LOG_KV
```

6. 点击 **Add**。

创建好后不需要手动写入数据，后台会自动读写。

## 3. 创建 Pages 项目

1. 在 Cloudflare Dashboard 进入 **Workers & Pages**。
2. 点击 **Create application**。
3. 选择 **Pages**。
4. 点击 **Connect to Git**。
5. 授权并选择你的 GitHub 仓库 `zeora-logbook`。
6. 分支选择 `main` 或你实际使用的分支。

## 4. 配置构建设置

在 **Set up builds and deployments** 页面填写：

| 设置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run check` |
| Build output directory | `public` |
| Root directory | `/` |

**重要**：Cloudflare 检测到 `wrangler.jsonc` 后，可能会自动在 **Deploy command** 里填入 `npx wrangler deploy`。**这个字段必须留空**，因为 Pages 本身会在构建完成后自动部署，不需要额外执行 wrangler 命令。

如果已经创建项目，可以按以下步骤修改：

1. 进入 Pages 项目，点击顶部 **Settings**。
2. 选择 **Build & deployment**。
3. 点击 **Configure**。
4. 填写：
   - **构建命令**：`npm run check`
   - **部署命令**：留空
   - **非生产分支部署命令**：留空
   - **路径**：`/`
5. 点击 **更新**。

然后点击 **Save and Deploy**。

> 第一次部署会失败，因为还没有绑定 KV 和环境变量，继续下一步即可。

## 5. 绑定 KV Namespace

1. 进入刚创建的 Pages 项目。
2. 点击顶部 **Settings**。
3. 左侧选择 **Functions**。
4. 找到 **KV namespace bindings**。
5. 点击 **Add binding**：

| 设置项 | 值 |
| --- | --- |
| Variable name | `LOG_KV` |
| KV namespace | 选择刚才创建的 `LOG_KV` |

6. 点击 **Save**。

## 6. 设置环境变量

1. 仍在 Pages 项目的 **Settings** 里。
2. 左侧选择 **Environment variables**。
3. 添加以下变量：

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 后台登录用户名 | `zeora` |
| `ADMIN_PASSWORD` | 后台登录密码，建议 32 位以上随机字符串 | `your-long-random-password` |
| `SITE_TITLE` | 站点标题 | `我的更新日志` |
| `SITE_DESCRIPTION` | 站点描述 | `记录 Zeora 和虾米的更新、发布与想法。` |
| `TRUST_CF_ACCESS_HEADERS` | 如果使用 Cloudflare Access 保护后台，设为 `true` | `false` |

4. 点击 **Save**。

## 7. 重新部署

1. 返回 Pages 项目主页。
2. 点击 **Deployments**。
3. 找到最新的一次部署，点击右侧三个点，选择 **Retry deployment**。

或者修改 `README.md` 的任意内容并推送到 GitHub，触发自动重新部署。

## 8. 访问网站

部署完成后，Cloudflare 会分配一个默认域名：

```txt
https://你的项目名.pages.dev
```

- 前台：`https://你的项目名.pages.dev/`
- 后台：`https://你的项目名.pages.dev/admin.html`

打开后台后输入第 6 步设置的用户名和密码即可登录。

## 可选：使用自定义域名

1. 在 Pages 项目的 **Custom domains** 里点击 **Set up a custom domain**。
2. 输入你的域名，按提示添加 DNS 记录。
3. 等待 SSL 证书自动签发。

## 可选：用 Cloudflare Access 保护后台

如果你希望后台只有你能访问：

1. 在 Cloudflare Dashboard 进入 **Access** > **Applications**。
2. 添加一个 Access 应用：
   - 保护 `https://你的项目名.pages.dev/admin.html`
   - 保护 `https://你的项目名.pages.dev/api/admin/*`
3. 添加一个 Access 策略，允许你自己的邮箱登录。
4. 在 Pages 环境变量里设置：

```txt
TRUST_CF_ACCESS_HEADERS=true
```

5. 重新部署。

## 以后更新

每次推送代码到 GitHub 的默认分支，Cloudflare Pages 会自动重新构建和部署。

## 常见问题

### 后台保存失败

检查 `LOG_KV` 是否已绑定，并确认已重新部署。

### 后台登录失败

检查 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 是否填对，注意大小写和前后空格。

### 页面样式或 JS 没更新

浏览器强制刷新（macOS 按 `Cmd + Shift + R`），或检查 Cloudflare 缓存设置。

### 部署提示 Build command 失败

`npm run check` 只做语法检查，失败通常是因为 `package.json` 里的脚本语法写错，或 Node 版本不兼容。检查 Pages 构建日志即可定位。
