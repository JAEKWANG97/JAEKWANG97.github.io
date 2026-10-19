(() => {
  'use strict';
  const catalog = document.querySelector('#cohort-groups');
  const form = document.querySelector('.cohort-filters');
  const search = document.querySelector('#cohort-search');
  const count = document.querySelector('#cohort-count');
  const empty = document.querySelector('#cohort-empty');
  const tablist = document.querySelector('.cohort-tabs');
  const panel = document.querySelector('#cohort-panel');
  if (!catalog || !form || !search || !count || !empty || !tablist || !panel) return;
  const tabs = [...tablist.querySelectorAll('[role=tab]')];
  const examples = [...panel.querySelectorAll('[data-cohort-case]')];
  const rows = [...catalog.querySelectorAll('[data-cohort-entry]')];
  const heading = document.querySelector('#examples-title');
  const label = document.querySelector('#cohort-catalog-label');
  const total = document.querySelector('#cohort-category-count');
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko');
  const params = new URLSearchParams(window.location.search);
  let category = tabs.some((tab) => tab.dataset.category === params.get('category')) ? params.get('category') : 'all';
  search.value = params.get('q') || '';
  if (search.value) catalog.open = true;

  function update() {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    const active = tabs.find((tab) => tab.dataset.category === category);
    tabs.forEach((tab) => {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', active.id);
    heading.textContent = category === 'all' ? '대표 사례' : `${active.textContent} 대표 사례`;
    examples.forEach((example) => { example.hidden = category !== 'all' && example.dataset.category !== category; });
    let matches = 0;
    let categoryTotal = 0;
    rows.forEach((row) => {
      const inCategory = category === 'all' || row.dataset.category === category;
      if (inCategory) categoryTotal += 1;
      row.hidden = !(inCategory && terms.every((term) => normalize(row.dataset.search).includes(term)));
      if (!row.hidden) matches += 1;
    });
    label.textContent = category === 'all' ? '확인한 기여 기록' : `${active.textContent} 기여 기록`;
    total.textContent = `${categoryTotal}개 저장소`;
    count.hidden = terms.length === 0;
    count.textContent = `검색 결과 ${matches}개 저장소`;
    empty.hidden = matches !== 0;
  }

  function activate(tab, focus) {
    category = tab.dataset.category;
    if (search.value.trim()) catalog.open = true;
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
  search.addEventListener('input', update);
  update();
})();
