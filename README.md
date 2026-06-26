# 생기부 문장 생성기

한국 고등학교 학교생활기록부의 **① 행동특성 및 종합의견(행특)**, **② 세부능력 및 특기사항(세특)** 초안을 만들어 주는 웹 도구입니다. Google **Gemini** API로 문장을 생성하고, NEIS 기준 **바이트(글자수)** 를 실시간으로 관리하며, 반 전체를 **엑셀(.xlsx)** 로 한 번에 저장합니다.

> ⚠️ 생성 결과는 **초안**입니다. 사실과 다른 내용(없던 수상·수치 등)이 섞일 수 있으니, 기록 전 반드시 교사가 확인·수정하세요. 민감한 개인정보(주민번호·연락처·건강·가정사 등)는 입력하지 마세요. 입력 내용은 외부 AI(Google)로 전송됩니다.

## 주요 기능

- **행동특성 탭** — 계열(인문계 / 특성화고(공업계) / 특성화고(상업계) / 마이스터고) × 학년(1~3)별 맞춤 체크 항목, 자유 메모, 교사 관점 지정
- **세특 탭** — 과목 단위 작성, 일반 교과 / NCS 전문교과 구분, 과목 공통 정보(성취기준·활동·평가) 1회 입력 후 학생 전원(최대 25명) 공통 적용
- 한 명 / 전체 일괄 생성, 이름 일괄 추가
- 바이트 게이지(2B/3B 토글, 제한값 조절)와 결과 직접 수정
- 엑셀 저장 (세특은 과목별 시트 분리)

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 안내되는 주소(기본 `http://localhost:5173`)로 접속합니다.

### API 키 설정

발급: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

키를 적용하는 방법은 두 가지입니다.

1. **코드에 입력** — `src/App.jsx` 상단 `AI_CONFIG.gemini.apiKey` 값에 붙여넣기 (배포용)
2. **화면에서 임시 입력** — 우측 상단 *키 입력* 에 붙여넣기 (이 세션에서만 사용, 새로고침하면 사라짐 / 테스트용)

```js
const AI_CONFIG = {
  provider: "gemini",
  gemini: {
    apiKey: "여기에_본인_키",      // 커밋 금지
    model: "gemini-2.5-flash",    // 대안: "gemini-2.0-flash", "gemini-1.5-flash"
  },
};
```

> 🔐 **보안 주의:** 이 앱은 브라우저에서 Gemini로 **직접** 요청합니다. 즉 코드에 넣은 키는 배포 시 사용자에게 노출될 수 있습니다. 공개 배포가 필요하면 키를 숨기는 **프록시(서버리스 함수 등)** 사용을 권장합니다. 그리고 **실제 키를 git에 커밋하지 마세요** (`.gitignore`로 `.env` 류는 제외되지만, `App.jsx`에 직접 넣은 키는 커밋됩니다).

## 다른 AI로 교체

`src/App.jsx`의 `aiProviders`에 함수를 추가하고 `AI_CONFIG.provider` 값만 바꾸면 됩니다.

```js
const aiProviders = {
  gemini: (prompt, key, maxTokens) => callGemini(...),
  // anthropic: (prompt, key, maxTokens) => callAnthropic(...),
};
```

## 알려진 참고 사항

- `gemini-2.5-flash`는 추론(thinking) 모델이라 `maxOutputTokens`가 작으면 본문이 비어 `"응답이 비어 있습니다"`가 뜰 수 있습니다. 그럴 땐 제한값을 키우거나 모델을 `gemini-2.0-flash`로 바꿔 보세요.
- 무료 사용량의 분당 요청 한도(429)를 넘으면 잠시 후 다시 시도하세요. 전체 생성은 학생 사이에 간격을 둡니다.

## 사용 가이드북

교사용 상세 안내서: [`docs/guidebook.html`](docs/guidebook.html) (브라우저로 열거나 인쇄/PDF 저장 가능)

## 기술 스택

React 18 · Vite · Tailwind CSS · lucide-react · SheetJS(xlsx)
