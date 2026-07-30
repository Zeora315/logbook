const API_BASE = window.LOGBOOK_API_BASE || '';

function apiUrl(path) {
  return API_BASE + path;
}

const AUTHORS = {
  me: {
    id: "me",
    name: "Zeora",
    color: "#4b8fbf",
    avatar: "http://p.zeora.top/logo",
    bio: "记录 Zeora 所有项目的更新"
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
  publishedAt: "",
  links: [],
  attachments: [],
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
  deletedIds: new Set(),
  dirty: false,
  authenticated: false
};

const form = document.querySelector("#post-form");
const queue = document.querySelector("#post-queue");
const preview = document.querySelector("#preview-card");
const previewDate = document.querySelector("#preview-date");
const saveState = document.querySelector("#save-state");
const linksList = document.querySelector("#links-list");
const attachmentsList = document.querySelector("#attachments-list");
const attachmentUpload = document.querySelector("#attachment-upload");

// 编辑器内部的临时状态：链接与附件在表单外用 DOM 维护，写入时收集
let editorLinks = [];
let editorAttachments = [];
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
document.querySelector("#publish-new").addEventListener("click", () => publishNew());
document.querySelector("#clear-post").addEventListener("click", () => selectPost(""));
document.querySelector("#add-link").addEventListener("click", () => {
  editorLinks.push({ label: "", url: "" });
  renderLinksEditor();
});
document.querySelector("#add-attachment-url").addEventListener("click", () => {
  editorAttachments.push({ kind: "file", url: "", name: "", type: "" });
  renderAttachmentsEditor();
});
attachmentUpload.addEventListener("change", () => uploadAttachment(attachmentUpload));

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
    const response = await fetch(apiUrl("/api/admin/posts"), {
      headers: requestHeaders()
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || `API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    state.posts = Array.isArray(payload.posts)
      ? payload.posts.filter((post) => !state.deletedIds.has(post.id))
      : [];
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
      const statusLabel = { draft: "草稿", published: "已发布", archived: "归档" }[post.status] || post.status;
      const statusTone = { draft: "warn", published: "ok", archived: "" }[post.status] || "";
      return `
        <div class="queue-item ${post.id === state.activeId ? "is-active" : ""}" data-post-id="${escapeAttribute(post.id)}">
          <div class="queue-item-main">
            <strong>${escapeHtml(post.title || "未命名日志")}</strong>
            <small>${escapeHtml(author.name)} · ${date}</small>
          </div>
          <div class="queue-item-actions">
            <span class="queue-status" data-tone="${statusTone}">${statusLabel}</span>
            <button class="queue-edit" type="button" data-action="edit" data-post-id="${escapeAttribute(post.id)}">编辑</button>
            ${post.status !== "archived" ? `<button class="queue-archive" type="button" data-action="archive" data-post-id="${escapeAttribute(post.id)}">归档</button>` : ""}
            <button class="queue-delete" type="button" data-action="delete" data-post-id="${escapeAttribute(post.id)}">删除</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Single delegated listener on the queue container
queue.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) {
    event.stopPropagation();
    const id = button.dataset.postId;
    const action = button.dataset.action;
    if (action === "edit") {
      selectPost(id);
      switchTab("publish");
    } else if (action === "archive") {
      archiveById(id, button);
    } else if (action === "delete") {
      deleteById(id, button);
    }
    return;
  }
  // Click on the queue item itself → edit
  const item = event.target.closest("[data-post-id]");
  if (item) {
    selectPost(item.dataset.postId);
    switchTab("publish");
  }
});

async function archiveById(id, button) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  if (button) {
    button.disabled = true;
    button.textContent = "归档中…";
  }
  state.activeId = id;
  writeForm({ ...post, status: "archived" });
  await savePost();
  if (button) {
    button.disabled = false;
    button.textContent = "归档";
  }
}

async function deleteById(id, button) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  const ok = window.confirm(`确定要删除《${post.title || "未命名日志"}》吗？删除后不会再出现在后台和前台。`);
  if (!ok) return;

  if (button) {
    button.disabled = true;
    button.textContent = "删除中…";
  }
  setSaveState("正在删除...", "busy");
  try {
    const response = await fetch(apiUrl(`/api/admin/posts/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: requestHeaders()
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `API returned ${response.status}`);

    const deletedIds = Array.isArray(payload.deletedIds) && payload.deletedIds.length ? payload.deletedIds : [id];
    deletedIds.forEach((deletedId) => state.deletedIds.add(deletedId));
    state.posts = state.posts.filter((item) => !state.deletedIds.has(item.id));
    if (state.deletedIds.has(state.activeId)) {
      state.activeId = "";
      writeForm(EMPTY_POST);
      renderPreview(EMPTY_POST);
    }
    renderQueue();
    await loadAdminPosts();
    setSaveState("已删除", "ok");
  } catch (error) {
    const message = error instanceof SyntaxError ? "静态预览不能删除，部署到 Cloudflare 后可用。" : `删除失败：${error.message}`;
    setSaveState(message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "删除";
    }
  }
}

function selectPost(id) {
  state.activeId = id || "";
  state.dirty = false;
  const post = state.posts.find((item) => item.id === id) || EMPTY_POST;
  editorLinks = JSON.parse(JSON.stringify(post.links || []));
  editorAttachments = JSON.parse(JSON.stringify(post.attachments || []));
  writeForm(post);
  renderLinksEditor();
  renderAttachmentsEditor();
  renderPreview(post);
  renderQueue();
  setSaveState(id ? "已载入" : "新草稿", "ok");
}

async function publishNow() {
  form.elements.status.value = "published";
  await savePost();
}

// 发布当前说说后立即新建一条空白草稿，便于连续发布多条而不互相覆盖
async function publishNew() {
  form.elements.status.value = "published";
  const ok = await savePost();
  if (ok) selectPost("");
}

function writeForm(post) {
  form.elements.title.value = post.title || "";
  form.elements.slug.value = post.slug || "";
  form.elements.summary.value = post.summary || "";
  form.elements.tags.value = (post.tags || []).join(", ");
  form.elements.status.value = post.status || "draft";
  form.elements.body.value = post.body || "";
  form.elements.publishedAt.value = toDatetimeLocal(post.publishedAt);
  const author = post.authorId || "me";
  form.querySelectorAll("input[name='authorId']").forEach((input) => {
    input.checked = input.value === author;
  });
}

// ISO -> datetime-local 控件需要的 yyyy-MM-ddTHH:mm
function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// datetime-local -> ISO 字串
function fromDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function readForm() {
  const formData = new FormData(form);
  // 收集编辑器中当前输入的链接/附件（含未提交的输入框值）
  collectEditorInputs();
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
    body: String(formData.get("body") || "").trim(),
    publishedAt: fromDatetimeLocal(String(formData.get("publishedAt") || "")),
    links: editorLinks.filter((l) => l.url),
    attachments: editorAttachments.filter((a) => a.url)
  };
}

// 渲染底部链接编辑器
function renderLinksEditor() {
  if (!linksList) return;
  linksList.innerHTML = editorLinks.map((link, index) => `
    <div class="repeatable-row" data-index="${index}">
      <input class="rep-label" placeholder="链接名称（如 GitHub 仓库）" value="${escapeAttribute(link.label || "")}" />
      <input class="rep-url" placeholder="https://github.com/..." value="${escapeAttribute(link.url || "")}" />
      <button class="ghost-button small-button rep-remove" type="button">删除</button>
    </div>
  `).join("");
}

// 渲染附件编辑器
function renderAttachmentsEditor() {
  if (!attachmentsList) return;
  attachmentsList.innerHTML = editorAttachments.map((item, index) => {
    const isImage = item.kind === "image" || /^image\//i.test(item.type || "");
    const icon = isImage ? "🖼" : "📄";
    return `
    <div class="repeatable-row" data-index="${index}">
      <span class="rep-kind" title="${escapeAttribute(item.type || "")}">${icon}</span>
      <input class="rep-url" placeholder="https://... 或上传后的文件地址" value="${escapeAttribute(item.url || "")}" />
      <input class="rep-name" placeholder="名称（可选）" value="${escapeAttribute(item.name || "")}" />
      <button class="ghost-button small-button rep-remove" type="button">删除</button>
    </div>`;
  }).join("");
}

// 从 DOM 输入框收集当前值回 editorLinks/editorAttachments
function collectEditorInputs() {
  linksList.querySelectorAll(".repeatable-row").forEach((row, index) => {
    if (!editorLinks[index]) editorLinks[index] = { label: "", url: "" };
    editorLinks[index].label = row.querySelector(".rep-label").value.trim();
    editorLinks[index].url = row.querySelector(".rep-url").value.trim();
  });
  attachmentsList.querySelectorAll(".repeatable-row").forEach((row, index) => {
    if (!editorAttachments[index]) editorAttachments[index] = { kind: "file", url: "", name: "", type: "" };
    editorAttachments[index].url = row.querySelector(".rep-url").value.trim();
    editorAttachments[index].name = row.querySelector(".rep-name").value.trim();
  });
}

// 链接/附件行的事件代理：删除、输入更新预览
linksList.addEventListener("click", (event) => {
  const btn = event.target.closest(".rep-remove");
  if (!btn) return;
  const row = btn.closest(".repeatable-row");
  const index = Number(row.dataset.index);
  editorLinks.splice(index, 1);
  renderLinksEditor();
  renderPreview(readForm());
});
linksList.addEventListener("input", () => {
  renderPreview(readForm());
});
attachmentsList.addEventListener("click", (event) => {
  const btn = event.target.closest(".rep-remove");
  if (!btn) return;
  const row = btn.closest(".repeatable-row");
  const index = Number(row.dataset.index);
  editorAttachments.splice(index, 1);
  renderAttachmentsEditor();
  renderPreview(readForm());
});
attachmentsList.addEventListener("input", () => {
  renderPreview(readForm());
});

// 上传文件到后端，返回附件对象后加入编辑器
async function uploadAttachment(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!hasCredentials()) {
    setSaveState("请先登录后再上传附件。", "error");
    input.value = "";
    return;
  }
  setSaveState("正在上传...", "busy");
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(apiUrl("/api/admin/upload"), {
      method: "POST",
      headers: requestHeaders(),
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `API returned ${response.status}`);
    const a = payload.attachment;
    editorAttachments.push({
      kind: a.kind,
      url: a.url,
      name: a.name,
      type: a.type,
      size: a.size
    });
    renderAttachmentsEditor();
    renderPreview(readForm());
    setSaveState("附件已上传", "ok");
  } catch (error) {
    const message = error instanceof SyntaxError ? "静态预览不能上传，部署到 Cloudflare 后可用。" : `上传失败：${error.message}`;
    setSaveState(message, "error");
  } finally {
    input.value = "";
  }
}

async function savePost() {
  const post = readForm();
  if (!post.title || !post.body) {
    setSaveState("标题和正文必填。", "error");
    return false;
  }

  const wasNew = !state.activeId;
  const endpoint = wasNew ? apiUrl("/api/admin/posts") : apiUrl(`/api/admin/posts/${encodeURIComponent(state.activeId)}`);
  setSaveState("正在保存...", "busy");
  try {
    const response = await fetch(endpoint, {
      method: wasNew ? "POST" : "PUT",
      headers: {
        ...requestHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(post)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `API returned ${response.status}`);

    state.deletedIds.delete(payload.post.id);
    state.dirty = false;
    await loadAdminPosts();

    if (wasNew) {
      selectPost("");
      setSaveState("已保存，新草稿已准备好", "ok");
      return true;
    }

    state.activeId = payload.post.id;
    const saved = state.posts.find((item) => item.id === state.activeId) || payload.post;
    editorLinks = JSON.parse(JSON.stringify(saved.links || []));
    editorAttachments = JSON.parse(JSON.stringify(saved.attachments || []));
    writeForm(saved);
    renderLinksEditor();
    renderAttachmentsEditor();
    renderPreview(saved);
    setSaveState("已保存", "ok");
    return true;
  } catch (error) {
    const message = error instanceof SyntaxError ? "静态预览不能保存，部署到 Cloudflare 后可用。" : `保存失败：${error.message}`;
    setSaveState(message, "error");
    return false;
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
      ${renderPreviewLinks(post)}
      ${renderPreviewAttachments(post)}
    </div>
  `;
}

function renderPreviewLinks(post) {
  const links = (post.links || []).filter((l) => l.url);
  if (!links.length) return "";
  return `<div class="log-links">${links.map((l) => `<a class="log-link" href="${escapeAttribute(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || l.url)}</a>`).join("")}</div>`;
}

function renderPreviewAttachments(post) {
  const items = (post.attachments || []).filter((a) => a.url);
  if (!items.length) return "";
  const images = items.filter((a) => a.kind === "image" || /^image\//i.test(a.type || ""));
  const files = items.filter((a) => !(a.kind === "image" || /^image\//i.test(a.type || "")));
  let html = "";
  if (images.length) html += `<div class="log-gallery">${images.map((a) => `<a class="log-gallery-item" href="${escapeAttribute(resolveAssetUrl(a.url))}" target="_blank" rel="noopener noreferrer"><img src="${escapeAttribute(resolveAssetUrl(a.url))}" alt="${escapeHtml(a.alt || a.name || "")}" loading="lazy" /></a>`).join("")}</div>`;
  if (files.length) html += `<div class="log-files">${files.map((a) => `<a class="log-file" href="${escapeAttribute(resolveAssetUrl(a.url))}" target="_blank" rel="noopener noreferrer">📄 ${escapeHtml(a.name || "附件")}</a>`).join("")}</div>`;
  return html ? `<div class="log-attachments"><span class="log-attachments-label">附件</span>${html}</div>` : "";
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return apiUrl(url);
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
