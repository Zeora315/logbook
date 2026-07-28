const API_BASE = window.LOGBOOK_API_BASE || '';

function apiUrl(path) {
  return API_BASE + path;
}

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

const SAMPLE_POSTS = [
  {
    id: "sample-xiami",
    title: "更新",
    slug: "xiami-author-mode",
    authorId: "openclaw",
    status: "published",
    tags: ["admin", "xiami"],
    summary: "",
    body: "后台现在可以在 Zeora 和虾米两个发布身份之间切换。\n- 新增作者切换\n- 支持草稿和发布状态\n- 前台展示标签和总发布数",
    publishedAt: "2026-07-26T12:10:00+08:00",
    updatedAt: "2026-07-26T12:10:00+08:00"
  },
  {
    id: "sample-first-log",
    title: "更新",
    slug: "logbook-initialized",
    authorId: "me",
    status: "published",
    tags: ["site", "kv"],
    summary: "",
    body: "第一版站点采用 Cloudflare Pages Functions 和 KV 存储。\n前台读取已发布索引，后台负责写入正文、slug、revision 和 audit 记录。",
    publishedAt: "2026-07-26T11:40:00+08:00",
    updatedAt: "2026-07-26T11:40:00+08:00"
  }
];

const state = {
  posts: [],
  tag: ""
};

const hero = document.querySelector("#tag-hero");
const nameEl = document.querySelector("#tag-name");
const countEl = document.querySelector("#tag-count");
const postsEl = document.querySelector("#tag-posts");
const notice = document.querySelector("#tag-notice");
let noticeTimer = 0;

loadConfig();
init();

function loadConfig() {
  const avatarMe = localStorage.getItem("logbook-config-avatar-me");
  const avatarOpenclaw = localStorage.getItem("logbook-config-avatar-openclaw");
  if (avatarMe) AUTHORS.me.avatar = avatarMe;
  if (avatarOpenclaw) AUTHORS.openclaw.avatar = avatarOpenclaw;
}

function init() {
  const params = new URLSearchParams(window.location.search);
  state.tag = params.get("tag") || "";

  if (!state.tag) {
    renderEmpty();
    return;
  }

  renderHero();
  loadPosts();
}

function renderHero() {
  document.title = `#${state.tag} - 我的更新日志`;
  nameEl.textContent = state.tag;
}

async function loadPosts() {
  setNotice("正在读取日志...", false);
  try {
    const response = await fetch(apiUrl("/api/posts"), { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const payload = await response.json();
    state.posts = Array.isArray(payload.posts) ? payload.posts : [];
    setNotice("", true);
  } catch (error) {
    state.posts = SAMPLE_POSTS;
    setNotice("暂时没有连上 KV API，正在显示本地示例内容。", false);
  }
  render();
}

function render() {
  const posts = state.posts
    .filter((post) => (post.tags || []).includes(state.tag))
    .sort(sortPosts);

  countEl.textContent = `${posts.length} 篇更新`;

  if (!posts.length) {
    postsEl.innerHTML = `<div class="empty-state">还没有 #${escapeHtml(state.tag)} 相关的更新。</div>`;
  } else {
    postsEl.innerHTML = posts.map(renderPostCard).join("");
  }

  const shared = window.logbook || {};
  if (shared.state) shared.state.posts = state.posts;
  if (shared.renderTagList) shared.renderTagList(state.posts);
  if (shared.renderStats) shared.renderStats(state.posts);
  if (shared.renderCalendar) shared.renderCalendar(state.posts);
}

function renderPostCard(post) {
  const author = AUTHORS[post.authorId] || AUTHORS.me;
  const time = formatTimeAgo(post.publishedAt || post.updatedAt || post.createdAt);
  const tags = (post.tags || []).slice(0, 1).map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("");
  const avatarHtml = author.avatar
    ? `<img class="log-avatar" src="${escapeAttribute(author.avatar)}" alt="${escapeHtml(author.name)}" onerror="this.replaceWith(this.nextElementSibling);this.remove()" /><span class="initials" hidden>${escapeHtml(author.name.slice(0, 1))}</span>`
    : `<span class="initials">${escapeHtml(author.name.slice(0, 1))}</span>`;

  return `
    <article class="log-card" id="${escapeAttribute(post.slug || post.id)}" style="--author-color: ${author.color}">
      <div class="log-card-inner">
        <header class="log-header">
          <a class="log-author" href="/author.html?id=${escapeAttribute(author.id)}">
            ${avatarHtml}
            <span>${escapeHtml(author.name)}</span>
          </a>
          <time datetime="${escapeAttribute(post.publishedAt || post.updatedAt || "")}">${time}</time>
        </header>
        <div class="log-title-row">
          ${tags}
          <h3>${escapeHtml(post.title || "更新")}</h3>
        </div>
        ${post.summary ? `<p class="log-summary">${escapeHtml(post.summary)}</p>` : ""}
        <div class="log-body">${markdownToHtml(post.body || "")}</div>
      </div>
    </article>
  `;
}

function renderEmpty() {
  document.title = "标签 - 我的更新日志";
  nameEl.textContent = "未指定标签";
  countEl.textContent = "0 篇更新";
  postsEl.innerHTML = `<div class="empty-state">请在 URL 中指定标签，例如 ?tag=site。</div>`;
}

function setNotice(message, autoHide) {
  if (!notice) return;
  window.clearTimeout(noticeTimer);
  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }
  notice.hidden = false;
  notice.textContent = message;
  noticeTimer = window.setTimeout(() => {
    notice.hidden = true;
    notice.textContent = "";
  }, autoHide ? 1800 : 5000);
}

function sortPosts(a, b) {
  const left = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || 0);
  const right = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || 0);
  return right - left;
}

function formatTimeAgo(value) {
  if (!value) return "未发布";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

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
