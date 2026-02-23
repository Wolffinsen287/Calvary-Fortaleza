(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav__toggle');
  const navMenu = document.querySelector('#navMenu');

  const DEBUG = true;
  const debug = (...args) => {
    if (!DEBUG) return;
    // console.debug is non-intrusive (no UI changes)
    console.debug('[Fortaleza]', ...args);
  };

  // Navbar: siempre con fondo blanco (sin estado por scroll)
  header?.classList.remove('is-scrolled');

  // -----------------
  // Mobile nav toggle
  // -----------------
  const setMenuOpen = (open) => {
    if (!navMenu || !navToggle) return;
    navMenu.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    // Accesibilidad: el label debe reflejar el estado
    navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');

    debug('menu', open ? 'open' : 'close');

    if (open) {
      navMenu.querySelector('a,button')?.focus();
    } else {
      navToggle.focus();
    }
  };

  navToggle?.addEventListener('click', () => {
    const isOpen = navMenu?.classList.contains('is-open');
    debug('toggle click', { isOpen });
    setMenuOpen(!isOpen);
  });

  // Close menu when clicking a link (mobile)
  navMenu?.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('a.nav__link')) setMenuOpen(false);
  });

  // Close menu on outside click (mobile)
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!navMenu || !navToggle) return;

    const clickedInsideMenu = navMenu.contains(target);
    const clickedToggle = navToggle.contains(target);
    if (!clickedInsideMenu && !clickedToggle) setMenuOpen(false);
  });

  // Escape closes menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenuOpen(false);
  });

  // -----------------
  // Smooth scroll with header offset
  // -----------------
  const getHeaderOffset = () => {
    const h = getComputedStyle(root).getPropertyValue('--header-h');
    const parsed = Number.parseFloat(h);
    return Number.isFinite(parsed) ? parsed + 18 : 90;
  };

  // -----------------
  // Active section highlight (UI hierarchy)
  // -----------------
  const navLinks = Array.from(document.querySelectorAll('.nav__link[href^="#"]'));
  const sectionIds = navLinks
    .map((link) => (link.getAttribute('href') || '').replace('#', ''))
    .filter(Boolean);
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter((el) => el instanceof HTMLElement);

  const setActiveNav = (activeId) => {
    for (const link of navLinks) {
      const id = (link.getAttribute('href') || '').replace('#', '');
      const isActive = id && id === activeId;

      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  const getActiveSectionId = () => {
    if (!sections.length) return '';
    const y = window.scrollY + getHeaderOffset() + 12;
    let current = sections[0]?.id || '';
    for (const section of sections) {
      if (!section) continue;
      if (section.offsetTop <= y) current = section.id;
    }
    return current;
  };

  let rafPending = false;
  const onScrollUpdateActive = () => {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(() => {
      rafPending = false;
      const id = getActiveSectionId();
      if (id) setActiveNav(id);
    });
  };

  window.addEventListener('scroll', onScrollUpdateActive, { passive: true });

  const scrollToHash = (hash) => {
    const id = (hash || '').replace('#', '');
    if (!id) return;

    const el = document.getElementById(id);
    if (!el) return;

    const y = el.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
    window.scrollTo({ top: y, behavior: 'smooth' });

    // Mantiene el navbar sincronizado al navegar por hash
    setActiveNav(id);
  };

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const link = target.closest('a[href^="#"]');
    if (!(link instanceof HTMLAnchorElement)) return;

    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;

    // Allow skip-link default behavior
    if (link.classList.contains('skip-link')) return;

    e.preventDefault();
    history.pushState(null, '', href);
    debug('smooth scroll', href);
    scrollToHash(href);
  });

  // If loaded with hash
  window.addEventListener('load', () => {
    if (location.hash) {
      setTimeout(() => scrollToHash(location.hash), 60);
    }

    // Estado inicial (sin hash o después de layout)
    onScrollUpdateActive();
  });

  // -----------------
  // Reveal animations (fade-in / slide-up)
  // -----------------
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  for (const el of revealEls) io.observe(el);
})();

/*
  Prédicas (100% estático para GitHub Pages)
  - NO usa YouTube Data API
  - NO usa API keys
  - NO usa backend
*/
(() => {
  "use strict";

  const HANDLE = "CalvaryFortalezaQuerétaro"; // del URL: https://www.youtube.com/@...
  const FALLBACK_CHANNEL_ID = "";
  const MAX_RESULTS = 4;
  const USE_MODAL = true;
  const CHANNEL_URL = `https://www.youtube.com/@${HANDLE}`;

  const RSS2JSON_V1 = "https://api.rss2json.com/v1/api.json?rss_url=";
  const RSS2JSON_LEGACY = "https://rss2json.com/api.json?rss_url=";
  const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";

  const TIMEOUT_MS = 6500;
  const CHANNEL_ID_CACHE_KEY = `fortaleza_channel_id_cache_${HANDLE}`;
  const CHANNEL_ID_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  const grid = document.getElementById("sermonsGrid");
  const statusEl = document.getElementById("sermonsStatus");
  const featuredEl = document.getElementById("featuredSermon");
  const moreBtn = document.getElementById("sermonsMoreBtn");
  const modal = document.getElementById("videoModal");
  const modalFrame = document.getElementById("videoModalFrame");

  if (!grid || !statusEl) return;

  if (moreBtn) {
    moreBtn.setAttribute("href", CHANNEL_URL);
  }

  const setStatus = (msg) => {
    statusEl.textContent = msg;
  };

  const escapeHtml = (str) =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const capitalizeMonth = (formatted) => {
    const parts = String(formatted).split(" de ");
    if (parts.length !== 3) return formatted;
    const [day, month, year] = parts;
    const monthCap = month ? month.charAt(0).toUpperCase() + month.slice(1) : month;
    return `${day} de ${monthCap} de ${year}`;
  };

  const formatDateEs = (iso) => {
    try {
      const date = new Date(iso);
      const formatted = date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
      return capitalizeMonth(formatted);
    } catch {
      return "";
    }
  };

  const renderFeaturedSkeleton = () => {
    if (!featuredEl) return;
    featuredEl.innerHTML = `
      <article class="featured-card featured-card--skeleton">
        <div class="featured-card__img skeleton" style="height: clamp(280px, 45vw, 460px);"></div>
      </article>
    `;
  };

  const renderSkeletons = (count) => {
    grid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("article");
      el.className = "sermon-card sermon-card--skeleton";
      el.innerHTML = `
        <div class="sermon-card__img skeleton"></div>
        <div class="sermon-card__body">
          <div class="skeleton skeleton--title"></div>
          <div class="skeleton skeleton--meta"></div>
          <div class="skeleton skeleton--btn"></div>
        </div>
      `;
      grid.appendChild(el);
    }
  };

  const extractVideoId = (item) => {
    const link = String(item?.link || "");

    try {
      const url = new URL(link);
      const v = url.searchParams.get("v");
      if (v) return v;
    } catch {
      // ignore
    }

    const guid = String(item?.guid || "");
    const m = guid.match(/yt:video:([a-zA-Z0-9_-]{6,})/);
    if (m?.[1]) return m[1];
    return "";
  };

  const getThumbnailFromVideoId = (videoId) => {
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "assets/sermon-placeholder.svg";
  };

  const openModal = (videoId, title) => {
    if (!modal || !modalFrame) return;

    const safeTitle = escapeHtml(title || "Video");
    modalFrame.innerHTML = `
      <iframe
        title="${safeTitle}"
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        style="border:0;"
      ></iframe>
    `;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.documentElement.classList.add("is-modal-open");
  };

  const closeModal = () => {
    if (!modal || !modalFrame) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    modalFrame.innerHTML = "";
    document.documentElement.classList.remove("is-modal-open");
  };

  if (modal) {
    modal.addEventListener("click", (event) => {
      const shouldClose = event.target?.closest("[data-modal-close]");
      if (shouldClose) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  const renderFeatured = (it) => {
    if (!featuredEl) return;

    const videoId = extractVideoId(it);
    const title = String(it?.title || "Mensaje");
    const link = String(it?.link || "");
    const date = formatDateEs(it?.pubDate);
    const thumb = it?.thumbnail || getThumbnailFromVideoId(videoId);
    const safeTitle = escapeHtml(title);

    featuredEl.innerHTML = `
      <article class="featured-card animate animate--up">
        <button class="featured-card__media" type="button" aria-label="Ver último mensaje: ${safeTitle}">
          <img class="featured-card__img" src="${thumb}" alt="Miniatura del último mensaje: ${safeTitle}" loading="eager" fetchpriority="high" decoding="async" />
          <span class="featured-card__shade" aria-hidden="true"></span>
          <div class="featured-card__content">
            <span class="featured-card__badge" aria-hidden="true">Último mensaje</span>
            <h3 class="featured-card__title">${safeTitle}</h3>
            <p class="featured-card__meta">${escapeHtml(date)}</p>
            <div class="featured-card__actions">
              <a class="btn btn--primary btn--sm" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Ver ahora</a>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(CHANNEL_URL)}" target="_blank" rel="noreferrer">Ver más</a>
            </div>
          </div>
        </button>
      </article>
    `;

    const mediaBtn = featuredEl.querySelector(".featured-card__media");
    if (USE_MODAL && mediaBtn && videoId) {
      mediaBtn.addEventListener("click", () => openModal(videoId, title));
    } else if (mediaBtn && link) {
      mediaBtn.addEventListener("click", () => window.open(link, "_blank", "noopener,noreferrer"));
    }

    requestAnimationFrame(() => {
      featuredEl.querySelectorAll(".animate").forEach((el) => el.classList.add("is-visible"));
    });
  };

  const renderCards = (items) => {
    grid.innerHTML = "";

    items.forEach((it) => {
      const videoId = extractVideoId(it);
      const title = String(it?.title || "Mensaje");
      const link = String(it?.link || "");
      const date = formatDateEs(it?.pubDate);

      const thumb = it?.thumbnail || getThumbnailFromVideoId(videoId);
      const safeTitle = escapeHtml(title);

      const card = document.createElement("article");
      card.className = "sermon-card animate animate--up";
      card.innerHTML = `
        <button class="sermon-card__media" type="button" aria-label="Ver mensaje: ${safeTitle}">
          <img class="sermon-card__img" src="${thumb}" alt="Miniatura del mensaje: ${safeTitle}" loading="lazy" />
          <span class="sermon-card__overlay" aria-hidden="true"></span>
          <span class="sermon-card__play" aria-hidden="true">Ver</span>
        </button>
        <div class="sermon-card__body">
          <h3 class="sermon-card__title">${safeTitle}</h3>
          <p class="sermon-card__meta">${escapeHtml(date)}</p>
          <div class="sermon-card__actions">
            <a class="btn btn--primary btn--sm" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">
              Ver mensaje
            </a>
          </div>
        </div>
      `;

      const mediaBtn = card.querySelector(".sermon-card__media");
      if (USE_MODAL && mediaBtn && videoId) {
        mediaBtn.addEventListener("click", () => openModal(videoId, title));
      } else if (mediaBtn && link) {
        mediaBtn.addEventListener("click", () => window.open(link, "_blank", "noopener,noreferrer"));
      }

      grid.appendChild(card);
    });

    requestAnimationFrame(() => {
      grid.querySelectorAll(".animate").forEach((el) => el.classList.add("is-visible"));
    });
  };

  const fetchWithTimeout = async (url, options) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchText = async (url) => {
    const res = await fetchWithTimeout(url, { headers: { Accept: "text/plain, application/xml, text/xml, */*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  };

  const fetchJson = async (url) => {
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  };

  const fetchViaAllOrigins = async (targetUrl) => {
    const url = `${ALLORIGINS_RAW}${encodeURIComponent(targetUrl)}`;
    return await fetchText(url);
  };

  const rss2json = async (rssUrl, baseUrl) => {
    const url = `${baseUrl}${encodeURIComponent(rssUrl)}`;
    const data = await fetchJson(url);
    if (data?.status !== "ok") throw new Error("RSS2JSON error");
    return data;
  };

  const parseYouTubeRssXmlToItems = (xmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");

    if (doc.getElementsByTagName("parsererror")?.length) {
      throw new Error("XML parse error");
    }

    const entries = Array.from(doc.getElementsByTagName("entry"));

    return entries.map((entry) => {
      const title = entry.getElementsByTagName("title")?.[0]?.textContent || "";
      const published = entry.getElementsByTagName("published")?.[0]?.textContent || "";

      const links = Array.from(entry.getElementsByTagName("link"));
      const alt = links.find((l) => (l.getAttribute("rel") || "").toLowerCase() === "alternate") || links[0];
      const link = alt?.getAttribute("href") || "";

      const videoId =
        entry.getElementsByTagName("yt:videoId")?.[0]?.textContent ||
        entry.getElementsByTagName("videoId")?.[0]?.textContent ||
        "";

      const thumb = entry.getElementsByTagName("media:thumbnail")?.[0]?.getAttribute("url") || getThumbnailFromVideoId(videoId);

      return {
        title,
        link,
        pubDate: published,
        guid: videoId ? `yt:video:${videoId}` : "",
        thumbnail: thumb
      };
    });
  };

  const getChannelIdFromHandle = async (handle) => {
    const html = await fetchViaAllOrigins(`https://www.youtube.com/@${encodeURIComponent(handle)}`);

    const patterns = [
      /"channelId"\s*:\s*"(UC[\w-]+)"/,
      /"browseId"\s*:\s*"(UC[\w-]+)"/,
      /\/channel\/(UC[\w-]+)/
    ];

    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }

    return "";
  };

  const getFeedData = async (rssUrl) => {
    try {
      return await rss2json(rssUrl, RSS2JSON_V1);
    } catch {
      // ignore
    }

    try {
      return await rss2json(rssUrl, RSS2JSON_LEGACY);
    } catch {
      // ignore
    }

    const xml = await fetchViaAllOrigins(rssUrl);
    const items = parseYouTubeRssXmlToItems(xml);
    return { status: "ok", feed: { url: rssUrl }, items };
  };

  const extractChannelIdFromFeedUrl = (feedUrl) => {
    const m = String(feedUrl || "").match(/channel_id=(UC[a-zA-Z0-9_-]+)/);
    return m?.[1] || "";
  };

  const readCachedChannelId = () => {
    try {
      const raw = localStorage.getItem(CHANNEL_ID_CACHE_KEY);
      if (!raw) return "";
      const cached = JSON.parse(raw);
      if (cached?.expiresAt > Date.now() && typeof cached?.channelId === "string") return cached.channelId;
    } catch {
      // ignore
    }
    return "";
  };

  const writeCachedChannelId = (channelId) => {
    try {
      localStorage.setItem(
        CHANNEL_ID_CACHE_KEY,
        JSON.stringify({
          channelId,
          expiresAt: Date.now() + CHANNEL_ID_CACHE_TTL_MS
        })
      );
    } catch {
      // ignore
    }
  };

  const resolveChannelId = async () => {
    if (FALLBACK_CHANNEL_ID) return { channelId: FALLBACK_CHANNEL_ID, data: null };

    const cached = readCachedChannelId();
    if (cached) return { channelId: cached, data: null };

    // Intento rápido: algunos canales aún responden a feed legacy por user
    const legacyRss = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(HANDLE)}`;
    try {
      const data = await getFeedData(legacyRss);
      const channelId = extractChannelIdFromFeedUrl(data?.feed?.url);
      if (channelId) {
        writeCachedChannelId(channelId);
        return { channelId, data };
      }
      // si no hay channelId pero hay items, devolvemos data para no bloquear
      if (Array.isArray(data?.items) && data.items.length) return { channelId: "", data };
    } catch {
      // ignore
    }

    // Más lento: scrape del canal por handle (vía proxy CORS)
    const scraped = await getChannelIdFromHandle(HANDLE);
    if (scraped) {
      writeCachedChannelId(scraped);
      return { channelId: scraped, data: null };
    }

    return { channelId: "", data: null };
  };

  const fetchSermones = async () => {
    const cacheKey = `fortaleza_sermons_cache_${HANDLE}_${MAX_RESULTS}`;
    const now = Date.now();

    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.expiresAt > now && Array.isArray(cached?.items) && cached.items.length) {
          renderFeatured(cached.items[0]);
          renderCards(cached.items.slice(1));
          setStatus("Mostrando las prédicas más recientes.");
          return;
        }
      }
    } catch {
      // ignore
    }

    renderFeaturedSkeleton();
    renderSkeletons(Math.max(0, MAX_RESULTS - 1));
    setStatus("Cargando las prédicas más recientes…");

    try {
      const { channelId, data: fallbackData } = await resolveChannelId();

      let feedData = fallbackData;
      if (channelId) {
        const officialRss = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
        feedData = await getFeedData(officialRss);
      } else {
        const legacyRss = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(HANDLE)}`;
        feedData = await getFeedData(legacyRss);
      }

      const items = Array.isArray(feedData?.items) ? feedData.items.slice(0, MAX_RESULTS) : [];

      if (!items.length) {
        if (featuredEl) featuredEl.innerHTML = "";
        grid.innerHTML = "";
        setStatus("Aún no hay prédicas para mostrar.");
        return;
      }

      renderFeatured(items[0]);
      renderCards(items.slice(1));
      setStatus("Mostrando las prédicas más recientes.");

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ expiresAt: now + 6 * 60 * 60 * 1000, items }));
      } catch {
        // ignore
      }
    } catch {
      if (featuredEl) featuredEl.innerHTML = "";
      grid.innerHTML = "";
      setStatus("No pudimos cargar las prédicas en este momento.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchSermones);
  } else {
    fetchSermones();
  }
})();
