export interface SearchPost {
  title: string;
  excerpt: string;
  tags: string[];
  url: string;
  date: string;
}

export interface SearchInput {
  query: string;
  limit?: number;
}

export function validateSearchInput(input: unknown): Required<SearchInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('검색 조건이 필요합니다.');
  const { query, limit = 5 } = input as SearchInput;
  if (typeof query !== 'string' || !query.trim() || query.length > 100) {
    throw new TypeError('검색어는 1~100자로 입력해주세요.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new TypeError('결과 개수는 1~10이어야 합니다.');
  return { query: query.trim(), limit };
}

const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ko-KR');

export function searchPosts(posts: SearchPost[], input: unknown) {
  const { query, limit } = validateSearchInput(input);
  const terms = [...new Set(normalize(query).split(/\s+/))];
  const matches = posts
    .map((post) => {
      const fields = [normalize(post.title), normalize(post.tags.join(' ')), normalize(post.excerpt)];
      const scores = terms.map((term) =>
        fields.reduce((score, field, i) => score + (field.includes(term) ? [5, 3, 1][i] : 0), 0)
      );
      return { post, score: scores.every((score) => score > 0) ? scores.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date));
  return { query, total: matches.length, results: matches.slice(0, limit).map(({ post }) => post) };
}
