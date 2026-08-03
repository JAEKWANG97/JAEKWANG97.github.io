---
title: "Ouroboros는 AI 코딩을 어떻게 명세·평가 루프로 바꿀까?"
pubDatetime: 2026-08-03T11:22:54+09:00
featured: false
draft: false
tags:
  - "ai"
  - "ai-agent"
  - "ouroboros"
  - "spec-driven-development"
  - "harness-engineering"
description: "Ouroboros v0.50.7의 공식 문서, 실제 소스 코드, 테스트, 릴리스를 교차 확인해 Interview부터 Seed, 실행, 평가, 진화까지의 과정과 각 결과가 다음 단계에 어떻게 이용되는지 분석했습니다."
---

AI 코딩 에이전트에게 기능을 맡길 때 보통은 요구사항을 프롬프트로 적는 것부터 시작합니다.

```text
가격 비교 기능을 만들어줘.
공식 API만 사용하고 테스트도 추가해줘.
```

처음에는 꽤 구체적으로 썼다고 생각합니다. 하지만 작업이 진행되면 질문이 생깁니다.

- 어떤 상품을 같은 상품이라고 판단해야 할까?
- 일부 쇼핑몰 API가 실패하면 전체 요청도 실패해야 할까?
- "비교할 수 있다"는 것을 무엇으로 검증할까?
- 에이전트가 테스트를 통과시켰다면 요구사항도 충족한 것일까?

대부분은 코드를 작성하는 도중에 드러납니다. 에이전트는 빈칸을 멈춰서 보여주기보다 그럴듯한 가정으로 채우기 쉽습니다. 구현은 완료됐지만 처음 원한 것과 다른 결과가 나오는 이유입니다.

[Ouroboros](https://github.com/Q00/ouroboros)는 이 문제를 **명세 우선(specification-first) 워크플로**로 풀려는 오픈소스입니다. 바로 코딩하지 않고 질문으로 요구사항을 좁힌 뒤, 실행 가능한 `Seed`를 만들고, 실행 결과를 별도의 평가 단계에 통과시킵니다. 부족하면 평가 결과를 다음 Seed에 반영합니다.

공식 소개만 보면 다음 한 줄로 요약할 수 있습니다.

```text
Interview → Seed → Execute → Evaluate → Evolve
```

하지만 정말 중요한 질문은 화살표 사이에 있습니다.

> 각 단계에서 무엇이 남고, 그 결과가 실제로 다음 단계에 어떻게 사용될까?

이 글에서는 `v0.50.7`의 공식 문서만 요약하지 않고 실제 소스 코드, 단위·통합 테스트, PyPI 메타데이터, 릴리스 기록을 함께 확인했습니다. 확인한 사실과 프로젝트가 주장하는 효과도 구분하겠습니다.

## 먼저 결론: 결과가 다음 작업의 입력으로 남는 구조다

Ouroboros의 핵심 산출물을 코드 하나로 보면 구조를 놓치기 쉽습니다.

```text
막연한 목표
  ↓
Interview 기록과 결정 출처
  ↓
Seed YAML
  ↓
실행 세션·코드·작업 결과
  ↓
Mechanical·Semantic·Consensus 평가 결과
  ↓
Wonder 질문과 Reflect 패치
  ↓
새로운 세대의 Seed
```

각 결과는 다음과 같이 이용됩니다.

| 단계       | 남는 결과                                 | 다음 단계에서의 용도                    |
| ---------- | ----------------------------------------- | --------------------------------------- |
| Interview  | 답변, 출처, 모호성 상태                   | 요구사항과 관찰 사실을 구분해 Seed 생성 |
| Seed       | 목표, 제약, AC, 온톨로지, 종료 조건       | 실행 범위이자 평가 기준                 |
| Execute    | 코드 변경, 실행 출력, 세션·작업 상태      | 평가할 실제 산출물과 증거               |
| Evaluate   | 단계별 통과 여부, AC 결과, 드리프트, 근거 | 종료·재작업 판단 및 Reflect 입력        |
| Evolve     | AC 패치, 온톨로지 변화, 계보              | 다음 세대 Seed 생성과 선택적 재실행     |
| EventStore | 세션·작업·세대 이벤트                     | 상태 조회, 재개, 재생, 계보 복원        |

즉, 평가 결과가 보고서로 끝나는 것이 아닙니다. 다음 실행에서 어떤 AC를 유지하고 무엇을 다시 고칠지를 결정하는 입력이 됩니다.

## 조사 기준과 확인 범위

분석 기준은 2026년 8월 3일의 `v0.50.7`, 태그 커밋 `cb658aa`입니다.

확인한 자료는 다음과 같습니다.

1. [공식 저장소와 한국어 README](https://github.com/Q00/ouroboros/tree/v0.50.7)
2. [Getting Started](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/getting-started.md)와 [CLI Reference](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/cli-reference.md)
3. [`Seed` 모델](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/core/seed.py)
4. [평가 파이프라인](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evaluation/pipeline.py)
5. [Reflect 엔진](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evolution/reflect.py)과 [진화 루프](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evolution/loop.py)
6. [실행→평가 연계 테스트](https://github.com/Q00/ouroboros/blob/v0.50.7/tests/unit/mcp/tools/test_run_evaluate_chaining.py)
7. [PyPI 0.50.7](https://pypi.org/project/ouroboros-ai/0.50.7/)과 [v0.50.7 릴리스](https://github.com/Q00/ouroboros/releases/tag/v0.50.7)
8. 태그 커밋의 GitHub Actions 검사 결과

PyPI에서는 `ouroboros-ai 0.50.7`, Python `>=3.12`, 2026년 8월 2일 배포를 확인했습니다. 같은 커밋의 GitHub Actions에서는 Python 3.12·3.13·3.14 테스트와 Ruff, MyPy 검사가 성공했습니다.

다만 이 글을 작성한 머신은 Python 3.11이고 Ouroboros CLI가 설치돼 있지 않았습니다. 환경을 임의로 바꾸지 않기 위해 직접 설치·실행한 사용기처럼 쓰지 않았습니다. 아래 과정은 문서에 나온 사용법을 코드와 테스트로 교차 확인한 결과입니다.

## 1. Interview: 요구사항과 코드에서 관찰한 사실을 구분한다

기본 시작점은 AI 코딩 에이전트 세션 안에서의 인터뷰입니다.

```text
ooo interview "공식 API 기반 가격 비교 기능을 만들고 싶다"
```

Ouroboros가 질문을 만들고, 호스트 에이전트가 코드베이스나 사용자에게서 답을 구합니다. 여기서 흥미로운 부분은 답변의 **출처**를 구분한다는 점입니다.

```text
[from-code] 현재 백엔드는 Spring Boot 3을 사용한다.
[from-user] 내부 쇼핑 API는 사용하지 않는다.
[from-research] 공식 API의 호출 제한은 분당 N회다.
```

코드에서 발견한 현재 상태와 사용자가 앞으로 원하는 정책은 같은 종류의 정보가 아닙니다.

```text
현재 JWT 인증을 사용한다.  → 관찰한 사실
새 기능도 JWT만 사용한다.  → 사용자가 결정할 정책
```

`v0.50.7` 릴리스에는 `[from-code]`나 `[from-repo]`로 관찰한 사실이 사용자가 결정하지 않은 acceptance criterion으로 들어가지 않도록 수정한 내용이 있습니다. 릴리스 설명의 주장만 있는 것도 아닙니다. 자동 Seed 합성 코드는 인터뷰의 `SeedDraftLedger`에서 목표, 제약, non-goal, AC, 검증 계획, 실패 모드를 꺼내 Seed를 구성하며 결정 출처 통계도 메타데이터에 남깁니다.

이 단계의 결과는 단순 대화 전문이 아닙니다.

- 확정된 목표
- 아직 약하거나 충돌하는 항목
- 명시적인 non-goal
- 검증 방법
- 각 결정의 출처

가 다음 Seed를 만드는 입력이 됩니다.

### 모호성 0.2는 무엇을 의미할까

공식 문서는 모호성 점수가 `0.2` 이하일 때 Seed를 만들 수 있다고 설명합니다. 코드에서도 Seed 메타데이터에 `ambiguity_score`가 존재하고 자동 흐름에는 A-grade Seed에 도달하기 전 실행하지 않는 게이트가 있습니다.

하지만 이 숫자를 "0.2 이하면 좋은 제품이 보장된다"고 해석하면 안 됩니다. 이는 Ouroboros 내부의 실행 허용 기준입니다. 이 임계값이 실제 재작업률을 얼마나 줄이는지 보여주는 독립적인 비교 실험은 이번 조사 범위에서 확인하지 못했습니다.

## 2. Seed: 프롬프트가 아니라 실행과 평가가 공유하는 계약

인터뷰가 충분히 구체화되면 다음 명령으로 Seed를 생성합니다.

```text
ooo seed <interview-session-id>
```

Seed는 YAML 형태의 명세입니다.

```yaml
goal: 공식 API만 사용해 상품 가격을 비교한다
constraints:
  - 내부 쇼핑 엔드포인트는 사용하지 않는다
  - 일부 공급자 실패가 전체 응답을 중단하지 않게 한다
acceptance_criteria:
  - 동일 상품의 가격을 공급자별로 반환한다
  - 공급자별 실패 원인을 식별할 수 있다
ontology_schema:
  name: ProductComparison
  description: 상품과 공급자별 가격 비교 모델
metadata:
  ambiguity_score: 0.15
```

실제 `Seed` 모델에는 목표와 제약, acceptance criteria뿐 아니라 다음 항목이 포함됩니다.

- ontology schema
- evaluation principles
- exit conditions
- brownfield context
- metadata와 interview ID
- AC별 검증 명령과 예상 산출물 같은 success contract

코드에서는 `Seed`, `SeedMetadata`, `AcceptanceCriterionSpec`을 `frozen=True`인 Pydantic 모델로 정의합니다. 실행 중 기존 Seed 객체를 몰래 고치는 방식이 아니라, 변경이 필요하면 새로운 Seed를 생성하는 구조입니다.

Seed 파일은 일반적인 인터뷰 흐름에서 `~/.ouroboros/seeds/<seed_id>.yaml`에 저장됩니다. 이후 실행기는 파일 경로나 YAML 내용을 받아 파싱하고 검증합니다.

### Seed가 실제로 두 역할을 수행한다

Seed는 구현 지시서이면서 평가표입니다.

```text
Execute가 보는 것: 무엇을 만들어야 하는가
Evaluate가 보는 것: 무엇을 만족해야 통과인가
```

이 둘이 같은 Seed를 기준으로 삼아야 "에이전트가 만들었다"와 "사용자가 요구한 것을 만들었다"를 구분할 수 있습니다.

## 3. Execute: AC를 작업으로 실행하지만, 완료는 아직 승인 아니다

Seed 실행은 호스트 안에서 다음과 같은 `ooo run` 흐름으로 시작합니다.

```text
ooo run <seed-file>
```

내부적으로는 Seed를 검증한 뒤 작업을 백그라운드 실행하고 다음 식별자를 만듭니다.

- `job_id`: 백그라운드 작업 조회용
- `session_id`: 실행 세션 연결용
- `execution_id`: 실행 단위 식별용

실제 orchestrator 코드는 `seed.acceptance_criteria`를 읽어 의존성을 분석하고 실행 단위를 구성합니다. 런타임은 Codex, Claude Code, Hermes 같은 지원 백엔드 중 설정된 것을 사용합니다.

여기서 가장 중요한 사실은 다음과 같습니다.

> 실행 작업의 성공 상태는 formal AC verdict가 아니다.

공식 이벤트 스키마도 과거의 `execution.ac.completed` 이벤트가 이름과 달리 **worker task completion**을 기록할 뿐, 정식 AC 판정은 `ACResult`와 `EvaluationSummary`에서 나온다고 명시합니다.

실행→평가 연계 테스트는 이 차이를 더 분명히 보여줍니다.

1. 실행 작업이 성공한다.
2. 별도의 evaluate 작업이 큐에 들어간다.
3. 실행 결과에는 `evaluation_enqueued`가 기록된다.
4. 아직 평가가 끝나지 않았으므로 `evaluated`는 `false`다.

자동 평가를 끄면 성공한 실행 결과에는 `executed_unverified`가 남습니다. 평가 작업 등록 자체가 실패해도 실행 상태는 성공으로 유지되고, 사용자가 `ooo evaluate`를 다시 수행할 수 있는 다음 단계가 제공됩니다.

```text
completed ≠ accepted
executed_unverified ≠ verified
```

이 구분은 단순한 용어 정리가 아닙니다. 에이전트가 파일을 만들고 테스트 명령을 실행했다는 이유만으로 제품 요구사항까지 충족했다고 보고하는 문제를 막는 경계입니다.

## 4. Evaluate: 세 단계가 항상 모두 실행되는 것은 아니다

정식 평가는 실행 세션과 산출물을 대상으로 수행합니다.

```text
ooo evaluate <session-id>
```

### Stage 1: Mechanical

첫 단계는 코드와 프로젝트가 기계적으로 정상인지 확인합니다.

- lint
- build
- test
- static analysis
- coverage

하나라도 실패하면 다음 단계로 진행하지 않고 거절할 수 있습니다. LLM 판단보다 저렴하고 재현 가능한 검사를 먼저 두는 fail-fast 구조입니다.

다만 코드 주석에는 중요한 제한이 적혀 있습니다. 현재 Stage 1 검사는 여러 AC에 대해 한 번만 실행해 공유하는 **프로젝트 전체 검사**입니다. AC별 행동을 직접 검증하는 테스트로 자동 분리되는 것은 아닙니다. "전체 테스트 통과"와 "각 AC가 개별적으로 증명됨"을 동일시하면 안 됩니다.

### Stage 2: Semantic

두 번째 단계는 LLM이 산출물과 Seed의 의미적 일치를 평가합니다.

- AC compliance
- goal alignment
- drift score
- uncertainty
- reasoning과 evidence
- reward-hacking risk

코드에서는 semantic score가 `0.8` 이상이고 AC를 충족해야 기본 승인이 가능합니다. evaluator를 속이도록 최적화한 위험 점수가 `0.7` 이상이면 다른 조건을 통과해도 최종 승인을 거부하는 veto도 존재합니다.

하지만 Semantic 평가는 여전히 모델 판단입니다. 점수와 설명을 제공한다고 해서 수학적 증명이 되는 것은 아닙니다. 어떤 파일과 실행 증거를 평가기에 전달했는지, 사용한 모델과 프롬프트가 무엇인지에 영향을 받습니다.

### Stage 3: Consensus

세 번째 단계는 항상 실행되지 않습니다. 다음과 같은 trigger 조건이나 사용자의 명시적 요청이 있을 때만 실행됩니다.

- 평가 불확실성이 높음
- Seed 또는 온톨로지가 바뀜
- 목표가 재해석됨
- 드리프트가 큼
- 수동 consensus 요청

Consensus 모델은 최소 3개 투표와 2/3 다수 승인을 전제로 정의돼 있습니다. 다만 실제 독립성은 제공자와 자격 증명 구성에 좌우됩니다. 코드에도 reviewer independence를 `independent`, `same_vendor`, `unavailable`, `unverified` 등으로 별도 표시하는 필드가 있습니다.

따라서 "3단계 평가"라는 표현은 세 단계를 매번 무조건 실행한다는 뜻이 아닙니다.

```text
Mechanical → Semantic → 조건부 Consensus
```

가 더 정확합니다.

## 5. Evolve: 평가 결과에서 다음 Seed를 만드는 방법

평가에서 부족한 부분이 발견되면 `Evolve`가 시작됩니다.

```text
ooo evolve "목표"
```

또는 한 세대씩 처리하는 내부 `evolve_step`을 이용합니다.

```text
Gen 1: Seed₁ → Execute → Evaluate
Gen 2: Wonder → Reflect → Seed₂ → Execute → Evaluate
Gen 3: Wonder → Reflect → Seed₃ → Execute → Evaluate
```

### Wonder가 다시 여는 질문

Wonder 단계는 평가 결과를 보고 아직 모르는 것과 온톨로지의 긴장을 질문으로 만듭니다. 이미 통과한 AC라도 새로운 증거가 모순을 드러내면 다시 검토할 수 있습니다.

### Reflect가 받는 실제 입력

`ReflectEngine.reflect()`의 인자를 보면 평가 결과가 어떻게 이용되는지 알 수 있습니다.

```text
current_seed
execution_output
evaluation_summary
wonder_output
lineage
regression_report
```

Reflect는 다음 정보를 프롬프트에 직접 포함합니다.

- 최종 승인 여부
- 평가 점수와 drift
- AC별 PASS/FAIL
- 이전 세대에서 통과했지만 현재 실패한 regression
- Wonder가 다시 연 AC
- 최근 세대의 평가 이력
- 실제 실행 출력

그리고 전체 AC를 매번 새로 쓰는 대신 패치를 반환합니다.

```json
{
  "ac_patches": [
    { "op": "keep", "index": 0, "reason": "통과했고 다시 열린 문제가 없음" },
    {
      "op": "revise",
      "index": 1,
      "content": "수정된 AC",
      "reason": "평가 실패"
    },
    {
      "op": "add",
      "content": "새로 발견한 공백을 검증하는 AC",
      "reason": "Wonder 질문"
    }
  ]
}
```

### 통과한 AC는 함부로 바꾸지 않는다

코드에는 LLM의 제안을 그대로 믿지 않는 deterministic backstop이 있습니다.

- 통과함
- Wonder가 다시 문제 삼지 않음
- regression이 아님

이 세 조건을 만족한 AC는 원문 그대로 보호합니다. 반대로 실패했거나 다시 열린 AC, regression은 수정 대상이 됩니다. `v1` 패치에서는 AC 제거도 허용하지 않습니다. 위치 기반 AC 정체성이 깨지는 것을 막기 위해서입니다.

진화 루프는 Reflect 결과로 새로운 Seed를 만들고 `current_seed = new_seed`로 다음 실행에 넘깁니다. 이전 객체를 변경하는 것이 아니라 세대별 Seed와 온톨로지 차이를 남깁니다.

### 이전 결과는 재실행 범위도 줄인다

진화 루프에는 선택적 scoped re-execution도 구현돼 있습니다. 이전 세대에서 통과했고 다시 문제 되지 않은 AC는 외부에서 충족된 것으로 표시해 구현 작업을 건너뛸 수 있습니다. 단, 이후 검증은 전체 AC를 대상으로 다시 수행합니다.

즉 평가 결과는 다음 세 가지에 쓰입니다.

1. 다음 Seed의 AC와 온톨로지를 수정한다.
2. 이미 안정된 AC를 보호한다.
3. 다음 세대에서 다시 구현할 범위를 줄인다.

## 6. EventStore: 재개와 계보가 가능한 이유

Ouroboros는 세션 상태를 대화창 안에만 두지 않습니다. 실행, 평가, 취소, 세대 전환 같은 상태를 EventStore에 기록합니다.

공식 이벤트 스키마에는 다음 식별자가 등장합니다.

- `seed_id`
- `execution_id`
- `session_id`
- `job_id`
- `lineage_id`

이벤트 payload에는 `event_version`도 들어갑니다. CLI의 `status`, `resume-session`, `job result`, TUI와 MCP 조회 도구가 이 기록을 사용합니다.

백그라운드 작업의 메모리 핸들이 만료돼도 완료·실패·취소 결과는 저장된 이벤트에서 다시 조회하도록 문서와 코드가 정의돼 있습니다. 진화 단계도 이전 세대의 Seed, 실행 출력, 평가 결과를 계보에서 복원합니다.

이 구조 때문에 Ralph 같은 지속 루프가 한 번의 긴 에이전트 대화가 아니라, 세션 경계를 넘는 여러 단계로 동작할 수 있습니다.

## `ooo auto`를 쓰면 무엇이 합쳐질까

각 명령을 따로 실행하지 않고 한 목표에서 시작하는 경로도 있습니다.

```bash
ouroboros auto "공식 API 기반 가격 비교 서비스를 만든다"
```

또는 에이전트 세션에서 `ooo auto`를 사용할 수 있습니다.

```text
목표
→ 자동 Interview
→ Seed 생성·보수
→ A-grade 확인
→ 선택한 런타임으로 실행 handoff
```

`--skip-run`을 주면 A-grade Seed 생성에서 멈출 수 있고, `--show-ledger`로 가정과 non-goal을 확인할 수 있습니다.

여기에도 문서만 보면 놓치기 쉬운 경계가 있습니다. `--runtime codex`나 `--runtime hermes`는 **실행 handoff 단계의 런타임**을 고르는 옵션입니다. `ooo auto`의 Interview, Seed 생성, Seed repair는 선택한 런타임 에이전트가 수행하는 것이 아니라 Ouroboros MCP 서버 안에서 in-process로 진행됩니다.

즉 `--runtime codex`가 "Codex가 인터뷰도 한다"는 뜻은 아닙니다.

## 실제 프로젝트에서는 무엇에 쓰는 게 좋을까

작은 오타 수정까지 모두 Interview와 Evolve에 넣는 것은 오히려 무겁습니다. 다음과 같은 작업에 더 잘 맞습니다.

- 요구사항이 모호한 신규 기능
- API, DB, 프런트엔드를 함께 바꾸는 작업
- 실패했을 때 되돌림 비용이 큰 변경
- 여러 에이전트 세션에 걸쳐 이어지는 작업
- "완료"의 의미를 acceptance criteria로 합의해야 하는 작업

예를 들어 기존 저장소에서는 다음 문서와 결합할 수 있습니다.

```text
AGENTS.md  → 프로젝트에서 지켜야 할 작업 규칙
ADR        → 이미 결정된 설계와 이유
OpenAPI    → API 계약
Flyway     → 실행 가능한 DB 변경 이력
Seed       → 이번 작업의 목표와 완료 조건
EventStore → 이번 실행·평가·진화의 계보
```

Seed가 프로젝트의 모든 지식을 대신하는 것은 아닙니다. 오히려 기존 Source of Truth를 참조하면서 **이번 작업에서 무엇을 만족해야 하는지**를 고정하는 계약에 가깝습니다.

## 한계와 주의할 점

### 1. 빠르게 변하는 초기 프로젝트다

GitHub 저장소는 2026년 1월에 만들어졌고, 조사 시점에 약 5.2k stars와 532 forks가 있었습니다. 하지만 별 개수는 신뢰성의 증명이 아닙니다.

`v0.50.7` 릴리스만 해도 97개 커밋이 들어갔고, 프로젝트 정체성 판별, 체크포인트 저장, 평가 증거, MCP 버전 격리, Ralph 종료 조건 같은 경계 오류가 대거 수정됐습니다. 적극적으로 개선되고 있다는 뜻인 동시에 아직 동작 계약이 빠르게 바뀌고 있다는 뜻입니다.

### 2. 설치 프로필과 런타임 차이가 크다

기본 패키지는 Python 3.12 이상이 필요합니다. LiteLLM 포함 프로필은 Python 3.12~3.13으로 범위가 더 좁습니다. MCP 2와 Claude Agent SDK가 요구하는 MCP 메이저 버전이 달라 설치 프로필도 분리돼 있습니다.

Codex, Hermes, OpenCode 등 이름이 지원 목록에 있다고 해서 모든 기능의 실행 방식이 같다는 뜻은 아닙니다. 각 runtime guide와 capability matrix를 먼저 확인해야 합니다.

### 3. Semantic과 Consensus는 결정론적 증명이 아니다

기계적 테스트 이후에 의미 평가를 추가하는 것은 유용하지만, 평가 모델도 틀릴 수 있습니다. 같은 vendor의 모델 여러 개를 사용하면 진정한 독립 검토라고 보기 어렵습니다. 그래서 코드도 reviewer independence를 별도 상태로 노출합니다.

### 4. 자동 반복에는 비용과 중단 조건이 필요하다

Evolve와 Ralph는 여러 세대의 실행과 평가를 반복할 수 있습니다. 모호성, ontology similarity, stagnation, 최대 세대 수 같은 종료 조건이 있지만, 모델 호출과 코드 실행 비용은 실제 구성에 따라 달라집니다.

"수렴했다"는 것은 온톨로지 변화가 내부 기준보다 작아졌다는 뜻이지, 제품이 시장에서 성공하거나 모든 버그가 사라졌다는 뜻이 아닙니다.

### 5. 효과를 보여주는 독립 벤치마크는 확인하지 못했다

공식 README에는 숨은 가정 개수나 모호성 점수 예시가 나오지만, 이를 일반적인 AI 코딩과 비교한 독립 연구나 재현 가능한 생산성 벤치마크는 이번 조사에서 확인하지 못했습니다.

따라서 이 글에서 확정할 수 있는 것은 다음입니다.

- 명세·실행·평가·진화 데이터 구조가 실제 코드에 구현돼 있다.
- 실행과 정식 평가가 분리돼 있다.
- 평가 결과가 다음 Seed와 재실행 범위에 실제로 입력된다.
- 관련 테스트와 릴리스 CI가 존재하고 조사한 커밋에서 통과했다.

반면 "항상 더 좋은 코드를 만든다"거나 "재작업을 몇 퍼센트 줄인다"는 주장은 현재 근거로 확정할 수 없습니다.

## 그래서 Ouroboros는 무엇인가

처음에는 Ouroboros를 반복해서 코드를 고치는 에이전트 루프로 보기 쉽습니다. 코드를 확인하고 나면 조금 다르게 보입니다.

```text
단순 반복 루프
실행 → 실패 → 다시 실행

Ouroboros가 지향하는 루프
명세 → 실행 → 증거 기반 평가 → 명세 변화 → 선택적 재실행
```

차이는 **무엇이 다음 반복으로 전달되는가**에 있습니다.

대화 내용만 넘기는 것이 아니라 Seed와 AC, 평가 결과, regression, ontology delta, lineage를 넘깁니다. 이미 통과한 기준은 보호하고, 실패하거나 다시 열린 기준만 바꾸려 합니다. 실행 완료와 정식 승인을 별도 상태로 관리합니다.

이 점에서 Ouroboros는 더 좋은 프롬프트를 만드는 도구라기보다, 비결정적인 AI 코딩 작업에 명세와 평가 경계를 추가하는 **하네스**에 가깝습니다.

다만 하네스가 있다는 것과 하네스의 모든 판단이 옳다는 것은 다릅니다. 실제 프로젝트에 적용한다면 작은 기능 하나를 골라 다음을 직접 비교해보는 편이 좋습니다.

- 일반 에이전트 작업과 Seed 기반 작업의 재질문 횟수
- 구현 후 발견한 요구사항 누락 개수
- 실행 완료와 AC 승인 사이의 차이
- Evolve가 수정한 AC가 실제 문제와 연결됐는지
- 모델 호출 시간과 비용

Ouroboros의 가장 검증 가능한 가치는 "AI가 알아서 더 잘 만든다"는 약속이 아닙니다.

> 무엇을 만들기로 했고, 무엇이 실행됐으며, 어떤 증거로 통과했고, 그 결과가 다음 작업을 어떻게 바꿨는지를 남기는 구조입니다.

에이전트와 오래 작업할수록 중요한 것은 한 번의 영리한 답변보다, 다음 실행이 이전 실행의 결과를 잊지 않게 만드는 일입니다.

## 참고 자료

- [Q00/ouroboros v0.50.7](https://github.com/Q00/ouroboros/tree/v0.50.7)
- [Ouroboros 한국어 README](https://github.com/Q00/ouroboros/blob/v0.50.7/README.ko.md)
- [Getting Started](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/getting-started.md)
- [CLI Reference](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/cli-reference.md)
- [Seed Authoring Guide](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/guides/seed-authoring.md)
- [Execution vs. Evaluation Contract](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/guides/execution-vs-evaluation.md)
- [Evaluation Pipeline Guide](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/guides/evaluation-pipeline.md)
- [Evolutionary Loop & Ralph](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/guides/evolution-loop.md)
- [Event Payload Schema](https://github.com/Q00/ouroboros/blob/v0.50.7/docs/events.md)
- [Seed 모델](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/core/seed.py)
- [Evaluation Pipeline 코드](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evaluation/pipeline.py)
- [Reflect Engine 코드](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evolution/reflect.py)
- [Evolution Loop 코드](https://github.com/Q00/ouroboros/blob/v0.50.7/src/ouroboros/evolution/loop.py)
- [Run-to-Evaluate 테스트](https://github.com/Q00/ouroboros/blob/v0.50.7/tests/unit/mcp/tools/test_run_evaluate_chaining.py)
- [PyPI ouroboros-ai 0.50.7](https://pypi.org/project/ouroboros-ai/0.50.7/)
- [v0.50.7 릴리스 노트](https://github.com/Q00/ouroboros/releases/tag/v0.50.7)
