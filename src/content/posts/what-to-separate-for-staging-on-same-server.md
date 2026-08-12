---
title: "같은 서버에 staging을 추가할 때 정말 분리해야 하는 것은 무엇일까?"
pubDatetime: 2026-08-11T21:32:15+09:00
modDatetime: 2026-08-13T00:25:00+09:00
featured: false
draft: true
tags:
  - "docker"
  - "ci-cd"
  - "gitlab-ci"
  - "aws"
  - "aws-ecr"
  - "devops"
description: "별도 서버를 추가하지 않고 한 EC2에서 production과 staging을 운영했습니다. 컨테이너·포트·Volume뿐 아니라 ECR의 SHA·환경·latest 태그까지 어떤 기준으로 분리했는지 정리합니다."
---

> 이 글은 실제 배포 설정을 바탕으로 작성했지만, 프로젝트명·브랜치명·작업 번호 등 식별 가능한 정보는 일반화했습니다.

## staging 서버를 따로 두기 어려웠다

production에 변경 사항을 바로 배포하는 것은 부담스럽습니다. 실제 사용자가 쓰는 환경에서 처음 동작을 확인하게 되고, 문제가 생기면 곧바로 서비스에 영향을 주기 때문입니다. 그래서 production에 반영하기 전에 배포 결과를 확인할 staging 환경이 필요했습니다.

가장 명확한 방법은 별도 서버를 두는 것입니다.

```text
production EC2 → production 컨테이너
staging EC2    → staging 컨테이너
```

서버 자체가 다르기 때문에 CPU·메모리 사용량과 장애 영역을 비교적 명확하게 나눌 수 있습니다. 하지만 규모가 작은 프로젝트에서는 staging을 위해 EC2 한 대를 더 유지하는 비용과 관리 부담도 무시하기 어려웠습니다.

현재 production 서버에는 여유 자원이 있었고, staging에 production 수준의 가용성까지 필요하지는 않았습니다. 그래서 새로운 서버를 추가하는 대신 **하나의 EC2에서 두 환경을 별도 Docker 컨테이너로 실행하는 방식**을 선택했습니다.

```text
하나의 EC2
├─ production 컨테이너
└─ staging 컨테이너
```

이 선택은 비용을 줄여주지만 두 환경을 완전히 격리하지는 못합니다.

- CPU와 메모리를 함께 사용합니다.
- EC2 장애가 발생하면 두 환경이 함께 중단됩니다.
- staging의 과도한 자원 사용이 production에 영향을 줄 수 있습니다.

현재 규모에서는 이 한계를 감수하고 비용과 관리 복잡도를 줄이는 편이 현실적이라고 판단했습니다. 이제 질문은 조금 더 구체적으로 바뀌었습니다.

> 서버를 나누지 않는다면, 같은 EC2 안에서 무엇을 환경별로 분리해야 할까?

## 실제 배포 흐름부터 확인했다

기존 production 배포는 다음 순서로 진행됐습니다.

```text
운영 브랜치에 코드 반영
→ GitLab Pipeline에서 Docker 이미지 빌드
→ AWS ECR에 이미지 push
→ AWS SSM으로 EC2에 배포 명령 전달
→ EC2에서 production 컨테이너 실행
```

처음에는 staging 전용 배포 코드를 별도로 많이 만들어야 할 것처럼 보였습니다. 하지만 기존 파이프라인을 따라가 보니 환경별로 달라져야 하는 값은 생각보다 적었습니다.

```text
컨테이너 이름
호스트 포트
Volume 이름
환경을 표시하는 값
이미지 태그 정책
```

애플리케이션 코드와 컨테이너 내부 포트는 두 환경에서 그대로 사용할 수 있었습니다. 환경 차이는 주로 배포 설정에서 결정됐습니다.

## 실행 자원은 컨테이너·포트·Volume으로 분리했다

production과 staging을 동시에 실행하려면 최소한 세 자원이 충돌하지 않아야 합니다.

1. 컨테이너 이름
2. 호스트 포트
3. 영속 데이터를 저장하는 Volume

환경별 변수는 다음과 같이 나눌 수 있습니다.

```yaml
- if: $CI_COMMIT_BRANCH == "main"
  variables:
    CONTAINER_NAME: "app"
    APP_PORT: "8501"
    IMAGE_CHANNEL: "production"

- if: $CI_COMMIT_BRANCH == "staging"
  variables:
    CONTAINER_NAME: "app-staging"
    APP_PORT: "8502"
    IMAGE_CHANNEL: "staging"
```

production은 기존 구성을 유지합니다.

```text
EC2:8501
→ app 컨테이너의 8501
→ app-runtime Volume
```

staging은 별도 이름과 포트를 사용합니다.

```text
EC2:8502
→ app-staging 컨테이너의 8501
→ app-staging-runtime Volume
```

두 컨테이너 내부에서는 애플리케이션의 기본 포트인 `8501`을 그대로 사용합니다. 충돌이 발생하는 곳은 EC2가 외부에 공개하는 호스트 포트이므로 `8501`과 `8502`로 나눴습니다.

```text
production: EC2 8501 → 컨테이너 8501
staging:    EC2 8502 → 컨테이너 8501
```

`EXPOSE 8501`만으로 외부 포트가 자동으로 열리는 것은 아닙니다. 실제 연결은 `docker run`의 `-p`가 만듭니다.

## 같은 내부 경로를 쓰면서 데이터는 따로 보관했다

애플리케이션은 두 환경에서 같은 경로에 데이터를 씁니다.

```text
/var/lib/app
```

대신 Docker가 서로 다른 named volume을 그 경로에 연결합니다.

```bash
-v ${CONTAINER_NAME}-runtime:/var/lib/app
```

production에서 `CONTAINER_NAME=app`이라면 다음 Volume을 사용합니다.

```text
app-runtime
```

staging에서 `CONTAINER_NAME=app-staging`이라면 다음 이름이 됩니다.

```text
app-staging-runtime
```

결과적으로 구조는 이렇게 나뉩니다.

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

`${CONTAINER_NAME}-runtime`은 Docker가 컨테이너 이름을 보고 자동 생성하는 문법이 아닙니다. 배포 명령에서 컨테이너 이름 뒤에 `-runtime`을 붙이도록 정한 이름 규칙입니다.

Docker는 해당 이름의 Volume이 있으면 재사용하고, 없으면 만듭니다. 컨테이너를 삭제해도 Volume은 별도 자원으로 남기 때문에 새 컨테이너에 같은 Volume을 연결하면 기존 SQLite와 업로드 파일을 다시 볼 수 있습니다.

이 구조 덕분에 애플리케이션 코드에 production과 staging 경로를 구분하는 조건문을 넣지 않았습니다. **애플리케이션은 같은 경로를 사용하고, 배포 계층이 서로 다른 실제 저장공간을 연결하도록 했습니다.**

다만 Volume은 백업이 아닙니다. 호스트 디스크 장애나 `docker volume rm`, `docker volume prune` 같은 명령에는 영향을 받습니다. 마운트에 성공하더라도 컨테이너 사용자의 UID·GID와 파일 소유권이 맞지 않으면 쓰기 권한 오류가 날 수 있습니다.

## 여기까지가 실행 환경 분리였다

이제 production과 staging은 같은 EC2 안에서 동시에 실행될 수 있습니다.

| 구분             | production     | staging               |
| ---------------- | -------------- | --------------------- |
| 컨테이너         | `app`          | `app-staging`         |
| 호스트 포트      | `8501`         | `8502`                |
| 컨테이너 포트    | `8501`         | `8501`                |
| Volume           | `app-runtime`  | `app-staging-runtime` |
| 내부 데이터 경로 | `/var/lib/app` | `/var/lib/app`        |

하지만 배포 설정을 검토하면서 실행 자원 외에 한 가지가 더 보였습니다. 두 환경이 같은 ECR 저장소를 사용한다면 **이미지의 의미도 환경별로 정리해야 했습니다.**

## staging이 추가되자 `latest`의 의미가 흔들렸다

기존에는 운영 브랜치에서만 이미지를 빌드했습니다. 모든 빌드에 `latest`를 붙여도 자연스럽게 최근 production 이미지를 뜻했습니다.

```text
운영 파이프라인 완료
latest → production 이미지
```

그런데 staging 브랜치도 같은 ECR 저장소에 `latest`를 push하면 마지막으로 완료된 파이프라인이 태그를 가져갑니다.

```text
운영 파이프라인 완료
latest → production 이미지 A

staging 파이프라인 완료
latest → staging 이미지 B
```

`latest`는 Docker가 가장 최신 이미지를 계산해주는 특별한 기능이 아닙니다. 이름이 `latest`인 일반적인 가변 태그입니다. 새 이미지에 붙여 push할 때마다 가리키는 대상이 바뀝니다.

기존에는 운영 브랜치만 갱신했기 때문에 `latest = 최근 production 이미지`라는 암묵적인 약속이 유지됐습니다. staging 추가로 그 약속이 깨질 수 있게 된 것입니다.

## 먼저 실제 서버가 어떤 이미지를 pull하는지 확인했다

`latest`가 staging 이미지로 바뀔 수 있다는 사실만 보면 바로 운영 장애가 날 것처럼 느껴집니다. 하지만 실제 영향도를 판단하려면 EC2가 어떤 태그를 pull하는지 확인해야 했습니다.

배포 명령은 `latest`가 아니라 커밋 SHA 태그를 사용하고 있었습니다.

```bash
IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"
docker pull "${IMAGE}"
```

예를 들어 커밋 SHA가 `abc123`이라면 실제 배포 대상은 다음 이미지입니다.

```text
app:abc123
```

staging이 `latest`를 바꾸더라도 이미 SHA를 기준으로 실행되는 production 컨테이너가 자동으로 교체되지는 않습니다. 다음 production 배포도 해당 운영 커밋의 SHA를 사용합니다.

여기서 두 질문을 구분할 수 있었습니다.

```text
1. 실제 배포와 롤백은 무엇을 기준으로 할 것인가?
2. 사람이 현재 환경의 이미지를 확인할 때 어떤 이름을 쓸 것인가?
```

첫 번째에는 바뀌지 않는 식별자가 필요하고, 두 번째에는 읽기 쉬운 별칭이 필요합니다.

## SHA·환경 태그·`latest`의 역할을 나눴다

태그를 세 가지 역할로 정리했습니다.

| 태그 종류 | 예시                            | 역할                              |
| --------- | ------------------------------- | --------------------------------- |
| 커밋 SHA  | `app:abc123`                    | 실제 배포·재배포·롤백 기준        |
| 환경 태그 | `app:production`, `app:staging` | 각 환경의 현재 이미지 확인용 별칭 |
| 호환 태그 | `app:latest`                    | 기존 production 참조와의 호환     |

브랜치별 발행 정책은 다음과 같습니다.

| 브랜치  | ECR에 발행하는 태그         | 실제 배포 태그 |
| ------- | --------------------------- | -------------- |
| 운영    | SHA, `production`, `latest` | SHA            |
| staging | SHA, `staging`              | SHA            |

SHA는 특정 커밋의 빌드 결과를 식별합니다. 반면 `production`과 `staging`은 새 배포가 발생할 때마다 이동하며 사람이 각 환경의 현재 이미지를 확인하는 데 사용합니다.

```text
SHA 태그    → 기계가 정확히 배포할 대상
환경 태그   → 사람이 현재 환경을 확인할 별칭
latest 태그 → 기존 사용자를 위한 호환 별칭
```

핵심은 태그를 많이 만드는 것이 아니라 **실제 배포 기준과 현재 상태를 보여주는 별칭의 역할을 나누는 것**이었습니다.

## `latest`를 없애지 않고 운영에만 남겼다

가장 단순한 방법은 `latest`를 완전히 없애는 것입니다. 실제 배포가 이미 SHA를 사용하므로 내부 실행 경로만 보면 가능한 선택입니다.

하지만 ECR 저장소 밖에서 누가 `app:latest`를 최근 production 이미지라는 의미로 참조하는지 바로 확인하기 어려웠습니다.

```bash
docker pull app:latest
```

`latest`를 즉시 제거하면 기존 사용자의 호환성을 깨뜨릴 수 있습니다. 반대로 staging에서도 계속 갱신하면 기존 의미가 사라집니다.

그래서 다음과 같이 결정했습니다.

- 운영 브랜치에서만 `latest`를 갱신합니다.
- staging은 `staging` 환경 태그를 사용합니다.
- 실제 배포는 두 환경 모두 SHA를 사용합니다.

이 선택은 `latest`가 좋은 배포 기준이라는 뜻이 아닙니다. 기존 약속을 한 번에 없애지 않으면서 staging 이미지가 `latest`의 의미를 바꾸지 않도록 한 호환성 처리입니다.

## 빌드 명령을 분기할까, 나중에 태그를 붙일까?

구현 방식에서도 두 선택지를 검토했습니다.

첫 번째는 브랜치에 따라 빌드 명령을 나누는 방법입니다.

```bash
if [ "$CI_COMMIT_BRANCH" = "main" ]; then
  docker build --pull \
    -t "${IMAGE}:${IMAGE_TAG}" \
    -t "${IMAGE}:${IMAGE_CHANNEL}" \
    -t "${IMAGE}:latest" .
else
  docker build --pull \
    -t "${IMAGE}:${IMAGE_TAG}" \
    -t "${IMAGE}:${IMAGE_CHANNEL}" .
fi
```

`latest`가 빌드 시점부터 붙는다는 점은 직관적이지만 긴 `docker build` 명령이 중복됩니다.

두 번째는 공통 빌드 후 운영에서만 별칭을 추가하는 방법입니다.

```bash
docker build --pull \
  -t "${IMAGE}:${IMAGE_TAG}" \
  -t "${IMAGE}:${IMAGE_CHANNEL}" .

docker push "${IMAGE}:${IMAGE_TAG}"
docker push "${IMAGE}:${IMAGE_CHANNEL}"

if [ "$CI_COMMIT_BRANCH" = "main" ]; then
  docker tag "${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
  docker push "${IMAGE}:latest"
fi
```

`docker tag`는 이미지를 다시 빌드하거나 복사하지 않습니다. 기존 이미지에 다른 이름을 붙이는 작업이므로 빌드 명령을 분기하는 방식이 성능상 더 효율적인 것은 아닙니다.

선택 기준은 성능보다 중복과 가독성이었습니다. 공통 빌드는 한 번만 작성하고, 운영에만 필요한 호환 태그 처리를 그 뒤에서 분기했습니다.

여러 줄 블록에서는 중간 명령이 실패하면 다음 명령을 실행하지 않도록 `set -e`도 추가했습니다.

```yaml
- |
  set -e
  if [ "$CI_COMMIT_BRANCH" = "main" ]; then
    docker tag "${IMAGE}:${IMAGE_TAG}" "${IMAGE}:latest"
    docker push "${IMAGE}:latest"
  fi
```

SHA 이미지에 `latest`를 붙이는 작업이 실패했다면 Job을 바로 실패시키고 `docker push`를 실행하지 않는 편이 안전합니다.

## 애플리케이션 Profile은 추가하지 않았다

Java와 Spring에 익숙하다면 환경이 늘어날 때 다음과 같은 구성을 떠올릴 수 있습니다.

```text
application-production.yml
application-staging.yml
```

하지만 이번에는 환경마다 애플리케이션의 동작이 달라지지 않았습니다.

- 사용하는 코드는 같습니다.
- 컨테이너 내부 포트도 같습니다.
- 데이터 저장 경로도 같습니다.
- 달라지는 것은 컨테이너 이름, 호스트 포트, Volume과 이미지 별칭입니다.

따라서 애플리케이션 코드에 `if staging` 분기를 추가하지 않았습니다. 환경 차이는 GitLab CI와 Docker 실행 변수에서 처리했습니다.

> 애플리케이션의 동작이 같다면, 환경을 애플리케이션 Profile로 나누기보다 배포 계층의 실행 자원을 다르게 주는 편이 단순할 수 있다.

## 같은 EC2를 선택하며 감수한 것

최종 선택의 트레이드오프를 정리하면 다음과 같습니다.

| 고민                     | 선택                         | 얻은 것                            | 감수한 것                        |
| ------------------------ | ---------------------------- | ---------------------------------- | -------------------------------- |
| staging 인프라           | 기존 EC2에서 컨테이너 분리   | 비용과 관리 대상 감소              | 자원·장애 영역 공유              |
| 환경별 애플리케이션 설정 | 배포 변수로만 분리           | 애플리케이션 단순화                | 환경별 동작이 생기면 재검토 필요 |
| runtime 데이터           | 환경별 named volume          | 재배포 후 데이터 유지·환경 간 분리 | 권한·백업 관리 필요              |
| 실제 이미지 배포         | 커밋 SHA                     | 재현성과 롤백 기준 확보            | SHA와 커밋을 추적해야 함         |
| 현재 환경 표시           | `production`, `staging` 태그 | ECR에서 상태 확인이 쉬움           | 태그가 계속 이동함               |
| 기존 `latest`            | 운영에서만 갱신              | 기존 참조와 호환                   | 가변 태그 자체의 모호함은 남음   |
| 태그 구현                | 공통 빌드 후 `docker tag`    | 빌드 명령 중복 감소                | 태그 처리 단계 추가              |

## 실제 배포 전에는 코드 밖도 확인해야 한다

Pipeline 설정과 테스트가 통과해도 실제 배포 준비가 모두 끝난 것은 아닙니다. 같은 EC2에 환경을 하나 더 올리려면 서버와 네트워크 상태도 확인해야 합니다.

- EC2의 staging 호스트 포트가 비어 있는가?
- 외부 staging 주소를 연결할 reverse proxy나 load balancer 설정이 있는가?
- 방화벽과 security group에서 필요한 접근을 허용하는가?
- production과 staging이 같은 CPU·메모리를 사용해도 되는가?
- Volume의 쓰기 권한과 백업 정책은 준비됐는가?
- ECR의 `latest`를 참조하는 외부 작업이 있는가?
- 동시에 실행된 운영 Pipeline이 `latest`를 역순으로 갱신할 가능성은 없는가?

특히 별도 컨테이너가 곧 완전히 격리된 환경을 의미하지는 않습니다. 실행 이름과 저장공간을 나눠도 물리 자원과 장애 영역은 여전히 공유합니다.

## 마무리

처음에는 staging 컨테이너 하나를 더 실행하면 되는 작업이라고 생각했습니다. 실제로 따라가 보니 분리해야 할 대상은 서버 한 대라는 단위보다 더 세밀했습니다.

```text
실행 프로세스 → 컨테이너 이름
접근 경로     → 호스트 포트
영속 데이터   → 환경별 Volume
배포 대상     → 커밋 SHA
현재 상태     → production·staging 태그
기존 호환성   → main에서만 latest
```

이번 경험에서 얻은 결론은 단순히 `latest`를 쓰지 말거나 staging 서버를 반드시 따로 두어야 한다는 규칙이 아닙니다.

> 환경 분리는 서버 대수를 늘리는 것만이 아니라, 실행 자원과 데이터, 이미지 식별자가 서로 덮어쓰지 않도록 각 역할의 경계를 정하는 일이다.

현재 규모에서는 같은 EC2를 선택했습니다. 대신 무엇이 분리되고 무엇이 여전히 공유되는지 명확히 적어두었습니다. 규모와 장애 비용이 커진다면 그때는 별도 인스턴스나 더 강한 격리 방식으로 옮길 근거도 함께 남았습니다.
