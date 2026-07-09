(() => {
  const configEl = document.getElementById("essence-search-config");
  if (!configEl) {
    return;
  }

  let config = {};
  try {
    config = JSON.parse(configEl.textContent);
  } catch (error) {
    console.error("Failed to parse search configuration.", error);
    return;
  }

  const inputEl = document.querySelector("[data-search-input]");
  const resultsEl = document.querySelector("[data-search-results]");
  const statusEl = document.querySelector("[data-search-status]");
  const emptyEl = document.querySelector("[data-search-empty]");
  const clearBtn = document.querySelector("[data-search-clear]");
  const formEl = inputEl ? inputEl.closest("form") : null;

  if (!inputEl || !resultsEl) {
    return;
  }

  const messages = {
    initial: "",
    loading: "Loading…",
    minLength: "",
    noResults: "",
    results: "",
    error: "",
    ...(config.messages || {}),
  };

  const minLength = Math.max(1, Number(config.minLength) || 2);
  const maxResults = Math.max(1, Number(config.maxResults) || 30);
  const debounceDelay = Math.max(0, Number(config.debounce) || 180);

  const state = {
    items: [],
    isLoaded: false,
    isLoading: false,
    hasError: false,
  };

  if (formEl) {
    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      inputEl.value = "";
      inputEl.focus();
      clearResults();
      updateStatus(messages.initial);
    });
  }

  if (messages.initial) {
    updateStatus(messages.initial);
  }

  const handleInput = debounce(async () => {
    const term = inputEl.value.trim();

    if (!term) {
      clearResults();
      updateStatus(messages.initial);
      return;
    }

    if (term.length < minLength) {
      clearResults();
      updateStatus(messages.minLength || "");
      return;
    }

    try {
      const index = await loadIndex();
      if (!index.length) {
        clearResults();
        showEmpty(true);
        updateStatus(messages.noResults || "");
        return;
      }

      const normalizedTerm = term.toLowerCase();
      const matches = index
        .filter((entry) => includesTerm(entry, normalizedTerm))
        .slice(0, maxResults);

      renderResults(matches, term);
    } catch (error) {
      console.error("Search failed.", error);
    }
  }, debounceDelay);

  inputEl.addEventListener("input", handleInput);
  inputEl.addEventListener("search", handleInput);
  inputEl.addEventListener("focus", () => {
    if (!state.isLoaded && !state.isLoading && !state.hasError) {
      loadIndex().catch(() => undefined);
    }
  });

  async function loadIndex() {
    if (state.isLoaded) {
      return state.items;
    }

    if (state.isLoading) {
      return state.pending;
    }

    state.isLoading = true;
    updateStatus(messages.loading || "");

    const request = fetch(config.indexURL, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();
        state.items = Array.isArray(data) ? data : [];
        state.isLoaded = true;
        state.hasError = false;
        updateStatus(messages.initial || "");
        return state.items;
      })
      .catch((error) => {
        state.hasError = true;
        updateStatus(messages.error || "");
        throw error;
      })
      .finally(() => {
        state.isLoading = false;
        state.pending = null;
      });

    state.pending = request;
    return request;
  }

  function includesTerm(entry, term) {
    const haystacks = [
      entry.title,
      entry.summary,
      entry.content,
      entry.tags ? entry.tags.join(" ") : "",
    ];
    return haystacks.some((field) => {
      if (!field) {
        return false;
      }
      return String(field).toLowerCase().includes(term);
    });
  }

  function renderResults(items, originalTerm) {
    clearResults();

    if (!items.length) {
      showEmpty(true);
      updateStatus(messages.noResults || "");
      return;
    }

    const countMessage =
      messages.results && messages.results.includes("%d")
        ? messages.results.replace("%d", String(items.length))
        : messages.results || "";

    updateStatus(countMessage);
    showEmpty(false);

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      fragment.appendChild(createResultItem(item, originalTerm));
    }
    resultsEl.appendChild(fragment);
  }

  function createResultItem(item, term) {
    const li = document.createElement("li");
    li.className = "search-result";

    const titleLink = document.createElement("a");
    titleLink.className = "search-result__title";
    titleLink.href = item.permalink;
    titleLink.textContent = item.title || item.permalink;
    li.appendChild(titleLink);

    const meta = document.createElement("p");
    meta.className = "search-result__meta";
    meta.textContent = formatMeta(item);
    li.appendChild(meta);

    const snippet = document.createElement("p");
    snippet.className = "search-result__snippet";
    snippet.innerHTML = highlightSnippet(
      createSnippet(item, term),
      term.trim()
    );
    li.appendChild(snippet);

    return li;
  }

  function formatMeta(item) {
    const bits = [];
    if (item.date) {
      bits.push(item.date);
    }
    if (item.section) {
      bits.push(item.section);
    }
    return bits.join(" · ");
  }

  function createSnippet(item, term) {
    const source =
      (item.summary && item.summary.trim()) ||
      (item.content && item.content.trim()) ||
      "";

    if (!source) {
      return "";
    }

    const normalisedText = source.replace(/\s+/g, " ");
    const lowerSource = normalisedText.toLowerCase();
    const lowerTerm = term.toLowerCase();

    let index = lowerSource.indexOf(lowerTerm);
    if (index < 0) {
      index = 0;
    }

    const radius = 80;
    let start = Math.max(0, index - radius);
    const end = Math.min(normalisedText.length, index + lowerTerm.length + radius);

    // Ensure we don't cut words awkwardly
    if (start > 0) {
      const nextSpace = normalisedText.indexOf(" ", start);
      if (nextSpace > 0 && nextSpace < end) {
        start = nextSpace + 1;
      }
    }

    let snippet = normalisedText.slice(start, end).trim();
    if (start > 0) {
      snippet = `…${snippet}`;
    }
    if (end < normalisedText.length) {
      snippet = `${snippet}…`;
    }
    return snippet;
  }

  function highlightSnippet(snippet, term) {
    if (!snippet) {
      return "";
    }
    const safeSnippet = escapeHTML(snippet);
    if (!term) {
      return safeSnippet;
    }
    try {
      const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(pattern, "gi");
      return safeSnippet.replace(regex, (match) => `<mark>${match}</mark>`);
    } catch (error) {
      return safeSnippet;
    }
  }

  function clearResults() {
    resultsEl.innerHTML = "";
    showEmpty(false);
  }

  function showEmpty(shouldShow) {
    if (!emptyEl) {
      return;
    }
    emptyEl.hidden = !shouldShow;
  }

  function updateStatus(message) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message || "";
  }

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#039;";
        default:
          return character;
      }
    });
  }

  function debounce(fn, wait) {
    let timeoutId;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        fn.apply(null, args);
      }, wait);
    };
  }
})();
