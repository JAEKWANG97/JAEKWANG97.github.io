---
title: "Hive는 무엇일까? 파일을 테이블처럼 조회한다는 감각 이해하기"
pubDatetime: 2026-05-24T01:10:00+09:00
featured: false
draft: true
tags:
  - "data-engineering"
  - "hive"
  - "hive-metastore"
  - "external-table"
  - "spark-sql"
  - "parquet"
description: "데이터 엔지니어링 과제를 하다 보면 이런 요구사항을 만날 수 있습니다. 처음에는 이 문장이 생각보다 헷갈립니다. Hive table이라고 하면 Hive라는 데이터베이스 안에 데이터를 넣는 것 같기도 하고, spark-sql로 조회하면 그냥 SQL을 실행하는 것 같기도 합니다."
---

## 들어가며

데이터 엔지니어링 과제를 하다 보면 이런 요구사항을 만날 수 있습니다.

```text
사용자 activity 로그를 Hive table로 제공
External Table 방식으로 설계
설계한 Hive external table을 이용하여 WAU 계산
```

처음에는 이 문장이 생각보다 헷갈립니다.

`Hive table`이라고 하면 Hive라는 데이터베이스 안에 데이터를 넣는 것 같기도 하고, `spark-sql`로 조회하면 그냥 SQL을 실행하는 것 같기도 합니다.

저도 처음에는 이런 질문이 먼저 떠올랐습니다.

```text
Hive가 정확히 뭐지?
라이브러리인가?
데이터베이스인가?
그냥 SQL 실행하는 것과 뭐가 다르지?
spark-sql로 조회하면 Hive를 쓰는 게 맞나?
```

이번 글은 이 질문에서 출발합니다.

전체 데이터 엔지니어링 흐름에서 보면 Hive는 주로 `Metadata`와 `Query` 사이에 걸쳐 있습니다.

```text
Source -> Ingestion -> Storage -> Processing -> Metadata -> Query -> Consumption
                                                     ↑          ↑
                                                 이번 글과 관련
```

핵심 질문은 단순합니다.

> 파일로 저장된 데이터를 어떻게 SQL 테이블처럼 조회할 수 있을까?

---

## 1. Hive를 한 문장으로 이해하기

Hive는 파일 시스템에 저장된 대용량 데이터를 SQL 테이블처럼 조회할 수 있게 해주는 시스템입니다.

조금 더 정확히 말하면, Hive는 실제 데이터 파일 자체보다 **그 파일을 테이블로 해석하기 위한 정보**를 관리합니다.

예를 들어 이런 정보입니다.

```text
테이블 이름
컬럼 schema
partition 정보
데이터 파일 위치
파일 포맷
```

이 정보가 있어야 사용자는 파일 경로를 직접 뒤지지 않고 SQL로 데이터를 조회할 수 있습니다.

예를 들어 Spark가 처리 결과를 이런 파일로 저장했다고 해보겠습니다.

```text
data/lake/sessionized_events/
  dt=2019-10-01/
    part-0000.snappy.parquet
    part-0001.snappy.parquet
  dt=2019-10-02/
    part-0000.snappy.parquet
```

실제 데이터는 `part-*.snappy.parquet` 파일 안에 있습니다.

하지만 파일만 있으면 SQL 사용자는 바로 조회하기 어렵습니다.

```text
어떤 컬럼이 있는지
각 컬럼 타입이 무엇인지
어느 경로를 읽어야 하는지
dt=2019-10-01은 어떤 폴더인지
파일 포맷이 Parquet인지 CSV인지
```

이런 정보를 알아야 하기 때문입니다.

Hive는 이 정보를 테이블 metadata로 등록합니다.

---

## 2. Hive Metastore는 테이블 설명서를 저장한다

Hive에서 중요한 개념이 `Hive Metastore`입니다.

Metastore는 이름 그대로 metadata를 저장하는 곳입니다.

예를 들어 `sessionized_events`라는 테이블을 만들면 Metastore에는 대략 이런 정보가 저장됩니다.

```text
database: default
table: sessionized_events
columns:
  event_time_utc timestamp
  event_type string
  user_id bigint
  generated_session_id string
partition:
  dt string
format:
  parquet
location:
  data/lake/sessionized_events
```

중요한 점은 실제 이벤트 데이터가 Metastore에 들어가는 것이 아니라는 점입니다.

실제 이벤트 데이터는 Parquet 파일에 있고, Metastore는 그 파일을 어떻게 읽어야 하는지만 기억합니다.

이렇게 생각하면 조금 편합니다.

```text
Parquet 파일 = 실제 데이터
Hive Metastore = 그 데이터를 테이블처럼 읽기 위한 설명서
```

---

## 3. Hive는 라이브러리일까?

처음에는 Hive가 라이브러리처럼 느껴질 수 있습니다.

라이브러리는 보통 내 코드 안에서 import해서 함수를 호출하는 형태입니다.

```scala
import something
something.doWork()
```

Hive는 그보다는 데이터 시스템에 가깝습니다.

```text
Hive = 파일 기반 데이터를 SQL 테이블처럼 관리하고 조회하게 해주는 데이터 웨어하우스 시스템
```

물론 Spark 코드 안에서 Hive table을 생성하거나 조회할 수는 있습니다.

```scala
spark.sql("CREATE EXTERNAL TABLE ...")
spark.sql("MSCK REPAIR TABLE ...")
```

그래서 Spark 입장에서는 Hive 기능을 호출하는 것처럼 보일 수 있습니다.

하지만 Hive 자체는 단순 함수 모음이라기보다, table metadata를 저장하고 SQL 조회 인터페이스를 제공하는 시스템으로 보는 편이 더 정확합니다.

---

## 4. spark-sql로 실행하면 그냥 SQL 아닌가?

`spark-sql`을 실행하면 겉으로는 그냥 SQL을 치는 것처럼 보입니다.

예를 들어 다음 쿼리를 실행한다고 해보겠습니다.

```sql
SELECT COUNT(*)
FROM default.sessionized_events
WHERE dt = '2019-10-01';
```

이때 실제로는 다음 일이 일어납니다.

```text
1. Spark SQL이 쿼리를 받는다.
2. Spark가 Hive Metastore에 묻는다.
   "default.sessionized_events 테이블은 어디에 있고 schema가 뭐야?"
3. Hive Metastore가 답한다.
   "location은 data/lake/sessionized_events이고, format은 Parquet이고, partition은 dt야."
4. Spark가 해당 경로의 Parquet 파일을 읽어서 계산한다.
```

여기서 계산을 수행하는 실행 엔진은 Spark SQL입니다.

하지만 table의 schema, location, partition 정보는 Hive Metastore에 등록된 Hive table metadata를 사용합니다.

그래서 이 상황은 이렇게 나누어 이해하면 좋습니다.

```text
SQL 실행 엔진: Spark SQL
테이블 metadata: Hive Metastore
테이블 형태: Hive External Table
실제 데이터: Parquet/Snappy files
```

따라서 `spark-sql`을 쓴다고 해서 Hive를 전혀 안 쓰는 것은 아닙니다.

반대로 Hive가 직접 모든 계산을 수행한다고 보는 것도 정확하지 않습니다.

이 과제에서 Hive를 쓴다는 말은 주로 다음 뜻에 가깝습니다.

```text
Spark가 만든 Parquet 결과를 Hive external table로 등록하고,
그 table metadata를 SQL 엔진이 사용해서 조회한다.
```

---

## 5. External Table은 무엇인가?

Hive table에는 크게 managed table과 external table이 있습니다.

초보자 입장에서는 **데이터 소유권 차이**로 이해하면 됩니다.

```text
Managed Table
- Hive가 데이터 저장 위치까지 관리한다.
- 테이블을 drop하면 데이터까지 삭제될 수 있다.

External Table
- 데이터는 외부 경로에 있다.
- Hive는 schema, partition, location metadata만 관리한다.
- 테이블을 drop해도 원본 데이터 파일은 유지되는 설계다.
```

External table은 이미 저장된 파일 경로를 Hive table로 등록하는 방식입니다.

예를 들어 Spark가 세션화 결과를 다음 경로에 저장했다고 해보겠습니다.

```text
data/lake/sessionized_events/
```

그러면 Hive에는 이 경로를 바라보는 external table을 만들 수 있습니다.

```sql
CREATE EXTERNAL TABLE default.sessionized_events (
  event_time_utc timestamp,
  event_type string,
  user_id bigint,
  generated_session_id string
)
PARTITIONED BY (dt string)
STORED AS PARQUET
LOCATION 'data/lake/sessionized_events';
```

여기서 핵심은 `LOCATION`입니다.

```text
Hive table이 이 경로의 파일들을 테이블처럼 읽겠다는 뜻이다.
```

---

## 6. 왜 Spark 과제에서는 External Table이 자연스러운가

Spark 과제의 목적은 원본 activity log를 Spark Application으로 처리한 뒤 Hive table로 제공하는 것입니다.

즉 데이터 생성 책임은 Spark batch에 있습니다.

```text
Spark 역할:
- CSV 읽기
- event_time UTC 파싱
- KST 기준 dt partition 생성
- user_id별 5분 gap 기준 sessionization
- Parquet/Snappy 파일 저장

Hive 역할:
- Spark가 저장한 Parquet 경로를 table로 등록
- schema, partition, location metadata 관리
- SQL 사용자가 table name으로 조회 가능하게 제공
```

따라서 Hive managed table에 데이터를 넣는 방식보다, Spark output path를 바라보는 external table 방식이 자연스럽습니다.

전체 흐름은 이렇게 볼 수 있습니다.

```text
2019-Oct.csv, 2019-Nov.csv
  -> Spark Application
  -> event_time UTC 파싱
  -> event_time_kst 생성
  -> dt=yyyy-MM-dd KST partition 생성
  -> user_id별 5분 gap sessionization
  -> generated_session_id 생성
  -> Parquet/Snappy 저장
  -> Hive External Table 등록
  -> WAU SQL 실행
```

Hive는 이 흐름에서 중간 처리 로직을 담당하지 않습니다.

중간 처리 로직은 Spark가 담당합니다.

Hive는 처리된 결과를 SQL 사용자가 조회할 수 있도록 테이블 metadata를 제공하는 역할입니다.

---

## 7. Partition과 Hive

이 프로젝트에서는 KST 기준 일자 partition을 만듭니다.

파일 경로는 이런 식입니다.

```text
data/lake/sessionized_events/dt=2019-10-01/
data/lake/sessionized_events/dt=2019-10-02/
data/lake/sessionized_events/dt=2019-10-03/
```

Hive table은 `dt`를 partition column으로 알고 있습니다.

그래서 이런 쿼리를 실행하면:

```sql
SELECT COUNT(*)
FROM default.sessionized_events
WHERE dt = '2019-10-01';
```

전체 파일을 다 읽을 필요 없이 `dt=2019-10-01` partition 경로를 읽을 수 있습니다.

이게 partition을 쓰는 중요한 이유입니다.

---

## 8. 추가 기간 처리는 어떻게 연결되는가

10월, 11월 데이터를 이미 처리했다고 해보겠습니다.

```text
data/lake/sessionized_events/
  dt=2019-10-01/
  ...
  dt=2019-11-30/
```

나중에 12월 데이터가 들어오면 같은 output root 아래에 partition이 추가되면 됩니다.

```text
data/lake/sessionized_events/
  dt=2019-10-01/
  ...
  dt=2019-11-30/
  dt=2019-12-01/
  dt=2019-12-02/
```

Hive external table은 같은 root location을 바라보고 있으므로, 새 partition metadata만 갱신하면 같은 테이블에서 조회할 수 있습니다.

```sql
MSCK REPAIR TABLE default.sessionized_events;
```

또는 필요한 partition만 명시적으로 추가할 수도 있습니다.

```sql
ALTER TABLE default.sessionized_events
ADD IF NOT EXISTS PARTITION (dt='2019-12-01')
LOCATION '.../dt=2019-12-01';
```

즉 추가 기간 처리는 코드를 10월/11월에 하드코딩하지 않고, 입력 경로와 처리 기간을 인자로 받아 같은 table location 아래 partition을 추가할 수 있게 만드는 문제입니다.

---

## 마무리

Hive를 처음 보면 데이터베이스인지, 라이브러리인지, SQL 엔진인지 헷갈릴 수 있습니다.

이 글에서는 일단 이렇게 이해했습니다.

```text
Hive는 데이터를 직접 만드는 도구라기보다,
파일 시스템에 저장된 데이터를 schema와 location 정보로
테이블처럼 조회하게 해주는 시스템이다.
```

Spark와 함께 사용할 때는 역할을 나누어 보면 더 분명합니다.

```text
Spark = 데이터를 처리하고 파일로 저장한다.
Parquet/Snappy = 처리 결과가 저장되는 파일 포맷과 압축 방식이다.
Hive Metastore = 파일을 테이블로 읽기 위한 metadata를 저장한다.
Hive External Table = 외부 파일 경로를 테이블처럼 조회하게 해준다.
Spark SQL = 그 table metadata를 사용해 실제 쿼리를 실행할 수 있다.
```

이 구분을 잡고 나면 `Hive table로 제공한다`는 요구사항도 조금 덜 막연해집니다.

그 말은 단순히 DataFrame을 만들고 끝내라는 뜻이 아니라, 처리 결과 파일을 정해진 schema와 location을 가진 테이블로 등록해서 다른 사용자가 SQL로 조회할 수 있게 하라는 뜻입니다.
