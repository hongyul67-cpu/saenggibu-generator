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

> Windows에서는 `생기부생성기 실행.bat` 을 더블클릭하면 의존성 설치·서버 실행·브라우저 열기까지 자동으로 됩니다.

### 단독 실행 파일 (Node 설치 없이 더블클릭)

```bash
npm run build:single
```

`dist-single/index.html` 하나에 모든 코드·CSS가 인라인된 **단일 HTML**이 생성됩니다. 이 파일만 USB나 압축으로 옮겨 어느 컴퓨터에서든 **더블클릭**하면 (Node·Python·서버 없이) 브라우저에서 바로 실행됩니다. Gemini API는 `null` origin(file://)에서도 CORS가 허용되어 정상 호출됩니다.

> ⚠️ **주의:** `.env.local` 에 키가 있는 상태로 빌드하면 그 키가 HTML 안에 **그대로 박힙니다.** 본인 컴퓨터 간 이동에는 편하지만, 이 파일은 **외부 공유·git 커밋 금지**입니다(`.gitignore` 로 제외됨). 다른 사람에게 줄 거면 키 없이(`.env.local` 비우고) 빌드한 뒤 화면 우측 상단 *키 입력* 으로 각자 넣게 하세요.

### API 키 설정

발급: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (보통 `AIza...` 로 시작)

키를 적용하는 방법은 두 가지입니다.

1. **`.env.local` 파일에 입력 (권장 · git에 커밋 안 됨)**
   ```bash
   cp .env.example .env.local
   ```
   그런 다음 `.env.local` 의 값을 본인 키로 채웁니다.
   ```env
   VITE_GEMINI_API_KEY=여기에_본인_키
   ```
   `src/App.jsx` 는 이 값을 자동으로 읽습니다(`import.meta.env.VITE_GEMINI_API_KEY`). 값 변경 후엔 `npm run dev` 를 다시 실행하세요.
2. **화면에서 임시 입력** — 우측 상단 *키 입력* 에 붙여넣기 (이 세션에서만 사용, 새로고침하면 사라짐 / 테스트용)

모델 등 그 밖의 설정은 `src/App.jsx` 상단 `AI_CONFIG` 블록에서 바꿉니다.

> 🔐 **보안 주의:** `.env.local` 은 `.gitignore` 로 제외되어 키가 저장소에 올라가지 않습니다. 다만 이 앱은 브라우저에서 Gemini로 **직접** 요청하므로, 빌드해서 **배포하면** 키가 번들·네트워크 요청에 포함되어 사용자에게 보일 수 있습니다. 공개 배포가 필요하면 키를 숨기는 **프록시(서버리스 함수 등)** 사용을 권장합니다.

## 다른 AI로 교체

`src/App.jsx`의 `aiProviders`에 함수를 추가하고 `AI_CONFIG.provider` 값만 바꾸면 됩니다.

```js
const aiProviders = {
  gemini: (prompt, key, maxTokens) => callGemini(...),
  // anthropic: (prompt, key, maxTokens) => callAnthropic(...),
};
```

## 알려진 참고 사항

- `gemini-2.5-flash`는 추론(thinking) 모델이라 사고 과정이 본문에 섞이거나 토큰을 소진해 빈 응답이 날 수 있어, 2.5 계열은 `thinkingConfig.thinkingBudget = 0` 으로 **추론을 끄도록** 처리해 두었습니다(`callGemini`). 그래도 빈 응답이 잦으면 제한값을 키우거나 모델을 `gemini-2.0-flash`로 바꿔 보세요.
- 무료 사용량의 분당 요청 한도(429)를 넘으면 잠시 후 다시 시도하세요. 전체 생성은 학생 사이에 간격을 둡니다.

## 사용 가이드북

교사용 상세 안내서: [`docs/guidebook.html`](docs/guidebook.html) (브라우저로 열거나 인쇄/PDF 저장 가능)

## 기술 스택

React 18 · Vite · Tailwind CSS · lucide-react · SheetJS(xlsx)
