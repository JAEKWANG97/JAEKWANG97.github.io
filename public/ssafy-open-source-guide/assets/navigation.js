(() => {
  'use strict';
  const menu = document.querySelector('#document-menu');
  if (!menu) return;
  const mobile = window.matchMedia('(max-width: 960px)');
  const adjustMenu = () => { menu.open = !mobile.matches; };
  adjustMenu();
  mobile.addEventListener('change', adjustMenu);
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!mobile.matches) return;
      menu.open = false;
      const url = new URL(link.href, window.location.href);
      if (url.pathname === window.location.pathname && url.hash) {
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) {
          target.setAttribute('tabindex', '-1');
          window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
        }
      }
    });
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobile.matches && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });

  const links = [...menu.querySelectorAll('a[data-section]')];
  const sections = links.map((link) => ({
    link,
    section: document.getElementById(link.dataset.section),
  })).filter((item) => item.section);
  if (!sections.length) return;
  let waiting = false;
  const updateLocation = () => {
    const offset = mobile.matches ? 150 : 80;
    let current = sections[0];
    for (const item of sections) {
      if (item.section.getBoundingClientRect().top <= offset) current = item;
    }
    sections.forEach((item) => {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
    waiting = false;
  };
  window.addEventListener('scroll', () => {
    if (document.visibilityState === 'hidden') {
      updateLocation();
      return;
    }
    if (!waiting) {
      waiting = true;
      window.requestAnimationFrame(updateLocation);
    }
  }, { passive: true });
  window.addEventListener('resize', updateLocation);
  window.addEventListener('hashchange', updateLocation);
  document.addEventListener('visibilitychange', updateLocation);
  updateLocation();
})();
