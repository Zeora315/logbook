const AUTHORS = {
  me: {
    id: "me",
    name: "Zeora",
    color: "#4b8fbf",
    avatar: "",
    bio: "记录 Zeora 和虾米的更新、发布、修复和小型里程碑。"
  },
  openclaw: {
    id: "openclaw",
    name: "虾米",
    color: "#ee8f43",
    avatar: "",
    bio: ""
  }
};

const EMPTY_POST = {
  id: "",
  title: "",
  slug: "",
  authorId: "me",
  status: "draft",
  tags: [],
  summary: "",
  body: "",
  createdAt: "",
  updatedAt: ""
};

const SAMPLE_ADMIN_POSTS = [
  {
    id: "sample-xiami",
    title: "虾米获得独立发布身份",
    slug: "xiami-author-mode",
    authorId: "openclaw",
    status: "published",
    tags: ["admin", "xiami"],
    summary: "后台现在可以在 Zeora 和虾米两个发布身份之间切换。",
    body: "- 新增作者切换\n- 支持草稿和发布状态\n- 前台展示标签和总发布数",
    publishedAt: "2026-07-26T12:10:00+08:00",
    updatedAt: "2026-07-26T12:10:00+08:00"
  },
  {
    id: "sample-draft",
    title: "下一次更新草稿",
    slug: "next-dispatch",
    authorId: "me",
    status: "draft",
    tags: ["draft", "site"],
    summary: "这是静态预览里的示例草稿，用来展示后台队列和预览效果。",
    body: "部署到 Cloudflare 后，这里会显示 KV 里的真实日志。",
    createdAt: "2026-07-27T00:34:00+08:00",
    updatedAt: "2026-07-27T00:34:00+08:00"
  }
];

const CONFIG_KEYS = {
  greeting: "logbook-config-greeting",
  avatarMe: "logbook-config-avatar-me",
  avatarOpenclaw: "logbook-config-avatar-openclaw",
  linkHome: "logbook-config-link-home",
  linkBlog: "logbook-config-link-blog"
};

const state = {
  posts: [],
  activeId: "",
  dirty: false,
  authenticated: false
};

const form = document.querySelector("#post-form");
const queue = document.querySelector("#post-queue");
const preview = document.querySelector("#preview-card");
const previewDate = document.querySelector("#preview-date");
const saveState = document.querySelector("#save-state");
const loginPanel = document.querySelector("#login-panel");
const adminApp = document.querySelector("#admin-app");
const loginForm = document.querySelector("#login-form");
const loginState = document.querySelector("#login-state");
const usernameInput = document.querySelector("#admin-username");
const passwordInput = document.querySelector("#admin-password");
const configForm = document.querySelector("#config-form");
const configState = document.querySelector("#config-state");

usernameInput.value = localStorage.getItem("logbook-admin-username") || "";
passwordInput.value = sessionStorage.getItem("logbook-admin-password") || "";

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistCredentials();
  loginState.textContent = "正在登录...";
  loginState.dataset.tone = "busy";
  await loadAdminPosts({ fromLogin: true });
});

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.querySelector("#logout-btn").addEventListener("click", logout);
document.querySelector("#reload-admin").addEventListener("click", loadAdminPosts);
document.querySelector("#publish-now").addEventListener("click", () => publishNow());
document.querySelector("#clear-post").addEventListener("click", () => selectPost(""));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await savePost();
});

form.addEventListener("input", () => {
  state.dirty = true;
  setSaveState("有未保存修改", "warn");
  renderPreview(readForm());
});

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(configForm);
  localStorage.setItem(CONFIG_KEYS.greeting, String(data.get("greeting") || "").trim());
  localStorage.setItem(CONFIG_KEYS.avatarMe, String(data.get("avatarMe") || "").trim());
  localStorage.setItem(CONFIG_KEYS.avatarOpenclaw, String(data.get("avatarOpenclaw") || "").trim());
  localStorage.setItem(CONFIG_KEYS.linkHome, String(data.get("linkHome") || "").trim());
  localStorage.setItem(CONFIG_KEYS.linkBlog, String(data.get("linkBlog") || "").trim());
  configState.textContent = "已保存";
  configState.dataset.tone = "ok";
});

configForm.addEventListener("input", () => {
  configState.textContent = "有未保存修改";
  configState.dataset.tone = "warn";
});

if (usernameInput.value && passwordInput.value) {
  loadAdminPosts({ fromLogin: true });
}

function loadConfig() {
  document.querySelector("#config-greeting").value = localStorage.getItem(CONFIG_KEYS.greeting) || "";
  document.querySelector("#config-avatar-me").value = localStorage.getItem(CONFIG_KEYS.avatarMe) || "";
  document.querySelector("#config-avatar-openclaw").value = localStorage.getItem(CONFIG_KEYS.avatarOpenclaw) || "";
  document.querySelector("#config-link-home").value = localStorage.getItem(CONFIG_KEYS.linkHome) || "";
  document.querySelector("#config-link-blog").value = localStorage.getItem(CONFIG_KEYS.linkBlog) || "";
}

function switchTab(name) {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".admin-tabpanel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `tab-${name}`);
  });
  if (name === "manage") renderQueue();
  if (name === "config") loadConfig();
}

async function loadAdminPosts({ fromLogin = false } = {}) {
  if (!hasCredentials()) {
    setAdminVisible(false);
    loginState.textContent = "请输入用户名和密码。";
    loginState.dataset.tone = "warn";
    return false;
  }

  setSaveState("正在读取队列...", "busy");
  try {
    const response = await fetch("/api/admin/posts", {
      headers: requestHeaders()
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || `API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    state.posts = Array.isArray(payload.posts) ? payload.posts : [];
    state.authenticated = true;
    setAdminVisible(true);
    renderQueue();
    setSaveState("队列已同步", "ok");
    loginState.textContent = "登录成功";
    loginState.dataset.tone = "ok";
    if (fromLogin && !state.activeId) selectPost("");
    loadConfig();
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      state.authenticated = false;
      setAdminVisible(false);
      loginState.textContent = "登录失败，请检查用户名和密码。";
      loginState.dataset.tone = "error";
      return false;
    }
    state.posts = SAMPLE_ADMIN_POSTS;
    state.authenticated = true;
    setAdminVisible(true);
    renderQueue();
    if (!state.activeId) {
      selectPost("");
    }
    setSaveState("静态预览：正在显示示例队列", "warn");
    loginState.textContent = "静态预览";
    loginState.dataset.tone = "warn";
    loadConfig();
    return true;
  }
}

function logout() {
  sessionStorage.removeItem("logbook-admin-password");
  state.authenticated = false;
  state.posts = [];
  state.activeId = "";
  passwordInput.value = "";
  setAdminVisible(false);
  loginState.textContent = "已退出登录";
  loginState.dataset.tone = "ok";
}

function renderQueue(errorMessage = "") {
  if (errorMessage) {
    queue.innerHTML = `<div class="empty-state">${escapeHtml(errorMessage)}</div>`;
    return;
  }

  const posts = [...state.posts].sort(sortPosts);

  if (!posts.length) {
    queue.innerHTML = `<div class="empty-state">还没有日志。</div>`;
    return;
  }

  queue.innerHTML = posts
    .map((post) => {
      const author = AUTHORS[post.authorId] || AUTHORS.me;
      const date = formatDate(post.publishedAt || post.updatedAt || post.createdAt);
      return `
        <div class="queue-item ${post.id === state.activeId ? "is-active" : ""}" data-id="${escapeAttribute(post.id)}">
          <div class="queue-item-main">
            <strong>${escapeHtml(post.title || "未命名日志")}</strong>
            <small>${escapeHtml(author.name)} / ${escapeHtml(post.status || "draft")} / ${date}</small>
          </div>
          <div class="queue-item-actions">
            <button class="queue-edit" type="button" data-id="${escapeAttribute(post.id)}">编辑</button>
            ${post.status !== "archived" ? `<button class="queue-archive" type="button" data-id="${escapeAttribute(post.id)}">归档</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  queue.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = el.dataset.id;
      if (el.classList.contains("queue-archive")) {
        archiveById(id);
      } else {
        selectPost(id);
        switchTab("publish");
      }
    });
  });
}

async function archiveById(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  state.activeId = id;
  writeForm({ ...post, status: "archived" });
  await savePost();
}

function selectPost(id) {
  state.activeId = id || "";
  state.dirty = false;
  const post = state.posts.find((item) => item.id === id) || EMPTY_POST;
  writeForm(post);
  renderPreview(post);
  renderQueue();
  setSaveState(id ? "已载入" : "新草稿", "ok");
}

function publishNow() {
  form.elements.status.value = "published";
  savePost();
}

function writeForm(post) {
  form.elements.title.value = post.title || "";
  form.elements.slug.value = post.slug || "";
  form.elements.summary.value = post.summary || "";
  form.elements.tags.value = (post.tags || []).join(", ");
  form.elements.status.value = post.status || "draft";
  form.elements.body.value = post.body || "";
  const author = post.authorId || "me";
  form.querySelectorAll("input[name='authorId']").forEach((input) => {
    input.checked = input.value === author;
  });
}

function readForm() {
  const formData = new FormData(form);
  return {
    id: state.activeId,
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim(),
    authorId: String(formData.get("authorId") || "me"),
    status: String(formData.get("status") || "draft"),
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    summary: String(formData.get("summary") || "").trim(),
    body: String(formData.get("body") || "").trim()
  };
}

async function savePost() {
  const post = readForm();
  if (!post.title || !post.body) {
    setSaveState("标题和正文必填。", "error");
    return;
  }

  setSaveState("正在保存...", "busy");
  try {
    const response = await fetch(state.activeId ? `/api/admin/posts/${encodeURIComponent(state.activeId)}` : "/api/admin/posts", {
      method: state.activeId ? "PUT" : "POST",
      headers: {
        ...requestHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(post)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `API returned ${response.status}`);

    state.activeId = payload.post.id;
    state.dirty = false;
    await loadAdminPosts();
    const saved = state.posts.find((item) => item.id === state.activeId) || payload.post;
    writeForm(saved);
    renderPreview(saved);
    setSaveState("已保存", "ok");
  } catch (error) {
    const message = error instanceof SyntaxError ? "静态预览不能保存，部署到 Cloudflare 后可用。" : `保存失败：${error.message}`;
    setSaveState(message, "error");
  }
}

function renderPreview(post) {
  const author = AUTHORS[post.authorId] || AUTHORS.me;
  const tags = (post.tags || []).map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("");
  preview.style.setProperty("--author-color", author.color);
  previewDate.textContent = formatDate(post.publishedAt || post.updatedAt || new Date().toISOString());
  preview.innerHTML = `
    <div class="log-card-inner">
      <div class="log-header">
        <span class="log-author">
          <span class="initials">${escapeHtml(author.name.slice(0, 1))}</span>
          <span>${escapeHtml(author.name)}</span>
        </span>
        <time>${formatDate(post.publishedAt || post.updatedAt || new Date().toISOString())}</time>
      </div>
      <div class="log-title-row">
        ${tags}
        <h3>${escapeHtml(post.title || "未命名日志")}</h3>
      </div>
      ${post.summary ? `<p class="log-summary">${escapeHtml(post.summary)}</p>` : ""}
      <div class="log-body">${markdownToHtml(post.body || "正文会在这里预览。")}</div>
    </div>
  `;
}

function requestHeaders() {
  const headers = { accept: "application/json" };
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (username && password) headers.authorization = `Basic ${encodeBasicAuth(username, password)}`;
  return headers;
}

function persistCredentials() {
  const username = usernameInput.value.trim();
  localStorage.setItem("logbook-admin-username", username);
  sessionStorage.setItem("logbook-admin-password", passwordInput.value);
}

function hasCredentials() {
  return Boolean(usernameInput.value.trim() && passwordInput.value);
}

function setAdminVisible(visible) {
  loginPanel.hidden = visible;
  adminApp.hidden = !visible;
}

function encodeBasicAuth(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function setSaveState(message, tone) {
  saveState.textContent = message;
  saveState.dataset.tone = tone;
}

function sortPosts(a, b) {
  const left = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || 0);
  const right = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || 0);
  return right - left;
}

function formatDate(value) {
  if (!value) return "Draft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function markdownToHtml(source) {
  const lines = escapeHtml(source).split(/\r?\n/);
  const html = [];
  let listOpen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      continue;
    }
    if (line.startsWith("### ")) {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      html.push(`<h2>${inlineMarkdown(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  if (listOpen) html.push("</ul>");
  return html.join("");
}

function inlineMarkdown(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
