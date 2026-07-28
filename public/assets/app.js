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

const SITE = {
  ownerId: "me",
  greeting: "欢迎再次回来，Zeora"
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
  calendarDate: new Date()
};

const stream = document.querySelector("#log-stream");
const tagList = document.querySelector("#tag-list");
const authorList = document.querySelector("#author-list");
const statCount = document.querySelector("#stat-count");
const statTags = document.querySelector("#stat-tags");
const statLast = document.querySelector("#stat-last");
const notice = document.querySelector("#public-notice");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const openLeftBtn = document.querySelector("#open-left");
const openRightBtn = document.querySelector("#open-right");
const calendarMonth = document.querySelector("#calendar-month");
const calendarGrid = document.querySelector("#calendar-grid");
const profileAvatarImg = document.querySelector("#profile-avatar-img");
const profileName = document.querySelector("#profile-name");
const drawerMedia = window.matchMedia("(max-width: 760px)");
let noticeTimer = 0;

openLeftBtn?.addEventListener("click", () => openDrawer("left"));
openRightBtn?.addEventListener("click", () => openDrawer("right"));
drawerBackdrop?.addEventListener("click", () => closeDrawers());

document.querySelector("#calendar-prev")?.addEventListener("click", () => shiftCalendar(-1));
document.querySelector("#calendar-next")?.addEventListener("click", () => shiftCalendar(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawers();
});

drawerMedia.addEventListener("change", () => {
  closeDrawers();
});

const isPublicPage = document.body.dataset.page === "public";
loadConfig();
initProfile();
syncAuthorSwitch();
closeDrawers();
if (isPublicPage) loadPosts();

window.logbook = {
  AUTHORS,
  SITE,
  state,
  renderTagList,
  renderStats,
  renderCalendar,
  initProfile,
  loadConfig,
  applyNavLinks,
  syncAuthorSwitch,
  renderAuthorSwitchAvatars,
  createInitialsAvatar,
  sortPosts,
  formatTimeAgo,
  formatShortDate,
  markdownToHtml,
  escapeHtml,
  escapeAttribute
};

function loadConfig() {
  const greeting = localStorage.getItem("logbook-config-greeting");
  const avatarMe = localStorage.getItem("logbook-config-avatar-me");
  const avatarOpenclaw = localStorage.getItem("logbook-config-avatar-openclaw");
  if (greeting) SITE.greeting = greeting;
  if (avatarMe) AUTHORS.me.avatar = avatarMe;
  if (avatarOpenclaw) AUTHORS.openclaw.avatar = avatarOpenclaw;

  const linkHome = localStorage.getItem("logbook-config-link-home");
  const linkBlog = localStorage.getItem("logbook-config-link-blog");
  applyNavLinks({
    home: linkHome || "https://zeora.top",
    blog: linkBlog || "https://blog.zeora.top"
  });
}

function applyNavLinks(links) {
  const map = [
    { selector: ".profile-social .social-btn", keys: ["home", "blog"] }
  ];
  map.forEach(({ selector, keys }) => {
    const items = document.querySelectorAll(selector);
    keys.forEach((key, index) => {
      const item = items[index];
      if (item && links[key]) item.href = links[key];
    });
  });
}

function initProfile() {
  const owner = AUTHORS[SITE.ownerId] || AUTHORS.me;
  if (profileName) profileName.textContent = owner.name;
  if (profileAvatarImg) {
    profileAvatarImg.src = owner.avatar || "";
    profileAvatarImg.alt = owner.name;
    profileAvatarImg.onerror = () => {
      profileAvatarImg.replaceWith(createInitialsAvatar(owner, "profile-avatar-img"));
    };
    if (!owner.avatar) {
      profileAvatarImg.replaceWith(createInitialsAvatar(owner, "profile-avatar-img"));
    }
  }
}

function syncAuthorSwitch() {
  const switches = document.querySelectorAll(".author-switch");
  if (!switches.length) return;

  renderAuthorSwitchAvatars();

  let active = "";
  if (document.body.dataset.page === "public") {
    active = "all";
  } else if (document.body.dataset.page === "author") {
    active = new URLSearchParams(window.location.search).get("id") || "me";
  }

  switches.forEach((item) => {
    const isActive = item.dataset.authorFilter === active;
    item.classList.toggle("is-active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}

function renderAuthorSwitchAvatars() {
  document.querySelectorAll("[data-author-avatar]").forEach((avatar) => {
    const author = AUTHORS[avatar.dataset.authorAvatar];
    if (!author) return;

    avatar.style.setProperty("--author-color", author.color);
    avatar.textContent = "";

    if (!author.avatar) {
      avatar.textContent = author.name.slice(0, 1);
      return;
    }

    const fallback = document.createElement("span");
    fallback.className = "initials";
    fallback.textContent = author.name.slice(0, 1);

    const image = document.createElement("img");
    image.src = author.avatar;
    image.alt = "";
    image.addEventListener("error", () => {
      image.remove();
      avatar.append(fallback);
    }, { once: true });

    avatar.append(image);
  });
}

async function loadPosts({ announce = false } = {}) {
  setNotice("正在读取最新日志...", false);
  try {
    const response = await fetch(apiUrl("/api/posts"), { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const payload = await response.json();
    state.posts = Array.isArray(payload.posts) ? payload.posts : [];
    setNotice(announce ? "日志已刷新。" : "", true);
  } catch (error) {
    state.posts = SAMPLE_POSTS;
    setNotice("暂时没有连上 KV API，正在显示本地示例内容。", false);
  }
  render();
}

function render() {
  const posts = [...state.posts].sort(sortPosts);

  statCount.textContent = String(posts.length);
  renderTagList(posts);
  renderStats(posts);
  renderCalendar(posts);

  if (!posts.length) {
    stream.innerHTML = `<div class="empty-state">还没有已发布的日志。</div>`;
    return;
  }

  stream.innerHTML = posts.map(renderPostCard).join("");
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

function renderTagList(posts) {
  const counts = new Map();
  posts.forEach((post) => {
    (post.tags || []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!tags.length) {
    tagList.innerHTML = `<span class="muted-note">暂无标签</span>`;
    return;
  }

  tagList.innerHTML = tags
    .map(([tag, count]) => `<a class="tag-chip" href="/tag.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}<small>${count}</small></a>`)
    .join("");
}

function renderAuthorList(posts) {
  const counts = new Map();
  posts.forEach((post) => {
    counts.set(post.authorId, (counts.get(post.authorId) || 0) + 1);
  });

  authorList.innerHTML = Object.values(AUTHORS)
    .map((author) => {
      const count = counts.get(author.id) || 0;
      const avatarHtml = author.avatar
        ? `<img src="${escapeAttribute(author.avatar)}" alt="${escapeHtml(author.name)}" onerror="this.replaceWith(this.nextElementSibling);this.remove()" /><span class="initials" hidden>${escapeHtml(author.name.slice(0, 1))}</span>`
        : `<span class="initials">${escapeHtml(author.name.slice(0, 1))}</span>`;
      return `
        <a href="/author.html?id=${escapeAttribute(author.id)}" style="--author-color: ${author.color}">
          ${avatarHtml}
          <span class="name">${escapeHtml(author.name)}</span>
          <span class="count">${count} 篇</span>
        </a>
      `;
    })
    .join("");
}

function openDrawer(side) {
  closeDrawers();
  document.body.classList.add(`drawer-${side}-open`);
  drawerBackdrop.hidden = false;
}

function closeDrawers() {
  document.body.classList.remove("drawer-left-open", "drawer-right-open");
  drawerBackdrop.hidden = true;
}

function shiftCalendar(delta) {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + delta);
  renderCalendar(state.posts);
}

function renderCalendar(posts) {
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  calendarMonth.textContent = `${year} 年 ${month + 1} 月`;

  const postDays = new Map();
  posts.forEach((post) => {
    const postDate = new Date(post.publishedAt || post.updatedAt || post.createdAt);
    if (Number.isNaN(postDate.getTime())) return;
    if (postDate.getFullYear() === year && postDate.getMonth() === month) {
      const day = postDate.getDate();
      postDays.set(day, (postDays.get(day) || 0) + 1);
    }
  });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dowHTML = ["日", "一", "二", "三", "四", "五", "六"]
    .map((d) => `<span class="calendar-dow">${d}</span>`)
    .join("");

  let daysHTML = "";
  for (let i = 0; i < startOffset; i++) {
    daysHTML += `<span class="calendar-day is-other"></span>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const classes = ["calendar-day"];
    if (isCurrentMonth && day === today.getDate()) classes.push("is-today");
    const count = postDays.get(day) || 0;
    if (count > 0) classes.push(`has-post-${Math.min(count, 3)}`);
    daysHTML += `<span class="${classes.join(" ")}">${day}</span>`;
  }

  calendarGrid.innerHTML = dowHTML + daysHTML;
}

function renderStats(posts) {
  statCount.textContent = String(posts.length);

  const counts = new Map();
  posts.forEach((post) => {
    (post.tags || []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  statTags.textContent = String(counts.size);

  const latest = posts[0];
  statLast.textContent = latest ? formatShortDate(latest.publishedAt || latest.updatedAt || latest.createdAt) : "—";
}

function createInitialsAvatar(author, id) {
  const span = document.createElement("span");
  span.className = "initials";
  if (id) span.id = id;
  span.textContent = author.name.slice(0, 1);
  span.style.setProperty("--author-color", author.color);
  return span;
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

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function sortPosts(a, b) {
  const left = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || 0);
  const right = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || 0);
  return right - left;
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
