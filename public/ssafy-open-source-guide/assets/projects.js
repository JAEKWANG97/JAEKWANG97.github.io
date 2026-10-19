(() => {
  'use strict';
  const form = document.querySelector('.project-filters');
  const search = document.querySelector('#project-search');
  const source = document.querySelector('#project-source');
  const count = document.querySelector('#project-count');
  const empty = document.querySelector('#project-empty');
  const tablist = document.querySelector('.project-tabs');
  const panel = document.querySelector('#project-panel');
  if (!form || !search || !source || !count || !empty || !tablist || !panel) return;
  const tabs = [...tablist.querySelectorAll('[role=tab]')];
  const rows = [...panel.querySelectorAll('.project')];
  const heading = document.querySelector('#groups-title');
  const reset = form.querySelector('[type=reset]');
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko');
  const params = new URLSearchParams(window.location.search);
  let category = tabs.some((tab) => tab.dataset.category === params.get('category')) ? params.get('category') : 'all';
  search.value = params.get('q') || '';
  if (['usage', 'survey'].includes(params.get('source'))) {
    source.value = params.get('source');
    source.closest('details').open = true;
  }
  function update() {
    const active = tabs.find((tab) => tab.dataset.category === category);
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    let matches = 0;
    let held = 0;
    tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab === active));
      tab.tabIndex = tab === active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', active.id);
    heading.textContent = category === 'all' ? '전체 프로젝트' : active.textContent;
    rows.forEach((row) => {
      const matchesCategory = category === 'all' || row.dataset.category === category;
      const matchesText = terms.every((term) => normalize(row.dataset.search).includes(term));
      const matchesSource = source.value === 'all' || row.dataset.sources.split(' ').includes(source.value);
      row.hidden = !(matchesCategory && matchesText && matchesSource);
      if (!row.hidden) {
        matches += 1;
        if (row.dataset.state !== 'candidate') held += 1;
      }
    });
    count.textContent = `${matches}개 프로젝트${held ? ` · 보류·제외 ${held}개 포함` : ''}`;
    empty.hidden = matches !== 0;
    reset.hidden = !terms.length && source.value === 'all';
  }
  function activate(tab, focus) {
    category = tab.dataset.category;
    update();
    if (focus) tab.focus({ preventScroll: true });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab, false));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next], true);
    });
  });
  form.hidden = false;
  tablist.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('reset', () => window.setTimeout(update, 0));
  search.addEventListener('input', update);
  source.addEventListener('change', update);
  update();
})();
