(() => {
  'use strict';
  const form = document.querySelector('.project-filters');
  const search = document.querySelector('#project-search');
  const source = document.querySelector('#project-source');
  const count = document.querySelector('#project-count');
  const empty = document.querySelector('#project-empty');
  const groups = [...document.querySelectorAll('[data-project-group]')];
  if (!form || !search || !source || !count || !empty) return;

  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko');
  const rows = groups.flatMap((group) => [...group.querySelectorAll('.project')]);
  const originalOpen = new Map(groups.map((group) => [group, group.open]));
  let wasFiltering = false;
  const params = new URLSearchParams(window.location.search);
  search.value = params.get('q') || '';
  const initialSource = params.get('source');
  if (['usage', 'survey'].includes(initialSource)) {
    source.value = initialSource;
    const options = source.closest('details');
    if (options) options.open = true;
  }

  function update() {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    const filtering = terms.length > 0 || source.value !== 'all';
    if (filtering && !wasFiltering) {
      groups.forEach((group) => originalOpen.set(group, group.open));
    }
    let active = 0;
    let held = 0;
    rows.forEach((row) => {
      const haystack = normalize(row.dataset.search || '');
      const matchesText = terms.every((term) => haystack.includes(term));
      const sources = (row.dataset.sources || '').split(' ');
      const matchesSource = source.value === 'all' || sources.includes(source.value);
      const visible = matchesText && matchesSource;
      row.hidden = !visible;
      if (visible) {
        if (row.dataset.state === 'candidate') active += 1;
        else held += 1;
      }
    });
    groups.forEach((group) => {
      const matches = [...group.querySelectorAll('.project')].filter((row) => !row.hidden);
      group.hidden = matches.length === 0;
      const badge = group.querySelector('.group-count');
      if (badge) badge.textContent = String(matches.length);
      if (filtering) group.open = matches.length > 0;
      else if (wasFiltering) group.open = originalOpen.get(group) || false;
    });
    count.textContent = filtering ? `검색 결과 ${active + held}개${held ? ` · 보류·제외 ${held}개 포함` : ''}` : `${rows.length}개 조사 대상`;
    form.querySelector('[type=reset]').hidden = !filtering;
    empty.hidden = active + held !== 0;
    wasFiltering = filtering;
  }

  form.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', update);
  source.addEventListener('change', update);
  form.addEventListener('reset', () => {
    // Reset happens after this event's default action, including on file: URLs.
    window.setTimeout(update, 0);
  });
  update();
})();
