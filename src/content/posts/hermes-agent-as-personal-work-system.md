---
title: "Hermes Agent는 왜 단순한 챗봇이 아니라 작업 시스템처럼 느껴질까"
pubDatetime: 2026-05-26T10:00:00+09:00
featured: false
draft: false
tags:
  - "ai"
  - "hermes-agent"
  - "productivity"
  - "second-brain"
  - "workflow"
description: "요즘 AI 도구를 쓰다 보면 가끔 이런 생각이 듭니다. “분명히 답변은 잘하는데, 왜 매번 처음부터 다시 설명하는 느낌이 들까?” ChatGPT든 Claude든 Codex든, 대부분의 AI 도구는 한 번의 대화 안에서는 꽤 똑똑하게 움직입니다. 코드를 읽고, 문서를 정리하고, "
---

## 들어가며

요즘 AI 도구를 쓰다 보면 가끔 이런 생각이 듭니다.

“분명히 답변은 잘하는데, 왜 매번 처음부터 다시 설명하는 느낌이 들까?”

ChatGPT든 Claude든 Codex든, 대부분의 AI 도구는 한 번의 대화 안에서는 꽤 똑똑하게 움직입니다. 코드를 읽고, 문서를 정리하고, 글 초안을 만들고, 버그 원인을 추적합니다. 그런데 대화가 끝나면 많은 것이 흩어집니다. 내가 어떤 방식으로 일하는지, 어떤 실수를 반복했는지, 어떤 프로젝트에서 어떤 판단 기준을 세웠는지, 어떤 자료를 어디에 저장해두었는지는 도구 바깥에 남습니다.

그래서 AI를 오래 쓰다 보면 단순히 “답을 잘하는 모델”보다 “내 작업 환경 안에서 계속 이어지는 시스템”이 더 중요해지는 것 같습니다.

이번에 Hermes Agent 관련 공식 문서, 커뮤니티 글, SNS/LinkedIn 사례들을 찾아보면서 느낀 핵심도 여기에 가까웠습니다. Hermes Agent는 그냥 터미널에서 대화하는 챗봇이라기보다는, 기억하고, 도구를 쓰고, 스킬을 축적하고, 필요한 경우 subagent나 cron 작업까지 동원하는 개인 작업 시스템에 가깝습니다.

이 글은 Hermes Agent를 소개하는 글이라기보다는, 제가 여러 자료를 보면서 “이 도구를 어떻게 써야 내 작업 방식에 도움이 될까?”를 정리한 글입니다.

## Hermes Agent의 핵심은 “답변”보다 “이어지는 작업”에 있다

Hermes Agent 공식 소개에서 반복해서 나오는 표현은 “An agent that grows with you”입니다. 직역하면 “당신과 함께 성장하는 에이전트” 정도인데, 처음 들으면 조금 추상적으로 느껴집니다.

그런데 문서와 사례를 같이 보면 이 말이 꽤 구체적으로 다가옵니다.

Hermes가 강조하는 축은 대략 네 가지입니다.

- persistent memory
- skills
- tool access
- background/durable workflows

일반적인 챗봇은 사용자가 질문을 던지면 답을 줍니다. 물론 파일을 읽거나 웹을 검색하거나 코드를 실행할 수도 있습니다. 하지만 Hermes는 여기서 한 발 더 나아가 “이 작업에서 배운 절차를 다음에도 다시 쓸 수 있게 남기는 것”을 중요하게 봅니다.

예를 들어 어떤 프로젝트에서 테스트를 고치기 위해 여러 번 삽질했다고 해보겠습니다. 그냥 대화가 끝나면 그건 한 번의 해결 경험으로 사라집니다. 하지만 Hermes에서는 그 과정이 반복 가능한 절차라면 skill로 저장할 수 있습니다. 다음에 비슷한 상황이 오면 에이전트가 그 skill을 불러와서 처음부터 같은 실수를 반복하지 않게 됩니다.

이게 단순한 메모와 다른 점은, 사람이 읽기 위한 기록만이 아니라 에이전트가 다음 작업에서 실제로 참고할 수 있는 절차 지식이라는 점입니다.

저는 이 부분이 꽤 중요하게 느껴졌습니다. 취업 준비나 포트폴리오 프로젝트를 하다 보면, 결과물보다 더 중요한 것이 “내가 어떻게 판단하고 검증했는가”일 때가 많습니다. 그런데 그 판단 과정은 매번 흩어지기 쉽습니다. Hermes의 memory와 skill은 이 흩어지는 과정을 조금 더 구조화해서 남기는 장치로 볼 수 있습니다.

## 공식 문서에서 보이는 좋은 사용 패턴

공식 문서 기준으로 우선 읽을 만한 부분은 다음 정도였습니다.

- Tips & Best Practices
  - https://hermes-agent.nousresearch.com/docs/guides/tips/
- Delegation & Parallel Work
  - https://hermes-agent.nousresearch.com/docs/guides/delegation-patterns
- Kanban
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Profiles
  - https://hermes-agent.nousresearch.com/docs/user-guide/profiles/
- Working with Skills
  - https://hermes-agent.nousresearch.com/docs/guides/work-with-skills
- Cron
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- Memory
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/memory

여기서 제가 본 핵심은 “작업의 성격에 따라 다른 실행 방식을 고르라”는 것입니다.

간단한 질문이나 짧은 수정은 그냥 현재 대화에서 처리하면 됩니다. 굳이 복잡하게 나눌 필요가 없습니다.

하지만 복잡한 문제는 다릅니다. 예를 들어 코드 리뷰, 원인 분석, 설계 비교, 글쓰기 방향 비교처럼 한 가지 답이 정답이라고 보기 어려운 작업은 subagent를 여러 개 돌려 후보를 만들고, 그 결과를 다시 평가하는 방식이 더 좋을 수 있습니다.

또 장기 프로젝트나 여러 단계가 얽힌 작업은 단발성 대화보다 kanban이나 cron 같은 구조가 더 어울립니다. 예를 들어 “매일 내 작업 로그를 보고 반복되는 실수를 정리해줘” 같은 일은 사람이 매번 요청하기보다 scheduled task로 두는 것이 자연스럽습니다.

정리하면 이런 식입니다.

- 지금 바로 끝나는 단순 작업: 현재 대화에서 처리
- 비교와 판단이 필요한 작업: subagent/delegation 사용
- 장기적으로 상태가 필요한 작업: kanban 사용
- 반복적으로 확인해야 하는 작업: cron 사용
- 다음에도 반복될 절차: skill로 저장
- 사용자의 선호/환경처럼 계속 유효한 정보: memory로 저장

이 구분이 마음에 들었습니다. AI 도구를 잘 쓰는 것은 단순히 프롬프트를 잘 쓰는 문제가 아니라, 작업의 성격에 맞는 실행 구조를 고르는 문제에 가깝다는 생각이 들었습니다.

## LinkedIn 사례 1: 작업 로그를 분석해서 다음 날 더 똑똑하게 시작하기

찾은 사례 중 가장 실전적으로 느껴진 것은 Aaron Nam의 LinkedIn 포스트였습니다.

- Claude Code / Codex / Hermes agent log #9
  - https://www.linkedin.com/posts/aaronnam_claude-code-codex-hermes-agent-log-9-activity-7463635700375072768-Mt7f

이 포스트에서 흥미로웠던 점은 Hermes를 단순히 “명령을 수행하는 AI”로 쓰지 않았다는 것입니다. Hermes에 X 검색 기능을 붙이고, 매일 Claude Code와 Codex 세션을 스캔하는 scheduled task를 운영했다고 합니다.

흐름은 대략 이렇습니다.

1. 하루 동안 Claude Code/Codex로 작업한 세션 로그를 훑는다.
2. 그 안에서 막힌 지점이나 반복된 pitfall을 찾는다.
3. X와 GitHub에서 비슷한 문제의 해결책을 검색한다.
4. 발견한 내용을 second brain에 저장한다.
5. 다음 날 agent가 그 내용을 참고해서 더 나은 상태로 시작한다.

이 구조가 굉장히 좋게 느껴졌습니다.

보통 우리는 AI에게 “이 문제 해결해줘”라고 말합니다. 그런데 이 사례는 조금 다릅니다. “내가 AI와 일하는 과정 자체를 다시 AI가 분석하게 한다”에 가깝습니다. 즉, AI를 결과물 생성기가 아니라 작업 방식 개선 도구로 쓰는 것입니다.

저에게 적용해보면 이런 식이 될 수 있을 것 같습니다.

- 오늘 Hermes/Codex/Claude와 작업한 로그를 훑는다.
- 반복해서 막힌 부분을 찾는다.
- 예를 들어 Spark 테스트, GitHub Actions, Jekyll 빌드, Obsidian 정리, 이력서 문서화 같은 영역에서 반복 문제가 있는지 본다.
- 해결책을 공식 문서/GitHub/X에서 찾는다.
- Obsidian secondBrain에 요약한다.
- 재사용 가능한 절차는 Hermes skill로 만든다.

이건 취업 준비에도 꽤 잘 맞습니다. 포트폴리오 프로젝트를 만들 때 중요한 것은 단순히 “완성했다”가 아니라, “어떤 문제가 반복됐고, 다음에는 어떻게 더 잘할 수 있게 되었는가”이기 때문입니다.

## LinkedIn 사례 2: Claude Code에 Hermes를 memory layer처럼 붙이기

또 하나 흥미로웠던 사례는 Giga Lu의 LinkedIn 포스트였습니다.

- AI Agent / Hermes / Claude Code 관련 포스트
  - https://www.linkedin.com/posts/giga-lu-54b6a898_aiagent-hermes-claudecode-activity-7460366133322321920-WK58

이 글에서는 Claude Code에 Hermes Agent를 붙여 auto-learning memory처럼 활용하는 이야기가 나왔습니다.

Claude Code에도 `CLAUDE.md`나 `SKILL.md`처럼 작업 맥락을 남길 수 있는 장치가 있습니다. 그런데 글쓴이는 두 가지 한계를 이야기합니다.

첫째, 무엇을 기억해야 할지 사람이 계속 판단해야 합니다.

둘째, 정적인 문서는 대화가 진행되면서 자연스럽게 진화하지 않습니다.

여기서 Hermes의 강점이 나옵니다. Hermes는 memory와 skill을 통해 “이건 다음에도 쓸 만하다”는 정보를 더 적극적으로 축적할 수 있습니다. 특히 5회 이상의 tool call이 들어간 복잡한 workflow나, 삽질 끝에 해결한 절차는 skill로 남길 가치가 있습니다.

이걸 보고 저는 Hermes를 단독 도구로만 볼 필요는 없겠다고 느꼈습니다. 오히려 Claude Code, Codex, GitHub Copilot 같은 coding agent를 쓰면서, Hermes를 그 위의 작업 기억/절차 지식 계층으로 두는 방식도 가능합니다.

비유하면 이렇습니다.

- Claude Code/Codex: 실제 코딩 작업을 빠르게 수행하는 실행자
- Hermes: 내 작업 방식, 선호, 반복 절차, 프로젝트 맥락을 관리하는 작업 운영자
- Obsidian: 사람이 읽고 다시 생각하기 위한 second brain

이 셋이 잘 연결되면 꽤 강력한 구조가 됩니다.

## Tooling Up Hermes Agent: Hermes는 확장 가능한 tool framework이기도 하다

Hacker News에서 잡힌 글 중에는 “Tooling Up Hermes Agent”라는 글도 있었습니다.

- 원문
  - https://nedkarlovich.com/writing/tooling-up-hermes-agent
- Hacker News
  - https://news.ycombinator.com/item?id=47945426

이 글은 Hermes에 settlement/reputation layer를 붙이는 실험을 소개합니다. agent identity, reputation, economic participation 같은 주제라서 당장 제 작업과 직접 연결되지는 않습니다.

그런데 글에서 흥미로웠던 부분은 Hermes의 tool architecture였습니다. 글쓴이는 Hermes가 Python 파일 하나를 tools 디렉터리에 넣으면 registry가 auto-discover하는 구조라서, settlement 관련 tool을 붙이기 쉬웠다고 설명합니다.

등록된 tool 예시는 이런 것들이었습니다.

- settlement_register
- settlement_reputation
- settlement_record_task
- settlement_balance
- settlement_subnet_info
- settlement_transfer

이 사례 자체는 다소 실험적입니다. 하지만 Hermes를 “내가 필요한 도구를 붙일 수 있는 agent framework”로 보는 관점은 중요합니다.

일반 사용자는 처음부터 custom tool을 만들 필요는 없습니다. 하지만 개발자 입장에서는 이런 확장성이 꽤 큰 의미를 가집니다. 예를 들어 나중에 다음과 같은 도구를 붙일 수도 있습니다.

- Saramin 지원 현황 tracker 업데이트
- GitHub PR/issue 상태 요약
- Obsidian 노트 자동 정리
- 포트폴리오 프로젝트 README 점검
- Jekyll 블로그 발행 전 체크
- 특정 채용 공고/회사 리서치 자동화

결국 Hermes는 “AI에게 질문하는 앱”이라기보다, 내 로컬 환경과 외부 API를 연결하는 작업 레이어에 가깝게 발전할 수 있습니다.

## DEV, Medium, HN 글들은 어디까지 참고할 만할까

DEV Community와 Medium에서도 Hermes Agent 관련 글들이 여럿 잡혔습니다.

DEV 쪽에서는 다음과 같은 글들이 보였습니다.

- One Open Source Project a Day: Hermes Agent
  - https://dev.to/wonderlab/one-open-source-project-a-day-no40-hermes-agent-nous-researchs-self-improving-ai-agent-4ale
- Hermes Agent Review: Self-Improving Open-Source AI Agent
  - https://dev.to/jangwook_kim_e31e7291ad98/hermes-agent-review-self-improving-open-source-ai-agent-3kk3
- Hermes Agent Review: 95.6K Stars, Self-Improving AI Agent
  - https://dev.to/tokenmixai/hermes-agent-review-956k-stars-self-improving-ai-agent-april-2026-11le
- Hermes Agent: A Self-Improving AI Agent That Runs Anywhere
  - https://dev.to/arshtechpro/hermes-agent-a-self-improving-ai-agent-that-runs-anywhere-2b7d

Medium 쪽에서도 Hermes Agent 소개, 사용 후기, beginner-to-expert 스타일의 글들이 검색되었습니다. 다만 일부는 본문 접근이 제한되어 제목 중심으로만 확인할 수 있었습니다.

이런 글들은 처음 개념을 잡기에는 도움이 됩니다. 하지만 실전 best practice를 얻기에는 공식 문서나 실제 사용자의 LinkedIn/X 사례가 더 유용해 보였습니다.

특히 SEO성 리뷰 글은 조심해서 읽어야 합니다. “self-improving”, “runs anywhere”, “works while you sleep” 같은 표현은 매력적이지만, 실제로 내 작업에 도움이 되려면 결국 다음 질문으로 내려와야 합니다.

- 어떤 정보를 memory에 저장해야 하는가?
- 어떤 절차를 skill로 만들어야 하는가?
- 어떤 작업은 subagent로 나눌 가치가 있는가?
- 어떤 작업은 cron으로 자동화할 가치가 있는가?
- 어떤 결과를 Obsidian에 남겨야 나중에 다시 쓸 수 있는가?

소개글을 읽고 끝내면 그냥 “좋은 도구구나”에서 멈춥니다. 하지만 이 질문까지 내려오면 실제 작업 방식이 바뀔 수 있습니다.

## 내가 Hermes를 쓴다면 이렇게 운영해보고 싶다

여러 자료를 보고 나서, 제 기준에서 Hermes를 가장 잘 쓰는 방법은 “개인 작업 운영체제”처럼 두는 것입니다.

조금 더 구체적으로는 이런 구조입니다.

### 1. Obsidian은 사람이 읽는 지식 저장소로 둔다

Obsidian에는 생각의 결과물을 남깁니다.

- 프로젝트 설계 이유
- 기술 개념 큰 그림
- 블로그 초안
- 회고
- 취업 준비 자료
- 회사/공고 리서치
- AI 사용 방식 정리

이건 사람이 다시 읽고 연결하기 위한 저장소입니다. Hermes memory와는 역할이 다릅니다. memory는 에이전트가 다음 대화에서 참고해야 하는 짧고 지속적인 사실에 가깝고, Obsidian은 생각을 펼쳐놓는 공간에 가깝습니다.

### 2. Hermes memory에는 오래가는 선호와 환경만 남긴다

모든 것을 memory에 넣으면 오히려 잡음이 됩니다.

그래서 memory에는 이런 것만 남기는 게 좋아 보입니다.

- 내가 선호하는 글쓰기 톤
- 주로 쓰는 프로젝트 경로
- 자주 쓰는 도구와 환경
- 반복적으로 지켜야 하는 개인 규칙
- 당분간 계속 유효한 작업 방식

반대로 PR 번호, 일회성 작업 결과, 오늘 끝난 할 일 같은 것은 memory에 넣으면 금방 낡습니다. 그런 것은 session log나 Obsidian, Git history에 두는 편이 낫습니다.

### 3. Hermes skill에는 반복 가능한 절차를 남긴다

skill은 “다음에 또 할 일”을 위한 절차 지식입니다.

예를 들면 이런 것들이 skill 후보가 됩니다.

- 포트폴리오 README 점검 절차
- Spark 과제 검증 절차
- Jekyll 블로그 발행 전 체크 절차
- Obsidian 블로그 초안 작성 방식
- GitHub PR 리뷰 루틴
- Saramin 지원 현황 정리 루틴

중요한 것은 skill이 단순한 메모가 아니라 실행 절차라는 점입니다. 어떤 명령을 쓰고, 어떤 파일을 확인하고, 어떤 함정을 조심해야 하는지까지 들어가야 다음에 실제로 도움이 됩니다.

### 4. Cron으로 반복 리서치와 회고를 자동화한다

가장 해보고 싶은 것은 “작업 로그 기반 회고 자동화”입니다.

예를 들어 매일 밤이나 이틀에 한 번 이런 작업을 돌릴 수 있습니다.

- 최근 Hermes/Codex/Claude 작업 로그를 훑는다.
- 반복된 막힘을 찾는다.
- 관련 키워드를 뽑는다.
- 공식 문서/GitHub/X에서 해결책을 찾는다.
- Obsidian에 요약한다.
- skill로 만들 만한 절차를 제안한다.

이건 단순한 생산성 자동화가 아니라, “내가 AI와 일하는 방식”을 개선하는 루프입니다.

### 5. Subagent는 비교와 검증에 쓴다

subagent는 아무 때나 쓰면 token만 많이 쓸 수 있습니다. 하지만 비교가 필요한 작업에는 꽤 유용합니다.

예를 들어:

- 블로그 제목 후보 여러 개 만들기
- 포트폴리오 README를 다른 관점에서 리뷰하기
- 코드 변경의 위험 요소를 독립적으로 찾기
- 설계안 A/B/C 비교하기
- 면접 답변을 기술/커뮤니케이션/리스크 관점에서 나눠 검토하기

이런 작업은 한 명의 agent가 바로 결론을 내리는 것보다, 여러 관점의 후보를 만든 뒤 다시 평가하는 방식이 더 안전할 수 있습니다.

## 취준생/주니어 개발자 입장에서 중요한 지점

제가 이 주제를 취업 준비와 연결해서 보는 이유는, 요즘 포트폴리오나 기술 면접에서 단순 구현만으로는 설명이 부족한 경우가 많기 때문입니다.

AI를 쓰면 구현 속도는 빨라집니다. 하지만 그만큼 “내가 무엇을 판단했는지”가 더 중요해집니다.

- 왜 이 구조를 선택했는가?
- 어떤 대안을 버렸는가?
- 어디까지 검증했는가?
- AI가 만든 결과를 어떻게 확인했는가?
- 다음에는 어떤 절차로 더 잘할 수 있는가?

Hermes의 memory/skill/cron/subagent 구조는 이 질문들에 답하는 데 도움이 될 수 있습니다. 왜냐하면 단순히 결과물을 만드는 것이 아니라, 작업 과정과 판단 기준을 계속 남기도록 유도하기 때문입니다.

예를 들어 포트폴리오 프로젝트 하나를 만든다고 해도, Hermes를 잘 쓰면 다음과 같은 자료가 자연스럽게 쌓일 수 있습니다.

- 프로젝트 설계 결정 로그
- 검증 명령과 결과
- 반복된 문제와 해결 절차
- README 개선 이력
- 면접에서 설명할 수 있는 설계 근거
- 다음 프로젝트에 재사용할 skill

이런 자료는 단순히 “AI를 써서 빨리 만들었다”와는 다릅니다. 오히려 AI를 쓰면서도 본인이 이해하고 검증했다는 증거에 가깝습니다.

## 내가 바로 적용해볼 작은 루틴

거창하게 시작할 필요는 없을 것 같습니다. 우선은 작은 루틴 하나면 충분합니다.

제가 해보고 싶은 첫 번째 루틴은 이것입니다.

“하루 작업이 끝나면 Hermes에게 오늘 작업 로그를 바탕으로 세 가지를 정리하게 한다.”

1. 오늘 반복해서 막힌 지점
2. 다음에 같은 문제를 줄이기 위한 절차
3. Obsidian이나 skill로 남길 만한 내용

이 루틴이 쌓이면, 단순한 회고가 아니라 개인 작업 방식의 개선 데이터가 됩니다.

조금 더 발전시키면 이런 형태도 가능합니다.

- 매주 한 번 Hermes가 최근 세션을 검색한다.
- 반복 주제를 묶는다.
- Obsidian에 “이번 주 AI 작업 회고”를 만든다.
- skill 후보를 제안한다.
- 오래가는 선호나 환경은 memory로 정리한다.

이 정도만 해도 AI를 쓰는 방식이 꽤 달라질 것 같습니다. 매번 새로운 대화에서 출발하는 것이 아니라, 작업 방식 자체가 조금씩 축적되기 때문입니다.

## 마무리

Hermes Agent 관련 자료를 찾아보면서 가장 크게 느낀 것은, 이제 AI 도구를 “어떤 모델이 더 똑똑한가”만으로 볼 수는 없다는 점입니다.

물론 모델 성능은 중요합니다. 하지만 실제 작업에서는 그 못지않게 중요한 것이 있습니다.

- 내 파일과 도구에 접근할 수 있는가?
- 이전 작업 맥락을 기억할 수 있는가?
- 반복 절차를 skill로 남길 수 있는가?
- 복잡한 작업을 subagent로 나눌 수 있는가?
- 반복 작업을 cron으로 돌릴 수 있는가?
- 사람이 읽을 지식은 Obsidian 같은 곳에 남길 수 있는가?

Hermes Agent는 이 질문들에 꽤 직접적으로 답하려는 도구처럼 보입니다.

저는 이걸 단순히 “새로운 AI CLI”로 보기보다는, 제 작업 방식과 지식 관리 방식을 연결하는 레이어로 실험해보려고 합니다. 특히 취업 준비, 포트폴리오 프로젝트, 블로그 글쓰기, 오픈소스 기여처럼 과정과 설명이 중요한 작업에서는 잘 맞을 가능성이 커 보입니다.

아직 모든 기능을 완벽히 써본 것은 아닙니다. 하지만 방향은 분명해 보입니다.

AI가 대신 생각하게 만드는 것이 아니라, 내가 더 잘 생각하고 검증하고 축적할 수 있도록 작업 환경을 설계하는 것.

Hermes Agent를 잘 쓴다는 것은 결국 그 방향에 가까운 것 같습니다.

## 참고 링크

### 공식 자료

- Hermes Agent 공식 문서
  - https://hermes-agent.nousresearch.com/docs/
- Tips & Best Practices
  - https://hermes-agent.nousresearch.com/docs/guides/tips/
- Delegation & Parallel Work
  - https://hermes-agent.nousresearch.com/docs/guides/delegation-patterns
- Kanban
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Profiles
  - https://hermes-agent.nousresearch.com/docs/user-guide/profiles/
- Working with Skills
  - https://hermes-agent.nousresearch.com/docs/guides/work-with-skills
- Cron
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- Memory
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/memory

### SNS / 커뮤니티 사례

- Nous Research Hermes Agent announcement
  - https://x.com/NousResearch/status/2026758996107898954
- Nous Research xurl skill post
  - https://x.com/NousResearch/status/2056872329561710766
- Hermes Agent X account
  - https://x.com/_HermesAgent
- Aaron Nam LinkedIn post: Claude Code / Codex / Hermes agent log #9
  - https://www.linkedin.com/posts/aaronnam_claude-code-codex-hermes-agent-log-9-activity-7463635700375072768-Mt7f
- Giga Lu LinkedIn post: Claude Code + Hermes memory layer
  - https://www.linkedin.com/posts/giga-lu-54b6a898_aiagent-hermes-claudecode-activity-7460366133322321920-WK58
- BridgeMind X post: personality/workflow cloning experiment
  - https://x.com/bridgemindai/status/2050606240682614878

### 글 / 리뷰 / 논의

- Tooling Up Hermes Agent
  - https://nedkarlovich.com/writing/tooling-up-hermes-agent
- Hacker News: Tooling Up Hermes Agent
  - https://news.ycombinator.com/item?id=47945426
- DEV: One Open Source Project a Day: Hermes Agent
  - https://dev.to/wonderlab/one-open-source-project-a-day-no40-hermes-agent-nous-researchs-self-improving-ai-agent-4ale
- DEV: Hermes Agent Review: Self-Improving Open-Source AI Agent
  - https://dev.to/jangwook_kim_e31e7291ad98/hermes-agent-review-self-improving-open-source-ai-agent-3kk3
- DEV: Hermes Agent Review: 95.6K Stars, Self-Improving AI Agent
  - https://dev.to/tokenmixai/hermes-agent-review-956k-stars-self-improving-ai-agent-april-2026-11le
- DEV: Hermes Agent: A Self-Improving AI Agent That Runs Anywhere
  - https://dev.to/arshtechpro/hermes-agent-a-self-improving-ai-agent-that-runs-anywhere-2b7d
