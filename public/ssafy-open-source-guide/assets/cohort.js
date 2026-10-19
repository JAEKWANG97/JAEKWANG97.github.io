(() => {
  'use strict';
  const catalog = document.querySelector('#cohort-groups');
  const form = document.querySelector('.cohort-filters');
  const search = document.querySelector('#cohort-search');
  const count = document.querySelector('#cohort-count');
  const empty = document.querySelector('#cohort-empty');
  if (!catalog || !form || !search || !count || !empty) return;
  const rows = [...catalog.querySelectorAll('[data-cohort-entry]')];
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko');
  search.value = new URLSearchParams(window.location.search).get('q') || '';
  if (search.value) catalog.open = true;
  function update() {
    const terms = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    let matches = 0;
    rows.forEach((row) => {
      row.hidden = !terms.every((term) => normalize(row.dataset.search).includes(term));
      if (!row.hidden) matches += 1;
    });
    count.hidden = terms.length === 0;
    count.textContent = `검색 결과 ${matches}개 저장소`;
    empty.hidden = matches !== 0;
  }
  form.hidden = false;
  form.addEventListener('submit', (event) => event.preventDefault());
  search.addEventListener('input', update);
  update();
})();
