(() => {
  'use strict';
  const form = document.querySelector('.issue-controls');
  const search = document.querySelector('#issue-search');
  const tabsRoot = document.querySelector('.issue-tabs');
  const panel = document.querySelector('#issues-panel');
  const count = document.querySelector('#issue-count');
  const empty = document.querySelector('#issue-empty');
  if (!form || !search || !tabsRoot || !panel || !count || !empty) return;
  const tabs = [...tabsRoot.querySelectorAll('[role="tab"]')];
  const issues = [...panel.querySelectorAll('[data-issue]')];
  const groups = [...panel.querySelectorAll('[data-issue-group]')];
  const reset = form.querySelector('[type="reset"]');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ko');
  const params = new URLSearchParams(location.search);
  let category = tabs.some(tab => tab.dataset.category === params.get('category')) ? params.get('category') : 'all';
  search.value = params.get('q') || '';
  function update(syncUrl = false) {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean).map(term => term.replace(/^#(?=\d+$)/u, ''));
    const active = tabs.find(tab => tab.dataset.category === category);
    tabs.forEach(tab => {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', active.id);
    let matches = 0;
    const projects = new Set();
    issues.forEach(issue => {
      const inCategory = category === 'all' || issue.dataset.categories.split(' ').includes(category);
      issue.hidden = !(inCategory && terms.every(term => normalize(issue.dataset.search).includes(term)));
      if (!issue.hidden) { matches += 1; projects.add(issue.dataset.project); }
    });
    groups.forEach(group => { group.hidden = ![...group.querySelectorAll('[data-issue]')].some(issue => !issue.hidden); });
    count.textContent = `${matches}개 이슈 · ${projects.size}개 프로젝트`;
    empty.hidden = matches !== 0;
    reset.hidden = terms.length === 0;
    if (syncUrl) {
      const url = new URL(location.href);
      if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', category);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
      try { history.replaceState(null, '', url); } catch { /* Filtering also works for local files. */ }
    }
  }
  function activate(tab, focus = false) {
    category = tab.dataset.category;
    update(true);
    if (focus) tab.focus({ preventScroll: true });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
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
  form.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', () => update(true));
  form.addEventListener('reset', event => { event.preventDefault(); search.value = ''; update(true); search.focus(); });
  form.hidden = false;
  tabsRoot.hidden = false;
  update();
  if (category !== 'all') tabs.find(tab => tab.dataset.category === category).scrollIntoView({ block: 'nearest', inline: 'nearest' });
})();
