---
title: "Codex를 그냥 쓰지 말고 작은 작업 루프로 쓰기"
pubDatetime: 2026-06-25T12:20:00+09:00
featured: false
draft: false
tags:
  - "ai"
  - "codex"
  - "loop-engineering"
  - "ai-agent"
  - "developer-workflow"
description: "Codex를 단순히 코드 작성 도구로 쓰는 대신, 테스트 재현, 최소 수정, 재검증, 중단 조건을 가진 작은 작업 루프로 사용하는 방법을 정리했습니다."
---
## 들어가며

AI 코딩 도구를 쓰다 보면 처음에는 자꾸 이렇게 말하게 됩니다.

```text
이 버그 고쳐줘.
이 테스트 통과시켜줘.
이 코드 리팩터링해줘.
```

저도 비슷하게 생각했습니다. Codex 같은 도구는 “코딩을 대신해주는 에이전트”니까, 원하는 작업을 던지면 알아서 잘 해주길 기대하게 됩니다.

그런데 실제로 써보면 조금 애매한 지점이 생깁니다.

Codex가 코드를 고쳤다고 말했는데, 테스트를 돌려보면 아직 실패할 수 있습니다. 어떤 파일을 바꿨는지 봤더니 원래 건드리지 않아도 되는 부분까지 수정했을 수도 있습니다. 작은 버그 수정인 줄 알았는데 package dependency를 바꾸거나, public API에 가까운 코드를 건드릴 수도 있습니다.

이럴 때 문제는 Codex가 “멍청하다”라기보다, 제가 너무 넓은 권한과 너무 흐릿한 목표를 준 것에 가깝다고 느꼈습니다.

그래서 Codex를 잘 쓰려면 단순히 좋은 프롬프트를 쓰는 것보다, Codex가 움직일 수 있는 작은 작업 루프를 설계하는 쪽이 더 중요해집니다.

## Codex에게 일을 맡긴다는 것의 오해

Codex에게 일을 맡긴다는 말은 가끔 이렇게 들립니다.

```text
내가 할 일을 AI가 알아서 끝내준다.
```

물론 어느 정도는 맞습니다. Codex는 코드를 읽고, 수정하고, 테스트를 실행하고, 실패 로그를 볼 수 있습니다. 단순한 코드 생성 도구보다 훨씬 더 작업자에 가깝습니다.

하지만 여기서 한 가지를 구분해야 합니다.

```text
Codex가 코드를 수정할 수 있다.
```

와

```text
Codex에게 수정 권한과 판단 권한과 승인 권한을 모두 넘겨도 된다.
```

는 전혀 다른 말입니다.

제가 보기에는 Codex는 “구현자”로 두는 것이 가장 안전합니다. 문제를 분석하고, 작은 수정안을 만들고, 테스트를 돌려보는 역할에는 잘 맞습니다. 하지만 설계자, 검증자, 승인자 역할까지 모두 맡기면 위험합니다.

그래서 Codex를 사용할 때는 이런 구조가 더 안정적입니다.

```text
Codex = 구현 에이전트
테스트·린트·빌드 = 외부 검증기
Hermes = 오케스트레이터 / 검증자 / 기록자
Git worktree = 격리된 작업장
사람 = 최종 승인자
```

이 구조에서 Codex는 혼자 모든 것을 결정하지 않습니다. 정해진 범위 안에서 움직이고, 결과는 테스트와 diff로 확인하고, 위험한 결정은 사람에게 넘깁니다.

## 좋은 Codex 요청은 작은 루프를 가진다

나쁜 요청은 보통 이렇게 생겼습니다.

```text
Codex야, 이 버그 고쳐줘.
```

짧고 편하지만, Codex 입장에서는 모호합니다. 어떤 파일까지 봐도 되는지, 무엇을 바꾸면 안 되는지, 성공 기준이 무엇인지, 몇 번까지 시도해야 하는지 알 수 없습니다.

조금 더 나은 요청은 이렇게 바뀝니다.

```text
Codex야, 이 failing test를 고쳐줘.
단, 먼저 테스트를 실행해서 실패를 재현하고,
관련 파일만 최소 수정하고,
같은 테스트를 다시 실행하고,
같은 에러가 3회 반복되면 중단하고,
의존성 추가나 공개 API 변경은 승인 없이 하지 마.
완료하면 변경 파일, 실행 명령, 실제 테스트 결과, 남은 리스크를 보고해.
```

이 문장은 단순히 길어진 프롬프트가 아닙니다. 작은 루프가 들어 있습니다.

```text
실패 재현
→ 원인 추정
→ 최소 수정
→ 같은 테스트 재실행
→ 통과 여부 확인
→ 반복 실패 시 중단
→ 결과 보고
```

이 정도가 되어야 Codex에게 “계속 일해줘”라고 말할 수 있습니다. 그냥 계속 돌리는 것이 아니라, 무엇을 기준으로 계속할지와 언제 멈출지를 정해주는 것입니다.

## 가장 먼저 적용하기 좋은 루프: failing test 고치기

Codex에 Loop Engineering을 적용할 때 가장 현실적인 시작점은 failing test입니다.

이유는 간단합니다. 성공 기준이 명확하기 때문입니다.

```text
테스트가 실패한다.
Codex가 수정한다.
테스트를 다시 실행한다.
통과하면 성공이다.
```

물론 실제로는 이렇게 단순하지 않을 수 있습니다. 테스트 자체가 잘못됐을 수도 있고, 환경 문제일 수도 있고, flaky test일 수도 있습니다. 그래도 “무엇으로 확인할지”가 있다는 점에서 좋은 출발점입니다.

예를 들어 Codex에게 이런 식으로 맡길 수 있습니다.

```text
Fix the failing test.

Repository context:
- Work only in src/auth and tests/auth.
- Do not change package dependencies.
- Do not change public API behavior unless tests prove it is required.

Loop:
1. Run `npm test -- auth` first.
2. Read the failure output.
3. Make the smallest code change.
4. Re-run `npm test -- auth`.
5. If the same failure repeats 3 times, stop and report root-cause hypotheses.
6. If it passes, run `npm run lint`.

Return:
- changed files
- commands run
- exact test/lint result
- risks
```

여기서 제가 중요하게 보는 부분은 “테스트를 먼저 실행하라”입니다.

AI에게 바로 고치라고 하면, 현재 실패를 제대로 재현하지 않고 수정부터 시작할 수 있습니다. 그런데 실패를 재현하지 못하면, 나중에 통과했다고 말해도 그게 진짜 해결인지 알기 어렵습니다.

그래서 Codex에게 맡길 때도 사람 개발자처럼 시작하게 하는 것이 좋습니다.

```text
먼저 깨진 것을 본다.
그다음 고친다.
다시 같은 방식으로 확인한다.
```

## PR Babysitter와 CI Sweeper는 “자동 수정”보다 “자동 관찰”부터

Codex를 조금 더 루프답게 쓰려면 PR이나 CI를 지켜보게 할 수도 있습니다.

예를 들어 PR Babysitter는 이런 역할입니다.

```text
주기적으로 PR 확인
→ CI 실패 여부 확인
→ 리뷰 대기 여부 확인
→ merge conflict 확인
→ 다음 행동 후보 정리
```

처음부터 Codex가 PR을 고치고 push하고 merge하게 만들 필요는 없습니다. 오히려 처음에는 report-only가 좋습니다.

```text
Check open PRs and summarize:
- CI status
- merge conflicts
- review blockers
- likely next action

Do not modify files.
Return only a prioritized report.
```

이 정도만 해도 꽤 유용할 수 있습니다. 사람이 매번 GitHub를 열어 확인하던 반복적인 관찰을 Codex가 대신 정리해주기 때문입니다.

CI Sweeper도 비슷합니다.

```text
CI 실패 확인
→ 로그 읽기
→ flaky test인지 실제 regression인지 분류
→ 간단한 수정 가능 여부 판단
→ 필요하면 사람에게 넘김
```

여기서도 중요한 것은 자동 수정이 아닙니다. 먼저 자동 분류와 자동 요약입니다.

```text
Analyze the latest CI failure.

Rules:
- First classify the failure: flaky test, environment issue, dependency issue, or code regression.
- Do not modify files unless the failure is a clear code regression.
- If modifying, make the smallest possible change.
- Run the relevant test locally.
- Stop after 2 failed fix attempts.

Return:
- failure classification
- evidence from logs
- files changed, if any
- test result
- whether human review is required
```

이런 식으로 보면 Codex 루프의 첫 단계는 “AI가 알아서 고친다”가 아니라 “AI가 반복적인 관찰과 정리를 대신한다”에 가깝습니다.

## 병렬로 돌릴수록 worktree가 중요해진다

Codex를 하나만 쓸 때는 크게 느끼지 못할 수 있지만, 여러 작업을 동시에 맡기기 시작하면 바로 문제가 생깁니다.

같은 repo에서 Codex A와 Codex B가 동시에 파일을 수정하면 어떻게 될까요? 둘 다 맞는 수정을 했더라도 working tree가 섞입니다. 어느 변경이 어떤 문제를 해결한 것인지 추적하기 어려워집니다.

그래서 병렬 작업에는 worktree가 중요합니다.

```text
main repo
├── worktree-issue-101
├── worktree-issue-102
└── worktree-review
```

각 Codex는 자기 작업장 안에서만 움직입니다.

```bash
git worktree add ../project-issue-101 -b codex/issue-101
git worktree add ../project-issue-102 -b codex/issue-102
```

그리고 각각의 worktree에서 별도 작업을 맡깁니다.

```bash
cd ../project-issue-101
codex "Fix issue #101. Run tests. Do not change dependencies."

cd ../project-issue-102
codex "Fix issue #102. Run tests. Do not change public API."
```

이렇게 하면 병렬 작업을 하더라도 충돌을 줄일 수 있습니다. 나중에 각 worktree에서 `git diff`, 테스트 결과, 변경 파일을 확인하고 하나씩 받아들이면 됩니다.

저는 이 부분이 AI 코딩 에이전트를 “여러 명의 작업자”처럼 쓰기 위한 기본 안전장치라고 느꼈습니다. 작업자가 여러 명이면 작업 공간도 분리되어야 합니다.

## 상태를 파일에 남겨야 같은 실패를 반복하지 않는다

Codex를 반복해서 쓰다 보면 또 하나 문제가 생깁니다.

대화 안에서는 맥락을 어느 정도 기억하지만, 세션이 바뀌거나 작업이 길어지면 이전에 무엇을 시도했는지 흐려질 수 있습니다. 그러면 같은 실패를 다시 반복하게 됩니다.

이때 필요한 것이 상태 파일입니다.

예를 들면 repo에 이런 파일을 둘 수 있습니다.

```text
AGENTS.md
LOOP.md
STATE.md
loop-run-log.md
```

각 파일의 역할은 조금씩 다릅니다.

`AGENTS.md`에는 프로젝트 규칙과 테스트 명령을 적습니다.

```md
# Agent Instructions

## Project rules
- Do not change public API without approval.
- Do not add dependencies without approval.
- Prefer minimal diffs.
- Run tests before reporting success.

## Test commands
- Unit tests: npm test
- Lint: npm run lint
- Typecheck: npm run typecheck
```

`LOOP.md`에는 루프 정책을 적습니다.

```md
# Loop Policy

## Allowed loops
- Daily Triage: report-only
- Failing Test Fix: max 3 attempts
- PR Babysitter: report-only unless approved

## Stop conditions
- Same error repeats 3 times
- Dependency change required
- DB migration required
- Secret or credential required
- More than 5 files need changes

## Human approval required
- package.json changes
- schema changes
- deployment
- merge/push to main
```

`STATE.md`에는 지금 무엇을 하고 있고, 지난번에 무엇을 시도했는지 남깁니다.

```md
# Agent State

## Current focus
- Auth failing test investigation

## Last attempts
- test_auth_signup failed due to missing validation branch
- Attempted fix in src/auth/signup.ts
- Still failing on duplicate email case

## Human inbox
- Need decision: should duplicate email return 400 or 409?
```

이런 파일은 사람에게도 좋고 Codex에게도 좋습니다. 사람은 현재 상황을 빠르게 이해할 수 있고, Codex는 매번 처음부터 추측하지 않아도 됩니다.

특히 `STATE.md`는 중요합니다. 루프가 길어질수록 “지난번에 무엇을 했고 왜 실패했는지”가 다음 시도의 품질을 좌우하기 때문입니다.

## 자동화 수준은 천천히 올리는 게 좋다

Codex 루프를 설계한다고 해서 처음부터 자동 PR, 자동 merge까지 가야 하는 것은 아닙니다. 오히려 그 반대가 더 안전합니다.

저는 단계적으로 보면 좋다고 생각합니다.

```text
L1: Report-only
    Codex가 보기만 하고 요약한다.

L2: Patch proposal
    Codex가 branch/worktree에서 수정안을 만든다.
    테스트도 실행한다.
    하지만 push/merge는 하지 않는다.

L3: Assisted PR
    Codex가 PR 초안까지 만든다.
    사람 승인 후 merge한다.

L4: Limited auto-merge
    정말 안전한 범위만 자동 merge한다.
    예: 문서 오타, changelog, patch dependency.
```

개인 작업에서는 L1과 L2만으로도 충분히 쓸모가 있을 것 같습니다.

매일 아침 repo 상태를 요약해주고, 작은 failing test는 worktree에서 수정안을 만들어주고, 테스트 결과와 diff를 보여주는 정도만 되어도 사람이 반복적으로 쓰던 시간을 꽤 줄일 수 있습니다.

반대로 L3, L4는 신중해야 합니다. 자동 PR까지는 괜찮을 수 있지만, 자동 merge는 검증 체계와 권한 관리가 없으면 위험합니다.

## Hermes와 Codex를 같이 쓰면 역할이 더 분명해진다

Codex만 단독으로 써도 루프를 만들 수 있습니다. 하지만 Hermes와 함께 쓰면 역할 분리가 더 자연스럽습니다.

제가 생각하는 구조는 이렇습니다.

```text
Hermes = PM / 오케스트레이터 / 검증자
Codex = 구현 에이전트
Git worktree = 격리된 작업장
Tests = 외부 검증기
Obsidian = 해석과 회고 저장소
GitHub / Linear = 작업 상태 저장소
```

흐름으로 보면 다음과 같습니다.

```text
1. Hermes가 repo 상태를 확인한다.
2. 작은 작업 하나를 선택한다.
3. worktree를 만든다.
4. Codex에게 범위가 정해진 prompt를 전달한다.
5. Codex가 수정한다.
6. Hermes가 git diff, test, lint로 검증한다.
7. 실패하면 로그를 다시 Codex에게 전달한다.
8. 같은 실패가 반복되면 중단한다.
9. 성공하면 사람에게 보고한다.
10. 사람 승인 후 commit 또는 PR을 진행한다.
```

이 구조에서 Codex의 “완료했습니다”는 증거가 아닙니다. 증거는 실제 테스트 출력, lint 결과, git diff, 변경 파일 목록입니다.

이 구분이 중요합니다. AI가 그럴듯하게 말하는 것과 실제로 검증된 것은 다르기 때문입니다.

## 마무리

Codex를 잘 쓴다는 것은 Codex에게 더 많은 자유를 주는 일이 아닐 수 있습니다.

오히려 반대에 가깝습니다.

작업을 작게 자르고, 범위를 정하고, 검증 명령을 알려주고, 반복 횟수를 제한하고, 위험한 순간에는 멈추게 하는 것. 그게 Codex를 더 안전하고 실용적으로 쓰는 방법에 가깝다고 느꼈습니다.

정리하면 이렇게 말할 수 있습니다.

```text
작업은 작게
범위는 명확하게
검증은 실제 명령으로
반복은 제한적으로
상태는 파일에 남기고
merge / deploy는 사람 승인
병렬 작업은 worktree로
```

Codex는 구현자로 쓰고, 테스트와 Hermes는 검증자로 두고, 사람은 승인자와 설계자로 남는 구조.

저는 이게 Codex에 Loop Engineering을 적용하는 가장 현실적인 출발점이라고 생각합니다.

## 참고 자료

- Codex에 Loop Engineering 적용하기
- Loop Engineering - AI 에이전트 반복 루프 설계 보고서
- AI에게 일을 맡긴다는 건 프롬프트가 아니라 루프를 설계하는 일이다
- GitHub, `cobusgreyling/loop-engineering`  
  https://github.com/cobusgreyling/loop-engineering
- Addy Osmani, “Loop Engineering”  
  https://addyosmani.com/blog/loop-engineering/
- Business Insider, “Forget Prompts: ‘Loop Engineering’ Is All the Rage Now”  
  https://www.businessinsider.com/what-are-loops-ai-engineering-tips-2026-6
