---
title: "같은 서버에 staging을 추가할 때 정말 분리해야 하는 것은 무엇일까?"
pubDatetime: 2026-08-11T21:32:15+09:00
featured: false
draft: false
tags:
  - "docker"
  - "ci-cd"
  - "gitlab-ci"
  - "aws"
  - "devops"
description: "소규모 프로젝트에서 서버를 추가하지 않고 staging을 구성했습니다. 한 EC2에서 production과 staging을 함께 운영할 때 나눠야 할 자원과 감수해야 할 한계를 정리합니다."
---

> 이 글은 실제 배포 설정을 바탕으로 작성했지만, 프로젝트명·브랜치명·작업 번호 등 식별 가능한 정보는 일반화했습니다.

## 소규모 프로젝트에서 staging 서버를 따로 두기 어려웠다

production에 변경 사항을 바로 배포하는 것은 부담스럽습니다. 실제 사용자가 쓰는 환경에서 처음 동작을 확인하게 되고, 문제가 생기면 곧바로 서비스에 영향을 주기 때문입니다. 그래서 production에 반영하기 전에 배포 결과를 확인할 staging 환경이 필요했습니다.

가장 명확한 방법은 production과 같은 구성을 별도 서버에 만드는 것입니다.

```text
production EC2 → production 컨테이너
staging EC2    → staging 컨테이너
```

서버 자체가 다르기 때문에 한쪽의 CPU·메모리 사용량이나 장애가 다른 쪽으로 번질 가능성도 줄어듭니다. 하지만 규모가 작은 프로젝트에서는 staging을 위해 EC2 한 대를 더 유지하는 비용과 관리 부담도 무시하기 어렵습니다.

현재 단계에서는 production 서버에 여유 자원이 있었고, staging에 production 수준의 가용성까지 필요하지는 않았습니다. 그래서 새로운 서버를 추가하는 대신 **기존 EC2 안에서 두 환경을 별도 Docker 컨테이너로 실행하는 방식**을 선택했습니다.

```text
하나의 EC2
├─ production 컨테이너
└─ staging 컨테이너
```

물론 이것은 두 환경을 완전히 격리하는 구성이 아닙니다.

- CPU와 메모리를 함께 사용합니다.
- EC2에 장애가 발생하면 두 환경이 모두 영향을 받습니다.
- staging의 과도한 자원 사용이 production에 영향을 줄 수 있습니다.

대신 별도 서버 비용 없이 실행 프로세스와 데이터, 접근 경로를 나눌 수 있습니다. 소규모 프로젝트의 현재 조건에서 비용과 격리 수준을 절충한 선택이었습니다.

이제 질문은 구체적으로 바뀝니다.

> 같은 서버를 공유하면서도 두 환경이 서로 덮어쓰거나 충돌하지 않게 하려면 무엇을 분리해야 할까?

## staging 배포인데 왜 `latest`가 먼저 보였을까?

이 구성을 Pipeline에 반영하는 작업을 검토하면서 처음에는 Docker 이미지의 `latest` 태그가 가장 큰 문제처럼 보였습니다.

staging 브랜치도 이미지를 빌드하면서 `latest`를 갱신하면, 기존에 production 이미지를 가리키던 `latest`가 staging 이미지로 바뀌기 때문입니다.

```text
staging 배포 전
latest → production 이미지

staging 배포 후
latest → staging 이미지
```

겉으로 보면 위험해 보입니다. 하지만 실제 배포 흐름을 따라가 보니, 이 작업의 핵심은 다른 곳에 있었습니다.

**같은 서버에서 두 환경이 충돌하지 않게 하려면 컨테이너 이름과 호스트 포트를 분리해야 했습니다.** `latest`는 그다음에 결정할 호환성 문제였습니다.

이 글에서는 무엇이 staging 배포에 반드시 필요한 변경이고, 무엇이 선택적인 방어 조치인지 나눠보려고 합니다.

## 기존 production 배포부터 따라가 보기

기존 production 배포는 다음 순서로 진행됐습니다.

```text
main 브랜치에 코드 반영
→ GitLab Pipeline에서 Docker 이미지 빌드
→ ECR에 이미지 저장
→ AWS SSM으로 EC2에 명령 전달
→ EC2에서 production 컨테이너 실행
```

예시 설정을 단순화하면 다음과 같습니다.

```text
컨테이너 이름: app
호스트 포트:   8501
컨테이너 포트: 8501
볼륨:          app-runtime
```

Docker 명령으로 보면 구조가 조금 더 분명해집니다.

```bash
docker run \
  --name app \
  -p 8501:8501 \
  -v app-runtime:/var/lib/app
```

여기서 중요한 점은 볼륨 이름을 별도로 고정하지 않았다는 것입니다.

```bash
-v "${CONTAINER_NAME}-runtime:/var/lib/app"
```

`CONTAINER_NAME`이 바뀌면 named volume도 함께 바뀝니다. 이미 컨테이너 이름을 기준으로 실행 상태를 분리할 수 있는 구조였던 셈입니다.

## 실제로 분리해야 했던 세 가지

같은 EC2에서 production과 staging을 동시에 실행하려면 적어도 다음 세 가지가 충돌하지 않아야 합니다.

1. 컨테이너 이름
2. 호스트 포트
3. 영속 데이터를 저장하는 볼륨

Pipeline에서 환경별 값을 명시하면 이를 한 번에 나눌 수 있습니다.

```yaml
- if: $CI_COMMIT_BRANCH == "main"
  variables:
    CONTAINER_NAME: "app"
    APP_PORT: "8501"
    DEPLOY_ENVIRONMENT: "production"

- if: $CI_COMMIT_BRANCH == "staging"
  variables:
    CONTAINER_NAME: "app-staging"
    APP_PORT: "8502"
    DEPLOY_ENVIRONMENT: "staging"
```

그러면 production은 기존 구성을 유지합니다.

```text
EC2:8501
→ app:8501
→ app-runtime
```

staging은 별도 구성으로 실행됩니다.

```text
EC2:8502
→ app-staging:8501
→ app-staging-runtime
```

두 컨테이너 내부에서는 애플리케이션의 기본 포트인 `8501`을 그대로 사용합니다. 충돌이 발생하는 지점은 EC2가 외부에 공개하는 호스트 포트이므로, production은 `8501`, staging은 `8502`로 나눕니다.

```text
production: 8501(호스트) → 8501(컨테이너)
staging:    8502(호스트) → 8501(컨테이너)
```

처음에는 staging을 위해 볼륨 처리 코드를 새로 추가해야 한다고 생각할 수 있습니다. 하지만 볼륨 이름이 `${CONTAINER_NAME}-runtime`으로 만들어진다면 컨테이너 이름을 바꾸는 것만으로 데이터도 자동 분리됩니다.

## SSM이 볼륨을 관리하는 것은 아니다

배포 흐름을 보면서 한 번 더 구분해야 했던 것이 있습니다. AWS SSM과 Docker volume의 역할입니다.

```text
GitLab Pipeline
→ 배포 스크립트 생성
→ AWS SSM으로 EC2에 전달
→ EC2에서 docker run 실행
→ Docker가 named volume 생성 또는 재사용
```

SSM은 EC2에 명령을 전달합니다. 실제로 named volume을 만들거나 기존 볼륨을 다시 연결하는 주체는 EC2에서 실행되는 Docker입니다.

따라서 staging 배포에서 다음 명령이 실행된다면,

```bash
CONTAINER_NAME=app-staging
```

기존 템플릿만으로도 볼륨 이름은 이렇게 결정됩니다.

```text
app-staging-runtime
```

이 구분을 놓치면 staging 전용 SSM 처리나 볼륨 생성 로직을 추가해야 할 것처럼 보입니다. 하지만 기존 변수 구조가 역할을 잘 나누고 있다면 새로운 코드는 필요하지 않습니다.

## 그렇다면 `latest`는 왜 헷갈렸을까?

기존 Pipeline은 하나의 Docker 이미지에 두 가지 태그를 붙였습니다.

```text
app:<커밋 SHA>
app:latest
```

예를 들어 커밋 SHA가 `abc12345`라면 같은 이미지에 다음 두 이름이 생깁니다.

```text
app:abc12345
app:latest
```

그런데 실제 EC2 배포 명령을 확인해 보니 `latest`가 아니라 커밋 SHA를 사용하고 있었습니다.

```bash
IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"
```

즉 EC2가 내려받는 이미지는 다음과 같습니다.

```text
app:abc12345
```

이 구조에서는 staging 빌드가 `latest`를 바꾸더라도 현재 실행 중인 production 컨테이너가 자동으로 교체되지 않습니다. 다음 production 배포 역시 해당 main 커밋의 SHA 태그를 사용합니다.

여기서 제가 구분하지 못했던 질문은 두 가지였습니다.

```text
1. staging을 실행하려면 무엇을 바꿔야 하는가?
2. latest라는 기존 태그의 의미를 어떻게 유지할 것인가?
```

첫 번째는 필수 배포 요건입니다. 두 번째는 외부 호환성에 관한 선택입니다.

## `latest`에 대해 선택할 수 있는 세 가지 방식

### 1. 모든 브랜치에서 `latest`를 갱신한다

기존 빌드 명령을 그대로 유지하는 방식입니다.

- 장점: 변경 범위가 가장 작습니다.
- 단점: `latest`가 production 이미지라는 의미를 잃습니다.

배포가 SHA 태그만 사용한다면 현재 Pipeline 자체에는 기능상 문제가 생기지 않습니다. 다만 저장소 밖에서 누군가 `app:latest`를 사용하고 있다면 예상과 다른 이미지를 받을 수 있습니다.

### 2. main에서만 `latest`를 갱신한다

공통 단계에서는 SHA 이미지만 만들고, main 브랜치일 때만 `latest` 태그를 추가합니다.

```bash
docker build --pull -t "${IMAGE}:${IMAGE_TAG}" .
docker push "${IMAGE}:${IMAGE_TAG}"

if [ "$CI_COMMIT_BRANCH" = "main" ]; then
  docker tag "${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
  docker push "${IMAGE}:latest"
fi
```

- 장점: 기존 `latest = production` 의미를 보존합니다.
- 단점: 조건 분기가 하나 추가됩니다.

외부 사용 여부를 바로 확인하기 어렵다면 비교적 안전한 방어 조치입니다. 다만 staging 실행 자체에 꼭 필요한 코드는 아닙니다.

### 3. `latest`를 완전히 제거한다

커밋 SHA 이미지만 빌드하고 배포하는 방식입니다.

- 장점: 어떤 코드가 배포됐는지 명확하고 롤백하기 쉽습니다.
- 단점: 외부에서 `latest`를 사용하고 있었다면 영향을 받습니다.

외부 소비자가 없다는 사실을 확인할 수 있다면 가장 단순한 선택입니다. AWS도 production 컨테이너 이미지에는 `latest`보다 Git SHA 같은 고유 태그를 사용하라고 권장합니다. 실제 배포가 이미 SHA 태그를 사용하고 있다면, 실행 경로는 이 원칙을 따르고 있는 셈입니다.

참고: [AWS ECS 컨테이너 이미지 권장사항](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/container-considerations.html)

## GitLab Environment의 URL은 배포 라우팅이 아니다

설정에는 GitLab Environment 정보도 있었습니다.

```yaml
environment:
  name: production
  url: "${APP_URL}"
```

처음 보면 `APP_URL`이 실제 서비스 라우팅에 사용되는 것처럼 느껴질 수 있습니다. 하지만 이 값은 GitLab의 Environments 화면에서 환경별 링크를 보여주기 위한 메타데이터입니다.

Docker의 포트 바인딩이나 외부 프록시 설정을 대신하지 않습니다.

따라서 staging URL이 아직 없더라도 환경 이름만 분리해 배포할 수는 있습니다.

```yaml
environment:
  name: staging
```

다만 기존 production 환경에서 GitLab의 Open 버튼을 사용하고 있었다면 URL을 무조건 제거해서는 안 됩니다. staging 배포에 필요 없다는 것과 기존 운영 편의 기능에 영향이 없다는 것은 다른 이야기이기 때문입니다.

## 검토하면서 걷어낸 과설계

처음에는 환경이 하나 늘어난다는 이유로 여러 설정을 함께 추가하려고 했습니다.

- staging 전용 이미지 별칭
- 값이 없는 staging URL 변수
- 설정 문자열 전체를 복사해 비교하는 테스트
- production 값을 전역 기본값으로 두고 staging만 덮어쓰는 구조

하지만 실제 실행 흐름을 기준으로 다시 보니 대부분 없어도 됐습니다.

production과 staging의 값을 각 조건 안에서 명시하고, 기존 배포 스크립트가 그 변수를 사용하게 하는 편이 더 읽기 쉬웠습니다. 기능과 관계없는 따옴표 변경이나 포맷 수정도 제외했습니다. 배포 설정은 작은 표기 변경도 기능 변경과 섞이면 리뷰하기 어려워지기 때문입니다.

결국 남은 변경은 단순했습니다.

1. staging 브랜치에서도 테스트·이미지 빌드·배포 job을 실행한다.
2. production은 `app`과 호스트 포트 `8501`을 사용한다.
3. staging은 `app-staging`과 호스트 포트 `8502`를 사용한다.
4. 컨테이너 이름을 기준으로 runtime 볼륨을 자동 분리한다.

애플리케이션 코드나 Dockerfile을 바꿀 이유는 없었습니다.

## 실제 배포 전에는 코드 밖도 확인해야 한다

Pipeline 시뮬레이션과 테스트가 통과해도 실제 배포 준비가 끝난 것은 아닙니다. 같은 EC2에 환경을 하나 더 올리려면 서버와 네트워크 상태를 확인해야 합니다.

- EC2의 staging 호스트 포트가 비어 있는가?
- 외부 staging 주소를 해당 포트로 전달할 reverse proxy 또는 load balancer 설정이 있는가?
- 방화벽과 security group에서 필요한 접근이 허용되는가?
- ECR의 `latest`를 사용하는 외부 작업이 있는가?
- production과 staging이 같은 EC2의 CPU·메모리를 함께 써도 되는가?

특히 마지막 항목은 설정 파일만 봐서는 알 수 없습니다. 컨테이너 이름과 포트를 잘 나눠도 물리 자원은 여전히 공유합니다. “별도 컨테이너”가 곧 “완전히 격리된 환경”을 뜻하지는 않습니다.

## 마무리

이번 작업에서 가장 오래 붙잡았던 것은 `latest`였습니다. 하지만 배포 흐름을 처음부터 따라가 보니 결론은 더 단순했습니다.

```text
staging 브랜치
→ app-staging 컨테이너
→ 별도 호스트 포트
→ app-staging-runtime 볼륨
```

이 네 가지가 staging 실행 경로를 만드는 핵심입니다.

`latest` 조건문은 staging을 실행하기 위한 필수 코드가 아닙니다. 기존에 `latest`를 production 이미지의 별칭으로 사용하던 사람이 있을 가능성을 방어하는 호환성 처리입니다.

배포 설정을 검토할 때는 눈에 띄는 위험부터 바로 고치기보다 먼저 실제 실행 경로를 확인해야 한다는 것도 배웠습니다.

- 어떤 태그를 빌드하는가?
- 실제 서버는 어떤 태그를 pull하는가?
- 환경별로 충돌하는 자원은 무엇인가?
- 기존 변수만 바꿔도 자동으로 분리되는 것은 무엇인가?

이 질문을 순서대로 확인하니 필수 변경과 선택적 개선을 나눌 수 있었고, 불필요한 코드도 걷어낼 수 있었습니다.
