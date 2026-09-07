import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPosts, validateSearchInput, type SearchPost } from '../src/utils/post-search.ts';

const posts: SearchPost[] = [
  { title: 'WebMCP와 AI', excerpt: '브라우저 도구', tags: ['web'], url: '/posts/webmcp/', date: '2026-09-07' },
  { title: '검색 이야기', excerpt: 'WebMCP와 AI 활용', tags: ['ai'], url: '/posts/search/', date: '2026-09-08' },
  { title: '데이터 기록', excerpt: 'SQL 인덱스', tags: ['data'], url: '/posts/data/', date: '2026-09-06' },
];
test('제목을 우선하고 대소문자를 구분하지 않는다', () => {
  const result = searchPosts(posts, { query: 'webmcp', limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.results[0].url, '/posts/webmcp/');
  assert.equal(result.results.length, 1);
});
test('여러 검색어는 모두 포함하고 태그도 검색한다', () => {
  assert.equal(searchPosts(posts, { query: 'WebMCP SQL' }).total, 0);
  assert.equal(searchPosts(posts, { query: 'data' }).results[0].title, '데이터 기록');
  assert.equal(searchPosts(posts, { query: 'ＷｅｂＭＣＰ' }).total, 2);
});
test('입력을 검증하고 원본 데이터를 변경하지 않는다', () => {
  for (const input of [
    null,
    [],
    {},
    { query: '' },
    { query: '   ' },
    { query: 3 },
    { query: 'a'.repeat(101) },
    { query: 'AI', limit: 0 },
    { query: 'AI', limit: 11 },
    { query: 'AI', limit: 1.5 },
  ]) {
    assert.throws(() => validateSearchInput(input));
  }
  const before = structuredClone(posts);
  searchPosts(posts, { query: ' AI ' });
  assert.deepEqual(posts, before);
  assert.deepEqual(validateSearchInput({ query: ' AI ' }), { query: 'AI', limit: 5 });
});
