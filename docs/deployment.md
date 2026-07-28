# 部署到 Cloudflare Pages

这份文档教你如何通过 Cloudflare 网页后台部署这个项目，不需要在本地执行 wrangler 命令。

## 准备

- Cloudflare 账号（免费版即可）。
- GitHub 账号。
- 本项目代码已上传到 GitHub 仓库。

## 1. 上传代码到 GitHub

1. 打开 GitHub，新建一个仓库，例如 `logbook`。
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
5. 授权并选择你的 GitHub 仓库 `logbook`。
6. 分支选择 `main` 或你实际使用的分支。
7. Pages 项目名称建议填 `logbook`。

> 这个项目的 `wrangler.jsonc` 已经写了 `"name": "logbook"`。Cloudflare Pages 的项目名称也必须是 `logbook`，否则 Wrangler v3.109.0+ / v4 会在构建后提示配置不一致，甚至自动尝试生成修复 PR。

> 一定要创建 **Pages** 项目，不要创建 **Worker** 项目。浏览器地址如果是 `/workers/services/view/logbook/...`，说明当前打开的是 Worker 项目。这个仓库的 `public/` 和 `functions/` 会由 Pages 一起部署，不需要单独创建 Worker。

## 4. 配置构建设置

在 **Set up builds and deployments** 页面填写：

| 设置项 | 值 |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run check` |
| Build output directory | `public` |
| Root directory | `/` |

Pages 的 Git 部署界面通常只要求 **Build command** 和 **Build output directory**。如果你现在看到的就是这两个输入框，这是正常的。

同时确认仓库里的 `wrangler.jsonc` 与 Cloudflare Pages 项目名一致：

```jsonc
{
  "name": "logbook",
  "pages_build_output_dir": "public"
}
```

这里有两个容易混淆的名字：

- `package.json` 里的 `"name": "zeora-logbook"` 只是 npm 包名，不影响 Cloudflare Pages 部署。
- `wrangler.jsonc` 里的 `"name": "logbook"` 是 Cloudflare Pages 项目名，必须和 Cloudflare 控制台里的 Pages 项目名称一致。

如果已经创建项目，可以按以下步骤修改：

1. 进入 Pages 项目，点击顶部 **Settings**。
2. 选择 **Build & deployment**。
3. 点击 **Configure**。
4. 填写：
   - **构建命令**：`npm run check`
   - **构建输出目录**：`public`
   - **路径**：`/`
5. 点击 **更新**。

然后点击 **Save and Deploy**。

> 如果还没有绑定 KV 或设置后台用户名密码，第一次部署可能会失败。先继续完成下面的 KV 和环境变量配置，再重新部署。

### 如果提示 wrangler.jsonc 配置不一致

如果部署日志里出现类似提示：

```txt
请更新您的存储库中的 wrangler.jsonc，以保持一致的设置
// wrangler.jsonc
"name": "logbook"
```

按下面检查：

1. 打开 Cloudflare Pages 项目，确认项目名称是 `logbook`。
2. 确认 `wrangler.jsonc` 里是：

```jsonc
"name": "logbook"
```

3. 确认 Pages 构建设置里：
   - **构建命令**：`npm run check`
   - **构建输出目录**：`public`
4. 提交并推送代码后重新部署。

如果你想把 Pages 项目改成别的名字，也可以，但必须同时改三处：

- Cloudflare Pages 项目名称。
- `wrangler.jsonc` 里的 `"name"`。
- 本地手动部署命令里的 `--project-name`。

### 手动部署时提示 Authentication error [code: 10000]

如果你在本地或 Cloudflare 自定义构建流程里手动执行 `npx wrangler pages deploy public --project-name logbook`，Wrangler 会读取 `CLOUDFLARE_API_TOKEN`。如果这个 token 没有 **Cloudflare Pages:Edit** 权限，就会报：

```txt
✘ [ERROR] A request to the Cloudflare API (/accounts/.../pages/projects/...) failed.
  Authentication error [code: 10000]
```

日志里通常还会出现：

```txt
It looks like you are authenticating Wrangler via a custom API token set in an environment variable.
The API Token is read from the CLOUDFLARE_API_TOKEN environment variable.
```

这里的 `CLOUDFLARE_API_TOKEN` 是 **Wrangler 手动部署用的 API Token**，不是后台登录用的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`，也不是上面运行时 **变量和密钥** 表格里的普通变量。

如果你使用的是标准 Pages Git 部署，而且页面只要求填写 **构建命令** 和 **构建输出目录**，通常不需要配置这个 token。

解决方法一：修正当前构建 token

1. 进入 Cloudflare 项目：**Workers 和 Pages** > `logbook` > **设置**。
2. 滚动到 **构建** 区域。
3. 找到 **API 令牌**，例如 `logbook build token`，点击 **编辑**。
4. 打开 token 管理页后，确认它至少有这些权限：
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Account Settings** > **Read**
5. 确认账号资源范围包含当前账号 `Huanhuan3156@163.com's Account`，不要选到别的账号。
6. 保存 token。
7. 回到 Pages 项目，重新部署一次。

解决方法二：新建一个专用 token

1. 打开 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)。
2. 点击 **Create Token**。
3. 选择 **Custom token**。
4. 权限填写：
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Account Settings** > **Read**
5. 账号资源选择当前账号 `Huanhuan3156@163.com's Account`。
6. 创建后复制 token。
7. 回到 `logbook` 项目 **设置** > **构建** > **API 令牌**，把它换成新 token。
8. 重新部署。

如果之后不再报 `Authentication error`，但改成 KV 相关错误，再检查 `LOG_KV` 是否绑定到 Pages Functions。

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

### 部署提示 Pages project "logbook" does not exist

如果构建日志里出现：

```txt
The Pages project "logbook" does not exist.
If you are targeting an existing Pages project, verify that the project name is correct and that it exists in your account.
```

说明当前账号里没有名为 `logbook` 的 **Pages 项目**。常见原因是误创建了 **Worker 项目**。Cloudflare 控制台里 Worker 和 Pages 都在 **Workers 和 Pages** 入口下，但项目类型不同。

按下面检查：

1. 看浏览器地址：
   - 如果包含 `/workers/services/view/logbook/...`，这是 Worker 项目。
   - Pages 项目应在 Pages 项目列表里，部署域名通常是 `项目名.pages.dev`。
2. 进入 **Workers 和 Pages**，点击 **Create application**。
3. 选择 **Pages**，再选择 **Connect to Git**。
4. 选择 GitHub 仓库 `Zeora315/logbook`。
5. Pages 项目名称填 `logbook`。
6. 按第 4 节重新填写构建设置。
7. 重新绑定 `LOG_KV`，并设置 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 等环境变量。
8. 重新部署。

如果 Cloudflare 不允许再创建名为 `logbook` 的 Pages 项目，可以改用另一个 Pages 项目名，例如 `zeora-logbook`，但必须同步修改三处：

- Cloudflare Pages 项目名称。
- `wrangler.jsonc` 里的 `"name"`。
- 本地手动部署命令里的 `--project-name`。

### 部署提示 Invalid KV namespace ID

如果构建日志里出现：

```txt
Invalid KV namespace ID (replace-with-production-kv-namespace-id). Not a valid hex string.
```

说明仓库里的 `wrangler.jsonc` 还保留了示例占位符。Pages 会把它当成真实 KV ID 校验，所以部署会失败。

推荐处理方式：

1. 删除 `wrangler.jsonc` 里的 `kv_namespaces` 占位符配置。
2. 在 Cloudflare Dashboard 的 **Pages 项目** > **Settings** > **Functions** > **KV namespace bindings** 里添加绑定：
   - Variable name：`LOG_KV`
   - KV namespace：选择你创建的 `LOG_KV`
3. 重新部署。

如果你想完全用 `wrangler.jsonc` 管理 KV，也可以保留 `kv_namespaces`，但必须把 `id` / `preview_id` 换成 Cloudflare 生成的真实十六进制 namespace ID，不能使用 `replace-with-...` 占位符。
