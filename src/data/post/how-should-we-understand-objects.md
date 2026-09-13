---
title: "객체를 어떻게 이해해야 할까?"
publishDate: 2026-09-13T21:29:23+09:00
draft: false
tags:
  - "java"
  - "object-oriented"
  - "software-design"
  - "backend"
excerpt: "데이터와 메서드를 묶었다고 객체의 역할까지 분명해질까요? 주문·재고·결제 사례로 객체의 책임, 공개 메서드, 협력을 연결하고 하나의 관심사로 객체를 나누는 기준을 살펴봅니다."
---

주문 클래스를 만들고 상품 번호, 수량, 주문 상태를 넣었습니다. 생성자와 getter, setter도 만들었습니다. 그런데 주문 처리 코드를 열어보면 여전히 서비스 메서드 하나가 모든 조건을 판단합니다.

클래스는 생겼는데, 무엇이 달라진 걸까요?

객체를 “데이터와 메서드를 묶은 것”이라고 외우면 모양은 이해하기 쉽습니다. 하지만 어떤 데이터를 묶어야 하는지, 메서드는 어디에 두어야 하는지, 새 클래스를 언제 만들어야 하는지는 남습니다.

한 상품을 주문하고 재고를 확보한 뒤 결제를 승인받는 작은 예제로 이 질문을 따라가 보겠습니다. 실제 쇼핑몰의 전체 구현이 아니라, 객체에 무엇을 맡기는지 살펴보기 위한 예제입니다.

## 1. 객체는 데이터와 메서드를 묶은 것일까?

Oracle의 Java 튜토리얼은 객체를 상태와 관련된 행동을 함께 가진 것으로 설명합니다. 상태는 필드에 저장하고, 행동은 메서드로 드러냅니다.[1] 틀린 설명이 아닙니다. 다만 여기서 **관련된 행동**이라는 부분을 놓치기 쉽습니다.

주문에 `status` 필드를 두고 `setStatus()`를 만들었다고 해보겠습니다. 결제 승인 후 주문을 확정해야 한다는 규칙은 어디에 있을까요?

호출하는 코드가 주문 상태를 읽고, 확정 가능한 상태인지 검사한 뒤, setter로 값을 바꾼다면 규칙은 여전히 호출자에게 있습니다. 웹 요청을 처리하는 코드와 관리자 도구가 각각 같은 검사를 작성할 수도 있습니다. 한쪽에서 검사를 빠뜨려도 주문 객체는 이를 막지 못합니다.

이때 문제는 getter나 setter라는 문법 자체가 아닙니다. **유효한 주문 상태를 지켜야 하는 주체와, 실제로 그 조건을 판단하는 코드가 떨어져 있다는 점**입니다.

반대로 외부에서 `order.confirm()`을 호출하고, 주문이 자기 상태를 검사한 뒤 확정한다면 달라집니다. 호출자는 확정을 요청하고, 주문은 그 요청을 받아들일 수 있는지 판단합니다. 상태를 바꾸는 길에 규칙이 놓이는 것입니다.

필드를 `private`으로 만드는 것만으로는 부족합니다. 아무 값이나 넣는 공개 setter가 있다면 외부에서 상태를 결정하는 구조는 그대로입니다. 내부 표현을 감춘다는 것은 필드가 보이지 않는다는 뜻을 넘어, 외부가 내부 규칙을 대신 구현하지 않아도 된다는 뜻으로 이어져야 합니다.

물론 데이터를 옮기기 위한 DTO처럼 행동이 거의 없는 자료구조도 필요합니다. 모든 데이터 묶음에 도메인 행동을 억지로 붙이자는 이야기는 아닙니다. 지금 살펴보려는 것은 업무 규칙을 맡은 객체입니다.

## 2. 객체는 도메인의 개념을 코드에 드러낸다

쇼핑몰에서 이야기하는 주문, 재고, 결제 승인은 서로 다른 개념입니다. 여기서 **도메인**은 프로그램이 다루는 업무 영역을 뜻합니다.

변수 몇 개만 있어도 주문 처리는 구현할 수 있습니다. 하지만 `quantity`, `remaining`, `status`, `approved`를 한 메서드에서 계속 조작하면, 읽는 사람이 변수 사이의 관계를 머릿속에서 복원해야 합니다.

`Order`, `Stock`, `PaymentGateway`라는 이름을 붙이면 코드에서 무엇을 구분하려는지 보이기 시작합니다.

- `Order`: 어떤 상품을 얼마만큼 주문했고, 주문이 어떤 상태인지 다룹니다.
- `Stock`: 해당 상품의 가용 수량을 관리하고 재고 확보 가능 여부를 판단합니다.
- `PaymentGateway`: 결제 승인을 요청하는 외부 연동의 창구입니다.

그렇다고 현실의 명사를 전부 클래스로 옮기면 되는 것은 아닙니다. 실제 창고에는 선반, 상자, 지게차도 있지만 지금 주문 흐름에는 필요하지 않습니다. 반대로 결제 연동의 창구처럼 물리적인 사물이 아니어도 코드에서 분리할 개념은 있습니다.

객체를 만드는 일은 현실을 복사하는 일보다, **현재 해결하려는 문제에서 구분해야 할 개념과 규칙을 고르는 일**에 가깝습니다.

예를 들어 주문 수량과 가용 재고 수량은 둘 다 정수입니다. 그렇지만 같은 값은 아닙니다. 주문 수량은 고객이 구매하려는 양이고, 가용 재고는 아직 다른 주문에 배정되지 않은 양입니다. 같은 `int`라도 어느 객체에 속하는지에 따라 의미와 변경 조건이 달라집니다.

이 차이를 이름과 경계로 드러내면, 코드의 독자는 숫자 계산을 보기 전에 업무에서 무슨 일이 일어나는지 이해할 단서를 얻습니다.

## 3. 객체를 이해하는 기준은 책임이다

이름만으로는 아직 부족합니다. `Order`라는 클래스에 결제 HTTP 요청과 SQL 저장까지 넣어도 이름은 여전히 주문이기 때문입니다.

그래서 한 번 더 물어야 합니다.

> 이 객체는 무엇을 알고, 어떤 판단과 행동을 맡아야 할까?

이 글에서는 그것을 객체의 **책임**으로 보겠습니다. 주문 객체라면 자신의 주문 내용과 상태를 알고, 허용된 순서로 상태가 바뀌도록 지키는 일을 맡길 수 있습니다. 재고 객체라면 가용 수량이 부족한 요청을 거절하는 일을 맡깁니다.

예제에서는 주문을 `PENDING`에서 `CONFIRMED`로 한 번만 바꿀 수 있게 하겠습니다. 금액은 원 단위의 양의 정수로 두고, 주문 생성 시 정해진 값으로 단순화합니다.

```java
enum OrderStatus { PENDING, CONFIRMED }

final class Order {
    private final String productId;
    private final int quantity;
    private final long amountWon;
    private OrderStatus status = OrderStatus.PENDING;

    Order(String productId, int quantity, long amountWon) {
        if (productId == null || productId.isBlank()
                || quantity <= 0 || amountWon <= 0) {
            throw new IllegalArgumentException("잘못된 주문 내용");
        }
        this.productId = productId;
        this.quantity = quantity;
        this.amountWon = amountWon;
    }

    public void requirePending() {
        if (status != OrderStatus.PENDING) {
            throw new IllegalStateException("대기 중인 주문만 처리 가능");
        }
    }

    public void confirm() {
        requirePending();
        status = OrderStatus.CONFIRMED;
    }

    public String productId() { return productId; }
    public int quantity() { return quantity; }
    public long amountWon() { return amountWon; }
    public OrderStatus status() { return status; }
}
```

`confirm()`은 상태에 값을 대입하는 한 줄을 포장한 것처럼 보입니다. 하지만 이미 확정한 주문을 다시 확정할 수 없다는 조건도 함께 지킵니다. 호출하는 곳이 늘어도 이 조건을 복사하지 않습니다. 잘못된 요청이 들어오면 기존 상태를 유지한 채 거절합니다.

여기에는 경계도 있습니다. 이 `Order`가 보장하는 것은 **주문 내부의 상태 전이**입니다. `confirm()`이 결제사에 승인 사실을 조회하거나 재고 확보 여부를 증명하지는 않습니다. 재고와 결제의 결과를 확인한 뒤 확정을 요청하는 일은 뒤에서 볼 주문 처리 흐름이 맡습니다.

이렇게 책임을 구체적으로 설명해야 “주문에 관련된 것은 전부 Order에 넣자”는 방향을 피할 수 있습니다. 주문을 저장할 테이블이 바뀌는 일과, 주문을 확정할 수 있는 상태가 바뀌는 일은 같은 정책이 아닙니다.

## 4. 공개 메서드는 책임을 요청하는 창구다

외부 객체는 주문의 필드를 직접 바꾸는 대신 공개 메서드로 요청합니다. 공개 메서드는 객체가 어떤 책임을 받아들이는지 보여주는 창구입니다.

![외부의 확정 요청이 공개 메서드 confirm을 거쳐 주문 내부의 상태 검사와 변경으로 이어지는 경계](/images/object-understanding/object-boundary.svg)

`setStatus(CONFIRMED)`는 “이 값을 넣어라”에 가깝습니다. `confirm()`은 “이 주문을 확정해 달라”는 요청입니다. 후자는 어떤 상태에서 허용되는지, 거절하면 어떻게 되는지를 메서드의 계약으로 정할 수 있습니다.

여기서 계약은 거창한 별도 문서만을 뜻하지 않습니다. 호출자가 알아야 하는 입력 조건, 성공 결과, 실패 방식입니다. 예제의 `confirm()`은 대기 상태에서 성공하면 확정 상태가 되고, 그 외에는 예외를 던지며 상태를 바꾸지 않습니다.

Martin Fowler가 설명한 Tell-Don't-Ask도 이 지점에 닿아 있습니다. 객체에서 데이터를 꺼내 외부에서 행동을 결정하기보다, 데이터와 관련된 행동을 함께 두도록 권합니다.[2]

다만 이를 “질의 메서드를 만들면 안 된다”로 읽으면 곤란합니다. Fowler도 적절한 질의가 코드를 단순하게 만드는 경우를 설명합니다. 예제의 `quantity()`나 `amountWon()`처럼 협력에 필요한 정보를 알려주는 것은 자연스럽습니다. 상태를 화면에 표시하려고 `status()`를 읽는 것도 문제라고 보기 어렵습니다.

차이는 **정보를 읽는가**가 아니라, **그 정보를 읽은 곳이 남의 규칙까지 다시 구현하는가**에 있습니다. 재고를 화면에 보여주는 조회와, 재고 값을 꺼내 수량을 검사하고 차감한 값을 다시 넣는 코드는 맡고 있는 일이 다릅니다.

## 5. 객체는 서로의 책임을 요청하며 협력한다

주문 객체가 스스로 결제할 필요는 없습니다. 그렇다고 주문 확정이라는 목표에서 결제를 빼도 되는 것은 아닙니다. 나눈 책임이 함께 필요해지는 순간, 객체 사이의 협력이 생깁니다.

재고부터 보겠습니다. 예제의 `Stock` 하나는 상품 하나의 가용 수량을 관리합니다. `reserve()`는 나중에 팔 수량을 확보한다는 뜻이며, 여기서는 가용 수량에서 차감하는 것까지만 표현합니다.

```java
final class Stock {
    private final String productId;
    private int available;

    Stock(String productId, int available) {
        if (productId == null || productId.isBlank() || available < 0) {
            throw new IllegalArgumentException("잘못된 재고 내용");
        }
        this.productId = productId;
        this.available = available;
    }

    public void reserve(String requestedProductId, int quantity) {
        if (!productId.equals(requestedProductId) || quantity <= 0) {
            throw new IllegalArgumentException("잘못된 재고 요청");
        }
        if (available < quantity) {
            throw new IllegalStateException("재고 부족");
        }
        available -= quantity;
    }

    public int available() { return available; }
}
```

호출자는 `available`을 직접 줄이지 않습니다. 어떤 상품인지, 요청 수량이 양수인지, 가용 수량이 충분한지는 `Stock`이 판단합니다. “재고는 음수가 되지 않는다”는 조건을 지키는 곳이 하나로 모였습니다. 단, 이 코드는 단일 스레드 예제이므로 동시 요청까지 보호하는 구현은 아닙니다.

결제는 승인 요청의 형태만 정의합니다. 실제 HTTP 통신은 이 인터페이스를 구현하는 연동 코드의 몫입니다.

```java
interface PaymentGateway {
    // 정상 반환은 승인 완료를 뜻한다. 실패하면 예외를 던진다.
    void approve(long amountWon);
}
```

이 둘을 연결하는 `CheckoutService`는 **주문 처리의 순서를 조정하는 책임**을 맡습니다. 다음 코드는 객체 간 호출 관계를 보는 성공 경로 예제입니다. 운영 코드로 그대로 사용할 수는 없습니다. 재고 확보 뒤 결제가 실패했을 때의 해제·보상, 저장과 외부 결제 사이의 일관성, 재시도의 멱등성은 별도로 설계해야 하며, `try/catch` 하나로 모두 원자적으로 되돌릴 수 있는 문제가 아닙니다.

```java
final class CheckoutService {
    private final PaymentGateway payments;

    CheckoutService(PaymentGateway payments) {
        this.payments = java.util.Objects.requireNonNull(payments);
    }

    public void checkout(Order order, Stock stock) {
        order.requirePending();
        stock.reserve(order.productId(), order.quantity());
        payments.approve(order.amountWon());
        order.confirm();
    }
}
```

![CheckoutService가 주문 사전 검사, 재고 확보, 결제 승인, 주문 확정을 순서대로 요청하는 협력 흐름](/images/object-understanding/object-collaboration.svg)

그림의 화살표는 서비스가 요청하는 순서입니다. 재고 객체가 결제 객체를 직접 부른다는 뜻이 아닙니다. 모든 객체를 서로 연결할 필요는 없습니다. 이 흐름에서는 조정자가 각 객체의 공개 메서드를 호출합니다.

서비스가 주문 상태를 확인할 때도 `status() != PENDING`이라는 조건을 다시 쓰지 않고 `requirePending()`을 요청합니다. 서비스는 “재고와 결제 전에 처리 가능한 주문인지 확인해야 한다”는 순서를 알고, 어떤 주문 상태가 가능한지는 주문이 판단합니다. 마지막 `confirm()`도 자체 검사를 유지하므로 다른 호출 경로에서 상태 규칙이 사라지지 않습니다.

호출 순서도 의미가 있습니다. 이미 확정된 주문이면 재고에 손대기 전에 실패합니다. 재고 확보에 실패하면 결제 승인까지 가지 않습니다. 결제 승인이 예외로 끝나면 주문은 확정되지 않습니다. 다만 이미 차감한 재고는 이 예제에서 복구되지 않습니다. 실패 지점을 구분해서 읽어야 협력의 책임과 아직 구현하지 않은 복구 책임이 섞이지 않습니다.

## 6. 객체를 통해 도메인의 언어로 로직을 표현한다

이제 `checkout()`을 다시 읽어보면 개별 필드 대입보다 업무의 흐름이 먼저 보입니다.

처리 가능한 주문인지 확인하고, 재고를 확보하고, 결제를 승인받고, 주문을 확정합니다.

읽는 사람은 이 단계에서 재고 차감의 비교 연산이나 결제사의 HTTP 응답 형식을 모두 알 필요가 없습니다. 필요한 곳으로 내려가서 확인하면 됩니다. 이것이 여기서 말하는 **높은 추상화 수준**입니다. 세부사항을 없애는 것이 아니라, 지금 읽는 위치에서 생각해야 할 일을 줄입니다.

다만 메서드 이름만 업무 용어로 바꾼다고 추상화가 완성되지는 않습니다. `reserve()`를 호출하기 전에 호출자가 상품 일치 여부와 재고 부족 조건을 직접 검사해야 한다면, 이름 뒤의 책임이 여전히 밖으로 새어 나온 것입니다. 요청받은 객체가 자기 규칙을 실제로 지켜야 합니다.

예제의 정상 경로는 다음처럼 실행할 수 있습니다. 앞의 클래스들과 아래 클래스를 같은 `ObjectExample.java` 파일에 넣고 `javac ObjectExample.java`, `java ObjectExample`로 실행합니다. 결제 구현은 실제 결제 대신 승인 금액만 출력하는 테스트용 대역입니다.

```java
public class ObjectExample {
    public static void main(String[] args) {
        Order order = new Order("BOOK-1", 2, 30000);
        Stock stock = new Stock("BOOK-1", 5);
        PaymentGateway payments = amount ->
                System.out.println("결제 승인 요청: " + amount);

        new CheckoutService(payments).checkout(order, stock);
        System.out.println(order.status());
        System.out.println("가용 재고: " + stock.available());
    }
}
```

실행하면 승인 요청 금액 `30000`, 주문 상태 `CONFIRMED`, 가용 재고 `3`을 확인합니다. 이 예제는 외부 결제가 성공했다는 증거가 아니라, 서로 다른 책임을 가진 객체들이 연결되는 방식을 보여줍니다.

이런 추상화와 모듈화는 객체지향만의 독점적인 장점은 아닙니다. 절차적 코드에서도 잘 나눈 함수와 모듈로 업무 흐름을 표현할 수 있습니다. 객체는 상태와 그 상태를 다루는 규칙을 함께 두고, 그 경계에 요청을 보내도록 만드는 한 가지 방법입니다.

단순한 계산 하나를 위해 클래스와 인터페이스를 여러 겹 만들면 오히려 읽기 어려워집니다. 객체를 늘렸는지보다, 흩어진 판단이 줄고 필요한 개념이 더 잘 보이는지를 확인하는 편이 낫습니다. 여기서도 `PaymentGateway`는 외부 결제 연동이라는 경계가 있어서 분리했지, 모든 클래스에 인터페이스가 필요해서 만든 것은 아닙니다.

## 7. 새로운 객체의 책임은 하나의 관심사로 설명할 수 있는가?

그러면 언제 새 객체로 나누면 좋을까요?

우선 그 객체가 맡을 일을 한 문장으로 써보면 좋겠습니다. “상품 하나의 가용 재고를 관리한다”는 설명 아래에는 재고 확보, 해제, 조회 같은 여러 메서드가 들어갈 수 있습니다. **하나의 관심사는 하나의 메서드라는 뜻이 아닙니다.** 같은 규칙과 목적을 위해 함께 필요한 행동이라면 한곳에 두는 편이 자연스럽습니다.

반대로 “주문을 관리한다”는 말은 너무 넓을 수 있습니다. 그 말 아래 주문 상태 규칙, 결제사 인증 헤더, SQL 문장, 영수증 HTML을 모두 넣을 수 있기 때문입니다. 한 문장으로 표현했다는 사실보다 그 문장이 실제로 무엇을 묶고 무엇을 제외하는지가 중요합니다.

![웹과 관리자에 흩어진 재고 규칙을 Stock의 reserve로 모으고 주문과 결제 책임은 분리한 전후 비교](/images/object-understanding/object-cohesion.svg)

Robert C. Martin은 단일 책임 원칙을 설명하면서 변경 이유를 사람과 업무 기능에 연결합니다. 같은 이유로 바뀌는 것은 모으고, 다른 이유로 바뀌는 것은 나누라는 설명입니다.[3]

이를 “가능한 수정 종류가 딱 하나여야 한다”로 받아들이면 거의 모든 클래스를 끝없이 쪼개게 됩니다. 버그 수정과 이름 변경을 각각 다른 책임으로 세는 것도 이 설명의 취지와 다릅니다. **누구의 요구로, 어떤 정책 때문에 함께 바뀌는가**를 보는 기준에 가깝습니다.

예를 들어 재고 운영 정책이 바뀌어 안전 재고를 남겨야 한다면 `Stock`의 확보 판단을 살펴볼 수 있습니다. 결제사가 인증 방식을 바꿨다면 결제 연동 구현을 살펴봐야 합니다. 주문 확정 조건이 바뀌었다고 결제사 인증 헤더까지 건드려야 한다면 두 관심사가 불필요하게 얽혀 있는지 의심할 만합니다.

반대로 같은 재고 정책을 웹 주문, 관리자 주문, 배치 주문이 각자 구현하고 있다면 더 나눌 때가 아니라 모을 때일 수 있습니다. 같은 조건을 여러 곳에서 고치다가 하나를 빠뜨리는 문제가 있기 때문입니다. 객체를 나누는 일과 관련 규칙을 모으는 일은 반대 목표가 아닙니다. 함께 바뀌어야 할 것은 모으고, 독립적으로 바뀔 것은 갈라놓는 작업입니다.

지금의 경계가 영원히 정답인 것도 아닙니다. 여러 창고에서 수량을 나누어 확보하게 되면 상품 하나의 가용 수량만 아는 `Stock`으로는 부족할 수 있습니다. 그때는 창고 선택 정책이나 예약 내역처럼 새로 생긴 판단을 확인하고 경계를 다시 잡으면 됩니다. 아직 없는 요구를 상상해 모든 객체를 미리 쪼갤 필요는 없습니다.

객체를 볼 때 필드와 메서드 목록부터 세기보다 이렇게 질문해보려고 합니다.

> 이 객체는 어떤 개념을 드러내고, 어떤 규칙을 지키며, 외부에서 무엇을 요청받는가?

여기에 답할 수 있으면 왜 이 코드가 같은 객체에 모였는지 설명하기 쉬워집니다. 그리고 혼자 해결하지 못하는 일은 다른 객체의 책임을 요청하면 됩니다. 객체를 이해하는 출발점은 클래스의 모양보다, 그 안에 맡겨둔 일과 밖으로 드러낸 약속에 있습니다.

## 참고 자료

- [1] [Oracle — What Is an Object?](https://docs.oracle.com/javase/tutorial/java/concepts/object.html): 상태와 관련 행동, 메서드를 통한 상호작용과 데이터 캡슐화의 기초 설명.
- [2] [Martin Fowler — Tell-Don't-Ask](https://martinfowler.com/bliki/TellDontAsk.html): 데이터와 행동을 함께 두려는 원칙 및 질의 메서드와 설계 트레이드오프에 관한 보충.
- [3] [Robert C. Martin — The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html): 변경 이유를 요구하는 사람과 업무 기능에 연결한 설명.

그림은 [Rough.js](https://roughjs.com/) 4.6.6으로 직접 생성한 정적 SVG입니다. 페이지에서 별도 다이어그램 런타임을 실행하지 않습니다.
