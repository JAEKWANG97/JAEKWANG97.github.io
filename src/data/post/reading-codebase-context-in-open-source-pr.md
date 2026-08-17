---
title: "오픈소스 PR에서 기존 코드의 문맥을 읽는다는 것 - SeaTunnel MQTT Source 회고"
publishDate: 2026-05-21T10:00:00+09:00
draft: false
tags:
  - "open-source"
  - "apache-seatunnel"
  - "codebase-reading"
  - "testing"
  - "convention"
excerpt: "오픈소스에 기여하려고 코드를 작성하다 보면, 생각보다 자주 이런 착각을 하게 됩니다. “이 기능만 잘 만들면 되지 않을까?” 물론 기능은 중요합니다. 컴파일이 되어야 하고, 테스트가 통과해야 하고, 실제로 문제를 해결해야 합니다. 그런데 Apache SeaTunnel의 MQTT"
---

## 들어가며

오픈소스에 기여하려고 코드를 작성하다 보면, 생각보다 자주 이런 착각을 하게 됩니다.

“이 기능만 잘 만들면 되지 않을까?”

물론 기능은 중요합니다. 컴파일이 되어야 하고, 테스트가 통과해야 하고, 실제로 문제를 해결해야 합니다. 그런데 Apache SeaTunnel의 MQTT Source를 구현하면서 느낀 건, 오픈소스 PR에서는 기능 구현만으로는 부족하다는 점이었습니다.

내가 작성한 코드는 혼자 존재하지 않습니다. 이미 존재하는 수많은 코드 사이에 들어갑니다. 그래서 중요한 질문은 단순히 “이 코드가 맞는가?”가 아니라, 조금 더 복잡합니다.

“이 코드는 이 프로젝트가 지금까지 문제를 풀어온 방식 안에서 자연스러운가?”

처음에는 이것을 단순히 컨벤션이라고 생각했습니다. import 순서, 테스트 스타일, 파일 이름, 옵션 이름 같은 것들 말입니다. 그런데 막상 코드를 다시 보니, 컨벤션은 겉모습만의 문제가 아니었습니다.

컨벤션은 그 프로젝트가 쌓아온 판단의 흔적에 가까웠습니다.

- 이 프로젝트는 어떤 문제를 중요하게 보는가?
- 어떤 복잡도는 받아들이고, 어떤 복잡도는 피하는가?
- 사용자의 설정을 어디까지 안정적인 계약으로 보는가?
- 테스트에서는 무엇을 검증하고, 무엇을 과하게 검증하지 않는가?
- 첫 PR에서 어디까지 주장하는 것이 적절한가?

이번 글은 Apache SeaTunnel에 MQTT Source를 추가하는 과정에서, 단순히 코드를 짠 이야기가 아니라 “기존 코드의 문맥을 읽으려고 했던 과정”에 대한 기록입니다.

## 이번 작업의 배경

이번 작업은 Apache SeaTunnel issue #10753에서 MQTT Source connector를 구현하는 것이었습니다.

SeaTunnel에는 이미 MQTT Sink가 있었습니다. 즉, SeaTunnel에서 외부 MQTT broker로 메시지를 보내는 쪽은 존재했습니다. 하지만 MQTT broker에서 메시지를 읽어오는 Source는 비어 있었습니다.

이번 PR의 범위는 의도적으로 좁게 잡았습니다.

- connector: MQTT
- scope: Source
- target branch: dev
- 첫 PR에서는 MQTT Source만 구현
- Sink refactor, MQTT v5, multi-topic routing, exactly-once 보장은 제외

이렇게 범위를 좁힌 이유는 단순합니다. 오픈소스 첫 기여에서 “할 수 있는 것을 전부 넣는 것”은 좋아 보이지만, 실제로는 리뷰를 어렵게 만들 수 있습니다.

기능을 많이 넣을수록 설명해야 할 결정도 많아집니다. 특히 message broker source는 delivery semantics, offset, checkpoint, parallelism 같은 주제가 금방 복잡해집니다.

MQTT는 Kafka처럼 명확한 partition/offset 모델이 있는 시스템이 아닙니다. 그런데 첫 PR에서 Kafka source처럼 정교한 split/enumerator/checkpoint 구조를 흉내 내면, 오히려 프로젝트에 맞지 않는 복잡도를 들여오는 셈이 될 수 있습니다.

그래서 이번 구현은 “작고 방어 가능한 Source”를 목표로 했습니다.

MQTT topic 하나를 subscribe하고, 들어온 message를 내부 queue에 넣고, `pollNext`에서 역직렬화해서 `SeaTunnelRow`로 넘기는 구조입니다.

## 새로 추가한 파일들

이번 MQTT Source 작업에서 main 코드에는 다음 파일들이 추가되었습니다.

```text
MqttSourceOptions.java
MqttSourceConfig.java
MqttSourceFactory.java
MqttSource.java
MqttSourceReader.java
```

각 파일의 역할은 다음과 같습니다.

`MqttSourceOptions`는 사용자가 설정할 수 있는 옵션을 정의합니다. 예를 들면 `url`, `topic`, `qos`, `format`, `clean_session`, `max_queue_size` 같은 값입니다.

`MqttSourceConfig`는 `ReadonlyConfig`에서 실제 값을 읽고, 사용할 수 있는 값인지 검증합니다. 예를 들어 `qos`가 0 또는 1인지, `max_queue_size`가 0보다 큰지, `clean_session=false`일 때 `client_id`가 있는지 확인합니다.

`MqttSourceFactory`는 SeaTunnel이 config 안의 `MQTT` connector block을 보고 이 Source를 생성할 수 있게 연결합니다.

`MqttSource`는 SeaTunnel Source API와 실제 reader를 이어주는 얇은 layer입니다. schema를 기반으로 produced catalog table을 만들고, reader를 생성합니다.

`MqttSourceReader`는 실제 MQTT client를 만들고, topic을 subscribe하고, callback으로 들어온 메시지를 queue에 넣고, SeaTunnel runtime이 poll할 때 row로 변환해 collect합니다.

테스트에는 다음 파일들이 추가되었습니다.

```text
MqttSourceFactoryTest.java
MqttSourceConfigTest.java
MqttSourceTest.java
```

여기까지 보면 그냥 일반적인 구현 기록처럼 보입니다. 그런데 제가 다시 보려고 했던 지점은 “파일을 잘 나눴는가”보다 조금 더 깊었습니다.

이 파일들이 SeaTunnel이라는 프로젝트의 기존 언어를 제대로 사용하고 있는지 확인하고 싶었습니다.

## 기존 코드의 문맥을 읽는다는 것

이번에 가장 먼저 본 것은 같은 모듈에 이미 존재하던 MQTT Sink였습니다.

```text
connector-mqtt/src/main/java/.../mqtt/sink/MqttSinkOptions.java
connector-mqtt/src/main/java/.../mqtt/sink/MqttSinkFactory.java
connector-mqtt/src/main/java/.../mqtt/sink/MqttSinkWriter.java
```

같은 MQTT connector 안에 들어가는 코드라면, Source와 Sink는 서로 독립적이더라도 사용자 입장에서는 하나의 connector처럼 보입니다.

예를 들어 Sink에서 `qos`라고 쓰는데 Source에서 `quality_of_service`라고 쓰면, 기능적으로는 돌아갈 수 있습니다. 하지만 사용자 경험은 어색해집니다. 같은 MQTT connector인데 설정 이름이 다르기 때문입니다.

그래서 Source option은 Sink option과 최대한 맞춰야 했습니다.

- `url`
- `topic`
- `username`
- `password`
- `qos`
- `format`
- `field_delimiter`
- `connection_timeout`
- `clean_session`

여기서 중요한 건 이름을 베껴 썼다는 사실이 아닙니다. 같은 개념은 같은 이름으로 유지해야 한다는 점입니다. 설정 이름은 단순 문자열이 아니라 사용자와 connector 사이의 계약에 가깝습니다.

한 번 문서화되고 사용되기 시작하면 쉽게 바꿀 수 없습니다. 그래서 option 이름은 처음부터 기존 흐름 안에서 골라야 합니다.

두 번째로 본 것은 RabbitMQ Source였습니다.

MQTT와 RabbitMQ는 서로 다른 시스템입니다. 하지만 둘 다 message broker에서 메시지를 받아 SeaTunnel 내부 row로 흘려보낸다는 점에서는 비슷합니다.

여기서 RabbitMQ Source를 본 이유는 코드를 그대로 따라 하기 위해서가 아니었습니다. 오히려 반대였습니다.

어디까지 따라 하고, 어디부터 따라 하지 말아야 하는지 판단하기 위해서 봤습니다.

RabbitMQ Source에는 RabbitMQ만의 queue, exchange, routing key, ack, correlation id 같은 맥락이 있습니다. MQTT Source가 그 복잡도를 그대로 가져오면 안 됩니다.

비슷한 connector를 참고할 때 위험한 점은, “비슷하니까 구조도 다 가져오자”가 되기 쉽다는 것입니다. 하지만 좋은 참고는 복사가 아니라 비교에 가깝습니다.

- 이 프로젝트에서 SourceFactory는 어떻게 생겼는가?
- message broker source는 reader를 어떻게 구성하는가?
- callback으로 받은 메시지를 runtime에 어떻게 넘기는가?
- 하지만 RabbitMQ에만 필요한 개념은 무엇인가?

이렇게 구분해야 했습니다.

## 단일 split으로 작게 시작한 이유

이번 MQTT Source는 `AbstractSingleSplitSource` 기반으로 작성했습니다.

처음 들으면 조금 단순해 보일 수 있습니다. Source라면 parallelism을 지원해야 더 좋아 보일 수도 있습니다.

하지만 여기서 중요한 것은 “더 많은 기능”이 아니라 “현재 시스템의 semantics에 맞는 기능”이라고 생각했습니다.

MQTT topic subscription은 Kafka partition처럼 명확하게 나눠서 각 reader가 독립적으로 읽을 수 있는 모델이 아닙니다. 여러 reader가 같은 topic을 동시에 subscribe하면, broker와 subscription 설정에 따라 중복 소비나 예상하기 어려운 동작이 생길 수 있습니다.

그런데 첫 PR에서 이것을 무리하게 parallel source처럼 보이게 만들면, 실제 보장보다 더 큰 보장을 암시할 수 있습니다.

그래서 단일 split으로 시작하는 편이 더 정직하다고 봤습니다.

이건 기능을 덜 만든 것이 아니라, 보장할 수 있는 범위를 좁게 선언한 것입니다.

오픈소스 PR에서는 이 차이가 중요합니다. 구현자가 “할 수 있다”고 말하는 범위와 코드가 실제로 보장하는 범위가 맞아야 합니다. 특히 connector는 사용자가 운영 환경에서 쓰는 코드이기 때문에, 애매한 보장을 암시하는 것이 더 위험할 수 있습니다.

## 코드 리뷰에서 놓쳤던 부분

처음에는 제가 이 PR을 꽤 좁은 관점에서 보고 있었습니다. 옵션 이름이 Sink와 맞는지, SourceFactory가 자연스럽게 연결되는지, 단일 split으로 시작하는 판단이 무리하지 않은지, 테스트가 너무 과하게 mock 중심으로 보이지 않는지 같은 것들이었습니다.

그런데 코드 리뷰를 받으면서 더 중요한 부분을 놓쳤다는 걸 알게 됐습니다.

문제는 MQTT 연결이 끊겼을 때였습니다.

정상 흐름에서는 구조가 단순합니다. `open()`에서 MQTT client를 연결하고 topic을 subscribe합니다. 메시지가 들어오면 callback에서 payload를 queue에 넣고, `pollNext()`가 queue에서 꺼내 `SeaTunnelRow`로 넘깁니다.

그런데 broker 장애나 네트워크 문제로 연결이 끊기면 이야기가 달라집니다. 기존 구현에서는 `connectionLost()`에서 warning log만 남기고 Paho의 auto reconnect에 기대고 있었습니다. 겉으로는 그럴듯해 보였습니다. MQTT client가 알아서 재연결을 시도하니까요.

하지만 리뷰어가 짚어준 핵심은 이거였습니다.

> 재연결이 오래 실패하면, task는 살아 있는 것처럼 보이지만 실제로는 더 이상 데이터를 읽지 못할 수 있다.

이건 단순한 예외 처리 누락이 아니었습니다. streaming source에서 가장 위험한 상태 중 하나였습니다. 실패하면 차라리 빨리 드러납니다. 그런데 task가 죽지 않고, 데이터만 조용히 멈추면 운영자는 늦게 알아차립니다.

기존 구조에서는 `pollNext()`가 `receiveException`이 있을 때만 실패했습니다. 그런데 `connectionLost()`는 그 값을 설정하지 않았습니다. 그러면 reconnect가 계속 실패하더라도 queue는 비어 있고, `pollNext()`는 계속 `null`만 반환할 수 있습니다.

즉, 제가 처음에 본 것은 “메시지가 잘 들어올 때의 Source”였습니다. 리뷰에서 드러난 것은 “메시지가 더 이상 들어오지 않을 때도 Source가 정직하게 실패하는가”였습니다.

이 차이가 컸습니다.

그래서 이후 수정에서는 disconnect 시작 시간을 기록하고, `reconnect_timeout`을 넘기면 `pollNext()`에서 명확히 실패하도록 바꿨습니다. 재연결에 성공했을 때는 topic을 다시 subscribe하고 disconnect timer를 초기화하도록 했습니다. 만약 재연결 후 resubscribe가 실패하면 그 예외도 다음 `pollNext()`에서 드러나게 했습니다.

이 경험을 통해 Source connector에서는 happy path보다 failure path가 더 중요할 수 있다는 걸 느꼈습니다. 특히 streaming source는 “계속 실행된다”는 사실만으로는 충분하지 않습니다. 실제로 계속 데이터를 읽고 있는지, 읽지 못하는 상태를 어떻게 드러내는지가 중요합니다.

## 테스트에서 실제로 수정한 부분

처음 점검에서 실제로 수정한 파일은 `MqttSourceTest.java` 하나였습니다.

수정 전에는 테스트 클래스 전체에 Mockito extension이 붙어 있었습니다.

```java
@ExtendWith(MockitoExtension.class)
class MqttSourceTest {

    @Mock private SingleSplitReaderContext readerContext;

    @Test
    void testCreateReader() throws Exception {
        MqttSource source = new MqttSource(ReadonlyConfig.fromMap(baseConfig()));

        AbstractSingleSplitReader<?> reader = source.createReader(readerContext);

        Assertions.assertInstanceOf(MqttSourceReader.class, reader);
    }
}
```

이 코드는 틀린 코드는 아닙니다. JUnit 5와 Mockito를 함께 쓸 때 흔히 쓰는 방식입니다. 기존 `MqttSinkWriterTest`도 Mockito extension을 사용하고 있었습니다.

그런데 다시 보니 `MqttSourceTest`는 mock 중심 테스트가 아니었습니다.

대부분의 테스트는 Source의 metadata와 job mode, produced catalog table을 확인합니다.

- plugin name이 `MQTT`인지
- boundedness가 `UNBOUNDED`인지
- streaming job mode는 허용되는지
- batch job mode는 실패하는지
- produced catalog table이 schema를 잘 갖는지

mock이 필요한 곳은 reader 생성 테스트 하나뿐이었습니다.

그래서 테스트 클래스 전체에 Mockito extension을 붙이는 것이 조금 크게 느껴졌습니다.

수정 후에는 필요한 테스트 안에서만 mock을 만들도록 바꿨습니다.

```java
class MqttSourceTest {

    @Test
    void testCreateReader() throws Exception {
        MqttSource source = new MqttSource(ReadonlyConfig.fromMap(baseConfig()));

        SingleSplitReaderContext readerContext = Mockito.mock(SingleSplitReaderContext.class);
        AbstractSingleSplitReader<?> reader = source.createReader(readerContext);

        Assertions.assertInstanceOf(MqttSourceReader.class, reader);
    }
}
```

겉으로 보면 정말 작은 변경입니다.

- `@ExtendWith(MockitoExtension.class)` 제거
- `@Mock` field 제거
- `Mockito.mock(...)`을 테스트 메서드 안으로 이동

하지만 이 작은 변경이 의미하는 바는 단순하지 않았습니다.

테스트 클래스의 성격을 더 정확하게 만든 것입니다.

수정 전 코드는 “이 테스트 클래스는 Mockito extension이 필요한 테스트 클래스”처럼 보입니다. 수정 후 코드는 “이 특정 테스트에서만 context mock이 필요하다”는 사실이 바로 드러납니다.

이 차이는 작지만, 리뷰어가 테스트를 읽을 때 불필요한 해석을 줄여줍니다.

## 테스트 코드는 구현의 설명서이기도 하다

이번 수정에서 다시 느낀 점은, 테스트 코드는 단순히 실패를 잡는 장치가 아니라 구현의 설명서라는 것입니다.

특히 오픈소스 PR에서 테스트는 리뷰어에게 이런 메시지를 줍니다.

“제가 이 기능에서 중요하다고 본 동작은 이것입니다.”

`MqttSourceConfigTest`는 설정 validation이 중요하다는 것을 보여줍니다.

- invalid qos는 실패해야 한다.
- `max_queue_size <= 0`은 실패해야 한다.
- `clean_session=false`인데 `client_id`가 없으면 실패해야 한다.
- clean session일 때는 client id가 자동 생성될 수 있다.

`MqttSourceFactoryTest`는 factory option rule이 중요하다는 것을 보여줍니다.

- required option에 `url`, `topic`, `schema`가 포함되어야 한다.
- optional option에 source가 지원하는 설정들이 포함되어야 한다.
- factory identifier는 `MQTT`여야 한다.

`MqttSourceTest`는 Source 자체의 runtime-facing contract를 보여줍니다.

- 이 Source는 unbounded source다.
- streaming job mode에서 사용된다.
- batch mode에서는 실패한다.
- schema 기반 catalog table을 생산한다.
- reader를 생성할 수 있다.

이렇게 보면 테스트는 단순한 방어 코드가 아닙니다. PR의 설계를 설명하는 작은 문서입니다.

그래서 테스트 안에서 mock을 어디에 두는지, 어떤 assertion을 하는지도 설계 설명의 일부가 됩니다.

코드 리뷰 이후에는 이 관점이 조금 더 확장됐습니다. 테스트는 정상 동작의 설명서일 뿐 아니라, 장애 상황에서 어떤 보장을 하는지 보여주는 문서이기도 했습니다.

이번 리뷰를 반영하면서 추가로 중요해진 테스트는 다음과 같은 종류였습니다.

- 연결이 끊겼을 때 disconnect 시작 시간이 기록되는가
- `reconnect_timeout`을 넘기면 `pollNext()`에서 실패하는가
- reconnect가 성공하면 topic을 다시 subscribe하는가
- resubscribe가 실패하면 그 예외가 조용히 묻히지 않고 다음 polling 경로로 전달되는가
- queue overflow 같은 callback-side 실패가 runtime polling 경로에서 드러나는가

특히 timeout 테스트는 실제 시간을 기다리면 flaky해질 수 있습니다. 그래서 wall-clock에 의존하기보다 시간을 주입할 수 있게 만들어 deterministic하게 검증하는 쪽이 더 낫다고 봤습니다. 이 부분도 “테스트가 있다”보다 “테스트가 운영 상황의 실패 방식을 안정적으로 설명한다”에 가까웠습니다.

## 검증 결과를 남기는 이유

수정 후에는 MQTT connector 모듈 기준으로 테스트와 포맷을 확인했습니다.

먼저 `MqttSourceTest`만 실행했습니다.

```bash
./mvnw -pl seatunnel-connectors-v2/connector-mqtt -Dtest=MqttSourceTest test -Dskip.spotless=true
```

결과는 성공이었습니다.

```text
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

그 다음 Spotless check를 실행했습니다.

```bash
./mvnw -pl seatunnel-connectors-v2/connector-mqtt spotless:check
```

결과는 성공이었습니다.

```text
BUILD SUCCESS
```

마지막으로 MQTT connector 모듈 전체 테스트를 실행했습니다.

```bash
./mvnw -pl seatunnel-connectors-v2/connector-mqtt test -Dskip.spotless=true
```

결과는 다음과 같았습니다.

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

이런 검증 결과를 글에 남기는 이유는 단순히 “성공했다”를 기록하기 위해서가 아닙니다.

나중에 PR을 작성할 때, 리뷰어에게 보여줄 수 있는 신뢰의 근거가 되기 때문입니다.

오픈소스 PR에서 좋은 테스트 계획은 보통 이렇게 구체적이어야 합니다.

“테스트했습니다.”

보다는,

“이 명령어를 실행했고, 이 범위의 테스트가 통과했습니다.”

가 훨씬 좋습니다.

## 포트폴리오 관점에서 이 경험을 어떻게 말할 수 있을까

취업 준비 관점에서 보면, 오픈소스 기여 경험을 말할 때 “무엇을 구현했다”만 말하면 조금 아쉬울 수 있습니다.

예를 들어 이렇게 말할 수도 있습니다.

> Apache SeaTunnel에 MQTT Source connector를 구현했습니다.

틀린 말은 아니지만, 이 문장만으로는 어떤 판단을 했는지 잘 보이지 않습니다.

이번 경험을 더 잘 설명하려면 구현보다 판단을 드러내야 합니다.

예를 들면 이렇게 말할 수 있습니다.

> Apache SeaTunnel의 MQTT Source를 구현하면서, 기존 MQTT Sink와 RabbitMQ Source를 비교해 connector option naming, factory registration, reader lifecycle 패턴을 맞췄습니다. MQTT는 Kafka처럼 명확한 offset/partition 모델이 없기 때문에 첫 PR에서는 단일 split 기반의 unbounded source로 범위를 좁혔고, 테스트 코드에서도 Mockito 사용 범위를 필요한 메서드 안으로 줄여 리뷰 가능한 형태로 정리했습니다.

이 문장에는 단순 구현보다 많은 정보가 들어 있습니다.

- 기존 코드베이스를 읽었다.
- 유사 connector를 비교했다.
- 무리한 추상화를 피했다.
- 시스템의 delivery semantics를 고려했다.
- 테스트 코드의 의도를 정리했다.
- PR 리뷰 가능성을 생각했다.

저는 이런 지점이 오픈소스 기여를 포트폴리오로 설명할 때 중요하다고 느꼈습니다.

기술 스택을 나열하는 것보다, 어떤 제약 속에서 어떤 판단을 했는지를 보여주는 편이 훨씬 설득력 있습니다.

## 이번 작업에서 얻은 결론

이번에 다시 본 것은 단순한 코드 컨벤션이 아니었습니다.

겉으로는 `MqttSourceTest`에서 Mockito extension을 제거한 작은 수정이었습니다. 하지만 그 과정에서 본질적으로는 이런 질문을 다시 던진 셈입니다.

“내가 작성한 코드는 이 프로젝트의 기존 문맥 안에 잘 들어가고 있는가?”

오픈소스 기여에서는 이 질문이 중요합니다.

혼자 만드는 프로젝트에서는 내가 정한 규칙이 곧 프로젝트의 규칙이 됩니다. 하지만 오픈소스에서는 이미 프로젝트가 가진 언어가 있습니다.

- 파일을 나누는 방식
- 옵션을 정의하는 방식
- 예외를 던지는 방식
- 테스트를 구성하는 방식
- 문서화하는 방식
- 첫 PR의 범위를 잡는 방식

기여자는 그 언어를 먼저 읽어야 합니다. 그리고 그 언어 안에서 최소한의 변경으로 문제를 해결해야 합니다.

이번 MQTT Source 작업은 아직 끝난 것이 아닙니다. PR은 계속 리뷰를 거쳐야 하고, CI와 문서, e2e 같은 확인도 남아 있습니다. 하지만 이번 코드 리뷰를 통해 한 가지 방향은 더 분명해졌습니다.

오픈소스 PR에서 좋은 코드는 단순히 새 기능을 추가한 코드가 아닙니다.

기존 프로젝트가 이미 쌓아온 판단을 존중하면서, 그 안에 자연스럽게 들어가는 코드입니다.

이번 작업에서는 그 감각을 조금 배운 것 같습니다.
