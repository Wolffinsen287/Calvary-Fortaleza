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

  const scrollToHash = (hash) => {
    const id = (hash || '').replace('#', '');
    if (!id) return;

    const el = document.getElementById(id);
    if (!el) return;

    const y = el.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
    window.scrollTo({ top: y, behavior: 'smooth' });
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
