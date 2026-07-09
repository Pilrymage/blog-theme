(() => {
  function initSidebarPanels() {
    const body = document.body;
    const overlay = document.querySelector("[data-sidebar-overlay]");
    const panels = Array.from(document.querySelectorAll("[data-sidebar-panel]"));
    if (!body || !overlay || panels.length === 0) {
      return;
    }

    const closeAll = () => {
      panels.forEach((panel) => panel.classList.remove("is-open"));
      body.classList.remove("has-sidebar-open");
    };

    const openPanel = (panel) => {
      panels.forEach((item) => {
        if (item === panel) {
          item.classList.add("is-open");
        } else {
          item.classList.remove("is-open");
        }
      });
      body.classList.add("has-sidebar-open");
    };

    const togglePanel = (panel) => {
      if (!panel) {
        return;
      }
      if (panel.classList.contains("is-open")) {
        closeAll();
      } else {
        openPanel(panel);
      }
    };

    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-sidebar-toggle");
        if (!targetId) {
          return;
        }
        const panel = document.getElementById(targetId);
        togglePanel(panel);
      });
    });

    document.querySelectorAll("[data-sidebar-close]").forEach((button) => {
      button.addEventListener("click", () => closeAll());
    });

    overlay.addEventListener("click", () => closeAll());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAll();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1023) {
        closeAll();
      }
    });
  }

  function enhanceCopy(codeEl) {
    const pre = codeEl.closest("pre");
    const container = codeEl.closest(".highlight") || pre;
    if (!container || container.dataset.copyReady === "true") {
      return;
    }

    container.dataset.copyReady = "true";
    container.classList.add("code-block");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block__copy";
    button.setAttribute("aria-label", "复制代码");
    button.textContent = "复制";

    button.addEventListener("click", async () => {
      const text = codeEl.innerText;
      const reset = () => {
        button.classList.remove("is-success", "is-error");
        button.textContent = "复制";
      };

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const temp = document.createElement("textarea");
          temp.value = text;
          temp.setAttribute("readonly", "");
          temp.style.position = "absolute";
          temp.style.left = "-9999px";
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
        }
        button.classList.add("is-success");
        button.textContent = "已复制";
        window.setTimeout(reset, 2000);
      } catch (error) {
        console.error("Copy failed", error);
        button.classList.add("is-error");
        button.textContent = "复制失败";
        window.setTimeout(reset, 2000);
      }
    });

    container.appendChild(button);
  }

  function getCodeLang(codeEl) {
    if (!codeEl) {
      return "text";
    }
    const dataLang = codeEl.dataset && typeof codeEl.dataset.lang === "string" ? codeEl.dataset.lang : "";
    if (dataLang) {
      return String(dataLang).trim().toLowerCase();
    }
    const className = typeof codeEl.className === "string" ? codeEl.className : "";
    const match = className.match(/\blanguage-([^\s]+)/);
    if (match && match[1]) {
      return String(match[1]).trim().toLowerCase();
    }
    return "text";
  }

  function enhanceLangLabel(codeEl) {
    const pre = codeEl.closest("pre");
    const container = codeEl.closest(".highlight") || pre;
    if (!container || container.dataset.langReady === "true") {
      return;
    }

    container.dataset.langReady = "true";
    container.classList.add("code-block", "code-block--has-lang");

    const lang = getCodeLang(codeEl) || "text";
    const badge = document.createElement("div");
    badge.className = "code-block__lang";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = lang;
    container.appendChild(badge);
  }

  function enhanceCollapse(codeEl) {
    const pre = codeEl.closest("pre");
    const container = codeEl.closest(".highlight") || pre;
    if (!container || container.dataset.collapseReady === "true") {
      return;
    }

    const text = codeEl.textContent || "";
    let lines = text.split("\n").length;
    if (text.endsWith("\n")) {
      lines -= 1;
    }
    if (lines <= 5) {
      container.dataset.collapseReady = "true";
      return;
    }

    // Mark once to avoid duplicate toggles even if multiple code nodes are inside.
    container.dataset.collapseReady = "true";
    container.classList.add("code-block--collapsible", "code-block--collapsed");

    // The scrollable element is:
    // - <pre> itself for plain fences
    // - direct child <pre> or <div> for Chroma (.highlight)
    let scroller = container;
    if (container.classList.contains("highlight")) {
      scroller = container.firstElementChild || container;
    }

    const style = window.getComputedStyle(codeEl);
    const fontSize = parseFloat(style.fontSize) || 16;
    let lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      // Approximate "normal"
      lineHeight = 1.65 * fontSize;
    }

    const sStyle = window.getComputedStyle(scroller);
    const padTop = parseFloat(sStyle.paddingTop) || 0;
    const padBottom = parseFloat(sStyle.paddingBottom) || 0;
    const collapsedHeight = Math.ceil(padTop + padBottom + lineHeight * 5);
    container.style.setProperty("--code-collapsed-height", `${collapsedHeight}px`);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block__toggle";
    button.setAttribute("aria-expanded", "false");
    button.textContent = "展开";
    button.addEventListener("click", () => {
      const collapsed = container.classList.toggle("code-block--collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
      button.textContent = collapsed ? "展开" : "收起";
    });

    container.appendChild(button);
  }

  function findPrimaryCodeEl(container) {
    if (!container) {
      return null;
    }
    // Prefer the actual code column (it has language metadata).
    return (
      container.querySelector("pre code[data-lang]") ||
      container.querySelector("pre code[class*='language-']") ||
      container.querySelector("pre code")
    );
  }

  function clearActiveCodeLine(container) {
    if (!container) {
      return;
    }
    container.querySelectorAll(".code-lineno--active").forEach((el) => el.classList.remove("code-lineno--active"));
    container.querySelectorAll(".code-line--active").forEach((el) => el.classList.remove("code-line--active"));
  }

  function applyCodeLineClass(container, lineNo, className) {
    if (!container || !lineNo || lineNo <= 0) {
      return null;
    }
    const codeEl = findPrimaryCodeEl(container);
    if (!codeEl) {
      return null;
    }

    let spans = Array.from(codeEl.children).filter(
      (node) => node && node.nodeType === 1 && node.tagName === "SPAN" && node.style && node.style.display === "flex"
    );
    if (spans.length === 0) {
      spans = Array.from(codeEl.children).filter((node) => node && node.nodeType === 1 && node.tagName === "SPAN");
    }

    const lineEl = spans[lineNo - 1] || null;
    if (lineEl && className) {
      lineEl.classList.add(className);
    }
    return lineEl;
  }

  function parseLineNumberFromAnchorId(id) {
    if (typeof id !== "string" || !id) {
      return null;
    }
    const match = id.match(/-(\d+)$/);
    if (!match) {
      return null;
    }
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function ensureExpanded(container) {
    if (!container || !container.classList.contains("code-block--collapsible")) {
      return;
    }
    if (!container.classList.contains("code-block--collapsed")) {
      return;
    }
    container.classList.remove("code-block--collapsed");
    const toggle = container.querySelector(".code-block__toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.textContent = "收起";
    }
  }

  function highlightLineAnchorFromLocation() {
    const hash = typeof window.location.hash === "string" ? window.location.hash : "";
    if (!hash || hash.length < 2) {
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    if (!id) {
      return;
    }

    const anchorEl = document.getElementById(id);
    if (!anchorEl) {
      return;
    }

    const container = anchorEl.closest(".highlight") || anchorEl.closest("pre");
    if (!container) {
      return;
    }

    clearActiveCodeLine(container);

    // Left: line number anchor (generated by Chroma when anchorlinenos=true)
    anchorEl.classList.add("code-lineno--active");

    const lineNo = parseLineNumberFromAnchorId(id);
    let lineEl = null;

    if (lineNo) {
      lineEl = applyCodeLineClass(container, lineNo, "code-line--active");
    }

    // If the target is below the fold, auto-expand so the highlight is visible.
    if (lineNo && lineNo > 5) {
      ensureExpanded(container);
    }

    // Ensure it becomes visible inside the scroll container.
    const target = lineEl || anchorEl;
    window.setTimeout(() => {
      try {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      } catch (_) {
        // Ignore older browsers.
      }
    }, 0);
  }

  function initActiveToc() {
    const tocLinks = Array.from(document.querySelectorAll(".context-panel__toc a[href^='#']"));
    if (tocLinks.length === 0) {
      return;
    }

    const sections = tocLinks
      .map((link) => {
        const id = decodeURIComponent(link.getAttribute("href").slice(1));
        const target = document.getElementById(id);
        if (!target) {
          return null;
        }
        return { link, target };
      })
      .filter(Boolean);

    if (sections.length === 0) {
      return;
    }

    const clearActiveState = () => {
      sections.forEach(({ link }) => {
        link.classList.remove("active");
        let item = link.closest("li");
        while (item) {
          item.classList.remove("has-active");
          const parentList = item.parentElement;
          item = parentList ? parentList.closest("li") : null;
        }
      });
    };

    const applyActiveState = (link) => {
      link.classList.add("active");
      let item = link.closest("li");
      while (item) {
        item.classList.add("has-active");
        const parentList = item.parentElement;
        item = parentList ? parentList.closest("li") : null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            clearActiveState();
            const matched = sections.find(({ target }) => target === entry.target);
            if (matched) {
              applyActiveState(matched.link);
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -70% 0px",
      }
    );

    sections.forEach(({ target }) => observer.observe(target));
  }

  function initCollapsibleToc() {
    const section = document.querySelector("[data-toc-section]");
    const toggle = document.querySelector("[data-toc-toggle]");
    if (!section || !toggle) {
      return;
    }

    const applyState = () => {
      const collapsed = section.classList.contains("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
    };

    toggle.addEventListener("click", () => {
      section.classList.toggle("is-collapsed");
      applyState();
    });

    applyState();
  }

  function initSidenotes() {
    const article = document.querySelector(".content-article");
    const bodyEl = document.querySelector(".content-article__body");
    if (!article || !bodyEl) {
      return;
    }

    const sidenotes = Array.from(bodyEl.querySelectorAll(".sidenote"));
    if (sidenotes.length === 0) {
      return;
    }

    // Mark the article so CSS can hide inline sidenote contents.
    article.classList.add("sidenotes--initialized");

    // Desktop: right-hand margin column.
    let marginColumn = article.querySelector(".margin-notes");
    if (!marginColumn) {
      marginColumn = document.createElement("aside");
      marginColumn.className = "margin-notes";
      marginColumn.setAttribute("aria-label", "页边注");
      article.appendChild(marginColumn);
    }

    // Narrow screens: end-of-article list (matches entropicthoughts.com).
    let sidenotesList = article.querySelector(".sidenotes-list");
    if (!sidenotesList) {
      sidenotesList = document.createElement("section");
      sidenotesList.className = "sidenotes-list";
      sidenotesList.setAttribute("aria-label", "旁注");

      const heading = document.createElement("h2");
      heading.textContent = "Sidenotes";
      sidenotesList.appendChild(heading);

      const list = document.createElement("ol");
      sidenotes.forEach((note) => {
        const item = document.createElement("li");
        const clone = note.cloneNode(true);
        clone.removeAttribute("id");
        const back = clone.querySelector(".sn-back");
        if (back) {
          back.remove();
        }
        item.appendChild(clone);
        list.appendChild(item);
      });
      sidenotesList.appendChild(list);
      article.appendChild(sidenotesList);
    }

    function positionMarginNotes() {
      marginColumn.innerHTML = "";
      const articleRect = article.getBoundingClientRect();
      sidenotes.forEach((note) => {
        const ref = bodyEl.querySelector(`#snref-${note.id}`);
        const clone = note.cloneNode(true);
        clone.classList.add("margin-note");
        clone.removeAttribute("id");
        const back = clone.querySelector(".sn-back");
        if (back) {
          back.remove();
        }
        if (ref) {
          const refRect = ref.getBoundingClientRect();
          const top = refRect.top - articleRect.top;
          clone.style.top = `${Math.round(top)}px`;
        }
        marginColumn.appendChild(clone);
      });
    }

    positionMarginNotes();

    let resizeTimeout;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(positionMarginNotes, 150);
    });
  }

  function initEnhancements() {
    const body = document.body;
    if (!body) {
      return;
    }

    const enableHighlight = body.dataset.featureHighlight !== "false";
    const enableCopy = body.dataset.featureCopy !== "false";

    initSidebarPanels();
    initCollapsibleToc();
    initActiveToc();
    initSidenotes();

    const codeBlocks = Array.from(document.querySelectorAll("pre code")).filter((codeEl) => {
      if (!codeEl) {
        return false;
      }
      // When Hugo/Chroma renders line numbers, it emits a separate <pre><code> column
      // without language metadata. Exclude that column to avoid duplicate copy buttons.
      if (codeEl.dataset && codeEl.dataset.lang) {
        return true;
      }
      const className = typeof codeEl.className === "string" ? codeEl.className : "";
      return /\blanguage-/.test(className);
    });

    if (enableHighlight && window.hljs) {
      codeBlocks.forEach((block) => window.hljs.highlightElement(block));
    }

    // Always show language label for fenced code blocks.
    codeBlocks.forEach(enhanceLangLabel);

    if (enableCopy) {
      codeBlocks.forEach(enhanceCopy);
    }

    // Always enable collapsing for long code blocks.
    codeBlocks.forEach(enhanceCollapse);

    // Highlight a line when navigating to Chroma's line anchors (anchorlinenos=true).
    highlightLineAnchorFromLocation();
    window.addEventListener("hashchange", highlightLineAnchorFromLocation);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEnhancements);
  } else {
    initEnhancements();
  }
})();
