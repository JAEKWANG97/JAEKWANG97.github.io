---
title: "옵시디언에서 LLM Wiki를 실제로 어떻게 만들까?"
pubDatetime: 2026-08-05T09:16:00+09:00
featured: false
draft: false
tags:
  - "ai"
  - "llm"
  - "obsidian"
  - "second-brain"
  - "workflow"
  - "tutorial"
description: "빈 폴더에서 시작해 AGENTS.md를 작성하고, 자료 하나를 Ingest한 뒤 Query와 Lint까지 수행하는 옵시디언 LLM Wiki 실습입니다."
---

## 먼저 만들 결과

[앞선 글](/posts/was-i-already-using-llm-wiki/)에서는 안드레 카파시의 LLM Wiki에서 무엇을 배웠는지 정리했습니다. 이번에는 설명보다 실습에 집중해보겠습니다.

목표는 거대한 지식 시스템이 아닙니다. **자료 하나를 넣고, AI가 기존 지식에 편입하고, 나중에 다시 찾고 점검하는 가장 작은 LLM Wiki**를 만드는 것입니다.

실습이 끝나면 다음 구조가 남습니다.

```text
LLM-Wiki-Lab/
├── AGENTS.md
├── raw/
│   └── ai-workflow/
│       └── 2026-04-04-karpathy-llm-wiki.md
└── wiki/
    ├── ai-workflow/
    │   └── llm-wiki.md
    ├── index.md
    └── log.md
```

각 파일의 역할은 분명합니다.

- `raw/`: 원본을 그대로 보관합니다. AI도 수정하지 않습니다.
- `wiki/`: AI가 원본을 종합해 만든 지식 문서입니다.
- `AGENTS.md`: AI가 따라야 할 Ingest, Query, Lint 규칙입니다.
- `wiki/index.md`: 어떤 지식 문서가 있는지 찾는 목차입니다.
- `wiki/log.md`: 언제 어떤 작업을 했는지 남기는 기록입니다.

카파시의 원문은 이 아이디어가 특정 앱이나 정해진 구현이 아니라, 각자 사용하는 에이전트와 목적에 맞게 구체화해야 하는 패턴이라고 설명합니다. 그래서 이 실습에서는 별도 프로그램을 설치하지 않고 Markdown, Git, 파일을 수정할 수 있는 AI 에이전트만 사용합니다.

---

## 0. 기존 Vault 전체에서 바로 시작하지 않는다

처음부터 수년간 쌓은 옵시디언 Vault 전체를 AI에게 맡기지는 않는 편이 좋습니다. 링크가 대량으로 바뀌거나, 개인 기록이 외부 모델에 전달되거나, 원본과 AI의 해석이 섞일 수 있기 때문입니다.

먼저 별도 폴더를 만듭니다.

```bash
mkdir -p ~/LLM-Wiki-Lab/raw/ai-workflow
mkdir -p ~/LLM-Wiki-Lab/wiki/ai-workflow
cd ~/LLM-Wiki-Lab

git init
printf '# Knowledge Base Index\n' > wiki/index.md
printf '# Wiki Log\n' > wiki/log.md
```

옵시디언에서는 **Open folder as vault**로 `~/LLM-Wiki-Lab`을 열면 됩니다. 기존 Vault에 적용하고 싶다면 검증을 끝낸 뒤 이 구조를 하위 폴더로 옮기는 편이 안전합니다.

Git은 필수는 아니지만 사용하는 것을 권합니다. AI가 여러 Markdown 파일을 한 번에 수정하므로, 변경 전후를 확인하고 되돌릴 수 있어야 합니다.

---

## 1. 가장 먼저 AGENTS.md를 만든다

LLM Wiki에서 가장 중요한 파일은 화려한 인덱스가 아니라 운영 규칙입니다. 카파시는 이를 `AGENTS.md`나 `CLAUDE.md` 같은 **Schema 계층**으로 설명합니다.

프로젝트 루트의 `AGENTS.md`에 아래 내용을 넣습니다.

```markdown
# LLM Wiki 운영 규칙

## 범위

- `raw/`는 원본 보관 영역이다. 읽기만 하고 수정하지 않는다.
- `wiki/`는 AI가 생성·수정하는 지식 영역이다.
- 중요한 주장에는 반드시 `raw/` 원본 링크를 연결한다.

## Ingest

1. 새 원본을 읽는다.
2. `wiki/index.md`와 전체 `wiki/`를 검색한다.
3. New, Update, Disputed, No material 중 하나로 분류한다.
4. 변경할 파일과 이유를 먼저 보고하고 승인받는다.
5. 승인 후 관련 문서를 생성하거나 갱신한다.
6. `wiki/index.md`를 갱신하고 `wiki/log.md`에 기록한다.

## Query

- 먼저 `wiki/index.md`와 전체 `wiki/`를 검색한다.
- 위키에 있는 내용만 근거로 답하고 문서 링크를 인용한다.
- 사용자가 저장을 요청하지 않으면 파일을 수정하지 않는다.

## Lint

- 깨진 링크, 인덱스 누락, 원본 없는 주장, 고립 문서, 충돌하는 주장을 찾는다.
- 링크·인덱스처럼 기계적으로 안전한 수정만 자동 적용한다.
- 사실·해석 변경은 보고만 하고 승인받는다.
- 결과를 `wiki/log.md`에 추가한다.

## 변경 검증

- 작업 후 변경 파일 목록과 `git diff --stat` 결과를 보고한다.
- `raw/`가 수정됐다면 작업을 중단하고 알린다.
```

여기서 중요한 규칙은 세 가지입니다.

1. **원본은 수정하지 않습니다.** AI가 만든 자연스러운 문장보다 다시 확인할 수 있는 원본이 우선입니다.
2. **새 파일부터 만들지 않습니다.** 기존 문서에 합칠 내용인지 먼저 검색합니다.
3. **판단이 필요한 수정은 승인받습니다.** 깨진 링크 수정과 주장의 의미 변경을 같은 수준으로 자동화하지 않습니다.

처음부터 완벽한 규칙을 만들 필요는 없습니다. 실제로 잘못 분류하거나 출처를 빼먹는 문제가 생기면 그 실패를 `AGENTS.md`에 한 줄씩 반영하면 됩니다.

---

## 2. 첫 번째 원본을 raw에 넣는다

실습에서는 카파시의 LLM Wiki 원문 자체를 첫 자료로 사용합니다. 다음 명령은 Gist의 Markdown을 내려받고 출처 정보를 앞에 붙입니다.

```bash
cd ~/LLM-Wiki-Lab

SOURCE_URL="https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md"
RAW_FILE="raw/ai-workflow/2026-04-04-karpathy-llm-wiki.md"

{
  printf '# LLM Wiki — Andrej Karpathy\n\n'
  printf '> Source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f\n'
  printf '> Collected: %s\n' "$(date +%F)"
  printf '> Published: 2026-04-04\n\n'
  curl -fsSL "$SOURCE_URL"
} > "$RAW_FILE"
```

웹 글을 직접 수집할 때는 옵시디언 Web Clipper를 사용해도 됩니다. 어떤 방법을 쓰든 최소한 다음 정보는 남기는 편이 좋습니다.

```markdown
# 원본 제목

> Source: 원문 URL
> Collected: 수집한 날짜
> Published: 원문 공개일 또는 Unknown

원문 내용
```

원본 파일을 준비했다면 AI가 작업하기 전 상태를 먼저 커밋합니다.

```bash
git add AGENTS.md raw wiki/index.md wiki/log.md
git commit -m "chore: initialize llm wiki lab"
```

이제 Ingest 이후 `git diff -- raw/`가 비어 있는지 확인하면 원본이 변하지 않았다는 사실을 바로 알 수 있습니다.

---

## 3. Vault 폴더에서 AI 에이전트를 실행한다

에이전트의 현재 작업 폴더가 `LLM-Wiki-Lab`이어야 합니다. 그래야 루트의 `AGENTS.md`와 그 아래 Markdown 파일을 함께 읽을 수 있습니다.

Hermes CLI를 사용한다면 다음처럼 실행합니다.

```bash
cd ~/LLM-Wiki-Lab
hermes chat --checkpoints
```

Codex CLI나 Claude Code를 사용한다면 같은 폴더에서 해당 에이전트를 실행하면 됩니다. 파일 읽기·검색·수정 도구가 활성화되어 있어야 합니다.

처음부터 “이 글 정리해줘”라고만 요청하지 않습니다. 먼저 변경 계획을 확인합니다.

```text
raw/ai-workflow/2026-04-04-karpathy-llm-wiki.md를 Ingest해줘.

AGENTS.md 규칙을 따라 먼저 다음 작업만 해줘.
1. 원본을 읽는다.
2. wiki/index.md와 전체 wiki/를 검색한다.
3. New, Update, Disputed, No material 중 하나로 분류한다.
4. 생성하거나 수정할 파일과 각 변경 이유를 보고한다.

아직 파일은 수정하지 말고 내 승인을 기다려줘.
```

빈 위키에서 시작했으므로 첫 분류는 보통 `New`가 됩니다. 에이전트가 계획을 보여주면 범위를 확인한 뒤 적용을 승인합니다.

```text
승인해. 계획한 변경을 적용해줘.

추가 조건:
- raw/는 수정하지 않는다.
- wiki 문서의 중요한 주장에는 Raw 링크를 넣는다.
- wiki/index.md를 갱신한다.
- wiki/log.md에 ingest 기록을 추가한다.
- 완료 후 변경 파일 목록과 git diff --stat을 보여준다.
```

---

## 4. 첫 Ingest가 끝나면 무엇이 생겨야 할까

정상적으로 끝났다면 최소한 세 곳이 바뀝니다.

### 지식 문서

`wiki/ai-workflow/llm-wiki.md`는 다음 형태로 시작할 수 있습니다.

```markdown
# LLM Wiki

> Sources: Andrej Karpathy, 2026-04-04
> Raw: [Karpathy LLM Wiki](../../raw/ai-workflow/2026-04-04-karpathy-llm-wiki.md)
> Updated: 2026-08-05

## 한눈에 보기

LLM Wiki는 원본을 질문할 때마다 다시 조합하는 대신,
LLM이 연결된 Markdown 문서를 계속 갱신하는 지식 관리 방식이다.

## 세 개의 층

- raw: 수정하지 않는 원본
- wiki: LLM이 관리하는 종합 문서
- AGENTS.md: Ingest, Query, Lint 규칙
```

핵심은 원문 요약 파일 하나를 만드는 데 있지 않습니다. 이미 `wiki/`에 관련 문서가 있었다면 그 문서도 함께 갱신해야 합니다. 반대로 새로 추가할 지식이 없다면 `No material`로 기록하고 억지로 문서를 만들지 않아야 합니다.

### 인덱스

`wiki/index.md`에는 문서 링크와 한 줄 설명이 추가됩니다.

```markdown
# Knowledge Base Index

## ai-workflow

AI와 함께 지식을 축적하는 작업 방식을 정리한다.

| Article                             | Summary                                            | Updated    |
| ----------------------------------- | -------------------------------------------------- | ---------- |
| [LLM Wiki](ai-workflow/llm-wiki.md) | LLM이 지속적인 Markdown 지식베이스를 관리하는 방식 | 2026-08-05 |
```

### 작업 로그

`wiki/log.md`에는 시간순 기록이 추가됩니다.

```markdown
# Wiki Log

## [2026-08-05] ingest | LLM Wiki

- Disposition: New
- Raw: raw/ai-workflow/2026-04-04-karpathy-llm-wiki.md
```

실제 날짜는 작업한 날짜를 사용합니다. 형식을 일정하게 유지하면 나중에 최근 작업만 간단히 찾을 수 있습니다.

```bash
grep '^## \[' wiki/log.md | tail -5
```

---

## 5. AI의 “완료”를 그대로 믿지 않고 diff를 본다

Ingest가 끝나면 옵시디언에서 문서를 읽기 전에 터미널에서도 변경 범위를 확인합니다.

```bash
git status --short
git diff --stat
git diff -- raw/
git diff -- wiki/
git diff --check
```

확인할 것은 다음과 같습니다.

- `git diff -- raw/`에 아무 내용도 나오지 않는가
- 새 문서에 실제 원본 링크가 있는가
- 기존 문서를 불필요하게 대량 수정하지 않았는가
- `wiki/index.md`와 `wiki/log.md`가 함께 갱신됐는가
- Markdown 링크의 상대 경로가 맞는가

이 글의 예시 구조도 별도 Git 저장소에서 직접 만들고 Markdown 링크를 검사했습니다. `wiki/`의 문서 링크에서 존재하지 않는 대상은 0개였고, 첫 Ingest 결과는 `AGENTS.md`, 원본 1개, 지식 문서 1개, 인덱스, 로그까지 총 5개 파일이었습니다.

문제가 없다면 첫 결과를 커밋합니다.

```bash
git add wiki
git commit -m "docs: ingest Karpathy LLM Wiki"
```

---

## 6. Query는 기본적으로 파일을 수정하지 않는다

이제 위키에 질문해봅니다. 질문할 때도 검색 범위와 근거를 분명하게 지정합니다.

```text
내 LLM Wiki를 기준으로 다음 질문에 답해줘.

질문: LLM Wiki와 일반적인 RAG의 가장 큰 차이는 무엇인가?

규칙:
1. wiki/index.md를 먼저 읽는다.
2. 전체 wiki/에서 관련 용어와 동의어를 검색한다.
3. 찾은 wiki 문서를 근거로 답한다.
4. 답변마다 관련 Markdown 문서 링크를 인용한다.
5. 이번에는 어떤 파일도 수정하지 않는다.
```

여기서 중요한 점은 **일반 질문과 지식 저장을 분리하는 것**입니다. 모든 대화를 위키에 저장하면 문서 수만 빠르게 늘고 같은 내용이 반복됩니다.

답변이 다시 사용할 만한 비교나 분석이라면 그때 명시적으로 저장을 요청합니다.

```text
방금 답변은 다시 사용할 가치가 있어.
`wiki/ai-workflow/llm-wiki-vs-rag.md`에 별도 분석 문서로 저장해줘.

- 방금 인용한 wiki 문서를 Sources로 연결한다.
- wiki/index.md를 갱신한다.
- wiki/log.md에 query | Archived 기록을 추가한다.
- 기존 개념 문서는 수정하지 않는다.
```

이렇게 해야 일회성 질문과 축적할 지식을 사람이 구분할 수 있습니다.

---

## 7. Lint로 위키가 망가진 지점을 찾는다

문서가 몇 개 없을 때부터 Lint 형식을 정해두는 편이 좋습니다. 나중에 수백 개가 된 뒤 규칙을 추가하면 기존 문서를 전부 다시 손봐야 합니다.

```text
LLM Wiki를 Lint해줘.

검사 항목:
1. wiki/index.md에는 있지만 실제 파일이 없는 항목
2. 실제 파일은 있지만 index에 없는 문서
3. 깨진 Markdown 내부 링크와 Raw 링크
4. Raw 원본 없이 작성된 중요한 주장
5. 다른 문서에서 한 번도 연결되지 않은 고립 문서
6. 서로 충돌하지만 Disputed 표시가 없는 주장
7. 새 원본에 의해 오래됐지만 그대로 남은 주장

처리 규칙:
- 명확한 링크 경로와 index 누락만 자동 수정한다.
- 사실, 해석, 문서 통합은 수정하지 말고 보고한다.
- 수정 전후 파일 목록을 보여준다.
- 결과를 wiki/log.md에 `lint | N issues found, M auto-fixed` 형식으로 남긴다.
```

Lint 결과도 Git diff로 확인합니다.

```bash
git diff --stat
git diff --check
git diff -- wiki/index.md wiki/log.md
```

AI가 “모순을 해결했다”고 말하더라도 출처를 다시 보지 않고 한쪽 주장을 삭제하게 두면 안 됩니다. 출처끼리 다르면 두 주장을 남기고 `Disputed`로 표시하는 편이 안전합니다.

---

## 8. 실제 운영은 자료 하나씩 반복한다

처음에는 다음 주기만 반복하면 됩니다.

```text
자료 수집
→ raw에 원본 저장
→ Git 커밋
→ Ingest 계획 확인
→ 승인 후 wiki 갱신
→ Obsidian과 Git diff로 검토
→ 필요한 질문 수행
→ 저장할 가치가 있는 답만 Archive
→ 주기적으로 Lint
```

카파시도 원문에서 자료를 한 번에 대량 처리하기보다 하나씩 Ingest하면서 요약과 변경 내용을 확인하고, 무엇을 강조할지 안내하는 방식을 선호한다고 설명합니다.

처음부터 벡터 데이터베이스나 복잡한 검색 서버를 붙일 필요도 없습니다. 카파시는 중간 규모에서는 `index.md`를 먼저 읽고 필요한 문서로 들어가는 방식이 잘 동작했다고 적었습니다. 실제로 찾지 못하는 문제가 생겼을 때 전문 검색이나 벡터 검색을 추가해도 늦지 않습니다.

---

## 9. 기존 옵시디언 Vault에 옮길 때 정할 것

실습이 안정적으로 동작했다면 기존 Vault에 적용할 수 있습니다. 다만 폴더 이름을 그대로 복사하는 것보다 현재 구조와 역할을 맞추는 편이 좋습니다.

예를 들어 기존에 `Sources`와 `Resources`를 사용한다면 다음처럼 대응할 수 있습니다.

```text
SecondBrain/
├── Sources/          # raw 역할: 원본과 수집 자료
├── Resources/        # wiki 역할: 종합된 지식 문서
├── index.md
├── log.md
└── AGENTS.md
```

이때 먼저 결정해야 할 것은 폴더 이름이 아니라 경계입니다.

- AI가 절대 수정하면 안 되는 개인 기록은 어디인가
- 외부 모델에 전달하면 안 되는 자료는 무엇인가
- AI가 자유롭게 고쳐도 되는 종합 문서는 어디인가
- 출처 링크가 반드시 필요한 주장은 무엇인가
- 질문 결과를 저장할지 누가 결정하는가

특히 일기, 건강, 금융, 회사 내부 자료가 섞인 Vault라면 전체 폴더를 에이전트 작업 범위로 열지 않는 편이 안전합니다. 별도 Vault나 허용된 하위 폴더만 작업 경로로 지정하는 방법이 더 낫습니다.

---

## 선택 사항: 커뮤니티 Skill로 규칙을 확장하기

직접 작성한 `AGENTS.md`로 흐름을 이해한 뒤에는 커뮤니티 구현을 참고할 수도 있습니다. [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki)는 Ingest, Query, Lint 규칙과 문서 템플릿, 출처 검사 스크립트를 Agent Skill 형태로 제공합니다.

README에는 다음 설치 방법이 안내되어 있습니다.

```bash
npx add-skill Astro-Han/karpathy-llm-wiki
```

다만 이는 카파시의 공식 제품이 아니라 **비공식 커뮤니티 구현**입니다. 설치 전에 `SKILL.md`와 스크립트가 어떤 파일을 읽고 수정하는지 확인해야 합니다. 이 글의 기본 실습은 특정 Skill 없이도 원리를 이해하고 운영 규칙을 직접 통제할 수 있도록 구성했습니다.

---

## 마무리

LLM Wiki를 실제로 시작하는 데 필요한 것은 거대한 시스템이 아니었습니다.

1. 원본과 AI가 관리하는 문서를 분리합니다.
2. `AGENTS.md`에 Ingest, Query, Lint 규칙을 적습니다.
3. 자료 하나를 넣고 변경 계획부터 확인합니다.
4. AI의 완료 보고보다 Obsidian과 Git diff를 직접 봅니다.
5. 모든 답변이 아니라 다시 쓸 지식만 남깁니다.

앞선 글을 쓰며 LLM Wiki에서 지식을 계속 축적하는 관점을 배웠습니다. 이번 실습에서는 그 관점을 **원본 하나, 지식 문서 하나, 인덱스 하나, 로그 하나**로 직접 시작할 수 있게 구체화했습니다.

처음 일주일은 자동화보다 경계를 확인하는 데 쓰는 편이 좋습니다. AI가 어떤 문서를 잘못 합치고 어떤 출처를 놓치는지 알아야, 내 Vault에 맞는 운영 규칙도 만들 수 있습니다.

---

## 참고 자료

- [Andrej Karpathy, LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [Hermes Agent CLI Commands Reference](https://hermes-agent.nousresearch.com/docs/reference/cli-commands)
- [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki) — 비공식 Agent Skill 구현
- [LLM Wiki에서 무엇을 배웠고, 옵시디언에 어떻게 적용할까?](/posts/was-i-already-using-llm-wiki/)
