# JAEKWANG97.github.io

AstroPaper 기반 개인 기술 블로그입니다.

## 개발

```bash
pnpm install
pnpm run dev
```

## 빌드

```bash
pnpm run build
```

## 글 작성

새 글은 `src/content/posts/` 아래에 Markdown 또는 MDX로 작성합니다.

필수 frontmatter 예시:

```yaml
---
title: 글 제목
slug: post-slug
pubDatetime: 2026-05-27T15:16:56Z
draft: false
tags:
  - backend
description: 검색 결과와 OG 메타에 들어갈 글 요약
---
```
