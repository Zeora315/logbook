/* === 侧边栏搜索功能 === */
(function initSearch() {
  const searchBtn = document.querySelector("#sidebar-search-btn");
  const overlay = document.querySelector("#search-overlay");
  const searchInput = document.querySelector("#search-input");
  const resultsContainer = document.querySelector("#search-results");
  if (!searchBtn || !overlay || !searchInput || !resultsContainer) return;

  function openSearch() {
    overlay.hidden = false;
    searchInput.value = "";
    resultsContainer.innerHTML = '<p class="search-empty">输入关键词开始搜索</p>';
    setTimeout(() => searchInput.focus(), 60);
  }

  function closeSearch() {
    overlay.hidden = true;
    searchInput.value = "";
  }

  searchBtn.addEventListener("click", openSearch);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (overlay.hidden) openSearch(); else closeSearch();
    }
    if (e.key === "Escape" && !overlay.hidden) {
      e.preventDefault();
      closeSearch();
    }
  });

  let debounceTimer = 0;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(searchInput.value.trim()), 180);
  });

  function doSearch(query) {
    if (!query) {
      resultsContainer.innerHTML = '<p class="search-empty">输入关键词开始搜索</p>';
      return;
    }

    const q = query.toLowerCase();
    const posts = (window.logbook && window.logbook.state) ? window.logbook.state.posts : [];

    if (!posts.length) {
      resultsContainer.innerHTML = '<p class="search-empty">暂无文章可搜索</p>';
      return;
    }

    const matches = [];
    for (const post of posts) {
      const title = (post.title || "").toLowerCase();
      const body = (post.body || "").toLowerCase();
      const tags = (post.tags || []).join(" ").toLowerCase();
      const authorObj = (window.logbook && window.logbook.AUTHORS) ? window.logbook.AUTHORS[post.authorId] : null;
      const author = authorObj ? authorObj.name.toLowerCase() : "";

      if (title.includes(q) || body.includes(q) || tags.includes(q) || author.includes(q)) {
        matches.push(post);
      }
    }

    if (!matches.length) {
      resultsContainer.innerHTML = '<p class="search-no-result">未找到「' + escapeHtml(query) + '」相关结果</p>';
      return;
    }

    resultsContainer.innerHTML = matches.map((post) => {
      const authorObj = (window.logbook && window.logbook.AUTHORS) ? window.logbook.AUTHORS[post.authorId] : null;
      const authorName = authorObj ? authorObj.name : "Zeora";
      const fmt = window.logbook ? window.logbook.formatShortDate : null;
      const date = fmt ? fmt(post.publishedAt || post.updatedAt || post.createdAt) : "\u2014";
      const tagStr = (post.tags || []).slice(0, 3).map(function(t) { return "#" + escapeHtml(t); }).join("  ");
      const snippet = highlightMatch(post.body || post.summary || "", query, 120);
      const titleHtml = highlightMatch(post.title || "\u66f4\u65b0", query);
      const anchor = post.slug || post.id || "";
    
      return '<a class="search-result-item" href="#' + escapeHtml(anchor) + '" data-anchor="' + escapeHtml(anchor) + '">'
        + '<div class="search-result-title">' + titleHtml + '</div>'
        + '<div class="search-result-meta">'
        + '<span>' + escapeHtml(authorName) + '</span>'
        + '<span>' + date + '</span>'
        + (tagStr ? '<span>' + tagStr + '</span>' : '')
        + '</div>'
        + (snippet ? '<div class="search-result-snippet">' + snippet + '</div>' : '')
        + '</a>';
    }).join("");
    
    // 点击结果后关闭弹窗并滚动到文章
    resultsContainer.querySelectorAll(".search-result-item").forEach(function(item) {
      item.addEventListener("click", function(e) {
        e.preventDefault();
        var anchorId = this.getAttribute("data-anchor");
        closeSearch();
        if (anchorId) {
          var target = document.getElementById(anchorId);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            // 短暂高亮
            target.style.transition = "box-shadow 0.3s ease";
            target.style.boxShadow = "0 0 0 3px rgba(139, 112, 66, 0.35), 0 0 20px rgba(139, 112, 66, 0.15)";
            setTimeout(function() { target.style.boxShadow = ""; }, 1500);
          }
        }
      });
    });
  }

  function highlightMatch(text, query, maxLen) {
    if (!text || !query) return "";
    var plain = text.replace(/\n/g, " ");
    var lower = plain.toLowerCase();
    var idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) {
      return escapeHtml(plain.slice(0, maxLen || 120)) + (plain.length > (maxLen || 120) ? "…" : "");
    }
    var start = Math.max(0, idx - 40);
    var end = Math.min(plain.length, idx + query.length + 80);
    var snippet = plain.slice(start, end);
    if (start > 0) snippet = "…" + snippet;
    if (end < plain.length) snippet = snippet + "…";
    var escaped = escapeHtml(snippet);
    var safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("(" + safeQuery + ")", "gi");
    return escaped.replace(re, "<mark>$1</mark>");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
