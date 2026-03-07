# 블로그 포스트 이미지 관리 가이드

## 📁 폴더 구조
```
assets/img/posts/
├── 2026-03-07-armeria/     # 포스트별 폴더
│   ├── diagram-01.png
│   └── screenshot-01.png
└── 2026-02-05-welcome/
    └── banner.png
```

## 📝 이미지 추가 방법

### 1. 이미지 저장 위치
포스트별로 폴더를 만들어 관리합니다:
```bash
assets/img/posts/YYYY-MM-DD-post-name/image.png
```

### 2. 마크다운에서 참조
```markdown
![설명](/assets/img/posts/2026-03-07-armeria/diagram-01.png)
```

### 3. 이미지 크기 조정 (옵션)
```markdown
![설명](/assets/img/posts/2026-03-07-armeria/image.png){: width="700"}
```

## 💡 팁

### VS Code에서 이미지 복붙 자동화
1. **Paste Image** 확장 프로그램 설치
2. `settings.json`에 추가:
```json
{
  "pasteImage.basePath": "${projectRoot}",
  "pasteImage.path": "${projectRoot}/assets/img/posts/${currentFileNameWithoutExt}",
  "pasteImage.prefix": "/",
  "pasteImage.insertPattern": "![${imageFileNameWithoutExt}](${imageFilePath})"
}
```

3. 이미지 복사 후 `Cmd+Alt+V` (Mac) / `Ctrl+Alt+V` (Windows)

### 스크린샷 이름 규칙
- `diagram-01.png`: 다이어그램
- `screenshot-01.png`: 스크린샷
- `code-01.png`: 코드 캡처
- `result-01.png`: 실행 결과

## 🔗 관련 링크
- [Chirpy 테마 이미지 가이드](https://chirpy.cotes.page/posts/write-a-new-post/#images)
