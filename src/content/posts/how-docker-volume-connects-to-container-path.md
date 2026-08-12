---
title: "Docker Volume 한 줄은 어떻게 EC2의 저장공간과 연결될까?"
pubDatetime: 2026-08-12T11:50:00+09:00
featured: false
draft: false
tags:
  - "docker"
  - "volume"
  - "aws"
  - "devops"
description: "-v ${CONTAINER_NAME}-runtime:/var/lib/app 한 줄이 셸 변수 치환을 거쳐 Docker named volume을 만들고, 컨테이너 안의 경로와 연결되는 과정을 쉽게 풀어봅니다."
---

> 이 글은 실제 배포 설정에서 궁금했던 내용을 바탕으로 작성했으며, 프로젝트명과 경로는 일반화했습니다.

## `-v` 한 줄이 잘 읽히지 않았다

같은 EC2에 production과 staging 컨테이너를 함께 배포하면서 다음 명령을 보게 됐습니다.

```bash
-v ${CONTAINER_NAME}-runtime:/var/lib/app
```

짧은 한 줄인데 처음에는 여러 가지가 한꺼번에 헷갈렸습니다.

- `${CONTAINER_NAME}`은 Docker가 알아서 채우는 값일까?
- `-runtime`은 Docker의 특별한 문법일까?
- 콜론 앞과 뒤는 각각 무엇을 뜻할까?
- 컨테이너를 지웠는데 SQLite 파일은 왜 남아 있을까?

결론부터 말하면 이 한 줄은 이렇게 읽을 수 있습니다.

> `${CONTAINER_NAME}-runtime`이라는 Docker 저장공간을 만들거나 재사용하고, 그 공간을 컨테이너 안의 `/var/lib/app`에서 보이게 한다.

이 문장이 실제로 어떤 과정을 거치는지 staging 배포를 예로 들어 따라가 보겠습니다.

## 먼저 컨테이너와 데이터의 수명을 나눠야 한다

Docker로 애플리케이션을 배포할 때는 기존 컨테이너를 지우고 새 이미지로 컨테이너를 다시 만드는 일이 흔합니다.

```bash
docker rm -f app-staging
docker run --name app-staging NEW_IMAGE
```

그런데 애플리케이션이 SQLite나 업로드 파일을 컨테이너의 쓰기 계층에만 저장했다면, 컨테이너를 교체할 때 그 데이터도 함께 잃을 수 있습니다.

```text
기존 컨테이너
└─ /var/lib/app
   ├─ app.sqlite3
   ├─ uploads/
   └─ outputs/

컨테이너 삭제
→ 컨테이너에만 있던 데이터도 사라짐
```

애플리케이션 실행 단위인 컨테이너는 자주 교체해도, 데이터는 그보다 오래 살아남아야 합니다. 그래서 데이터 저장공간을 컨테이너와 별도 자원으로 분리합니다. 그 역할을 하는 것이 Docker Volume입니다.

## 콜론의 왼쪽과 오른쪽부터 나눠보기

Docker의 `-v` 옵션은 기본적으로 다음 형태입니다.

```bash
-v SOURCE:TARGET
```

Named volume을 사용할 때는 다음처럼 읽습니다.

```text
Docker Volume 이름 : 컨테이너 내부 경로
```

원래 명령에 적용하면 이렇습니다.

```text
${CONTAINER_NAME}-runtime : /var/lib/app
─────────────────────────   ────────────
Docker Volume 이름           컨테이너 내부 경로
```

- **콜론 왼쪽**은 Docker가 관리하는 저장공간의 이름입니다.
- **콜론 오른쪽**은 애플리케이션이 그 저장공간을 바라볼 위치입니다.

둘 다 경로처럼 보일 수 있지만, 왼쪽의 `app-staging-runtime`은 호스트 경로가 아니라 **named volume의 이름**입니다.

## 1단계: 셸이 환경변수를 글자로 바꾼다

`${CONTAINER_NAME}`은 Docker 문법이 아닙니다. Docker가 명령을 받기 전에 셸이 환경변수를 치환합니다.

staging 배포에서 다음 값이 설정되어 있다고 해보겠습니다.

```bash
CONTAINER_NAME=app-staging
```

그러면 셸은 다음 표현을

```bash
${CONTAINER_NAME}-runtime
```

이 문자열로 바꿉니다.

```text
app-staging-runtime
```

여기서 `-runtime`은 Docker 예약어가 아닙니다. 저장공간의 용도를 알아보기 쉽게 사람이 붙인 이름일 뿐입니다.

```text
app-staging + -runtime
= app-staging-runtime
```

## 2단계: Docker는 치환이 끝난 명령을 받는다

셸의 변수 치환이 끝나면 Docker가 실제로 받는 명령은 다음과 비슷합니다.

```bash
docker run \
  --name app-staging \
  -p 8502:8501 \
  -v app-staging-runtime:/var/lib/app \
  IMAGE
```

여기에는 이름이 비슷한 Docker 자원이 두 개 있습니다.

```text
컨테이너 이름: app-staging
Volume 이름:   app-staging-runtime
```

이 둘은 별개의 자원입니다. Docker가 컨테이너 이름을 보고 자동으로 Volume 이름을 만든 것이 아닙니다. 배포 명령에서 같은 환경변수를 이용해 이름을 조합했기 때문에 비슷해진 것입니다.

따라서 다음처럼 완전히 다른 이름을 사용해도 동작합니다.

```bash
docker run \
  --name app-staging \
  -v my-storage:/var/lib/app \
  IMAGE
```

다만 `my-storage`라는 이름만 보고 어느 컨테이너의 데이터인지 알아보기 어렵습니다. `${CONTAINER_NAME}-runtime`은 Docker의 기능이 아니라 **사람이 관계를 추적하기 쉽게 정한 이름 규칙**입니다.

## 3단계: Docker가 Volume을 만들거나 재사용한다

Docker는 `app-staging-runtime`이라는 이름의 Volume을 찾습니다.

```text
이미 있음 → 기존 Volume 재사용
없음      → 새 Volume 생성
```

기본 `local` 드라이버를 사용하는 일반적인 rootful Linux Docker 환경에서는 실제 데이터가 다음과 비슷한 위치에 보관됩니다.

```text
/var/lib/docker/volumes/app-staging-runtime/_data
```

다만 이 경로를 모든 환경에서 고정값으로 가정하면 안 됩니다. rootless Docker인지, 다른 Volume driver나 Docker 설정을 사용하는지에 따라 실제 위치가 달라질 수 있습니다.

현재 환경의 정확한 위치는 Docker에 물어보는 편이 안전합니다.

```bash
docker volume inspect app-staging-runtime
```

결과의 `Mountpoint`가 Docker 호스트에서 해당 Volume이 연결된 위치입니다. 이 영역은 Docker가 관리하므로 애플리케이션이 호스트 경로를 직접 알 필요는 없습니다.

## 4단계: Volume이 컨테이너 안의 경로로 보인다

Docker는 방금 찾거나 만든 Volume을 컨테이너 안의 `/var/lib/app`에 마운트합니다.

```text
EC2의 Docker Volume
app-staging-runtime
        │
        │ Docker가 마운트
        ▼
컨테이너 내부
/var/lib/app
```

애플리케이션 입장에서는 `/var/lib/app`이 평범한 디렉터리처럼 보입니다.

```python
from pathlib import Path

Path("/var/lib/app/example.xlsx").write_bytes(data)
```

하지만 이 파일은 컨테이너의 일회성 쓰기 계층이 아니라 연결된 Volume에 기록됩니다.

```text
애플리케이션
→ /var/lib/app/example.xlsx에 저장
→ Docker의 마운트 경로를 통과
→ app-staging-runtime Volume에 기록
```

여기서 컨테이너 내부 파일과 EC2의 Volume 파일이 따로 복사되는 것은 아닙니다. **하나의 저장공간을 컨테이너 안에서 `/var/lib/app`이라는 경로로 보고 있는 것**에 가깝습니다.

## 컨테이너를 지워도 데이터가 남는 이유

이제 기존 staging 컨테이너를 삭제해보겠습니다.

```bash
docker rm -f app-staging
```

삭제되는 것은 `app-staging` 컨테이너입니다. 이름을 붙여 만든 `app-staging-runtime` Volume은 독립된 Docker 자원이므로 그대로 남습니다.

```text
삭제: app-staging 컨테이너
유지: app-staging-runtime Volume
      └─ app.sqlite3
```

새 컨테이너를 실행하면서 같은 이름의 Volume을 다시 지정하면 Docker는 기존 저장공간을 연결합니다.

```bash
docker run \
  --name app-staging \
  -v app-staging-runtime:/var/lib/app \
  NEW_IMAGE
```

흐름은 다음과 같습니다.

```text
기존 컨테이너 삭제
→ Volume은 유지
→ 새 컨테이너 실행
→ 같은 Volume 재연결
→ 기존 SQLite와 파일이 다시 보임
```

이것이 컨테이너 이미지를 바꾸고 컨테이너를 새로 만들어도 데이터가 유지되는 이유입니다.

물론 Volume이 영원히 안전하다는 뜻은 아닙니다. `docker volume rm`, `docker volume prune` 같은 명령으로 지울 수 있고, 호스트 디스크 장애에도 영향을 받습니다. 중요한 데이터라면 Volume 사용과 별개로 백업 정책이 필요합니다.

## production과 staging은 같은 내부 경로를 써도 된다

production과 staging에서 애플리케이션 코드는 모두 같은 경로를 사용해도 됩니다.

```text
/var/lib/app
```

환경별로 다르게 만드는 것은 컨테이너 내부 경로가 아니라 연결할 Volume의 이름입니다.

```text
production 컨테이너
/var/lib/app
    ↕
app-runtime Volume

staging 컨테이너
/var/lib/app
    ↕
app-staging-runtime Volume
```

이를 표로 보면 더 분명합니다.

| 환경       | 컨테이너 이름 | Volume 이름           | 컨테이너 내부 경로 |
| ---------- | ------------- | --------------------- | ------------------ |
| production | `app`         | `app-runtime`         | `/var/lib/app`     |
| staging    | `app-staging` | `app-staging-runtime` | `/var/lib/app`     |

애플리케이션은 두 환경에서 똑같이 `/var/lib/app`에 파일을 씁니다. Docker가 서로 다른 Volume을 그 위치에 연결하기 때문에 실제 데이터는 섞이지 않습니다.

이 구조의 장점은 애플리케이션 코드가 production과 staging의 호스트 저장 위치를 알 필요가 없다는 것입니다. 환경 차이를 애플리케이션 분기 대신 배포 설정에서 처리할 수 있습니다.

## 반대로 같은 Volume을 연결하면 데이터가 섞인다

두 컨테이너에 같은 Volume 이름을 지정하면 어떻게 될까요?

```bash
-v app-runtime:/var/lib/app
```

두 환경이 같은 저장공간을 바라보게 됩니다.

```text
production 컨테이너 ─┐
                     ├─ app-runtime Volume
staging 컨테이너 ────┘
```

이 경우 다음 문제가 생길 수 있습니다.

- staging에서 만든 파일이 production에서도 보입니다.
- 테스트 데이터와 운영 데이터가 섞입니다.
- 두 컨테이너가 같은 SQLite 파일에 동시에 접근할 수 있습니다.
- staging에서 한 실험이 운영 데이터에 영향을 줄 수 있습니다.

따라서 같은 EC2에 두 환경을 올릴 때 포트와 컨테이너 이름만큼 **Volume 이름도 환경별로 분리해야 합니다.**

## 컨테이너 이름을 바꿀 때 생기는 숨은 함정

현재 Volume 이름은 `${CONTAINER_NAME}-runtime` 규칙으로 만들어집니다. 편리하지만 컨테이너 이름과 데이터 저장공간의 이름이 함께 움직인다는 뜻이기도 합니다.

예를 들어 컨테이너 이름을 바꾸면:

```text
기존 컨테이너: app-staging
기존 Volume:   app-staging-runtime

새 컨테이너:  app-stage
새 Volume:     app-stage-runtime
```

Docker는 두 Volume을 서로 다른 자원으로 봅니다. 기존 데이터가 삭제된 것은 아니지만 새 컨테이너에는 보이지 않습니다. 처음 실행한 서비스처럼 빈 저장공간이 나타날 수 있습니다.

따라서 컨테이너 이름을 변경할 때는 다음을 함께 확인해야 합니다.

- 기존 Volume을 그대로 연결할 것인가?
- 새 Volume으로 데이터를 옮길 것인가?
- Volume 이름을 컨테이너 이름과 독립된 변수로 관리할 것인가?

간단한 이름 규칙은 설정을 줄여주지만, 이름 변경이 데이터 연결 변경으로 이어진다는 결합도 생깁니다.

## 쓰기 권한도 별개의 문제다

Volume을 연결했다고 해서 애플리케이션 사용자가 자동으로 모든 파일에 쓸 수 있는 것은 아닙니다.

컨테이너를 `root`가 아닌 `appuser`로 실행한다면, 마운트된 디렉터리의 소유권과 권한도 `appuser`가 쓸 수 있어야 합니다. 기존 Volume에 다른 UID·GID로 생성된 파일이 있다면 마운트 자체는 성공해도 `Permission denied`가 발생할 수 있습니다.

```text
Volume 연결 성공
≠
애플리케이션 쓰기 권한 보장
```

따라서 문제가 생기면 마운트 여부와 함께 다음도 확인해야 합니다.

```bash
docker volume inspect app-staging-runtime
docker exec app-staging id
docker exec app-staging ls -ld /var/lib/app
```

Volume은 **어디에 보존할지**를 해결하고, 파일 권한은 **누가 읽고 쓸 수 있는지**를 해결합니다. 서로 연결되어 있지만 같은 문제는 아닙니다.

## 이 한 줄을 다시 읽어보면

처음 보았던 명령으로 돌아가 보겠습니다.

```bash
-v ${CONTAINER_NAME}-runtime:/var/lib/app
```

처리 순서는 다음과 같습니다.

```text
1. 셸이 ${CONTAINER_NAME}을 실제 문자열로 치환한다.
2. Docker가 해당 이름의 Volume을 찾거나 만든다.
3. Docker가 그 Volume을 컨테이너의 /var/lib/app에 연결한다.
4. 애플리케이션은 /var/lib/app에 평소처럼 파일을 쓴다.
5. 컨테이너를 교체해도 Volume은 남아 데이터를 보존한다.
```

staging 환경에서는 이 한 줄을 이렇게 읽으면 됩니다.

> `app-staging-runtime`이라는 Docker Volume을 만들거나 재사용하고, staging 컨테이너의 `/var/lib/app` 경로에 연결한다.

이번에 가장 헷갈렸던 부분은 컨테이너 이름과 Volume 이름이 비슷해서 Docker가 둘을 자동으로 연결한다고 생각하기 쉬웠다는 점입니다. 실제로는 셸의 문자열 치환과 우리가 정한 이름 규칙이 관계를 만들고 있었습니다.

핵심은 콜론 하나로 정리할 수 있습니다.

> 콜론 앞은 컨테이너보다 오래 보존할 Docker 저장공간의 이름이고, 콜론 뒤는 애플리케이션이 그 저장공간을 바라보는 컨테이너 내부 경로다.

함께 읽기:

- [같은 서버에 staging을 추가할 때 정말 분리해야 하는 것은 무엇일까?](/posts/what-to-separate-for-staging-on-same-server/)
- [staging을 추가했더니 Docker latest의 의미가 왜 달라졌을까?](/posts/why-latest-changed-after-adding-staging/)
