(() => {
  'use strict';
  const form = document.querySelector('.cohort-filters');
  const search = document.querySelector('#cohort-search');
  const state = document.querySelector('#cohort-state');
  const count = document.querySelector('#cohort-count');
  const empty = document.querySelector('#cohort-empty');
  if (!form || !search || !state || !count || !empty) return;
  const groups = [...document.querySelectorAll('[data-cohort-group]')];
  const rows = groups.flatMap((group) => [...group.querySelectorAll('[data-cohort-entry]')]);
  const openBeforeFilter = new Map(groups.map((group) => [group, group.open]));
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko');
  let wasFiltering = false;
  const params = new URLSearchParams(window.location.search);
  search.value = params.get('q') || '';
  if (['MERGED', 'OPEN', 'CLOSED'].includes(params.get('state'))) state.value = params.get('state');

  function update() {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    const filtering = terms.length > 0 || state.value !== 'all';
    if (filtering && !wasFiltering) groups.forEach((group) => openBeforeFilter.set(group, group.open));
    let visible = 0;
    rows.forEach((row) => {
      const matchesText = terms.every((term) => normalize(row.dataset.search).includes(term));
      row.hidden = !(matchesText && (state.value === 'all' || row.dataset.state === state.value));
      if (!row.hidden) visible += 1;
    });
    groups.forEach((group) => {
      const matches = [...group.querySelectorAll('[data-cohort-entry]')].filter((row) => !row.hidden).length;
      group.hidden = matches === 0;
      group.querySelector('.group-count').textContent = String(matches);
      if (filtering) group.open = matches > 0;
      else if (wasFiltering) group.open = openBeforeFilter.get(group) || false;
    });
    count.textContent = filtering ? `조건에 맞는 PR 제출 대상 ${visible}개 저장소.` : `PR 제출 대상 ${rows.length}개 저장소. 분야별 세부 항목을 확인할 수 있습니다.`;
    empty.hidden = visible !== 0;
    wasFiltering = filtering;
  }
  form.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', update);
  state.addEventListener('change', update);
  form.addEventListener('reset', () => window.setTimeout(update, 0));
  update();
})();
