import type { CollectionEntry } from "astro:content";

export const CATEGORIES = [
  {
    slug: "project",
    name: "프로젝트",
    eyebrow: "BUILD",
    description:
      "AI와 문서, 자동화를 실제 작업 시스템으로 만들며 선택한 구조와 기준을 기록합니다.",
  },
  {
    slug: "problem-solving",
    name: "문제 해결",
    eyebrow: "SOLVE",
    description:
      "배포·성능·구현 과정에서 마주친 문제를 근거로 좁히고 해결한 과정을 담습니다.",
  },
  {
    slug: "internship",
    name: "인턴",
    eyebrow: "WORK",
    description:
      "사용자의 업무를 이해하고 동료와 협업하며 배운 일하는 방식을 돌아봅니다.",
  },
  {
    slug: "open-source",
    name: "오픈소스",
    eyebrow: "CONTRIBUTE",
    description:
      "낯선 코드베이스의 문맥을 읽고 리뷰를 통해 판단을 다듬은 기여 경험입니다.",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export type Category = (typeof CATEGORIES)[number];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find(category => category.slug === slug);
}

export function getCategoryPosts(
  posts: CollectionEntry<"posts">[],
  slug: CategorySlug
): CollectionEntry<"posts">[] {
  return posts.filter(({ data }) => data.category === slug);
}
