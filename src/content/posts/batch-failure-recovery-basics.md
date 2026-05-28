---
title: "배치 장애 복구는 무엇을 해야 하는 걸까?"
pubDatetime: 2026-05-28T10:00:00+09:00
featured: false
draft: true
tags:
  - "data-engineering"
  - "batch"
  - "failure-recovery"
  - "operations"
description: "데이터 엔지니어링 과제를 하다 보면 이런 요구사항을 만날 수 있습니다. 처음 보면 막연합니다. 저도 처음에는 이 문장이 너무 크게 느껴졌습니다. 하지만 배치 장애 복구를 한 문장으로 줄이면 꽤 단순합니다."
---

> 상태: 블로그 초안
> 관련 프로젝트: P-sessionized-event-lakehouse
> 블로그 slug 후보: `batch-failure-recovery-basics`

## 들어가며

데이터 엔지니어링 과제를 하다 보면 이런 요구사항을 만날 수 있습니다.

```text
배치 장애시 복구를 위한 장치 구현
```

처음 보면 막연합니다.

```text
장애 복구가 정확히 뭐지?
Spark job이 실패하면 그냥 다시 실행하면 되는 거 아닌가?
어떤 장치를 구현해야 한다는 걸까?
```

저도 처음에는 이 문장이 너무 크게 느껴졌습니다.

하지만 배치 장애 복구를 한 문장으로 줄이면 꽤 단순합니다.

```text
실패한 배치의 반쯤 만들어진 결과가 최종 테이블에 섞이지 않게 하고,
같은 기간을 안전하게 다시 실행할 수 있게 만드는 것
```

이 글은 이 감각을 잡기 위한 메모입니다.

---

## 1. 배치 장애는 어디서 생길 수 있을까?

배치 처리는 보통 여러 단계로 나뉩니다.

예를 들어 사용자 이벤트 로그를 처리하는 Spark batch가 있다고 해보겠습니다.

```text
1. 원본 CSV 읽기
2. event_time 파싱
3. KST 기준 dt partition 생성
4. user_id 기준 sessionization
5. Parquet/Snappy 파일 저장
6. Hive external table partition 갱신
7. WAU 쿼리 실행
```

문제는 이 중간 어디서든 실패할 수 있다는 점입니다.

```text
CSV 일부 파일을 못 읽을 수 있다.
Spark job이 OOM으로 죽을 수 있다.
Parquet 파일을 쓰다가 실패할 수 있다.
Hive partition 갱신 전에 실패할 수 있다.
Hive partition은 갱신됐는데 일부 파일만 써졌을 수 있다.
```

배치 장애 복구는 이런 상황에서 최종 테이블이 이상한 상태가 되지 않게 만드는 문제입니다.

---

## 2. 그냥 다시 실행하면 안 되나?

가장 먼저 드는 생각은 이것입니다.

```text
실패하면 다시 돌리면 되는 거 아닌가?
```

다시 실행 자체는 맞습니다.

하지만 그냥 다시 실행하면 위험한 경우가 있습니다.

예를 들어 이미 이런 결과가 있다고 해보겠습니다.

```text
data/lake/sessionized_events/
  dt=2019-10-01/
  dt=2019-10-02/
```

그런데 `dt=2019-10-02`를 다시 처리하면서 append 방식으로 쓰면 어떻게 될까요?

```text
기존 dt=2019-10-02 데이터
+ 새로 처리한 dt=2019-10-02 데이터
= 중복 데이터
```

그러면 WAU 같은 집계 결과가 틀어질 수 있습니다.

따라서 배치 복구의 첫 번째 조건은 이것입니다.

```text
같은 기간을 다시 실행해도 중복 append가 발생하지 않아야 한다.
```

---

## 3. 1단계: 실행을 식별한다

복구하려면 먼저 실행 단위를 식별할 수 있어야 합니다.

그래서 배치마다 `run_id`를 둡니다.

```text
run_id = full-201910-201911-001
run_id = period-test-add-20191003
run_id = period-test-reprocess-20191002
```

`run_id`가 있으면 나중에 이런 질문에 답할 수 있습니다.

```text
이 데이터는 어떤 실행에서 만들어졌나?
어떤 실행이 실패했나?
어떤 기간을 다시 돌려야 하나?
```

이 프로젝트에서는 Spark application 실행 옵션으로 `--run-id`를 받고, 결과 row에도 `run_id` 컬럼을 남깁니다.

```text
장점:
- 실행 추적 가능
- 재처리 결과 확인 가능
- 문제가 생긴 실행 범위 파악 가능
```

---

## 4. 2단계: 같은 partition은 append하지 않고 교체한다

다음은 중복 방지입니다.

이 프로젝트에서는 `dt` 기준 partition으로 결과를 저장합니다.

```text
data/lake/sessionized_events/dt=2019-10-01/
data/lake/sessionized_events/dt=2019-10-02/
```

그리고 Spark의 dynamic partition overwrite를 사용합니다.

```scala
spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
```

저장은 이런 형태입니다.

```scala
df.write
  .mode("overwrite")
  .option("compression", "snappy")
  .partitionBy("dt")
  .parquet(config.output)
```

이 조합의 의도는 다음과 같습니다.

```text
전체 output을 매번 지우는 것이 아니라,
이번 실행 결과에 포함된 dt partition만 overwrite한다.
```

예를 들어 기존 데이터가 이렇다고 하겠습니다.

```text
dt=2019-10-01
dt=2019-10-02
```

새로 `dt=2019-10-03`만 처리하면:

```text
dt=2019-10-01  유지
dt=2019-10-02  유지
dt=2019-10-03  추가
```

기존 `dt=2019-10-02`를 다시 처리하면:

```text
dt=2019-10-01  유지
dt=2019-10-02  새 결과로 교체
dt=2019-10-03  유지
```

즉 이 단계에서 막고 싶은 것은 이것입니다.

```text
같은 partition에 같은 데이터를 계속 쌓아서 중복되는 문제
```

---

## 5. 3단계: 성공한 실행의 기록을 남긴다

다음으로 필요한 것은 실행 결과 기록입니다.

보통 이런 파일을 `manifest`라고 부를 수 있습니다.

예를 들어 배치가 성공하면 이런 기록을 남깁니다.

```json
{
  "run_id": "full-201910-201911-001",
  "input": "data/raw/extracted/2019-*.csv",
  "output": "data/lake/sessionized_events",
  "start_date": "2019-10-01",
  "end_date": "2019-12-01",
  "status": "SUCCESS",
  "row_count": 109362687,
  "partitions": ["2019-10-01", "2019-10-02"]
}
```

이런 기록이 있으면 복구할 때 판단하기 쉽습니다.

```text
어떤 배치가 성공했는가?
어떤 기간을 처리했는가?
몇 건을 만들었는가?
어떤 partition을 건드렸는가?
실패한 run의 결과를 지워도 되는가?
```

과제 수준에서는 manifest만 있어도 "복구를 위한 장치"를 꽤 구체적으로 설명할 수 있습니다.

---

## 6. 4단계: 중간 실패 결과를 격리한다

더 안전한 방식은 final path에 바로 쓰지 않는 것입니다.

위험한 방식:

```text
data/lake/sessionized_events/ 에 바로 쓰기
```

더 안전한 방식:

```text
data/staging/sessionized_events/run_id=abc/ 에 먼저 쓰기
검증 성공 후 data/lake/sessionized_events/ 로 반영
```

흐름은 이렇게 됩니다.

```text
1. staging 경로에 먼저 쓴다.
2. row count와 partition 목록을 검증한다.
3. 성공하면 대상 partition만 final 경로로 publish한다.
4. Hive partition metadata를 갱신한다.
5. 실패하면 staging 경로만 삭제하고 final은 그대로 둔다.
```

이 구조의 장점은 명확합니다.

```text
배치가 중간에 실패해도 최종 Hive table이 반쪽짜리 결과를 보지 않는다.
```

---

## 7. 그러면 과제에서는 어디까지 해야 할까?

과제가 원하는 것은 완전한 운영용 배치 플랫폼이 아닐 가능성이 큽니다.

하지만 최소한 다음 질문에는 답할 수 있어야 합니다.

```text
같은 기간을 다시 돌리면 중복되지 않는가?
실패한 실행과 성공한 실행을 구분할 수 있는가?
어떤 기간을 다시 실행해야 하는지 알 수 있는가?
중간 실패 결과가 최종 테이블에 섞이지 않게 할 방법이 있는가?
```

이 프로젝트 기준으로 단계별로 나누면 이렇게 볼 수 있습니다.

```text
이미 구현한 것:
- run_id로 실행 식별
- 결과 row에 run_id 저장
- deterministic generated_session_id
- dynamic partition overwrite
- 추가 기간 처리 검증
- 동일 partition 재처리 검증
- Hive external table partition repair

추가로 구현하면 좋은 것:
- run manifest 파일 생성
- row count와 partition 목록 기록
- status SUCCESS/FAILED 기록

운영 수준으로 더 강화할 수 있는 것:
- staging path에 먼저 write
- validation 성공 후 final partition publish
- 실패한 staging run cleanup
```

제출 과제에서는 우선 manifest 구현이 현실적인 최소 보강으로 보입니다.

---

## 8. 쉽게 정리하면

배치 장애 복구는 한 번에 큰 개념으로 보면 어렵습니다.

단계를 나누면 이해하기 쉽습니다.

```text
1. run_id로 이번 실행을 구분한다.
2. 같은 partition 재실행 시 append하지 않고 교체한다.
3. 실행 결과 row 수와 partition 목록을 기록한다.
4. 성공한 실행만 SUCCESS manifest로 남긴다.
5. 더 안전하게 하려면 staging에 먼저 쓰고 final로 publish한다.
```

이 프로젝트에서 지금 바로 할 수 있는 다음 구현은 이것입니다.

```text
run manifest 파일 생성
```

manifest를 남기면 배치가 성공했을 때의 처리 범위와 결과를 추적할 수 있습니다.
그리고 실패했을 때도 어떤 기간을 다시 실행해야 하는지 판단할 근거가 생깁니다.

---

## README에 쓸 수 있는 문장

```md
배치 복구를 위해 각 실행에 `run_id`를 부여하고 결과 row에 함께 저장했습니다. 또한 Spark dynamic partition overwrite를 사용하여 동일 기간 재처리 시 기존 결과에 중복 append하지 않고 대상 `dt` partition만 교체되도록 했습니다. 샘플 검증을 통해 추가 기간 처리 시 기존 partition이 유지되고, 동일 partition 재처리 시 대상 partition만 교체되는 것을 확인했습니다. 추가로 실행별 처리 범위, row count, partition 목록, 성공 상태를 기록하는 manifest를 남겨 실패 시 재실행 범위를 판단할 수 있도록 보강할 수 있습니다.
```

## 지금 이해한 한 문장

배치 장애 복구는 실패를 없애는 것이 아니라, 실패해도 최종 테이블이 깨지지 않고 같은 기간을 안전하게 다시 실행할 수 있게 만드는 장치다.
