/*
 * Announcement page behaviour - vanilla JS, no dependencies.
 *
 * The pages are rendered by Jekyll with the state they had at build time, so
 * they are correct and complete without JavaScript. In the browser this script
 * takes over and recomputes everything from the timestamps in the markup:
 *
 *   - which announcements are still to come, running, or closed, and in which
 *     list they belong (so an entry leaves the landing page and appears in the
 *     history the minute its end time passes - no rebuild, no cron job)
 *   - filtering and searching of the history, mirrored in the URL
 *
 * The vocabulary (labels, colours, icons) comes from _data/levels.yml via the
 * JSON block on the page; nothing about the types is hard-coded here.
 *
 * The two pages need different handling. The landing page only ever holds
 * entries that were open at build time, and they can only close, so it hides
 * them when they do. The history page holds every entry, with the ones that
 * have not closed yet hidden, so it can reveal one the moment it closes.
 */
(function () {
  "use strict";

  var MINUTE = 60000;

  /* ------------------------------------------------------------------ *
   * Time helpers
   * ------------------------------------------------------------------ */

  function parse(iso) {
    if (!iso) return null;
    var date = new Date(iso);
    return isNaN(date.getTime()) ? null : date;
  }

  /* ------------------------------------------------------------------ *
   * Vocabulary
   * ------------------------------------------------------------------ */

  var LEVELS = {};
  var levelsNode = document.getElementById("levels-data");
  if (levelsNode) {
    try {
      LEVELS = JSON.parse(levelsNode.textContent);
    } catch (e) {
      LEVELS = {};
    }
  }

  function level(key) {
    return LEVELS[key] || LEVELS.unplanned || { label: key, dot: "bg-slate-400" };
  }

  function stateOf(el, now) {
    var start = parse(el.getAttribute("data-start"));
    var end = parse(el.getAttribute("data-end"));
    if (end && end.getTime() <= now) return "closed";
    if (start && start.getTime() > now) return "scheduled";
    return "ongoing";
  }

  function icon(id) {
    var tpl = document.getElementById(id);
    return tpl ? tpl.content.cloneNode(true) : null;
  }

  /* ------------------------------------------------------------------ *
   * Entry chrome: labels
   * ------------------------------------------------------------------ */

  function setText(root, selector, text) {
    var el = root.querySelector(selector);
    if (el) el.textContent = text;
  }

  function setHidden(root, selector, hidden) {
    var el = root.querySelector(selector);
    if (el) el.hidden = hidden;
  }

  // Updates everything on a card that depends on the current time.
  // Cards carry no status pill (see entry-card.html); only the detail page
  // does, and it paints itself further down.
  function paintEntry(el, state) {
    var hasEnd = !!el.getAttribute("data-end");

    setText(el, ".js-start-label", state === "scheduled" ? "Starts" : "Started");
    setHidden(el, ".js-end-row", !hasEnd);
    setText(el, ".js-end-label", state === "closed" ? "Ended" : "Expected until");
    setHidden(el, ".js-latest-update", state === "closed");
    el.setAttribute("data-state", state);
  }

  function sortNodes(nodes, direction) {
    return nodes.slice().sort(function (a, b) {
      var ta = parse(a.getAttribute("data-start"));
      var tb = parse(b.getAttribute("data-start"));
      var diff = (ta ? ta.getTime() : 0) - (tb ? tb.getTime() : 0);
      return direction === "asc" ? diff : -diff;
    });
  }

  // Re-appending nodes restarts CSS animations, so only touch the DOM when the
  // order actually changed.
  function reorder(container, wanted) {
    var current = Array.prototype.slice.call(container.children);
    var same =
      current.length === wanted.length &&
      wanted.every(function (node, i) {
        return current[i] === node;
      });
    if (same) return;
    wanted.forEach(function (node) {
      container.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------ *
   * Detail page (a single announcement)
   * ------------------------------------------------------------------ */

  var detail = document.querySelector(".js-entry-state");
  if (detail) {
    (function paintDetail() {
      var now = Date.now();
      var state = stateOf(detail, now);

      setHidden(detail, ".js-end-note", state === "closed");

      setTimeout(paintDetail, MINUTE);
    })();
  }

  /* ------------------------------------------------------------------ *
   * Landing page: Current + Planned
   * ------------------------------------------------------------------ */

  var currentList = document.getElementById("current-list");
  var plannedList = document.getElementById("planned-list");

  if (currentList && plannedList) {
    var liveEntries = Array.prototype.slice.call(
      document.querySelectorAll("#current-list .js-entry, #planned-list .js-entry")
    );
    var currentSection = document.getElementById("current");
    var plannedSection = document.getElementById("planned");
    var nothingCurrent = document.getElementById("nothing-current");

    // Entries that have closed since the build stay in the DOM but hidden;
    // keeping them at the tail of their list means the order check in
    // reorder() still settles and animations are not restarted every minute.
    var tailOf = function (container, closed) {
      return closed.filter(function (el) {
        return el.parentNode === container;
      });
    };

    var refreshLanding = function () {
      var now = Date.now();
      var ongoing = [];
      var scheduled = [];
      var closed = [];

      liveEntries.forEach(function (el) {
        var state = stateOf(el, now);
        if (el.getAttribute("data-state") !== state) paintEntry(el, state);

        if (state === "closed") {
          el.hidden = true;
          closed.push(el);
        } else {
          el.hidden = false;
          (state === "ongoing" ? ongoing : scheduled).push(el);
        }
      });

      reorder(currentList, sortNodes(ongoing, "desc").concat(tailOf(currentList, closed)));
      reorder(plannedList, sortNodes(scheduled, "asc").concat(tailOf(plannedList, closed)));

      currentSection.hidden = ongoing.length === 0;
      plannedSection.hidden = scheduled.length === 0;
      if (nothingCurrent) nothingCurrent.hidden = ongoing.length + scheduled.length > 0;
    };

    refreshLanding();
    setInterval(refreshLanding, MINUTE);
  }

  /* ------------------------------------------------------------------ *
   * History page: every entry, filtered down to the closed ones
   * ------------------------------------------------------------------ */

  var timeline = document.getElementById("timeline");
  if (!timeline) return;

  var pastEntries = Array.prototype.slice.call(timeline.querySelectorAll(".js-entry"));
  var historyEmpty = document.getElementById("history-empty");

  var searchInput = document.getElementById("search");
  var searchClear = document.getElementById("search-clear");
  var typeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-type-filter]"));
  var chipsWrap = document.getElementById("active-filters");
  var chips = document.getElementById("filter-chips");
  var resultSummary = document.getElementById("result-summary");
  var resultCount = document.getElementById("result-count");
  var totalCount = document.getElementById("total-count");
  var noResults = document.getElementById("no-results");

  var TAB_ON = ["bg-white", "text-vib-800"];
  var TAB_OFF = ["text-slate-600", "hover:bg-slate-200", "hover:text-slate-900"];
  var CHIP_ON = ["bg-vib-600", "text-white"];
  var CHIP_OFF = ["bg-slate-100", "text-slate-600", "hover:bg-slate-200"];

  var serviceNames = {};
  document.querySelectorAll(".js-service-chip").forEach(function (el) {
    serviceNames[el.getAttribute("data-service-filter")] = el.textContent.trim();
  });

  var state = { q: "", type: "all", services: [] };

  /* ---------- filtering ---------- */

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var services = params.get("services");

    state.q = params.get("q") || "";
    state.type = params.get("type") || "all";
    state.services = services
      ? services
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      : [];

    if (state.type !== "all" && !LEVELS[state.type]) state.type = "all";
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.type !== "all") params.set("type", state.type);
    if (state.services.length) params.set("services", state.services.join(","));

    var query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? "?" + query : "") + window.location.hash
    );
  }

  function matches(el) {
    if (state.type !== "all" && el.getAttribute("data-level") !== state.type) return false;

    if (state.services.length) {
      var owned = (el.getAttribute("data-services") || "").split(/\s+/);
      // Stacking services widens the view: match any of them.
      var hit = state.services.some(function (id) {
        return owned.indexOf(id) !== -1;
      });
      if (!hit) return false;
    }

    if (state.q) {
      var haystack = el.getAttribute("data-search") || "";
      var ok = state.q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every(function (needle) {
          return haystack.indexOf(needle) !== -1;
        });
      if (!ok) return false;
    }

    return true;
  }

  function applyFilters() {
    var now = Date.now();
    var visible = 0;
    var closedTotal = 0;
    var previousMonth = null;

    pastEntries.forEach(function (el) {
      // This page holds every announcement; only the closed ones belong here.
      var isClosed = stateOf(el, now) === "closed";
      if (isClosed) closedTotal++;

      var ok = isClosed && matches(el);
      el.hidden = !ok;
      if (!ok) return;

      visible++;
      // Show a month heading on the first visible entry of each month.
      var month = el.getAttribute("data-month");
      var label = el.querySelector(".js-month-label");
      if (label) label.hidden = month === previousMonth;
      previousMonth = month;
    });

    if (resultCount) resultCount.textContent = String(visible);
    if (totalCount) totalCount.textContent = String(closedTotal);
    // Nothing is paginated, so "8 of 8" says nothing - only show the count
    // while a filter is actually holding entries back.
    if (resultSummary) resultSummary.hidden = visible === closedTotal;
    if (historyEmpty) historyEmpty.hidden = closedTotal > 0;
    if (noResults) noResults.hidden = visible !== 0 || closedTotal === 0;

    renderChips();
    syncControls();
    writeUrl();
  }

  /* ---------- controls ---------- */

  function syncControls() {
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    if (searchClear) searchClear.hidden = !state.q;

    typeButtons.forEach(function (btn) {
      var on = btn.getAttribute("data-type-filter") === state.type;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      TAB_ON.forEach(function (c) {
        btn.classList.toggle(c, on);
      });
      TAB_OFF.forEach(function (c) {
        btn.classList.toggle(c, !on);
      });
    });

    document.querySelectorAll(".js-service-chip").forEach(function (el) {
      var on = state.services.indexOf(el.getAttribute("data-service-filter")) !== -1;
      // Selected chips get a leading checkmark, not just a fill.
      var check = el.querySelector(".js-chip-check");
      if (check) check.hidden = !on;
      if (on) {
        el.setAttribute("aria-current", "true");
      } else {
        el.removeAttribute("aria-current");
      }
      CHIP_ON.forEach(function (c) {
        el.classList.toggle(c, on);
      });
      CHIP_OFF.forEach(function (c) {
        el.classList.toggle(c, !on);
      });
    });
  }

  function chipButton(label, kind, value) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex cursor-pointer items-center gap-1 rounded-lg bg-vib-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-vib-700";
    btn.setAttribute("data-remove-filter", kind);
    btn.setAttribute("data-value", value);
    btn.setAttribute("aria-label", "Remove filter " + label);
    btn.appendChild(document.createTextNode(label));

    var cross = icon("pill-close");
    if (cross) {
      btn.appendChild(cross);
    } else {
      var x = document.createElement("span");
      x.className = "text-sm leading-none opacity-60";
      x.textContent = "×";
      btn.appendChild(x);
    }
    return btn;
  }

  function renderChips() {
    if (!chips || !chipsWrap) return;
    chips.textContent = "";

    state.services.forEach(function (id) {
      chips.appendChild(chipButton(serviceNames[id] || id, "service", id));
    });
    if (state.type !== "all") {
      chips.appendChild(chipButton(level(state.type).label, "type", state.type));
    }
    if (state.q) {
      chips.appendChild(chipButton('"' + state.q + '"', "q", state.q));
    }

    chipsWrap.hidden = chips.childElementCount === 0;
  }

  function toggleService(id) {
    var i = state.services.indexOf(id);
    if (i === -1) {
      state.services.push(id);
      return;
    }
    state.services.splice(i, 1);
  }

  /* ---------- refresh loop ---------- */

  function refreshHistory() {
    var now = Date.now();
    pastEntries.forEach(function (el) {
      var current = stateOf(el, now);
      if (el.getAttribute("data-state") !== current) paintEntry(el, current);
    });
    reorder(timeline, sortNodes(pastEntries, "desc"));
    applyFilters();
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (event) {
    var tag = event.target.closest("[data-service-filter]");
    if (tag) {
      event.preventDefault();
      toggleService(tag.getAttribute("data-service-filter"));
      applyFilters();
      return;
    }

    var chip = event.target.closest("[data-remove-filter]");
    if (chip) {
      var kind = chip.getAttribute("data-remove-filter");
      if (kind === "service") toggleService(chip.getAttribute("data-value"));
      if (kind === "type") state.type = "all";
      if (kind === "q") state.q = "";
      applyFilters();
      return;
    }

    var typeBtn = event.target.closest("[data-type-filter]");
    if (typeBtn) {
      state.type = typeBtn.getAttribute("data-type-filter");
      applyFilters();
      return;
    }

    if (event.target.closest("#clear-filters, #clear-filters-empty")) {
      state.q = "";
      state.type = "all";
      state.services = [];
      applyFilters();
    }
  });

  if (searchInput) {
    var timer = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = searchInput.value.trim();
        applyFilters();
      }, 140);
    });
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && searchInput.value) {
        event.preventDefault();
        searchInput.value = "";
        state.q = "";
        applyFilters();
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", function () {
      state.q = "";
      applyFilters();
      if (searchInput) searchInput.focus();
    });
  }

  // "/" jumps to the search box.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!searchInput) return;
    event.preventDefault();
    searchInput.focus();
  });

  readUrl();
  refreshHistory();
  setInterval(refreshHistory, MINUTE);
})();
