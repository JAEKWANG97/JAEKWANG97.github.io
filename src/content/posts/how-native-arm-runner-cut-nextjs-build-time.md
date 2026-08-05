---
title: "QEMU로 3분 걸리던 Next.js 빌드를 어떻게 14초로 줄였을까?"
pubDatetime: 2026-08-06T01:01:00+09:00
featured: false
draft: false
tags:
  - "devops"
  - "github-actions"
  - "docker"
  - "arm64"
  - "nextjs"
  - "deployment"
  - "performance"
description: "운영 중인 쇼핑몰의 배포 로그에서 QEMU 병목을 찾고, GitHub Actions build job 한 곳만 native ARM runner로 바꿔 검증한 기록입니다."
---

## 웹 코드 한 줄을 바꾸는데 배포는 10분 가까이 걸렸다

[코어블SAF](https://coreable-saf.com)는 제가 실제로 운영하고 있는 건설 안전용품 쇼핑몰입니다. Spring Boot API와 Next.js 웹을 Docker 이미지로 만들고, ARM 기반 EC2 한 대에 배포합니다.

상품 목록의 관련 카테고리에서 숫자만 제거하는 작업이 있었습니다. 코드 변경은 한 줄이었습니다.

```diff
- {category[3]} <span>{categoryCounts[category[2]]}</span>
+ {category[3]}
```

그런데 이 정도 변경을 운영에 반영하는 데도 배포가 10분 가까이 걸렸습니다. 느낌으로는 Docker 빌드가 느린 것 같았지만, 어느 단계가 문제인지는 알 수 없었습니다.

이번 작업에서 중요했던 것은 “ARM runner를 썼다”는 결과보다 다음 순서였습니다.

```text
배포 로그에서 가장 느린 구간 찾기
→ 그 구간이 느린 이유 확인하기
→ 원인만 건드리는 작은 변경 만들기
→ 실제 운영 배포로 전후 비교하기
```

---

## 먼저 전체 배포 시간을 단계별로 나눠봤다

변경 전 기준은 [GitHub Actions 실행 #31017383652](https://github.com/JAEKWANG97/dropship-shop/actions/runs/31017383652)입니다. 실행 시작부터 완료까지 **9분 38초**가 걸렸습니다.

배포 workflow는 세 job을 순서대로 실행합니다.

```text
verify
→ build-and-push
→ deploy
```

GitHub Actions Jobs API와 로그에서 확인한 시간은 다음과 같았습니다.

| job              |     시간 |
| ---------------- | -------: |
| `verify`         | 2분 48초 |
| `build-and-push` | 5분 11초 |
| `deploy`         | 1분 14초 |

가장 오래 걸린 곳은 `build-and-push`였습니다. 그 안에서도 Web Docker 이미지 단계만 **3분 41초**를 차지했습니다.

로그를 더 내려가 보니 Dockerfile의 `RUN npm run build`에서 시간이 멈춰 있었습니다.

```text
#13 [build 5/5] RUN npm run build
#13 4.770 > next build
...
#13 DONE 188.3s
```

Next.js 빌드 한 단계에만 **188.3초**가 걸린 것입니다. 이제 문제의 범위가 “전체 배포가 느리다”에서 “Docker 안에서 실행되는 Next.js 빌드가 느리다”로 좁혀졌습니다.

---

## EC2가 아니라 빌드 머신의 아키텍처가 달랐다

배포 대상 EC2는 ARM64였습니다. 따라서 workflow도 Docker 이미지를 ARM64로 만들고 있었습니다.

```yaml
- name: Build and push Web image
  uses: docker/build-push-action@v6
  with:
    context: apps/web
    platforms: linux/arm64
```

문제는 이 빌드를 수행하는 GitHub runner였습니다.

```yaml
build-and-push:
  runs-on: ubuntu-latest
```

`ubuntu-latest`는 x64 runner입니다. x64 머신에서 `linux/arm64` 이미지를 빌드하려면 다른 CPU 아키텍처의 명령을 대신 실행할 장치가 필요합니다. 기존 workflow는 QEMU를 설치해 이를 처리했습니다.

```yaml
- uses: docker/setup-qemu-action@v3
```

`platforms: linux/arm64`를 지정한다고 GitHub runner 자체가 ARM으로 바뀌는 것은 아닙니다. 이 값은 Buildx에 **ARM64용 이미지 파일시스템과 실행 파일을 만들라**고 알려줄 뿐입니다. 실제 빌드를 수행하는 호스트는 여전히 `ubuntu-latest`, 즉 x64였습니다.

### ARM64 컨테이너의 RUN은 어디서 실행될까

`docker/setup-qemu-action`은 x64 호스트에 `qemu-aarch64` 같은 사용자 모드 에뮬레이터를 설치하고, ARM64 실행 파일 형식을 Linux `binfmt_misc`에 등록합니다. Docker 문서의 설명처럼 등록이 끝나면 컨테이너 안에서도 이 과정이 투명하게 동작합니다.

BuildKit이 ARM64 base image를 가져온 뒤 Dockerfile을 처리한다고 해보겠습니다.

```dockerfile
FROM node:24-alpine
COPY . .
RUN npm run build
```

`COPY`는 파일을 옮기는 작업이라 ARM64 프로그램을 실행하지 않습니다. 반면 `RUN`은 이미지 안의 `/bin/sh`와 Node.js를 실제로 실행합니다. 이 파일들은 ARM64 ELF 실행 파일입니다.

x64 Linux 커널은 ARM64 ELF를 직접 실행할 수 없습니다. 대신 `binfmt_misc` 등록을 보고 `qemu-aarch64`에 실행을 넘깁니다. 그래서 Dockerfile에는 QEMU 명령이 보이지 않아도 다음 경로가 만들어집니다.

```text
Dockerfile의 RUN npm run build
  → ARM64 /bin/sh 실행
  → ARM64 Node.js 실행
  → x64 커널이 binfmt_misc 규칙 확인
  → qemu-aarch64가 ARM64 명령을 x64에서 실행
```

QEMU 사용자 모드는 ARM 운영체제 전체를 띄우는 가상 머신이 아닙니다. ARM64 사용자 프로그램의 CPU 명령을 호스트에서 실행할 수 있게 변환하고, 프로그램이 파일·메모리·스레드를 요청하면 guest system call을 x64 호스트의 system call로 연결합니다. 이때 필요한 경우 endian과 32/64비트 인자 크기도 조정합니다.

CPU 명령 변환에는 QEMU의 TCG(Tiny Code Generator)가 쓰입니다. 처음 만난 guest code를 작은 Translation Block 단위로 호스트 명령 집합에 맞게 바꾸고, 변환된 block을 재사용합니다.

```text
ARM64 instruction block
  → QEMU TCG의 중간 표현
  → x64 instruction block
  → 호스트 CPU에서 실행
```

한번 번역한 block을 재사용하더라도 native 실행과 같아지는 것은 아닙니다. 새 code path의 번역, translation block 사이의 제어 이동, guest CPU 상태 관리, system call 중개가 계속 필요합니다. 실제 프로그램이 실행되는 동안 QEMU가 이 경계에 계속 개입합니다. 따라서 QEMU 설치 step 자체는 변경 전 workflow에서 5초밖에 걸리지 않았지만, 그 뒤의 `next build`는 188.3초가 걸렸습니다. 병목은 **QEMU를 설치하는 시간**이 아니라 **QEMU 위에서 빌드 프로그램을 실행하는 시간**이었습니다.

### 왜 Next.js 빌드에서 차이가 크게 벌어졌을까

변경 전 로그에는 Next.js 16.3.0과 Turbopack이 표시됩니다. Turbopack은 JavaScript와 TypeScript를 처리하는 Rust 기반 번들러입니다. `next build`에서는 소스 해석과 변환, client/server bundle 생성, route 분석, 정적 페이지 생성 같은 작업이 이어집니다.

파일을 내려받거나 이미지를 push하는 작업은 네트워크 대기 비중이 큽니다. 반면 이 빌드 구간은 Node.js와 Turbopack이 CPU 명령을 계속 실행합니다. ARM64 명령을 x64에서 변환하는 비용이 작업 전체에 누적되기 좋은 구간입니다. Docker 공식 문서도 QEMU 에뮬레이션은 compilation이나 compression처럼 compute-heavy한 작업에서 native build보다 훨씬 느릴 수 있다고 경고합니다.

로그에는 이 원인을 좁힐 수 있는 세 개의 숫자가 있었습니다.

| 실행 위치            | 아키텍처 경로                     | `npm run build` |
| -------------------- | --------------------------------- | --------------: |
| `verify` job         | x64에서 x64 Node.js 실행          |            13초 |
| 변경 전 Docker build | x64에서 QEMU로 ARM64 Node.js 실행 |         188.3초 |
| 변경 후 Docker build | ARM64에서 ARM64 Node.js 실행      |          13.7초 |

첫 번째 값은 GitHub Actions step 단위 시간이고, 나머지 두 값은 Docker layer 로그라 완전히 같은 측정은 아닙니다. 그래도 애플리케이션 빌드가 원래부터 3분짜리였던 것은 아니라는 단서는 됩니다. native x64와 native ARM에서는 모두 13초대였고, 아키텍처가 교차한 QEMU 경로에서만 188.3초가 걸렸습니다.

제가 찾은 병목은 EC2의 성능이 아니라 다음 실행 경로였습니다.

```text
x64 GitHub runner
  └─ binfmt_misc가 ARM64 실행 파일 감지
       └─ qemu-aarch64가 명령과 system call을 중개
            └─ Node.js와 Turbopack이 next build 수행
```

native ARM runner로 바꾸면 `platforms: linux/arm64` 설정은 그대로지만 실행 경로가 달라집니다. ARM64 커널이 ARM64 Node.js와 Turbopack을 직접 실행하므로 `binfmt_misc → qemu-aarch64` 우회가 사라집니다.

---

## ECR로 옮기는 방법은 이번 문제의 답이 아니었다

처음에는 GHCR 대신 AWS ECR을 쓰는 방법도 생각했습니다. ECR은 EC2에서 IAM으로 인증하고 이미지를 내려받는 구조를 단순하게 만들 수 있습니다. 이미지 pull 경로를 AWS 안에 둘 수 있다는 장점도 있습니다.

하지만 로그에서 느렸던 곳은 이미지 pull이 아니었습니다. 레지스트리에 이미지를 올리기 전, Docker 빌드 안에서 `next build`를 실행하는 구간이었습니다.

```text
Next.js 빌드가 느림
≠ 이미지 저장소가 느림
```

이 상태에서 ECR로 이전하면 인증과 배포 구조는 달라지지만 188.3초짜리 QEMU 빌드는 그대로 남습니다. 바꾸는 범위만 커지고, 찾은 병목은 해결하지 못합니다.

그래서 레지스트리와 EC2는 건드리지 않았습니다. `build-and-push` job의 실행 아키텍처만 바꾸기로 했습니다.

---

## 변경은 workflow 두 줄이었다

GitHub는 public repository에서 사용할 수 있는 ARM64 호스티드 runner로 `ubuntu-24.04-arm`을 제공합니다. 빌드 job을 이 runner로 옮기면 `linux/arm64` 이미지를 같은 아키텍처에서 직접 만들 수 있습니다.

[PR #43](https://github.com/JAEKWANG97/dropship-shop/pull/43)의 전체 변경은 다음과 같습니다.

```diff
 build-and-push:
-  runs-on: ubuntu-latest
+  runs-on: ubuntu-24.04-arm
   needs: verify
   steps:
     - uses: actions/checkout@v4
-    - uses: docker/setup-qemu-action@v3
     - uses: docker/setup-buildx-action@v3
```

바꾼 것은 두 가지뿐입니다.

- x64 runner를 ARM64 runner로 변경
- 더 이상 필요하지 않은 QEMU 설정 제거

Dockerfile, Buildx 캐시 설정, GHCR, EC2, SSM 배포 과정은 그대로 두었습니다. 변경 범위가 작아야 결과가 달라졌을 때 어느 수정이 영향을 줬는지 설명하기 쉽습니다.

변경 후 구조는 다음과 같습니다.

```text
ARM64 GitHub runner
  └─ ARM64 Docker 이미지 빌드
       └─ next build를 native로 실행
```

---

## workflow만 바꾼 뒤 실제 UI 변경으로 배포했다

이 저장소의 Deploy workflow는 `.github/**` 변경을 배포 트리거에서 제외합니다. workflow 파일만 수정한 PR #43을 병합했다고 바로 운영 배포가 실행되지는 않았습니다.

성능 확인을 위해 의미 없는 빈 커밋을 만들지는 않았습니다. 실제로 필요했던 UI 변경인 [PR #42](https://github.com/JAEKWANG97/dropship-shop/pull/42)를 병합해 배포를 실행했습니다.

```diff
- {category[3]} <span>{categoryCounts[category[2]]}</span>
+ {category[3]}
```

이렇게 하면 다음 두 가지를 함께 확인할 수 있습니다.

- 실제 웹 소스가 바뀌어도 native ARM 빌드가 정상적으로 완료되는가
- 새 이미지가 운영 EC2에 배포된 뒤 API readiness 검사까지 통과하는가

비교 대상은 단순한 로컬 벤치마크가 아니라 같은 저장소의 실제 운영 배포 두 번이었습니다.

---

## 188.3초가 13.7초로 줄었다

변경 후 [GitHub Actions 실행 #31021928941](https://github.com/JAEKWANG97/dropship-shop/actions/runs/31021928941)에서 같은 Docker 단계는 다음과 같이 끝났습니다.

```text
#13 [build 5/5] RUN npm run build
#13 0.423 > next build
...
#13 DONE 13.7s
```

결과를 같은 구간끼리 비교했습니다.

| 측정 구간                | QEMU x64 | native ARM |          변화 |
| ------------------------ | -------: | ---------: | ------------: |
| Docker 안의 `next build` |  188.3초 |     13.7초 |    92.7% 단축 |
| Web Docker 이미지 단계   | 3분 41초 |       33초 |    85.1% 단축 |
| `build-and-push` job     | 5분 11초 |   1분 38초 | 3분 33초 단축 |
| 전체 배포                | 9분 38초 |   6분 41초 | 2분 57초 단축 |

`next build`만 보면 약 **13.7배** 빨라졌습니다. Web 이미지 전체 단계도 3분 41초에서 33초로 줄었습니다.

전체 배포 시간은 build job만큼 그대로 줄지 않았습니다. 변경 후 실행에서는 API 테스트가 이전보다 20초 가까이 더 걸렸고, runner 준비와 EC2 배포 시간도 실행마다 달라졌기 때문입니다. 그래도 사용자가 기다리는 전체 배포 시간에서 2분 57초를 줄였습니다.

---

## 빨라진 것만큼 운영 배포가 끝까지 성공했는지도 확인했다

빌드가 빨라져도 운영 서버에서 이미지가 실행되지 않으면 의미가 없습니다. 변경 후 workflow는 다음 단계까지 모두 성공했습니다.

- API와 Web ARM64 이미지를 GHCR에 push
- AWS SSM으로 EC2 배포 명령 실행
- 새 컨테이너 재생성
- API 컨테이너 `healthy` 확인
- `/actuator/health/readiness` 응답 확인

배포 로그의 마지막 상태도 `Success`였습니다.

```text
coreable-api-1   Up 34 seconds (healthy)
coreable-web-1   Up 3 seconds
```

실제 쇼핑몰에서도 상품 목록과 UI 변경이 반영된 상태를 확인할 수 있었습니다.

---

## 이번 측정의 한계

이번 결과는 같은 코드를 여러 번 반복 실행한 정교한 벤치마크는 아닙니다. 변경 전후 실제 운영 배포를 한 번씩 비교했습니다.

- 두 실행의 commit은 서로 다릅니다.
- GitHub Actions와 Buildx 캐시 상태가 완전히 같다고 보장할 수 없습니다.
- 호스티드 runner의 실제 CPU 성능과 준비 시간은 실행마다 달라질 수 있습니다.
- 전체 배포에는 API 테스트와 EC2 이미지 pull처럼 ARM 변경과 무관한 시간도 포함됩니다.

따라서 “모든 Next.js ARM 빌드가 13.7배 빨라진다”고 일반화할 수는 없습니다. 다만 Dockerfile의 동일한 `RUN npm run build` 단계가 188.3초에서 13.7초로 줄었고, workflow에서 바꾼 핵심 변수는 build job의 아키텍처와 QEMU 제거였습니다. 이번 병목을 설명하기에는 충분히 큰 차이였습니다.

---

## 배포가 느릴 때 확인할 순서

이번 경험을 다른 프로젝트에 적용한다면 다음 순서로 확인하겠습니다.

### 1. job 전체가 아니라 가장 느린 step을 찾는다

“CI가 느리다”는 말만으로는 수정 대상을 고르기 어렵습니다. job, step, Docker layer 순서로 범위를 좁혀야 합니다.

```text
전체 workflow
→ build-and-push job
→ Web Docker 이미지 step
→ RUN npm run build layer
```

### 2. 빌드 대상과 runner의 아키텍처를 비교한다

```yaml
runs-on: ubuntu-latest # x64
platforms: linux/arm64 # ARM64
```

이 조합이라면 QEMU가 개입하고 있는지 확인합니다. 특히 컴파일, 번들링, 테스트처럼 CPU 사용량이 큰 단계는 영향을 크게 받을 수 있습니다.

### 3. 원인과 관계없는 개선을 섞지 않는다

레지스트리 이전, EC2 증설, Dockerfile 개편을 한 번에 적용하면 무엇이 시간을 줄였는지 알기 어렵습니다. 이번에는 runner 한 곳과 QEMU 설정만 바꿨습니다.

### 4. 실제 변경을 배포해 끝까지 검증한다

빌드 시간만 재고 끝내지 않았습니다. 실제 UI 변경을 포함한 이미지를 push하고, 운영 EC2에서 컨테이너와 API readiness까지 확인했습니다.

---

## 마무리

처음에는 EC2가 작아서 배포가 느린가 싶었습니다. 하지만 EC2는 Docker 이미지가 완성된 뒤에 등장합니다. 실제 병목은 x64 GitHub runner가 ARM64용 Next.js 빌드를 QEMU로 실행하던 188.3초였습니다.

서버나 레지스트리를 바꾸기 전에 로그에서 가장 느린 줄을 찾았습니다. 그 줄을 설명하는 CPU 아키텍처 차이를 확인했고, workflow 두 줄만 수정했습니다. 결과는 `next build` 188.3초에서 13.7초, 전체 배포 9분 38초에서 6분 41초였습니다.

배포가 느릴 때 먼저 볼 것은 서버 사양만이 아닙니다. **빌드가 어느 CPU 아키텍처에서 실행되고 있는지**, 그리고 **실제 병목이 로그의 어느 줄인지**부터 확인해야 합니다.

---

## 참고 자료

- [코어블SAF 쇼핑몰](https://coreable-saf.com)
- [native ARM runner 변경 PR #43](https://github.com/JAEKWANG97/dropship-shop/pull/43)
- [실제 UI 변경·배포 PR #42](https://github.com/JAEKWANG97/dropship-shop/pull/42)
- [변경 전 QEMU 배포 로그](https://github.com/JAEKWANG97/dropship-shop/actions/runs/31017383652)
- [변경 후 native ARM 배포 로그](https://github.com/JAEKWANG97/dropship-shop/actions/runs/31021928941)
- [현재 배포 workflow](https://github.com/JAEKWANG97/dropship-shop/blob/main/.github/workflows/deploy.yml)
- [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/) — QEMU, `binfmt_misc`, native node 비교
- [QEMU User space emulator](https://www.qemu.org/docs/master/user/main.html) — system call translation
- [QEMU TCG Translator Internals](https://www.qemu.org/docs/master/devel/tcg.html) — Translation Block과 동적 명령 변환
- [Next.js Turbopack](https://nextjs.org/docs/app/api-reference/turbopack) — Rust 기반 번들러 구조
- [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
