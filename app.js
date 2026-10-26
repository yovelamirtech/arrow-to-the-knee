(() => {
  'use strict';

  const STORAGE_KEY = 'arrow-to-the-knee-v1';
  const TAB_ARCHIVE = 'archive';
  const TAB_TIPS = 'tips';
  const TOAST_MS = 5000;

  const PRIORITY = {
    high: { label: 'עדיפות גבוהה', rank: 0 },
    medium: { label: 'בינונית', rank: 1 },
    low: { label: 'נמוכה', rank: 2 },
  };

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_EXTERNAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  const $ = (sel) => document.querySelector(sel);
  const el = {
    buildName: $('#build-name'),
    switcherWrap: $('#build-switcher-wrap'),
    switcher: $('#build-switcher'),
    progressText: $('#progress-text'),
    progressFill: $('#progress-fill'),
    search: $('#search'),
    tabs: $('#tabs'),
    list: $('#list'),
    sheet: $('#sheet'),
    sheetBody: $('#sheet-body'),
    toast: $('#toast'),
    toastText: $('#toast-text'),
    toastUndo: $('#toast-undo'),
  };

  const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let builds = [];
  let images = {};
  let store = { activeBuild: null, builds: {} };
  let query = '';
  let sheetItemId = null;
  let sheetHasHistory = false;
  let afterSheetClose = null;
  let toastTimer = null;
  let toastUndoFn = null;

  /* ---------- Storage ---------- */

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { activeBuild: null, builds: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { activeBuild: null, builds: {} };
      return {
        activeBuild: typeof parsed.activeBuild === 'string' ? parsed.activeBuild : null,
        builds: parsed.builds && typeof parsed.builds === 'object' ? parsed.builds : {},
      };
    } catch (e) {
      return { activeBuild: null, builds: {} };
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      /* storage unavailable: keep working in memory */
    }
  }

  function buildState(buildId) {
    let s = store.builds[buildId];
    if (!s || typeof s !== 'object') s = store.builds[buildId] = { done: {}, tab: null };
    if (!s.done || typeof s.done !== 'object') s.done = {};
    return s;
  }

  /* ---------- Helpers ---------- */

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Runs of Latin text (words joined by spaces, inner apostrophes, hyphens and dots)
  // get wrapped in <bdi> so punctuation around them stays in the right place.
  const LATIN_RUN = /[A-Za-z](?:[A-Za-z0-9'’\-]|\.(?=[A-Za-z0-9]))*(?: +[A-Za-z0-9](?:[A-Za-z0-9'’\-]|\.(?=[A-Za-z0-9]))*)*/g;

  function richText(str) {
    const text = String(str == null ? '' : str);
    let out = '';
    let last = 0;
    text.replace(LATIN_RUN, (match, offset) => {
      out += escapeHtml(text.slice(last, offset)) + '<bdi>' + escapeHtml(match) + '</bdi>';
      last = offset + match.length;
      return match;
    });
    return out + escapeHtml(text.slice(last));
  }

  function wikiUrl(title) {
    const path = encodeURIComponent(String(title).replace(/ /g, '_'))
      .replace(/%3A/gi, ':')
      .replace(/%2F/gi, '/')
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return 'https://en.uesp.net/wiki/' + path;
  }

  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[֑-ׇ]/g, '')
      .replace(/['’׳"״`\-–—_.,:;()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function activeBuild() {
    return builds.find((b) => b.id === store.activeBuild) || builds[0];
  }

  function categoryOf(build, catId) {
    return build.categories.find((c) => c.id === catId) || { id: catId, nameHe: catId, icon: '•' };
  }

  function isDone(build, itemId) {
    return Boolean(buildState(build.id).done[itemId]);
  }

  function sortItems(items) {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const pa = (PRIORITY[a.item.priority] || PRIORITY.low).rank;
        const pb = (PRIORITY[b.item.priority] || PRIORITY.low).rank;
        if (pa !== pb) return pa - pb;
        const la = a.item.minLevel == null ? -1 : Number(a.item.minLevel);
        const lb = b.item.minLevel == null ? -1 : Number(b.item.minLevel);
        if (la !== lb) return la - lb;
        return a.index - b.index;
      })
      .map((x) => x.item);
  }

  function currentTab(build) {
    const tab = buildState(build.id).tab;
    if (tab === TAB_ARCHIVE || tab === TAB_TIPS) return tab;
    if (build.categories.some((c) => c.id === tab)) return tab;
    return build.categories.length ? build.categories[0].id : TAB_TIPS;
  }

  function imageFor(build, item) {
    const entry = images[build.id] && images[build.id][item.id];
    return entry && entry.file ? entry : null;
  }

  /* ---------- Rendering ---------- */

  function thumbHtml(build, item, large) {
    const cat = categoryOf(build, item.category);
    const img = imageFor(build, item);
    const cls = 'thumb' + (large ? ' thumb-lg' : '');
    const emoji = `<span class="thumb-emoji" aria-hidden="true">${escapeHtml(cat.icon)}</span>`;
    if (!img) return `<span class="${cls}">${emoji}</span>`;
    const size = large ? 112 : 60;
    return `<span class="${cls}" data-emoji="${escapeHtml(cat.icon)}"><img src="${escapeHtml(img.file)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async"></span>`;
  }

  function badgesHtml(item) {
    const p = PRIORITY[item.priority];
    let html = '';
    if (p) html += `<span class="badge badge-${escapeHtml(item.priority)}">${p.label}</span>`;
    if (item.minLevel != null) html += `<span class="badge badge-level">מרמה ${escapeHtml(item.minLevel)}</span>`;
    return html ? `<span class="badges">${html}</span>` : '';
  }

  function cardHtml(build, item) {
    const done = isDone(build, item.id);
    const doneAt = buildState(build.id).done[item.id];
    const meta = done
      ? `<span class="done-date">סומן ב-${escapeHtml(formatDate(doneAt))}</span>`
      : `<span class="summary">${richText(item.summary)}</span>${badgesHtml(item)}`;
    const checkLabel = done ? `החזרה לרשימה: ${item.nameHe}` : `סימון כהושג: ${item.nameHe}`;
    return `<li class="card" data-id="${escapeHtml(item.id)}">
      <button type="button" class="card-open" data-action="open" aria-haspopup="dialog">
        ${thumbHtml(build, item, false)}
        <span class="card-body">
          <span class="name-he">${richText(item.nameHe)}</span>
          <span class="name-en" dir="ltr">${escapeHtml(item.nameEn)}</span>
          ${meta}
        </span>
      </button>
      <button type="button" class="check" data-action="toggle" role="checkbox" aria-checked="${done}" aria-label="${escapeHtml(checkLabel)}">
        <span class="check-box">${ICON_CHECK}</span>
      </button>
    </li>`;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : dateFmt.format(d);
  }

  function renderHeader(build) {
    el.buildName.textContent = build.nameHe || '';
    // With several builds the switcher shows the build name instead of the subtitle.
    el.buildName.hidden = builds.length > 1;
    if (builds.length > 1) {
      el.switcher.innerHTML = builds
        .map((b) => `<option value="${escapeHtml(b.id)}"${b.id === build.id ? ' selected' : ''}>${escapeHtml(b.nameHe)}</option>`)
        .join('');
      el.switcherWrap.hidden = false;
    } else {
      el.switcherWrap.hidden = true;
    }
    const total = build.items.length;
    const done = build.items.filter((i) => isDone(build, i.id)).length;
    el.progressText.textContent = `${done} מתוך ${total}`;
    el.progressFill.style.width = total ? `${(done / total) * 100}%` : '0';
    document.title = 'Arrow to the Knee';
  }

  function renderTabs(build) {
    const tab = currentTab(build);
    const selected = query ? null : tab;
    const doneCount = build.items.filter((i) => isDone(build, i.id)).length;
    const catTabs = build.categories.map((c) => {
      const remaining = build.items.filter((i) => i.category === c.id && !isDone(build, i.id)).length;
      return tabHtml(c.id, `<span class="tab-icon" aria-hidden="true">${escapeHtml(c.icon)}</span>${escapeHtml(c.nameHe)}`, remaining, selected);
    });
    el.tabs.innerHTML =
      catTabs.join('') +
      '<span class="tab-sep" aria-hidden="true"></span>' +
      tabHtml(TAB_ARCHIVE, 'ארכיון', doneCount, selected) +
      tabHtml(TAB_TIPS, 'טיפים', null, selected);
    // While searching no tab is selected; keep the row reachable by keyboard.
    if (!selected) el.tabs.querySelector('[data-tab]').tabIndex = 0;
  }

  function tabHtml(id, label, count, selected) {
    const isSel = id === selected;
    const countHtml = count == null ? '' : `<span class="tab-count">${count}</span>`;
    return `<button type="button" class="tab" role="tab" data-tab="${escapeHtml(id)}" aria-selected="${isSel}" tabindex="${isSel ? 0 : -1}">${label}${countHtml}</button>`;
  }

  function renderList(build) {
    if (query) return renderSearch(build);
    const tab = currentTab(build);
    if (tab === TAB_TIPS) return renderTips(build);
    if (tab === TAB_ARCHIVE) return renderArchive(build);

    const cat = categoryOf(build, tab);
    const items = sortItems(build.items.filter((i) => i.category === tab && !isDone(build, i.id)));
    const total = build.items.filter((i) => i.category === tab).length;
    let html = `<div class="list-head"><h2 class="list-title">${escapeHtml(cat.icon)} ${escapeHtml(cat.nameHe)}</h2><span class="list-meta">נשארו ${items.length} מתוך ${total}</span></div>`;
    if (items.length) {
      html += `<ul class="cards">${items.map((i) => cardHtml(build, i)).join('')}</ul>`;
    } else {
      html += `<p class="empty">${total ? 'הכל הושג בקטגוריה הזו. הפריטים מחכים בארכיון.' : 'אין עדיין פריטים בקטגוריה הזו.'}</p>`;
    }
    el.list.innerHTML = html;
  }

  function renderSearch(build) {
    const q = normalize(query);
    const matches = build.items.filter((i) => normalize(i.nameHe).includes(q) || normalize(i.nameEn).includes(q));
    const open = matches.filter((i) => !isDone(build, i.id));
    const done = matches.filter((i) => isDone(build, i.id));
    let html = `<div class="list-head"><h2 class="list-title">תוצאות חיפוש</h2><span class="list-meta">${matches.length} תוצאות</span></div>`;
    if (!matches.length) {
      el.list.innerHTML = html + '<p class="empty">לא נמצאו פריטים.</p>';
      return;
    }
    build.categories.forEach((c) => {
      const items = sortItems(open.filter((i) => i.category === c.id));
      if (items.length) html += groupHtml(`${escapeHtml(c.icon)} ${escapeHtml(c.nameHe)}`, build, items);
    });
    if (done.length) html += groupHtml('✓ בארכיון', build, sortByDoneDesc(build, done));
    el.list.innerHTML = html;
  }

  function sortByDoneDesc(build, items) {
    const doneMap = buildState(build.id).done;
    return items.slice().sort((a, b) => String(doneMap[b.id]).localeCompare(String(doneMap[a.id])));
  }

  function groupHtml(title, build, items) {
    return `<section class="group"><h3 class="group-title">${title}</h3><ul class="cards">${items.map((i) => cardHtml(build, i)).join('')}</ul></section>`;
  }

  function renderArchive(build) {
    const done = build.items.filter((i) => isDone(build, i.id));
    let html = `<div class="list-head"><h2 class="list-title">ארכיון</h2><span class="list-meta">${done.length} פריטים</span></div>`;
    if (!done.length) {
      el.list.innerHTML = html + '<p class="empty">עוד לא סימנת שום דבר. פריטים שתסמן ב-V יופיעו כאן.</p>';
      return;
    }
    build.categories.forEach((c) => {
      const items = done.filter((i) => i.category === c.id);
      if (items.length) html += groupHtml(`${escapeHtml(c.icon)} ${escapeHtml(c.nameHe)}`, build, sortByDoneDesc(build, items));
    });
    el.list.innerHTML = html;
  }

  function renderTips(build) {
    const tips = Array.isArray(build.tips) ? build.tips : [];
    let html = '<div class="list-head"><h2 class="list-title">טיפים</h2></div>';
    html += tips.length
      ? `<ol class="tips">${tips.map((t) => `<li>${richText(t)}</li>`).join('')}</ol>`
      : '<p class="empty">אין טיפים לבילד הזה.</p>';
    el.list.innerHTML = html;
  }

  function render() {
    const build = activeBuild();
    if (!build) return;
    renderHeader(build);
    renderTabs(build);
    renderList(build);
  }

  function refreshCounts() {
    const build = activeBuild();
    renderHeader(build);
    renderTabs(build);
  }

  function scrollActiveTabIntoView() {
    const active = el.tabs.querySelector('[aria-selected="true"]');
    if (!active) return;
    const tabsRect = el.tabs.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    if (r.left < tabsRect.left + 16) el.tabs.scrollBy({ left: r.left - tabsRect.left - 16 });
    else if (r.right > tabsRect.right - 16) el.tabs.scrollBy({ left: r.right - tabsRect.right + 16 });
  }

  /* ---------- Actions ---------- */

  function setTab(tabId) {
    const build = activeBuild();
    buildState(build.id).tab = tabId;
    saveStore();
    if (query) {
      query = '';
      el.search.value = '';
    }
    render();
    scrollActiveTabIntoView();
    window.scrollTo({ top: 0 });
  }

  function setBuild(buildId) {
    if (!builds.some((b) => b.id === buildId)) return;
    store.activeBuild = buildId;
    saveStore();
    render();
    el.tabs.scrollLeft = 0;
    scrollActiveTabIntoView();
  }

  async function toggleItem(itemId) {
    const build = activeBuild();
    const state = buildState(build.id);
    const wasDone = Boolean(state.done[itemId]);
    const prev = state.done[itemId];
    if (wasDone) delete state.done[itemId];
    else state.done[itemId] = new Date().toISOString();
    saveStore();
    refreshCounts();

    const card = el.list.querySelector(`.card[data-id="${CSS.escape(itemId)}"]`);
    if (card) {
      const box = card.querySelector('.check');
      if (box) box.setAttribute('aria-checked', String(!wasDone));
      await animateOut(card);
    }
    renderList(build);

    const buildId = build.id;
    showToast(wasDone ? 'הוחזר לרשימה' : 'הועבר לארכיון', () => {
      const s = buildState(buildId);
      if (wasDone) s.done[itemId] = prev;
      else delete s.done[itemId];
      saveStore();
      render();
    });
  }

  function animateOut(node) {
    if (reducedMotion.matches || typeof node.animate !== 'function' || document.hidden) return Promise.resolve();
    // Never let a stalled animation hold up the list.
    return Promise.race([runAnimateOut(node), new Promise((r) => setTimeout(r, 900))]);
  }

  async function runAnimateOut(node) {
    try {
      const cs = getComputedStyle(node);
      node.style.overflow = 'hidden';
      node.style.pointerEvents = 'none';
      await node.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-28px)' }],
        { duration: 200, delay: 120, easing: 'ease-in', fill: 'forwards' }
      ).finished;
      await node.animate(
        [
          { height: node.offsetHeight + 'px', marginBottom: cs.marginBottom },
          { height: '0px', marginBottom: '0px' },
        ],
        { duration: 180, easing: 'ease-out', fill: 'forwards' }
      ).finished;
    } catch (e) {
      /* animation interrupted: fall through to re-render */
    }
  }

  function showToast(message, undoFn) {
    clearTimeout(toastTimer);
    toastUndoFn = undoFn;
    el.toastText.textContent = message;
    el.toast.hidden = false;
    // restart the entrance animation
    el.toast.style.animation = 'none';
    void el.toast.offsetWidth;
    el.toast.style.animation = '';
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastUndoFn = null;
    el.toast.hidden = true;
  }

  /* ---------- Details sheet ---------- */

  function detailsHtml(build, item) {
    const done = isDone(build, item.id);
    const img = imageFor(build, item);
    const howTo = Array.isArray(item.howToGet) ? item.howToGet : [];
    const notes = Array.isArray(item.notes) ? item.notes : [];
    const credit = img && img.source
      ? `<a class="img-credit" href="${escapeHtml(img.source)}" target="_blank" rel="noopener noreferrer">מקור התמונה</a>`
      : '';
    return `
      <div class="sheet-head">
        <span class="sheet-grip" aria-hidden="true"></span>
        <button type="button" class="sheet-close" data-action="close" aria-label="סגירה">${ICON_CLOSE}</button>
      </div>
      <div class="sheet-content">
        <div class="sheet-hero">
          ${thumbHtml(build, item, true)}
          <div>
            <h2 id="sheet-title">${richText(item.nameHe)}</h2>
            <span class="name-en" dir="ltr">${escapeHtml(item.nameEn)}</span>
            ${badgesHtml(item)}
            ${credit}
          </div>
        </div>
        <section class="sheet-section"><h3>מה זה</h3><p>${richText(item.summary)}</p></section>
        <section class="sheet-section"><h3>למה זה טוב לבילד</h3><p>${richText(item.why)}</p></section>
        ${howTo.length ? `<section class="sheet-section"><h3>איך משיגים</h3><ol>${howTo.map((s) => `<li>${richText(s)}</li>`).join('')}</ol></section>` : ''}
        ${notes.length ? `<section class="sheet-section"><h3>הערות</h3><ul>${notes.map((s) => `<li>${richText(s)}</li>`).join('')}</ul></section>` : ''}
        ${item.wikiTitle ? `<a class="wiki-link" href="${escapeHtml(wikiUrl(item.wikiTitle))}" target="_blank" rel="noopener noreferrer">לקריאה נוספת ב-<bdi>UESP</bdi>${ICON_EXTERNAL}</a>` : ''}
      </div>
      <div class="sheet-actions">
        <button type="button" class="toggle-btn" data-action="toggle" aria-pressed="${done}">
          <span class="check-box">${ICON_CHECK}</span>
          <span>${done ? 'הושג · להחזיר לרשימה' : 'סימון כהושג'}</span>
        </button>
      </div>`;
  }

  function openDetails(itemId) {
    const build = activeBuild();
    const item = build.items.find((i) => i.id === itemId);
    if (!item) return;
    sheetItemId = itemId;
    el.sheetBody.innerHTML = detailsHtml(build, item);
    el.sheetBody.scrollTop = 0;
    if (el.sheet.open) return;
    el.sheet.showModal();
    document.body.classList.add('sheet-open');
    history.pushState({ sheet: itemId }, '');
    sheetHasHistory = true;
    requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('is-open')));
  }

  function requestCloseSheet() {
    if (!el.sheet.open) return;
    if (sheetHasHistory) {
      sheetHasHistory = false;
      history.back();
    } else {
      closeSheetNow();
    }
  }

  function closeSheetNow() {
    if (!el.sheet.open) return;
    el.sheet.classList.remove('is-open');
    const finish = () => {
      if (el.sheet.open) el.sheet.close();
      onSheetClosed();
    };
    if (reducedMotion.matches) finish();
    else setTimeout(finish, 210);
  }

  // Runs once per close, whether we closed the dialog or the browser did.
  function onSheetClosed() {
    if (!sheetItemId) return;
    el.sheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    sheetItemId = null;
    // The dialog can close natively (e.g. a forced Escape); drop our history entry too.
    if (sheetHasHistory) {
      sheetHasHistory = false;
      history.back();
    }
    const cb = afterSheetClose;
    afterSheetClose = null;
    if (cb) cb();
  }

  el.sheet.addEventListener('close', onSheetClosed);

  el.sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    requestCloseSheet();
  });

  el.sheet.addEventListener('click', (e) => {
    if (e.target === el.sheet) {
      requestCloseSheet();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'close') requestCloseSheet();
    else if (btn.dataset.action === 'toggle' && sheetItemId) {
      const id = sheetItemId;
      afterSheetClose = () => toggleItem(id);
      requestCloseSheet();
    }
  });

  window.addEventListener('popstate', () => {
    sheetHasHistory = false;
    if (el.sheet.open) closeSheetNow();
  });

  /* ---------- Events ---------- */

  el.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.card');
    if (!card) return;
    if (btn.dataset.action === 'toggle') toggleItem(card.dataset.id);
    else if (btn.dataset.action === 'open') openDetails(card.dataset.id);
  });

  el.tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  el.tabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = Array.from(el.tabs.querySelectorAll('[data-tab]'));
    const idx = tabs.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    let next = idx;
    // RTL: left arrow moves forward
    if (e.key === 'ArrowLeft') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowRight') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    setTab(tabs[next].dataset.tab);
    const target = el.tabs.querySelector(`[data-tab="${CSS.escape(tabs[next].dataset.tab)}"]`);
    if (target) target.focus();
  });

  el.search.addEventListener('input', () => {
    query = el.search.value.trim();
    const build = activeBuild();
    renderTabs(build);
    renderList(build);
  });

  el.search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.search.value) {
      el.search.value = '';
      query = '';
      render();
    }
  });

  el.switcher.addEventListener('change', () => setBuild(el.switcher.value));

  el.toastUndo.addEventListener('click', () => {
    const fn = toastUndoFn;
    hideToast();
    if (fn) fn();
  });

  // Broken image files fall back to the category emoji tile.
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const tile = img.closest('.thumb');
      if (!tile) return;
      tile.innerHTML = `<span class="thumb-emoji" aria-hidden="true">${escapeHtml(tile.dataset.emoji || '•')}</span>`;
    },
    true
  );

  /* ---------- Boot ---------- */

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(url + ': ' + res.status);
    return res.json();
  }

  async function init() {
    // A reload while the sheet was open leaves a stale history entry.
    if (history.state && history.state.sheet) history.replaceState(null, '');
    store = loadStore();
    try {
      const data = await fetchJson('data/items.json');
      builds = Array.isArray(data.builds) ? data.builds.filter((b) => b && b.id) : [];
      builds.forEach((b) => {
        b.categories = Array.isArray(b.categories) ? b.categories : [];
        b.items = Array.isArray(b.items) ? b.items : [];
      });
    } catch (e) {
      el.list.innerHTML = '<p class="empty">לא הצלחתי לטעון את הנתונים. נסה לרענן את הדף.</p>';
      return;
    }
    try {
      images = await fetchJson('data/images.json');
    } catch (e) {
      images = {};
    }
    if (!builds.length) {
      el.list.innerHTML = '<p class="empty">אין בילדים בקובץ הנתונים.</p>';
      return;
    }
    if (!builds.some((b) => b.id === store.activeBuild)) store.activeBuild = builds[0].id;
    render();
    scrollActiveTabIntoView();
  }

  init();
})();
