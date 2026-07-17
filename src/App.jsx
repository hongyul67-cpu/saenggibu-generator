import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Sparkles, Download, Copy, Check, AlertTriangle, Users, Loader2,
  Table, LayoutGrid, KeyRound, FileSpreadsheet, RefreshCw, X, ListPlus, BookOpen, ClipboardList, ShieldCheck, Flag, Hash, ExternalLink, Compass
} from "lucide-react";
import * as XLSX from "xlsx";

/* ============================================================
   AI 제공자 설정  ── 교체는 "이 블록만" 수정하면 됩니다.
   1) apiKey 에 본인 Gemini API 키 입력 (발급: aistudio.google.com/apikey)
   2) 다른 AI로 교체 시 aiProviders 에 함수 추가 + AI_CONFIG.provider 변경
   ⚠ 실제 키를 넣은 채로 git에 커밋/푸시하지 마세요. 키가 공개됩니다.
   ============================================================ */
const AI_CONFIG = {
  provider: "gemini",
  gemini: {
    // 키는 프로젝트 루트의 .env.local 에 VITE_GEMINI_API_KEY 로 넣습니다(절대 커밋되지 않음).
    // .env.local 이 없으면 아래 플레이스홀더가 쓰여 '미설정' 상태가 됩니다.
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY",
    // 항상 최신 Flash 계열로 자동 연결되는 별칭. 구글이 버전을 올려도 최신을 따라감.
    // 특정 모델이 막히면 화면의 '모델' 칸에서 다른 값으로 교체 가능.
    model: "gemini-flash-latest",
  },
};
// 화면 선택용 후보 모델(위에서부터 최신·권장). 목록에 없어도 직접 입력 가능.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

async function callGemini(prompt, apiKey, model, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig = { temperature: 0.7, maxOutputTokens: maxTokens || 1024 };
  // gemini-2.5/최신(latest) Flash 계열은 추론(thinking) 모델이라, 끄지 않으면 사고 과정이
  // 본문에 섞이거나 토큰을 소진해 빈 응답이 나올 수 있음 → 비활성화.
  // (thinking 미지원 모델엔 넣지 않도록 조건부 적용: 2.0/1.5 등 제외)
  if (/2\.5|latest/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API 오류 ${res.status} · ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join("");
  if (!text) throw new Error("응답이 비어 있습니다. 키·모델명·안전필터를 확인하세요.");
  return text.trim();
}

const aiProviders = {
  gemini: (prompt, keyOverride, maxTokens, modelOverride) =>
    callGemini(prompt, keyOverride || AI_CONFIG.gemini.apiKey, modelOverride || AI_CONFIG.gemini.model, maxTokens),
};

async function generateText(prompt, keyOverride, maxTokens, modelOverride) {
  const fn = aiProviders[AI_CONFIG.provider];
  if (!fn) throw new Error(`알 수 없는 provider: ${AI_CONFIG.provider}`);
  return fn(prompt, keyOverride, maxTokens, modelOverride);
}

/* ============================================================
   행특용 데이터 (계열 × 학년)
   ============================================================ */
const TRACK_LABELS = { humanities: "인문계", tech: "특성화고(공업계)", biz: "특성화고(상업계)", meister: "마이스터고" };
const TRACK_ORDER = ["humanities", "tech", "biz", "meister"];
const isVoc = (t) => t !== "humanities";

// 항목은 "문자열"(모든 계열 공통) 또는 ["문자열", [자주 쓰는 계열들]] 형태.
// 해당 계열에서 자주 쓰는 항목은 그룹 안에서 앞쪽으로, 특정 계열 전용인데 현재 계열이 아니면 뒤쪽으로 정렬.
const _t = (it) => (Array.isArray(it) ? it[0] : it);
const _pri = (it) => (Array.isArray(it) ? it[1] : null);
function orderItems(items, track) {
  const rank = (it) => { const pri = _pri(it); if (!pri) return 1; return pri.includes(track) ? 0 : 2; };
  return items.map((it, i) => ({ t: _t(it), r: rank(it), i })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.t);
}

const V3 = ["tech", "biz", "meister"]; // 특성화·마이스터(직업계) 전체
const G = {
  study: { group: "학습 태도", items: ["수업 집중도 우수", "과제 성실 수행", "자기주도 학습", "학업 열의", "탐구심", "질문·발표 적극", "목표의식 뚜렷", "이해력 우수", "꾸준한 노력", ["예습·복습 습관", ["humanities"]], ["오답 정리 꼼꼼", ["humanities"]], ["지적 호기심", ["humanities"]]] },
  life: { group: "생활 태도", items: ["규칙 준수", "출결 성실", "시간 약속 엄수", "바른 언어 사용", "정직함", "청결·정리정돈", "준비물 잘 챙김", "절제력", "기본생활습관 우수"] },
  social: { group: "대인 관계", items: ["협동심", "배려심", "리더십", "갈등 조율", "원만한 교우관계", "경청 태도", "공감 능력", "나눔·양보", "소통 능력", "포용력"] },
  character: { group: "인성·태도", items: ["책임감", "예의·인사성", "긍정적 태도", "끈기·인내", "봉사 정신", "성실성", "겸손함", "감사할 줄 앎", "도전 정신", "신뢰감"] },
  vocPractice: { group: "전공·실습", items: [["실습 적극 참여", V3], ["안전수칙 준수", V3], ["실습 집중도", V3], ["실습실 정리정돈", V3], ["문제해결력", V3], ["공구·장비 관리", ["tech", "meister"]], ["기능 숙련도 우수", ["tech", "meister"]], ["작업 정확성", ["tech", "meister"]], ["매뉴얼 준수", ["tech", "meister"]], ["손재주 우수", ["tech"]]] },
  vocCareer: { group: "진로·자격", items: [["자격증 취득 노력", V3], ["뚜렷한 진로목표", V3], ["전공 역량 향상", V3], ["직무 관심도", V3], ["현장실습 성실", V3], ["실무 감각", ["biz", "meister"]], ["전공 서적 탐독", ["tech", "biz"]]] },
  meister: { group: "산업체 마인드", items: [["직업윤리 의식", ["meister"]], ["현장 적응력", ["meister"]], ["산업체 이해도", ["meister"]], ["기술 숙련 의지", ["meister"]], ["납기·품질 의식", ["meister"]], ["산학협력 적극", ["meister"]]] },
};
const GRADE = {
  1: { group: "적응 (1학년)", items: ["학교생활 적응", "새 환경 적응력", "교우관계 형성", "기초 학습습관 형성", "자기관리 시작", "규칙 이해·수용"] },
  2: { group: "자치·주도 (2학년)", items: ["학급 역할 수행", "동아리 활동 적극", "자치활동 참여", "후배 지도", "주도성 향상", "책임 있는 역할 수행"] },
};
const GRADE3_HUM = { group: "진로·진학 (3학년)", items: ["뚜렷한 진학 목표", "수능 준비 성실", "진로 구체화", "면접·자소서 준비", "학업 마무리 충실", "전공 적합성 탐색"] };
const GRADE3_VOC = { group: "진로·취업 (3학년)", items: ["취업 의지 확고", "현장실습 성실", "직업의식", "구직 활동 적극", "사회 진출 준비", "산업체 연계 활동"] };
// 보완할 점(부정적·성장 방향) — 모든 계열·학년 공통(직업계 전용 항목은 뒤로). 프롬프트에서 완곡·건설적으로 서술.
const IMPROVE = {
  group: "보완할 점 (성장 방향)", tone: "warn",
  items: ["수업 집중 기복", "과제 제출 지연", "발표에 소극적", "자신감 부족", "정리정돈 미흡", "감정 조절 연습 필요", "교우관계 폭 좁음", "지각·결석 잦음", "끈기 부족", "학습 동기 부족", "산만함", "준비물 미흡", "수업 참여 저조", "과제 완성도 부족", "자기표현 서투름", "협업 참여 소극", "시간 관리 미흡", "목표의식 부족", "책임감 보완 필요", "언어 습관 개선 필요", "스마트폰 사용 과다", "의욕 기복", "좌절 극복 연습 필요", "경청 태도 보완", "정서적 지지 필요", "규칙 준수 노력 필요", ["실습 안전 부주의", V3], ["기초 학력 보충 필요", V3], ["기능 숙련 보완 필요", ["tech", "meister"]]],
};
const NEGATIVE_SET = new Set(IMPROVE.items.map(_t));
function getCategories(track, grade) {
  let order;
  if (track === "humanities") order = [G.study, G.character, G.social, G.life];
  else if (track === "meister") order = [G.vocPractice, G.meister, G.vocCareer, G.study, G.social, G.character, G.life];
  else order = [G.vocPractice, G.vocCareer, G.study, G.social, G.character, G.life]; // 특성화(공업·상업)
  const gradeGroup = grade === 3 ? (isVoc(track) ? GRADE3_VOC : GRADE3_HUM) : GRADE[grade];
  return [...order, gradeGroup, IMPROVE].map((c) => ({ ...c, items: orderItems(c.items, track) }));
}
const validItemSet = (track, grade) => new Set(getCategories(track, grade).flatMap((c) => c.items));

/* ============================================================
   세특용 데이터
   ============================================================ */
const ACTIVITY_GENERAL = ["토론", "발표", "탐구활동", "실험", "프로젝트", "보고서 작성", "모둠활동", "자료조사", "독서·서평", "질의응답"];
const ACTIVITY_NCS = ["실습", "직무 수행", "과제 수행", "장비·기기 운용", "도면·문서 작성", "작품·결과물 제작", "안전관리", "품질관리", "협업 실무", "현장 적용"];
const TEACHER_PERSPECTIVES = ["성장·변화 중시", "산출물·기능 숙련도 중심", "진로 연계 부각", "협업 역할 강조", "구체적 사례 중심", "핵심 역량 부각", "자기주도성 강조", "인성·태도 부각"];
const LEVELS = ["주도적", "적극적", "보통", "미흡", "미참여"];
// 참여 수준별 기본 글자수(바이트). 낮을수록 짧게. 화면에서 조정 가능.
const LEVEL_LIMIT_DEFAULT = { 주도적: 1200, 적극적: 900, 보통: 700, 미흡: 500, 미참여: 300 };
const MAX_SUB_STUDENTS = 25;

/* ============================================================
   바이트 계산 (NEIS식: 한글=2 또는 3, ASCII=1)
   ============================================================ */
function countBytes(str, mode) {
  let b = 0;
  for (const ch of str || "") b += ch.codePointAt(0) <= 0x7f ? 1 : mode;
  return b;
}
function approxChars(byteLimit, byteMode) {
  return Math.floor(byteLimit / (byteMode === 3 ? 2.4 : 1.7));
}
// 결과가 제한을 넘으면 한도 이내에서 '마지막 완성 문장'까지만 남기고 잘라냄(넘긴 채로 저장되지 않도록).
function trimToByteLimit(text, limit, mode) {
  const t = (text || "").trim();
  if (!limit || countBytes(t, mode) <= limit) return t;
  // 한도 이하가 되는 최대 길이로 컷
  let cut = t.length;
  while (cut > 0 && countBytes(t.slice(0, cut), mode) > limit) cut -= 1;
  const s = t.slice(0, cut);
  // 마지막 문장 종결 지점 찾기: 마침표(.!?) 또는 명사형 종결(…음/함/임/됨/힘/봄/옴) + 공백/끝
  const ENDERS = "음함임됨힘봄옴";
  let best = -1;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "." || ch === "!" || ch === "?") best = i;
    else if (ENDERS.includes(ch)) {
      const next = s[i + 1];
      if (next === undefined || next === " " || next === "." || next === "\n") best = i;
    }
  }
  if (best >= 0) {
    let out = s.slice(0, best + 1).trim();
    if (!/[.!?]$/.test(out)) out += "."; // 종결부호 보정
    return out;
  }
  return s.trim(); // 문장 경계를 못 찾으면 하드 컷
}
function joinList(arr, etc) {
  const all = [...(arr || [])];
  if (etc && etc.trim()) all.push(etc.trim());
  return all.join(", ");
}

/* ============================================================
   생기부 작성요령 기준 데이터 (2026학년도 기준 · 일반 작성 원칙 요약)
   - AI가 이 원칙을 근간으로 문장을 생성하도록 프롬프트에 주입합니다.
   - 화면에서 편집·초기화할 수 있으며, 학교/교육청 공식 기재요령으로 교체해도 됩니다.
   ============================================================ */
const GUIDELINES_DEFAULT = `[학교생활기록부 작성요령 기준 (2026학년도 · 일반 원칙 요약)]

■ 문체·형식
- 문장 종결은 '~함', '~임', '~을 보임' 등 명사형(개조식)으로 통일한다.
- 교사가 관찰한 제3자 시점으로 객관적·구체적으로 서술한다.
- 학생 이름, 1인칭(저는/나는), 경어체(~했습니다)는 사용하지 않는다.

■ 사실 기반·근거주의
- 교사가 직접 관찰·확인한 사실과 근거자료에 기반하여 기재한다.
- 추측, 과장, 미화, 근거 없는 칭찬은 지양하고 활동의 과정과 변화·성장을 중심으로 쓴다.
- 제공되지 않은 수치·대회명·수상·기관명 등 확인되지 않은 사실은 지어내지 않는다.

■ 기재 금지·유의 사항(매년 강조)
- 교외 상, 교외 대회 실적, 각종 인증시험(공인 어학성적 등) 점수·자격은 기재하지 않는다.
- 모의고사·전국연합학력평가 성적·석차, 특정 대학명·기관명은 기재하지 않는다.
- 부모(보호자)의 사회·경제적 지위나 직업, 사교육을 유발하는 내용은 기재하지 않는다.
- 논문·도서 출간, 발명특허, 해외 어학연수 등 학교 밖 실적은 기재하지 않는다.
- 특정 종교·정치적으로 편향된 표현은 사용하지 않는다.

■ 세부능력 및 특기사항(세특)
- 교육과정 성취기준과 수업 중 학습·탐구 활동을 근거로, 그 학생만의 특성이 드러나게 쓴다.
- 참여 수준에 따라 톤을 차등하되, 낮은 수준도 낙인 없이 기본 참여와 성장 가능성 위주로 절제하여 쓴다.

■ 행동특성 및 종합의견(행특)
- 학습·인성·진로 등을 총체적으로 종합하여 추천서 성격으로 기술한다.
- 변화와 성장의 과정을 중심으로 하고, 보완할 점은 완곡하게 개선 노력·지도 방향 중심으로 쓴다.

※ 위 내용은 일반 작성 원칙 요약본입니다. 세부 규정은 해당 연도 교육부·교육청 '학교생활기록부 기재요령'을 확인하세요.`;

// 프롬프트에 넣을 작성요령 블록(과도한 길이 방지를 위해 그대로 삽입)
function guidelineBlock(guidelines) {
  const g = (guidelines || "").trim();
  return g ? `${g}\n\n위 '학교생활기록부 작성요령 기준'을 반드시 준수하여 작성할 것.\n` : "";
}

/* ============================================================
   프롬프트 빌더
   ============================================================ */
function buildBehaviorPrompt({ track, grade, checks, customChecks, memo, byteLimit, byteMode, teacher, guidelines }) {
  const trackLabel = TRACK_LABELS[track];
  const strengths = checks.filter((c) => !NEGATIVE_SET.has(c));
  const improves = checks.filter((c) => NEGATIVE_SET.has(c));
  const customs = (customChecks || []).filter(Boolean);
  const L = [];
  L.push(`당신은 한국 고등학교 담임교사로서 학교생활기록부의 '행동특성 및 종합의견'을 작성하는 전문가입니다.`);
  L.push(`다음 정보를 바탕으로 한 학생의 행동특성 및 종합의견을 작성하세요.\n`);
  const gb = guidelineBlock(guidelines);
  if (gb) L.push(gb);
  L.push(`[학생 정보]`);
  L.push(`- 계열: ${trackLabel}`);
  L.push(`- 학년: ${grade}학년`);
  L.push(`- 관찰된 강점(체크 항목): ${strengths.length ? strengths.join(", ") : "(선택된 항목 없음)"}`);
  if (improves.length) L.push(`- 보완·성장 필요(체크 항목): ${improves.join(", ")}`);
  if (customs.length) L.push(`- 교사 직접 입력 키워드: ${customs.join(", ")}`);
  L.push(`- 교사 관찰 메모: ${memo && memo.trim() ? memo.trim() : "(없음)"}`);
  if (teacher) { L.push(``); L.push(`[작성 방향(교사 관점)]`); L.push(`- ${teacher}`); }
  L.push(``);
  const rules = [
    `학교생활기록부 문체: 객관적·관찰 중심, 문장 종결은 '~함','~임','~을 보임' 등 명사형/음슴체로 통일.`,
    `제3자 관찰 시점. '저는/나는' 1인칭이나 '~했습니다' 경어체는 절대 사용 금지.`,
    `주어진 정보에만 근거. 제공되지 않은 구체적 수치·대회명·상장 등 거짓 사실은 지어내지 말 것.`,
    `체크 항목과 메모를 자연스럽게 한 문단으로 엮되, 단순 나열이 아니라 맥락 있게 서술.`,
  ];
  if (improves.length) rules.push(`'보완·성장 필요' 항목은 단정적 비난이나 부정적 낙인 없이, 개선을 위한 노력·성장 가능성·지도 방향을 중심으로 완곡하고 따뜻하게 서술할 것. 강점을 먼저 서술한 뒤 보완점을 균형 있게 덧붙임.`);
  if (teacher) rules.push(`위 '작성 방향'을 반영하여 서술의 초점을 맞출 것.`);
  rules.push(`${trackLabel} ${grade}학년의 발달 단계·진로 맥락에 맞는 어조 사용.`);
  rules.push(`분량은 약 ${byteLimit}바이트(한글 기준 약 ${approxChars(byteLimit, byteMode)}자) 이내. 완성된 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(`[작성 규칙]`);
  rules.forEach((r, i) => L.push(`${i + 1}. ${r}`));
  L.push(``);
  L.push(`행동특성 및 종합의견:`);
  return L.join("\n");
}

function buildSubjectPrompt({ subject, student, byteMode, guidelines, byteLimit }) {
  const { name, type, standard, activities, activityEtc, commonActivity, evalMemo } = subject;
  const lim = byteLimit || subject.byteLimit;
  const isNcs = type === "ncs";
  const teacher = joinList(subject.teacherChecks, subject.teacherEtc);
  const acts = joinList(activities, activityEtc);
  const L = [];
  L.push(`당신은 한국 고등학교 ${name ? `'${name}' ` : ""}교과 담당교사로서 학교생활기록부의 '세부능력 및 특기사항'을 작성하는 전문가입니다.`);
  L.push(`다음 정보를 바탕으로 한 학생의 세부능력 및 특기사항을 작성하세요.\n`);
  const gb = guidelineBlock(guidelines);
  if (gb) L.push(gb);
  L.push(`[과목 정보]`);
  if (name) L.push(`- 과목명: ${name}`);
  L.push(`- 과목 유형: ${isNcs ? "NCS 전문교과(직무·수행 중심)" : "일반 교과"}`);
  if (standard && standard.trim()) L.push(`- ${isNcs ? "능력단위·수행준거" : "성취기준"}: ${standard.trim()}`);
  if (acts) L.push(`- 수업 활동 유형: ${acts}`);
  if (commonActivity && commonActivity.trim()) L.push(`- 공통 활동 내용: ${commonActivity.trim()}`);
  if (evalMemo && evalMemo.trim()) L.push(`- 수행평가 기준: ${evalMemo.trim()}`);
  L.push(``);
  L.push(`[학생 정보]`);
  L.push(`- 수업 참여 수준: ${student.level}`);
  if (student.memo && student.memo.trim()) L.push(`- 개별 관찰 메모: ${student.memo.trim()}`);
  if (teacher) { L.push(``); L.push(`[작성 방향(교사 관점)]`); L.push(`- ${teacher}`); }
  L.push(``);
  L.push(`[작성 규칙]`);
  L.push(`1. 세특 문체: 객관적·관찰 중심, '~함','~을 보임','~을 수행함' 등 명사형/음슴체로 통일. 제3자 시점. 1인칭·경어체 금지.`);
  L.push(`2. 주어진 정보에만 근거. 제공되지 않은 수치·대회명·수상 등 거짓 사실 금지.`);
  L.push(isNcs
    ? `3. NCS 전문교과이므로 직무 수행·기능 숙련 중심으로 서술('~을 능숙하게 수행함','~기능을 익혀 적용함' 등).`
    : `3. 일반 교과이므로 탐구·사고·개념 이해 과정을 중심으로 서술.`);
  L.push(`4. 참여 수준에 맞춰 톤과 분량을 차등할 것: '주도적/적극적'은 능동성과 구체적 기여를 부각, '보통'은 과장 없이 사실 위주로 담백하게, '미흡'은 부정적 낙인 없이 기본적 참여와 성장 가능성 위주로 절제하여, '미참여'는 수업 참여가 저조하였음을 사실 위주로 간결하고 완곡하게(비난·낙인 없이) 짧게 서술.`);
  L.push(`5. 활동 유형과 공통 활동을 배경으로 삼되, 개별 메모로 그 학생만의 모습이 드러나게 함. 비어 있는 정보는 자연스럽게 생략.`);
  if (teacher) L.push(`6. 위 '작성 방향'을 반영하여 서술 초점을 맞출 것.`);
  L.push(`${teacher ? 7 : 6}. 분량은 반드시 ${lim}바이트(한글 기준 약 ${approxChars(lim, byteMode)}자)를 넘지 말 것. 완성된 세특 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(``);
  L.push(`세부능력 및 특기사항:`);
  return L.join("\n");
}

// 자동 기록/합산된 결과를 뜻은 유지하고 표현만 살짝 바꿔(학생마다 다르게) 다듬는 프롬프트
function buildVariationPrompt({ text, byteLimit, byteMode, guidelines }) {
  const L = [];
  L.push(`당신은 한국 고등학교 교사로서 학교생활기록부 '세부능력 및 특기사항' 문장을 다듬는 전문가입니다.`);
  L.push(`아래 초안의 사실·의미는 그대로 유지하되, 표현과 문장 구조를 자연스럽게 바꿔 다른 학생과 겹치지 않게 다시 써 주세요.\n`);
  const gb = guidelineBlock(guidelines);
  if (gb) L.push(gb);
  L.push(`[초안]`);
  L.push(text);
  L.push(``);
  L.push(`[작성 규칙]`);
  L.push(`1. 초안에 없는 새로운 사실·수치·활동을 지어내지 말 것(의미 보존, 표현만 변형).`);
  L.push(`2. 세특 문체 유지: '~함','~을 보임','~을 수행함' 등 명사형/음슴체, 제3자 시점, 1인칭·경어체 금지.`);
  L.push(`3. 분량은 반드시 ${byteLimit}바이트(한글 기준 약 ${approxChars(byteLimit, byteMode)}자)를 넘지 말 것.`);
  L.push(`4. 완성된 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(``);
  L.push(`다듬은 세부능력 및 특기사항:`);
  return L.join("\n");
}

/* ============================================================
   공용 헬퍼/팩토리
   ============================================================ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 9);
const maxTokensFor = (byteLimit) => Math.min(8192, Math.max(1024, byteLimit));

const newBehaviorStudent = (name = "", number = "") => ({
  id: uid(), name, number, checks: [], customChecks: [], memo: "", result: "", status: "idle", error: null,
});
const newSubStudent = (name = "", number = "") => ({
  id: uid(), name, number, level: "보통", memo: "", result: "", status: "idle", error: null,
  segments: {}, // 공동 교과: { [teacherId]: 텍스트 }
  picks: {},    // 활동 주제별: { [topicId]: 수준 }
});
const newCoTeacher = (name = "") => ({ id: uid(), name, limit: 500 });
const newTopic = (name = "") => ({ id: uid(), name, levels: { 주도적: "", 적극적: "", 보통: "", 미흡: "", 미참여: "" } });
const newSubject = (name = "") => ({
  id: uid(), name, type: "general", standard: "",
  activities: [], activityEtc: "", commonActivity: "", evalMemo: "",
  teacherChecks: [], teacherEtc: "", byteLimit: 1000,
  levelMode: true, levelLimits: { ...LEVEL_LIMIT_DEFAULT }, // 참여 수준별 글자수 자동 조정
  coTeaching: false, coTeachers: [],
  topicMode: false, topics: [],
  students: [newSubStudent()],
});
// 공동 교과 합산: 각 교사 입력을 앞뒤 공백 제거 후, 내용이 있는 것만 빈 칸 1칸으로 이어붙임
const mergeSegments = (teachers, segments) =>
  (teachers || []).map((t) => (segments?.[t.id] || "").trim()).filter(Boolean).join(" ");
// 활동 주제별: 학생이 주제마다 고른 수준의 내용을 순서대로 빈 칸 1칸으로 이어붙임
const compileTopics = (topics, picks) =>
  (topics || []).map((t) => { const lv = picks?.[t.id]; return lv ? (t.levels?.[lv] || "").trim() : ""; }).filter(Boolean).join(" ");
// 학생별 실제 글자수 제한: 참여 수준별 자동 조정이 켜져 있으면 수준별 한도, 아니면 과목 기준 제한
const subLimitFor = (sub, st) => {
  if (sub.coTeaching || sub.topicMode) return sub.byteLimit;
  return sub.levelMode ? (sub.levelLimits?.[st.level] ?? sub.byteLimit) : sub.byteLimit;
};

/* ============================================================
   공용 컴포넌트
   ============================================================ */
function ByteGauge({ bytes, limit }) {
  const pct = Math.min(100, limit ? (bytes / limit) * 100 : 0);
  const over = bytes > limit, near = !over && pct >= 80;
  const bar = over ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500";
  const txt = over ? "text-red-600" : near ? "text-amber-600" : "text-slate-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${txt}`}>{bytes}/{limit}B</span>
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { try { await navigator.clipboard.writeText(text || ""); setDone(true); setTimeout(() => setDone(false), 1200); } catch {} }}
      disabled={!text}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 disabled:opacity-40"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}{done ? "복사됨" : "복사"}
    </button>
  );
}

/* 제한 초과 시 보여줄 재치있는 안내 문구 (필드마다 다른 문구가 나오도록 seed로 선택) */
const OVER_MESSAGES = [
  "그만 입력하라니까요… 😤 여기서 더 늘리면 NEIS가 거부해요.",
  "칸이 꽉 찼어요! 이제 늘릴 게 아니라 덜어낼 시간입니다 ✂️",
  "제한 초과! 명문(名文)은 짧을수록 빛나는 법이죠 ✨",
  "여기서 한 글자만 더 넣으면… 저장이 안 돼요! 🙅",
];
function pickOverMessage(seed = "") {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OVER_MESSAGES[h % OVER_MESSAGES.length];
}

/* ============================================================
   바이트 제한 입력창
   - 입력 중 바이트수를 실시간 표시
   - 제한 초과 상태에서 '더 늘리는' 입력은 차단(삭제·수정, AI 결과 세팅은 허용)
   - 초과 시 테두리·배경을 빨간색으로, 재치있는 안내 문구 표시
   ============================================================ */
function LimitedTextarea({ value, onChange, limit, byteMode, rows = 4, placeholder, accent = "indigo", seed = "" }) {
  const bytes = countBytes(value, byteMode);
  const over = limit > 0 && bytes > limit;
  const handle = (e) => {
    const next = e.target.value;
    // 이미 제한을 넘겼거나 넘기게 되는데도 '더 늘리는' 입력이면 무시(줄이는 편집은 항상 허용)
    if (limit > 0) {
      const nb = countBytes(next, byteMode);
      if (nb > limit && nb > bytes) return;
    }
    onChange(next);
  };
  const focusCls = accent === "teal" ? "focus:border-teal-500" : "focus:border-indigo-500";
  return (
    <div>
      <textarea
        value={value}
        onChange={handle}
        rows={rows}
        placeholder={placeholder}
        spellCheck
        className={`w-full resize-none rounded-md border px-3 py-2 text-sm leading-relaxed focus:outline-none transition-colors ${
          over ? "border-red-400 bg-red-50 text-red-900 focus:border-red-500" : `border-slate-200 bg-white ${focusCls}`
        }`}
      />
      {over && (
        <div className="mt-1 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {pickOverMessage(seed)}
        </div>
      )}
    </div>
  );
}

const CHIP_COLLAPSED = 8; // 접힘 상태에서 그룹당 기본 노출 개수
function CheckGroups({ track, grade, checks, onToggle, customChecks = [], onCustom }) {
  const cats = useMemo(() => getCategories(track, grade), [track, grade]);
  const set = useMemo(() => new Set(checks), [checks]);
  const [expanded, setExpanded] = useState({}); // { [group]: true }
  const [customInput, setCustomInput] = useState("");
  const custom = new Set(customChecks);

  const addCustom = () => {
    const vals = customInput.split(",").map((v) => v.trim()).filter(Boolean);
    if (!vals.length || !onCustom) { setCustomInput(""); return; }
    onCustom(Array.from(new Set([...customChecks, ...vals])));
    setCustomInput("");
  };

  return (
    <div className="space-y-3">
      {cats.map((cat) => {
        const warn = cat.tone === "warn";
        const isOpen = !!expanded[cat.group];
        // 접힘: 앞쪽 N개 + (그 밖에 이미 선택된 항목)만 노출
        const shown = isOpen ? cat.items : cat.items.filter((it, i) => i < CHIP_COLLAPSED || set.has(it));
        const hiddenCount = cat.items.length - shown.length;
        const onCls = warn ? "bg-amber-500 border-amber-500 text-white" : "bg-indigo-600 border-indigo-600 text-white";
        const offCls = warn ? "bg-white border-amber-300 text-amber-700 hover:border-amber-400" : "bg-white border-slate-300 text-slate-600 hover:border-indigo-400";
        return (
        <div key={cat.group}>
          <div className={`text-xs font-semibold mb-1.5 ${warn ? "text-amber-700" : "text-indigo-700"}`}>{cat.group}</div>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((item) => {
              const on = set.has(item);
              return (
                <button key={item} onClick={() => onToggle(item)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${on ? onCls : offCls}`}>{item}</button>
              );
            })}
            {(hiddenCount > 0 || isOpen) && cat.items.length > CHIP_COLLAPSED && (
              <button onClick={() => setExpanded((e) => ({ ...e, [cat.group]: !isOpen }))}
                className="px-2.5 py-1 rounded-full text-xs border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
                {isOpen ? "접기 ▲" : `+${hiddenCount} 더보기 ▼`}
              </button>
            )}
          </div>
        </div>
        );
      })}
      {/* 기타 직접 입력(사용자 키워드) */}
      {onCustom && (
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1.5">기타 직접 입력 <span className="font-normal text-slate-400">(쉼표로 여러 개)</span></div>
          {customChecks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {customChecks.map((c) => (
                <button key={c} onClick={() => onCustom(customChecks.filter((x) => x !== c))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-slate-700 border-slate-700 text-white">
                  {c} <X size={11} />
                </button>
              ))}
            </div>
          )}
          <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            onBlur={addCustom} placeholder="직접 키워드 입력 후 Enter (예: 학급문고 관리, 리더십)"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
      )}
    </div>
  );
}

function TeacherPerspective({ checks, etc, onChecks, onEtc }) {
  const set = new Set(checks);
  return (
    <div>
      <div className="text-xs font-semibold text-violet-700 mb-1.5">
        교사 관점·서술 방향 <span className="font-normal text-slate-400">(선택)</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {TEACHER_PERSPECTIVES.map((p) => {
          const on = set.has(p);
          return (
            <button key={p} onClick={() => onChecks(on ? checks.filter((c) => c !== p) : [...checks, p])}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                on ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-violet-400"
              }`}>{p}</button>
          );
        })}
      </div>
      <input value={etc} onChange={(e) => onEtc(e.target.value)} placeholder="기타 서술 방향 직접 입력"
        className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
    </div>
  );
}

/* ============================================================
   행특 탭
   ============================================================ */
function BehaviorTab({ byteMode, apiKeyOverride, keyConfigured, guidelines, model }) {
  const [track, setTrack] = useState("tech");
  const [grade, setGrade] = useState(1);
  const [byteLimit, setByteLimit] = useState(1000);
  const [teacherChecks, setTeacherChecks] = useState([]);
  const [teacherEtc, setTeacherEtc] = useState("");
  const [view, setView] = useState("card");
  const [students, setStudents] = useState([newBehaviorStudent()]);
  const [busyAll, setBusyAll] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const ref = useRef(students);
  useEffect(() => { ref.current = students; }, [students]);

  const applyTrackGrade = (nt, ng) => {
    const valid = validItemSet(nt, ng);
    setStudents((prev) => prev.map((s) => ({ ...s, checks: s.checks.filter((c) => valid.has(c)) })));
    setTrack(nt); setGrade(ng);
  };
  const patch = (id, p) => setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const genOne = async (id) => {
    const s = ref.current.find((x) => x.id === id);
    if (!s) return;
    patch(id, { status: "loading", error: null });
    try {
      const valid = validItemSet(track, grade);
      const checks = s.checks.filter((c) => valid.has(c));
      const teacher = joinList(teacherChecks, teacherEtc);
      const prompt = buildBehaviorPrompt({ track, grade, checks, customChecks: s.customChecks, memo: s.memo, byteLimit, byteMode, teacher, guidelines });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(byteLimit), model);
      patch(id, { result: trimToByteLimit(text, byteLimit, byteMode), status: "done" });
    } catch (e) { patch(id, { status: "error", error: e.message || "생성 실패" }); }
  };
  const genAll = async () => {
    setBusyAll(true);
    for (const s of ref.current) {
      if (!s.name && s.checks.length === 0 && !(s.customChecks?.length) && !s.memo) continue;
      await genOne(s.id); await sleep(400);
    }
    setBusyAll(false);
  };
  const addStudent = () => setStudents((p) => [...p, newBehaviorStudent()]);
  const removeStudent = (id) => setStudents((p) => (p.length === 1 ? [newBehaviorStudent()] : p.filter((s) => s.id !== id)));
  const applyBulk = () => {
    const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) { setBulkOpen(false); return; }
    setStudents((prev) => {
      const base = prev.filter((s) => s.name || s.checks.length || s.memo || s.result);
      const start = base.length;
      return [...base, ...names.map((n, i) => newBehaviorStudent(n, String(start + i + 1)))];
    });
    setBulkText(""); setBulkOpen(false);
  };
  const exportExcel = () => {
    const rows = students.map((s, i) => {
      const b = countBytes(s.result, byteMode);
      return { "번호": s.number || i + 1, "이름": s.name || "", "계열": TRACK_LABELS[track], "학년": `${grade}학년`,
        "행동특성 및 종합의견": s.result || "", [`글자수(${byteMode}B)`]: b, "제한초과": s.result && b > byteLimit ? "O" : "" };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 90 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "행동특성");
    XLSX.writeFile(wb, `행동특성_${TRACK_LABELS[track]}_${grade}학년.xlsx`);
  };
  const doneCount = students.filter((s) => s.result).length;

  return (
    <div>
      {/* 설정 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">계열</span>
            <select value={track} onChange={(e) => applyTrackGrade(e.target.value, grade)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none">
              {TRACK_ORDER.map((t) => <option key={t} value={t}>{TRACK_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">학년</span>
            <div className="flex overflow-hidden rounded-md border border-slate-300">
              {[1, 2, 3].map((g) => (
                <button key={g} onClick={() => applyTrackGrade(track, g)}
                  className={`px-3 py-1 text-sm ${grade === g ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{g}</button>
              ))}
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">제한</span>
            <input type="number" value={byteLimit} min={0} step={100}
              onChange={(e) => setByteLimit(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
            <span className="text-slate-400 text-xs">바이트</span>
          </label>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <TeacherPerspective checks={teacherChecks} etc={teacherEtc} onChecks={setTeacherChecks} onEtc={setTeacherEtc} />
        </div>
      </div>

      {/* 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={addStudent} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-400"><Plus size={15} /> 학생 추가</button>
        <button onClick={() => setBulkOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-400"><ListPlus size={15} /> 이름 일괄 추가</button>
        <button onClick={genAll} disabled={busyAll || !keyConfigured} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busyAll ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}{busyAll ? "전체 생성 중…" : "전체 생성"}
        </button>
        <button onClick={exportExcel} disabled={doneCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><Download size={15} /> 엑셀 저장</button>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          <button onClick={() => setView("card")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-sm ${view === "card" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}><LayoutGrid size={14} /> 카드</button>
          <button onClick={() => setView("table")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-sm ${view === "table" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}><Table size={14} /> 표</button>
        </div>
      </div>

      {bulkOpen && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">이름 한 줄에 하나씩</span>
            <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"김민준\n이서연\n박지후"} className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          <div className="mt-2 flex justify-end"><button onClick={applyBulk} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">추가하기</button></div>
        </div>
      )}

      {view === "card" ? (
        <div className="space-y-3">
          {students.map((s, i) => {
            const bytes = countBytes(s.result, byteMode);
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{s.number || i + 1}</div>
                  <input value={s.number} onChange={(e) => patch(s.id, { number: e.target.value })} placeholder="번호" className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                  <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder="이름" className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-slate-400">{s.checks.length + (s.customChecks?.length || 0)}개</span>
                    <button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
                <CheckGroups track={track} grade={grade} checks={s.checks}
                  onToggle={(item) => { const has = s.checks.includes(item); patch(s.id, { checks: has ? s.checks.filter((c) => c !== item) : [...s.checks, item] }); }}
                  customChecks={s.customChecks || []} onCustom={(v) => patch(s.id, { customChecks: v })} />
                <textarea value={s.memo} onChange={(e) => patch(s.id, { memo: e.target.value })} placeholder="자유 메모·키워드 (선택)" rows={2} className="mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                <button onClick={() => genOne(s.id)} disabled={s.status === "loading"} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                  {s.status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{s.status === "loading" ? "생성 중…" : s.result ? "다시 생성" : "생성"}
                </button>
                {s.error && <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {s.error}</div>}
                {(s.result || s.status === "loading") && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <LimitedTextarea value={s.result} onChange={(v) => patch(s.id, { result: v })} rows={4} placeholder="생성 결과 (직접 수정 가능)"
                      limit={byteLimit} byteMode={byteMode} accent="indigo" seed={s.id} />
                    <div className="mt-2 flex items-center gap-3"><div className="flex-1"><ByteGauge bytes={bytes} limit={byteLimit} /></div><CopyBtn text={s.result} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="w-12 px-3 py-2">번호</th><th className="w-24 px-3 py-2">이름</th><th className="px-3 py-2">행동특성 및 종합의견</th><th className="w-40 px-3 py-2">글자수</th><th className="w-12 px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {students.map((s, i) => {
                const b = countBytes(s.result, byteMode);
                return (
                  <tr key={s.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2"><input value={s.number} onChange={(e) => patch(s.id, { number: e.target.value })} placeholder={String(i + 1)} className="w-10 rounded border border-slate-200 px-1.5 py-1 text-sm focus:border-indigo-500 focus:outline-none" /></td>
                    <td className="px-3 py-2"><input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder="이름" className="w-20 rounded border border-slate-200 px-1.5 py-1 text-sm focus:border-indigo-500 focus:outline-none" /></td>
                    <td className="px-3 py-2"><LimitedTextarea value={s.result} onChange={(v) => patch(s.id, { result: v })} rows={3} placeholder={s.status === "loading" ? "생성 중…" : "생성 또는 직접 입력"} limit={byteLimit} byteMode={byteMode} accent="indigo" seed={s.id} /></td>
                    <td className="px-3 py-2"><ByteGauge bytes={b} limit={byteLimit} /></td>
                    <td className="px-3 py-2"><button onClick={() => genOne(s.id)} disabled={s.status === "loading"} className="inline-flex items-center justify-center rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-700 disabled:opacity-50">{s.status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   세특 탭
   ============================================================ */
function SubjectStudentRow({ st, idx, byteMode, byteLimit, coTeaching, coTeachers, topicMode, topics, onChange, onRemove, onGenerate, onVary }) {
  const bytes = countBytes(st.result, byteMode);
  const plain = !coTeaching && !topicMode;
  const loading = st.status === "loading";
  const VaryButton = () => (
    <button onClick={onVary} disabled={loading || !st.result} title="자동 기록된 내용을 뜻은 유지한 채 AI로 살짝 다르게 다듬어 학생마다 다르게 만듭니다"
      className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50">
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI로 살짝 다르게
    </button>
  );
  const setSegment = (tid, text) => {
    const segments = { ...(st.segments || {}), [tid]: text };
    onChange({ segments, result: mergeSegments(coTeachers, segments) });
  };
  const setPick = (topicId, level) => {
    const picks = { ...(st.picks || {}), [topicId]: level };
    onChange({ picks, result: compileTopics(topics, picks) });
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">{st.number || idx + 1}</div>
        <input value={st.number} onChange={(e) => onChange({ number: e.target.value })} placeholder="번호" className="w-12 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
        <input value={st.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="이름" className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
        {plain && (
          <>
            <select value={st.level} onChange={(e) => onChange({ level: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input value={st.memo} onChange={(e) => onChange({ memo: e.target.value })} placeholder="개별 메모·특이사항 (선택)" className="min-w-[140px] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
            <button onClick={onGenerate} disabled={loading} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{loading ? "생성 중" : st.result ? "다시 생성" : "생성"}
            </button>
          </>
        )}
        <button onClick={onRemove} className="ml-auto text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
      </div>
      {st.error && <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {st.error}</div>}

      {/* 활동 주제별: 주제마다 수준 선택 → 자동 기록 */}
      {topicMode ? (
        <div className="mt-2 space-y-2">
          {topics.length === 0 ? (
            <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">위 '활동 주제별 입력' 설정에서 활동 주제를 먼저 추가하세요.</div>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {topics.map((t, ti) => (
                <label key={t.id} className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">{t.name || `주제 ${ti + 1}`}</span>
                  <select value={st.picks?.[t.id] || ""} onChange={(e) => setPick(t.id, e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none">
                    <option value="">해당 없음</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-teal-700">자동 기록 결과 <span className="font-normal text-slate-400">(주제·수준 내용을 이어붙임 · 직접 수정 가능)</span></div>
              <VaryButton />
            </div>
            <LimitedTextarea value={st.result} onChange={(v) => onChange({ result: v })} rows={3} placeholder="주제별 수준을 선택하면 자동으로 기록됩니다"
              limit={byteLimit} byteMode={byteMode} accent="teal" seed={st.id + "topic"} />
            <div className="mt-2 flex items-center gap-3"><div className="flex-1"><ByteGauge bytes={bytes} limit={byteLimit} /></div><CopyBtn text={st.result} /></div>
          </div>
        </div>
      ) : coTeaching ? (
        <div className="mt-2 space-y-2">
          {coTeachers.length === 0 ? (
            <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">위 '공동 교과' 설정에서 담당 교사를 먼저 추가하세요.</div>
          ) : (
            coTeachers.map((t, ti) => {
              const val = st.segments?.[t.id] || "";
              return (
                <div key={t.id}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-teal-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-teal-100 text-[10px] font-bold text-teal-700">{ti + 1}</span>
                    {t.name || `교사 ${ti + 1}`}<span className="font-normal text-slate-400">· 제한 {t.limit}B</span>
                  </div>
                  <LimitedTextarea value={val} onChange={(v) => setSegment(t.id, v)} rows={2}
                    placeholder={`${t.name || `교사 ${ti + 1}`} 담당 단원 내용`} limit={t.limit} byteMode={byteMode} accent="teal" seed={st.id + t.id} />
                  <div className="mt-1"><ByteGauge bytes={countBytes(val, byteMode)} limit={t.limit} /></div>
                </div>
              );
            })
          )}
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-teal-700">자동 합산 결과 <span className="font-normal text-slate-400">(내용 있는 교사만 빈 칸 1칸으로 이어붙임)</span></div>
              <VaryButton />
            </div>
            <LimitedTextarea value={st.result} onChange={(v) => onChange({ result: v })} rows={3} placeholder="교사별 내용을 입력하면 자동으로 합쳐집니다 (직접 수정 가능)"
              limit={byteLimit} byteMode={byteMode} accent="teal" seed={st.id + "merged"} />
            <div className="mt-2 flex items-center gap-3"><div className="flex-1"><ByteGauge bytes={bytes} limit={byteLimit} /></div><CopyBtn text={st.result} /></div>
          </div>
        </div>
      ) : (
        (st.result || st.status === "loading") && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <LimitedTextarea value={st.result} onChange={(v) => onChange({ result: v })} rows={4} placeholder="생성 결과 (직접 수정 가능)"
              limit={byteLimit} byteMode={byteMode} accent="teal" seed={st.id} />
            <div className="mt-2 flex items-center gap-3"><div className="flex-1"><ByteGauge bytes={bytes} limit={byteLimit} /></div><CopyBtn text={st.result} /></div>
          </div>
        )
      )}
    </div>
  );
}

function SubjectTab({ byteMode, apiKeyOverride, keyConfigured, guidelines, model }) {
  const [subjects, setSubjects] = useState([newSubject("과목 1")]);
  const [activeId, setActiveId] = useState(subjects[0].id);
  const [busyAll, setBusyAll] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const ref = useRef(subjects);
  useEffect(() => { ref.current = subjects; }, [subjects]);

  const active = subjects.find((s) => s.id === activeId) || subjects[0];

  const patchSubject = (sid, p) => setSubjects((prev) => prev.map((s) => (s.id === sid ? { ...s, ...p } : s)));
  const patchStudent = (sid, stid, p) =>
    setSubjects((prev) => prev.map((s) => (s.id === sid ? { ...s, students: s.students.map((st) => (st.id === stid ? { ...st, ...p } : st)) } : s)));

  const addSubject = () => {
    const ns = newSubject(`과목 ${subjects.length + 1}`);
    setSubjects((p) => [...p, ns]); setActiveId(ns.id);
  };
  const removeSubject = (sid) => {
    setSubjects((prev) => {
      const next = prev.filter((s) => s.id !== sid);
      const fin = next.length ? next : [newSubject("과목 1")];
      if (sid === activeId) setActiveId(fin[0].id);
      return fin;
    });
  };

  const patchTeachers = (sid, teachers) => patchSubject(sid, { coTeachers: teachers });
  const addTeacher = () => {
    const list = active.coTeachers || [];
    if (list.length >= 4) return;
    patchTeachers(active.id, [...list, newCoTeacher(`교사 ${list.length + 1}`)]);
  };
  const removeTeacher = (tid) => patchTeachers(active.id, (active.coTeachers || []).filter((t) => t.id !== tid));
  const patchTeacher = (tid, p) => patchTeachers(active.id, (active.coTeachers || []).map((t) => (t.id === tid ? { ...t, ...p } : t)));
  const toggleCoTeaching = () => {
    const on = !active.coTeaching;
    // 처음 켤 때 교사 2명 기본 생성 / 공동 교과 켜면 활동 주제 모드는 끔
    const teachers = on && (active.coTeachers || []).length === 0 ? [newCoTeacher("교사 1"), newCoTeacher("교사 2")] : active.coTeachers;
    patchSubject(active.id, { coTeaching: on, coTeachers: teachers, topicMode: on ? false : active.topicMode });
  };

  const patchTopics = (topics) => patchSubject(active.id, { topics });
  const addTopic = () => { const list = active.topics || []; if (list.length >= 8) return; patchTopics([...list, newTopic(`주제 ${list.length + 1}`)]); };
  const removeTopic = (tid) => patchTopics((active.topics || []).filter((t) => t.id !== tid));
  const patchTopic = (tid, p) => patchTopics((active.topics || []).map((t) => (t.id === tid ? { ...t, ...p } : t)));
  const patchTopicLevel = (tid, level, text) =>
    patchTopics((active.topics || []).map((t) => (t.id === tid ? { ...t, levels: { ...t.levels, [level]: text } } : t)));
  const toggleTopicMode = () => {
    const on = !active.topicMode;
    const topics = on && (active.topics || []).length === 0 ? [newTopic("주제 1")] : active.topics;
    patchSubject(active.id, { topicMode: on, topics, coTeaching: on ? false : active.coTeaching });
  };

  const toggleLevelMode = () => patchSubject(active.id, { levelMode: !active.levelMode });
  const patchLevelLimit = (level, val) =>
    patchSubject(active.id, { levelLimits: { ...(active.levelLimits || LEVEL_LIMIT_DEFAULT), [level]: Math.max(0, Number(val) || 0) } });

  const genStudent = async (sid, stid) => {
    const sub = ref.current.find((s) => s.id === sid); if (!sub) return;
    if (sub.coTeaching || sub.topicMode) return; // 공동 교과·활동 주제별은 직접 입력/선택 → AI 생성 미사용
    const st = sub.students.find((x) => x.id === stid); if (!st) return;
    const lim = subLimitFor(sub, st);
    patchStudent(sid, stid, { status: "loading", error: null });
    try {
      const prompt = buildSubjectPrompt({ subject: sub, student: st, byteMode, guidelines, byteLimit: lim });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(lim), model);
      patchStudent(sid, stid, { result: trimToByteLimit(text, lim, byteMode), status: "done" });
    } catch (e) { patchStudent(sid, stid, { status: "error", error: e.message || "생성 실패" }); }
  };
  // 자동 기록/합산 결과를 AI로 살짝 다르게 다듬기(공동 교과·활동 주제별에서 학생마다 다르게)
  const genVariation = async (sid, stid) => {
    const sub = ref.current.find((s) => s.id === sid); if (!sub) return;
    const st = sub.students.find((x) => x.id === stid); if (!st) return;
    const base = (st.result || "").trim(); if (!base) return;
    const lim = subLimitFor(sub, st);
    patchStudent(sid, stid, { status: "loading", error: null });
    try {
      const prompt = buildVariationPrompt({ text: base, byteLimit: lim, byteMode, guidelines });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(lim), model);
      patchStudent(sid, stid, { result: trimToByteLimit(text, lim, byteMode), status: "done" });
    } catch (e) { patchStudent(sid, stid, { status: "error", error: e.message || "생성 실패" }); }
  };
  const genAll = async () => {
    setBusyAll(true);
    const sub = ref.current.find((s) => s.id === activeId);
    if (sub) for (const st of sub.students) {
      if (!st.name && !st.memo) continue;
      await genStudent(sub.id, st.id); await sleep(400);
    }
    setBusyAll(false);
  };

  const addStudent = () => {
    if (active.students.length >= MAX_SUB_STUDENTS) return;
    patchSubject(active.id, { students: [...active.students, newSubStudent()] });
  };
  const removeStudent = (stid) => {
    const left = active.students.filter((s) => s.id !== stid);
    patchSubject(active.id, { students: left.length ? left : [newSubStudent()] });
  };
  const applyBulk = () => {
    const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) { setBulkOpen(false); return; }
    const base = active.students.filter((s) => s.name || s.memo || s.result);
    const room = MAX_SUB_STUDENTS - base.length;
    const add = names.slice(0, Math.max(0, room)).map((n, i) => newSubStudent(n, String(base.length + i + 1)));
    patchSubject(active.id, { students: [...base, ...add] });
    setBulkText(""); setBulkOpen(false);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const used = new Set();
    subjects.forEach((sub, si) => {
      const rows = sub.students.map((st, i) => {
        const b = countBytes(st.result, byteMode);
        const lim = subLimitFor(sub, st);
        return { "번호": st.number || i + 1, "이름": st.name || "", "과목": sub.name || `과목${si + 1}`, "참여수준": st.level,
          "세부능력 및 특기사항": st.result || "", [`글자수(${byteMode}B)`]: b, "제한": lim, "제한초과": st.result && b > lim ? "O" : "" };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 90 }, { wch: 12 }, { wch: 8 }, { wch: 8 }];
      let nm = (sub.name || `과목${si + 1}`).replace(/[\\/?*[\]:]/g, "").slice(0, 26) || `과목${si + 1}`;
      let base = nm, k = 2; while (used.has(nm)) { nm = `${base}_${k++}`; } used.add(nm);
      XLSX.utils.book_append_sheet(wb, ws, nm);
    });
    XLSX.writeFile(wb, `세특_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const isNcs = active.type === "ncs";
  const activitySet = isNcs ? ACTIVITY_NCS : ACTIVITY_GENERAL;
  const actSet = new Set(active.activities);
  const doneCount = subjects.reduce((n, s) => n + s.students.filter((x) => x.result).length, 0);

  return (
    <div>
      {/* 과목 탭 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {subjects.map((s, i) => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            className={`group inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              s.id === activeId ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-teal-400"
            }`}>
            <BookOpen size={14} /> {s.name || `과목 ${i + 1}`}
            {subjects.length > 1 && (
              <span onClick={(e) => { e.stopPropagation(); removeSubject(s.id); }} className={`-mr-1 rounded p-0.5 ${s.id === activeId ? "hover:bg-teal-700" : "hover:bg-slate-100"}`}><X size={12} /></span>
            )}
          </button>
        ))}
        <button onClick={addSubject} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-slate-500 hover:border-teal-400 hover:text-teal-600"><Plus size={14} /> 과목 추가</button>
      </div>

      {/* 과목 설정 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">과목 유형</span>
            <div className="flex overflow-hidden rounded-md border border-slate-300">
              {[["general", "일반 교과"], ["ncs", "NCS 전문교과"]].map(([v, lab]) => (
                <button key={v} onClick={() => patchSubject(active.id, { type: v })}
                  className={`px-3 py-1 text-sm ${active.type === v ? "bg-teal-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{lab}</button>
              ))}
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">과목명</span>
            <input value={active.name} onChange={(e) => patchSubject(active.id, { name: e.target.value })} placeholder="예: 전기회로, 화학Ⅰ" className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{active.levelMode && !active.coTeaching && !active.topicMode ? "기준 제한" : "제한"}</span>
            <input type="number" value={active.byteLimit} min={0} step={100} onChange={(e) => patchSubject(active.id, { byteLimit: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
            <span className="text-slate-400 text-xs">바이트</span>
          </label>
          {!active.coTeaching && !active.topicMode && (
            <label className="flex items-center gap-2 text-sm" title="참여 수준(성적)에 따라 글자수 제한을 자동으로 다르게 적용">
              <input type="checkbox" checked={active.levelMode} onChange={toggleLevelMode} className="h-4 w-4 accent-teal-600" />
              <span className="text-slate-600">수준별 글자수 <span className="text-slate-400 text-xs">(참여·성적별 자동 조정)</span></span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm" title="한 과목을 여러 교사가 단원별로 나눠 가르칠 때">
            <input type="checkbox" checked={active.coTeaching} onChange={toggleCoTeaching} className="h-4 w-4 accent-teal-600" />
            <span className="text-slate-600">공동 교과 <span className="text-slate-400 text-xs">(단원 분담·자동 합산)</span></span>
          </label>
          <label className="flex items-center gap-2 text-sm" title="주제별로 수준(주도적~미흡) 내용을 미리 만들어두고 학생마다 선택">
            <input type="checkbox" checked={active.topicMode} onChange={toggleTopicMode} className="h-4 w-4 accent-teal-600" />
            <span className="text-slate-600">활동 주제별 <span className="text-slate-400 text-xs">(수준별 선택·자동 기록)</span></span>
          </label>
        </div>

        {active.levelMode && !active.coTeaching && !active.topicMode && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-1.5 text-xs font-semibold text-teal-700">참여 수준별 글자수 제한(바이트) <span className="font-normal text-slate-400">(미참여·저조 학생은 더 짧게 · 직접 조정 가능)</span></div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lv) => (
                <label key={lv} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  <span className="font-medium">{lv}</span>
                  <input type="number" min={0} step={50} value={(active.levelLimits || LEVEL_LIMIT_DEFAULT)[lv] ?? ""} onChange={(e) => patchLevelLimit(lv, e.target.value)}
                    className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm focus:border-teal-500 focus:outline-none" />
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">학생별 ‘참여 수준’에 따라 위 제한이 자동 적용되고, 생성 결과가 제한을 넘으면 문장 단위로 잘려 마무리됩니다.</p>
          </div>
        )}

        {active.topicMode && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-teal-700">활동 주제 뱅크 <span className="font-normal text-slate-400">(주제마다 수준별 내용을 미리 작성 → 학생별로 수준만 선택)</span></div>
              <button onClick={addTopic} disabled={(active.topics || []).length >= 8} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-teal-400 disabled:opacity-50"><Plus size={12} /> 주제 추가</button>
            </div>
            <div className="space-y-2.5">
              {(active.topics || []).map((t, ti) => (
                <div key={t.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-100 text-[11px] font-bold text-teal-700">{ti + 1}</span>
                    <input value={t.name} onChange={(e) => patchTopic(t.id, { name: e.target.value })} placeholder={`활동 주제 ${ti + 1} (예: 2차전지 탐구)`} className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
                    {(active.topics || []).length > 1 && <button onClick={() => removeTopic(t.id)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LEVELS.map((lv) => (
                      <div key={lv}>
                        <div className="mb-0.5 text-[11px] font-medium text-slate-500">{lv} 수준 문구</div>
                        <textarea value={t.levels?.[lv] || ""} onChange={(e) => patchTopicLevel(t.id, lv, e.target.value)} rows={2}
                          placeholder={`${lv} 수준에서 기록할 내용`} spellCheck
                          className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">학생 목록에서 주제별 수준을 고르면, 고른 수준의 문구가 순서대로 자동 기록됩니다. '해당 없음'은 제외돼요.</p>
          </div>
        )}

        {active.coTeaching && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-teal-700">담당 교사 <span className="font-normal text-slate-400">(교사별 글자수 제한 · 학생마다 교사별로 입력)</span></div>
              <button onClick={addTeacher} disabled={(active.coTeachers || []).length >= 4} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-teal-400 disabled:opacity-50"><Plus size={12} /> 교사 추가</button>
            </div>
            <div className="space-y-1.5">
              {(active.coTeachers || []).map((t, ti) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-100 text-[11px] font-bold text-teal-700">{ti + 1}</span>
                  <input value={t.name} onChange={(e) => patchTeacher(t.id, { name: e.target.value })} placeholder={`교사 ${ti + 1} 이름/단원`} className="w-44 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    제한
                    <input type="number" value={t.limit} min={0} step={100} onChange={(e) => patchTeacher(t.id, { limit: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
                    바이트
                  </label>
                  {(active.coTeachers || []).length > 1 && (
                    <button onClick={() => removeTeacher(t.id)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">교사별 입력 내용이 있는 것만 빈 칸 1칸으로 자동 합쳐집니다. 공동 교과에서는 AI 생성 대신 교사가 직접 입력해요.</p>
          </div>
        )}

        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-teal-700 mb-1.5">{isNcs ? "능력단위·수행준거" : "성취기준"} <span className="font-normal text-slate-400">(선택 · 한 번 입력 후 25명 공통)</span></div>
          <textarea value={active.standard} onChange={(e) => patchSubject(active.id, { standard: e.target.value })} rows={2} placeholder={isNcs ? "예: [2001020203_20v4] 전기설비 도면을 해독하여 시공할 수 있다" : "예: [12화학01-02] 물질의 구성 입자를 이해하고 설명할 수 있다"} className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
        </div>

        <div className="mt-3">
          <div className="text-xs font-semibold text-teal-700 mb-1.5">수업 활동 유형 <span className="font-normal text-slate-400">(선택)</span></div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activitySet.map((a) => {
              const on = actSet.has(a);
              return <button key={a} onClick={() => patchSubject(active.id, { activities: on ? active.activities.filter((x) => x !== a) : [...active.activities, a] })}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${on ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-teal-400"}`}>{a}</button>;
            })}
          </div>
          <input value={active.activityEtc} onChange={(e) => patchSubject(active.id, { activityEtc: e.target.value })} placeholder="기타 활동 직접 입력" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none" />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-teal-700 mb-1.5">공통 활동 내용 <span className="font-normal text-slate-400">(선택)</span></div>
            <textarea value={active.commonActivity} onChange={(e) => patchSubject(active.id, { commonActivity: e.target.value })} rows={2} placeholder="예: 2차전지 원리를 조사해 발표 수업을 진행함" className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
          <div>
            <div className="text-xs font-semibold text-teal-700 mb-1.5">수행평가 기준 <span className="font-normal text-slate-400">(선택)</span></div>
            <textarea value={active.evalMemo} onChange={(e) => patchSubject(active.id, { evalMemo: e.target.value })} rows={2} placeholder="예: 탐구보고서 — 자료 수집·분석 능력 평가" className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <TeacherPerspective checks={active.teacherChecks} etc={active.teacherEtc}
            onChecks={(v) => patchSubject(active.id, { teacherChecks: v })} onEtc={(v) => patchSubject(active.id, { teacherEtc: v })} />
        </div>
      </div>

      {/* 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={addStudent} disabled={active.students.length >= MAX_SUB_STUDENTS} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400 disabled:opacity-50"><Plus size={15} /> 학생 추가</button>
        <button onClick={() => setBulkOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400"><ListPlus size={15} /> 이름 일괄 추가</button>
        {!active.coTeaching && !active.topicMode && (
          <button onClick={genAll} disabled={busyAll || !keyConfigured} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {busyAll ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}{busyAll ? "생성 중…" : "이 과목 전체 생성"}
          </button>
        )}
        <button onClick={exportExcel} disabled={doneCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><FileSpreadsheet size={15} /> 엑셀 저장(전 과목)</button>
        <span className="ml-auto text-xs text-slate-400">{active.students.length}/{MAX_SUB_STUDENTS}명</span>
      </div>

      {bulkOpen && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">이름 한 줄에 하나씩 (최대 {MAX_SUB_STUDENTS}명)</span>
            <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"김민준\n이서연\n박지후"} className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
          <div className="mt-2 flex justify-end"><button onClick={applyBulk} className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">추가하기</button></div>
        </div>
      )}

      <div className="space-y-2.5">
        {active.students.map((st, i) => (
          <SubjectStudentRow key={st.id} st={st} idx={i} byteMode={byteMode} byteLimit={subLimitFor(active, st)}
            coTeaching={active.coTeaching} coTeachers={active.coTeachers || []}
            topicMode={active.topicMode} topics={active.topics || []}
            onChange={(p) => patchStudent(active.id, st.id, p)} onRemove={() => removeStudent(st.id)}
            onGenerate={() => genStudent(active.id, st.id)} onVary={() => genVariation(active.id, st.id)} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   창의적 체험활동(자율·동아리·진로) 특기사항 탭
   - 세특과 동일한 방식(개별/전체 생성, 참여 수준별 글자수, 초과 트림, 엑셀)
   ============================================================ */
const CA_AREAS = [
  { key: "auto", label: "자율활동", extra: null,
    focus: "학급·학교의 자치·자율 활동에서의 역할 수행, 공동체 의식, 리더십·책임감·협력을 중심으로 서술" },
  { key: "club", label: "동아리활동", extra: { field: "clubName", label: "동아리명", placeholder: "예: 로봇제작반" },
    focus: "동아리 활동에서의 관심 분야 탐구, 전문성·기능 신장, 협업과 역할을 중심으로 서술" },
  { key: "career", label: "진로활동", extra: { field: "careerField", label: "진로·관심 분야", placeholder: "예: 전기공학" },
    focus: "진로 탐색 활동, 자기 이해와 진로 성숙도, 진로와 연계한 노력을 중심으로 서술" },
];
const newActStudent = (name = "", number = "") => ({ id: uid(), name, number, level: "보통", memo: "", result: "", status: "idle", error: null });
const newActArea = (a) => ({
  key: a.key, label: a.label, clubName: "", careerField: "", commonActivity: "",
  teacherChecks: [], teacherEtc: "", byteLimit: 1000, levelMode: true, levelLimits: { ...LEVEL_LIMIT_DEFAULT },
  students: [newActStudent()],
});

function buildActivityPrompt({ area, meta, student, byteMode, guidelines, byteLimit }) {
  const teacher = joinList(meta.teacherChecks, meta.teacherEtc);
  const L = [];
  L.push(`당신은 한국 고등학교 교사로서 학교생활기록부 '창의적 체험활동 - ${area.label} 특기사항'을 작성하는 전문가입니다.`);
  L.push(`다음 정보를 바탕으로 한 학생의 ${area.label} 특기사항을 작성하세요.\n`);
  const gb = guidelineBlock(guidelines);
  if (gb) L.push(gb);
  L.push(`[활동 정보]`);
  L.push(`- 영역: 창의적 체험활동 / ${area.label}`);
  if (area.key === "club" && meta.clubName && meta.clubName.trim()) L.push(`- 동아리명: ${meta.clubName.trim()}`);
  if (area.key === "career" && meta.careerField && meta.careerField.trim()) L.push(`- 진로·관심 분야: ${meta.careerField.trim()}`);
  if (meta.commonActivity && meta.commonActivity.trim()) L.push(`- 공통 활동 내용: ${meta.commonActivity.trim()}`);
  L.push(``);
  L.push(`[학생 정보]`);
  L.push(`- 참여 수준: ${student.level}`);
  if (student.memo && student.memo.trim()) L.push(`- 개별 관찰 메모: ${student.memo.trim()}`);
  if (teacher) { L.push(``); L.push(`[작성 방향(교사 관점)]`); L.push(`- ${teacher}`); }
  L.push(``);
  L.push(`[작성 규칙]`);
  L.push(`1. 문체: 객관적·관찰 중심, '~함','~을 보임','~을 수행함' 등 명사형/음슴체. 제3자 시점. 1인칭·경어체 금지.`);
  L.push(`2. 주어진 정보에만 근거. 제공되지 않은 수치·대회명·수상 등 거짓 사실 금지.`);
  L.push(`3. ${area.focus}.`);
  L.push(`4. 참여 수준에 맞춰 톤·분량을 차등: '주도적/적극적'은 능동성과 구체적 기여 부각, '보통'은 사실 위주로 담백하게, '미흡'은 낙인 없이 기본 참여·성장 가능성 위주로 절제, '미참여'는 참여가 저조하였음을 간결·완곡하게 짧게.`);
  L.push(`5. 개별 메모로 그 학생만의 모습이 드러나게 하고, 비어 있는 정보는 자연스럽게 생략.`);
  if (teacher) L.push(`6. 위 '작성 방향'을 반영할 것.`);
  L.push(`${teacher ? 7 : 6}. 분량은 반드시 ${byteLimit}바이트(한글 기준 약 ${approxChars(byteLimit, byteMode)}자)를 넘지 말 것. 완성된 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(``);
  L.push(`${area.label} 특기사항:`);
  return L.join("\n");
}

function ActivityTab({ byteMode, apiKeyOverride, keyConfigured, guidelines, model }) {
  const [areas, setAreas] = useState(() => CA_AREAS.map(newActArea));
  const [activeKey, setActiveKey] = useState(CA_AREAS[0].key);
  const [busyAll, setBusyAll] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const ref = useRef(areas);
  useEffect(() => { ref.current = areas; }, [areas]);

  const active = areas.find((a) => a.key === activeKey) || areas[0];
  const areaDef = CA_AREAS.find((a) => a.key === active.key);
  const limFor = (a, st) => (a.levelMode ? (a.levelLimits?.[st.level] ?? a.byteLimit) : a.byteLimit);

  const patchArea = (key, p) => setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, ...p } : a)));
  const patchStudent = (key, stid, p) =>
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, students: a.students.map((st) => (st.id === stid ? { ...st, ...p } : st)) } : a)));
  const patchLevelLimit = (lv, val) =>
    patchArea(active.key, { levelLimits: { ...(active.levelLimits || LEVEL_LIMIT_DEFAULT), [lv]: Math.max(0, Number(val) || 0) } });

  const genStudent = async (key, stid) => {
    const a = ref.current.find((x) => x.key === key); if (!a) return;
    const st = a.students.find((x) => x.id === stid); if (!st) return;
    const def = CA_AREAS.find((x) => x.key === a.key);
    const lim = limFor(a, st);
    patchStudent(key, stid, { status: "loading", error: null });
    try {
      const prompt = buildActivityPrompt({ area: def, meta: a, student: st, byteMode, guidelines, byteLimit: lim });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(lim), model);
      patchStudent(key, stid, { result: trimToByteLimit(text, lim, byteMode), status: "done" });
    } catch (e) { patchStudent(key, stid, { status: "error", error: e.message || "생성 실패" }); }
  };
  const genAll = async () => {
    setBusyAll(true);
    const a = ref.current.find((x) => x.key === activeKey);
    if (a) for (const st of a.students) { if (!st.name && !st.memo) continue; await genStudent(a.key, st.id); await sleep(400); }
    setBusyAll(false);
  };

  const addStudent = () => { if (active.students.length >= MAX_SUB_STUDENTS) return; patchArea(active.key, { students: [...active.students, newActStudent()] }); };
  const removeStudent = (stid) => { const left = active.students.filter((s) => s.id !== stid); patchArea(active.key, { students: left.length ? left : [newActStudent()] }); };
  const applyBulk = () => {
    const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) { setBulkOpen(false); return; }
    const base = active.students.filter((s) => s.name || s.memo || s.result);
    const room = MAX_SUB_STUDENTS - base.length;
    const add = names.slice(0, Math.max(0, room)).map((n, i) => newActStudent(n, String(base.length + i + 1)));
    patchArea(active.key, { students: [...base, ...add] });
    setBulkText(""); setBulkOpen(false);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    areas.forEach((a) => {
      const rows = a.students.map((st, i) => {
        const b = countBytes(st.result, byteMode);
        const lim = limFor(a, st);
        return { "번호": st.number || i + 1, "이름": st.name || "", "영역": a.label, "참여수준": st.level,
          "특기사항": st.result || "", [`글자수(${byteMode}B)`]: b, "제한": lim, "제한초과": st.result && b > lim ? "O" : "" };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 90 }, { wch: 12 }, { wch: 8 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, a.label);
    });
    XLSX.writeFile(wb, `창의적체험활동_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const doneCount = areas.reduce((n, a) => n + a.students.filter((x) => x.result).length, 0);

  return (
    <div>
      {/* 영역 탭 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {areas.map((a) => (
          <button key={a.key} onClick={() => setActiveKey(a.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              a.key === activeKey ? "border-purple-600 bg-purple-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-purple-400"
            }`}>
            <Compass size={14} /> {a.label}
          </button>
        ))}
      </div>

      {/* 영역 설정 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {areaDef.extra && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">{areaDef.extra.label}</span>
              <input value={active[areaDef.extra.field] || ""} onChange={(e) => patchArea(active.key, { [areaDef.extra.field]: e.target.value })}
                placeholder={areaDef.extra.placeholder} className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-purple-500 focus:outline-none" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{active.levelMode ? "기준 제한" : "제한"}</span>
            <input type="number" value={active.byteLimit} min={0} step={100} onChange={(e) => patchArea(active.key, { byteLimit: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-purple-500 focus:outline-none" />
            <span className="text-slate-400 text-xs">바이트</span>
          </label>
          <label className="flex items-center gap-2 text-sm" title="참여 수준(성적)에 따라 글자수 제한을 자동으로 다르게 적용">
            <input type="checkbox" checked={active.levelMode} onChange={() => patchArea(active.key, { levelMode: !active.levelMode })} className="h-4 w-4 accent-purple-600" />
            <span className="text-slate-600">수준별 글자수 <span className="text-slate-400 text-xs">(참여·성적별 자동 조정)</span></span>
          </label>
        </div>

        {active.levelMode && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-1.5 text-xs font-semibold text-purple-700">참여 수준별 글자수 제한(바이트) <span className="font-normal text-slate-400">(미참여·저조 학생은 더 짧게 · 직접 조정 가능)</span></div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lv) => (
                <label key={lv} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  <span className="font-medium">{lv}</span>
                  <input type="number" min={0} step={50} value={(active.levelLimits || LEVEL_LIMIT_DEFAULT)[lv] ?? ""} onChange={(e) => patchLevelLimit(lv, e.target.value)}
                    className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-sm focus:border-purple-500 focus:outline-none" />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-purple-700 mb-1.5">공통 활동 내용 <span className="font-normal text-slate-400">(선택 · 한 번 입력 후 학생 공통)</span></div>
          <textarea value={active.commonActivity} onChange={(e) => patchArea(active.key, { commonActivity: e.target.value })} rows={2} spellCheck
            placeholder={active.key === "club" ? "예: 자율주행 로봇을 설계·제작하는 프로젝트를 진행함" : active.key === "career" ? "예: 학과 탐방과 직업인 특강에 참여함" : "예: 학급 자치회의 운영과 학교 행사 준비에 참여함"}
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <TeacherPerspective checks={active.teacherChecks} etc={active.teacherEtc}
            onChecks={(v) => patchArea(active.key, { teacherChecks: v })} onEtc={(v) => patchArea(active.key, { teacherEtc: v })} />
        </div>
      </div>

      {/* 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={addStudent} disabled={active.students.length >= MAX_SUB_STUDENTS} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-purple-400 disabled:opacity-50"><Plus size={15} /> 학생 추가</button>
        <button onClick={() => setBulkOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-purple-400"><ListPlus size={15} /> 이름 일괄 추가</button>
        <button onClick={genAll} disabled={busyAll || !keyConfigured} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
          {busyAll ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}{busyAll ? "생성 중…" : "이 영역 전체 생성"}
        </button>
        <button onClick={exportExcel} disabled={doneCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><FileSpreadsheet size={15} /> 엑셀 저장(전 영역)</button>
        <span className="ml-auto text-xs text-slate-400">{active.students.length}/{MAX_SUB_STUDENTS}명</span>
      </div>

      {bulkOpen && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">이름 한 줄에 하나씩 (최대 {MAX_SUB_STUDENTS}명)</span>
            <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"김민준\n이서연\n박지후"} className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
          <div className="mt-2 flex justify-end"><button onClick={applyBulk} className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700">추가하기</button></div>
        </div>
      )}

      <div className="space-y-2.5">
        {active.students.map((st, i) => (
          <SubjectStudentRow key={st.id} st={st} idx={i} byteMode={byteMode} byteLimit={limFor(active, st)}
            coTeaching={false} coTeachers={[]} topicMode={false} topics={[]}
            onChange={(p) => patchStudent(active.key, st.id, p)} onRemove={() => removeStudent(st.id)}
            onGenerate={() => genStudent(active.key, st.id)} onVary={() => {}} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   최소성취 대상학생 체크 탭
   - 명단을 만든 뒤(직접/일괄), 최소성취 수준 이하 '대상' 학생을 체크
   - 학번을 쉼표·공백·줄바꿈으로 입력하면 여러 명을 한 번에 자동 체크
     (명단에 없는 학번은 새 행으로 추가하며 체크)
   - 대상자만 추려 새 시트(엑셀)로 저장
   ============================================================ */
const newMinStudent = (number = "", name = "") => ({ id: uid(), number, name, target: false });

function MinAchievementTab() {
  const [students, setStudents] = useState([newMinStudent("1")]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [numInput, setNumInput] = useState("");

  const patch = (id, p) => setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const addStudent = () => setStudents((p) => [...p, newMinStudent(String(p.length + 1))]);
  const removeStudent = (id) => setStudents((p) => (p.length === 1 ? [newMinStudent("1")] : p.filter((s) => s.id !== id)));

  const applyBulk = () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { setBulkOpen(false); return; }
    setStudents((prev) => {
      const base = prev.filter((s) => s.number || s.name || s.target);
      const start = base.length;
      const add = lines.map((line, i) => {
        const m = line.match(/^(\d+)[\s.\)-]+(.+)$/); // "3 김민준" / "3. 김민준" / "3) 김민준"
        if (m) return newMinStudent(m[1], m[2].trim());
        if (/^\d+$/.test(line)) return newMinStudent(line, "");
        return newMinStudent(String(start + i + 1), line);
      });
      return [...base, ...add];
    });
    setBulkText(""); setBulkOpen(false);
  };

  const applyNumbers = () => {
    const nums = Array.from(new Set(numInput.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)));
    if (!nums.length) return;
    const numSet = new Set(nums.map(String));
    setStudents((prev) => {
      const existing = new Set(prev.map((s) => String(s.number)));
      const out = prev.map((s) => (numSet.has(String(s.number)) ? { ...s, target: true } : s));
      const missing = nums.filter((n) => !existing.has(String(n))).sort((a, b) => Number(a) - Number(b));
      return [...out, ...missing.map((n) => ({ ...newMinStudent(n, ""), target: true }))];
    });
    setNumInput("");
  };

  const clearTargets = () => setStudents((prev) => prev.map((s) => ({ ...s, target: false })));

  const targets = students.filter((s) => s.target);
  const exportExcel = () => {
    const rows = targets
      .slice()
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
      .map((s) => ({ "번호": s.number || "", "이름": s.name || "", "구분": "최소성취 대상" }));
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "최소성취대상");
    XLSX.writeFile(wb, `최소성취대상_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1.5 text-xs font-semibold text-rose-700 flex items-center gap-1.5"><Hash size={13} /> 학번으로 한 번에 체크</div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={numInput} onChange={(e) => setNumInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyNumbers(); }}
            placeholder="예: 3, 7, 12  또는  3 7 12 (쉼표·공백 구분)"
            className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-rose-500 focus:outline-none" />
          <button onClick={applyNumbers} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"><Check size={15} /> 대상 체크</button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">입력한 학번을 대상으로 표시합니다. 명단에 없는 학번은 새 행으로 추가돼요.</p>
      </div>

      {/* 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={addStudent} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-rose-400"><Plus size={15} /> 학생 추가</button>
        <button onClick={() => setBulkOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-rose-400"><ListPlus size={15} /> 명단 일괄 추가</button>
        <button onClick={clearTargets} disabled={!targets.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"><RefreshCw size={15} /> 체크 초기화</button>
        <button onClick={exportExcel} disabled={!targets.length} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"><Download size={15} /> 대상자 엑셀 저장</button>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700"><Flag size={14} /> 대상 {targets.length}명 / 전체 {students.length}명</span>
      </div>

      {bulkOpen && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">한 줄에 한 명 · "번호 이름" 또는 "이름"</span>
            <button onClick={() => setBulkOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"1 김민준\n2 이서연\n3 박지후"} className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
          <div className="mt-2 flex justify-end"><button onClick={applyBulk} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">추가하기</button></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[420px] text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <th className="w-16 px-3 py-2">대상</th><th className="w-20 px-3 py-2">번호</th><th className="px-3 py-2">이름</th><th className="w-12 px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className={`border-b border-slate-100 ${s.target ? "bg-rose-50" : ""}`}>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={s.target} onChange={(e) => patch(s.id, { target: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                  </label>
                </td>
                <td className="px-3 py-2"><input value={s.number} onChange={(e) => patch(s.id, { number: e.target.value })} placeholder="번호" className="w-14 rounded border border-slate-200 px-1.5 py-1 text-sm focus:border-rose-500 focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder="이름" className="w-full max-w-[200px] rounded border border-slate-200 px-1.5 py-1 text-sm focus:border-rose-500 focus:outline-none" /></td>
                <td className="px-3 py-2"><button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {targets.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="mb-1.5 text-xs font-semibold text-rose-700 flex items-center gap-1.5"><Flag size={13} /> 최소성취 대상 학생 ({targets.length}명)</div>
          <div className="flex flex-wrap gap-1.5">
            {targets.slice().sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)).map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700">
                {s.number && <span className="font-semibold">{s.number}</span>}{s.name || "(이름 미입력)"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   메인 (탭 전환)
   ============================================================ */
const IS_DIST = import.meta.env.VITE_DIST === "1"; // 배포용 빌드 표시(키 미포함)
const KEY_STORE = "saenggibu_gemini_key";
const MODEL_STORE = "saenggibu_gemini_model";
const GUIDE_STORE = "saenggibu_guidelines";
const GUIDE_ON_STORE = "saenggibu_guidelines_on";
const readStoredKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } };
const readStoredModel = () => { try { return localStorage.getItem(MODEL_STORE) || AI_CONFIG.gemini.model; } catch { return AI_CONFIG.gemini.model; } };
const readStoredGuide = () => { try { return localStorage.getItem(GUIDE_STORE) || GUIDELINES_DEFAULT; } catch { return GUIDELINES_DEFAULT; } };
const readGuideOn = () => { try { return localStorage.getItem(GUIDE_ON_STORE) !== "0"; } catch { return true; } };

export default function App() {
  const [mainTab, setMainTab] = useState("behavior");
  const [byteMode, setByteMode] = useState(3);
  const [apiKeyOverride, setApiKeyOverride] = useState(readStoredKey);
  const [rememberKey, setRememberKey] = useState(() => !!readStoredKey());
  const [showKey, setShowKey] = useState(() => IS_DIST && !readStoredKey());
  const [model, setModel] = useState(readStoredModel);

  // 생기부 작성요령(기본 숨김 · 원하면 열어서 확인/편집)
  const [guidelines, setGuidelines] = useState(readStoredGuide);
  const [useGuidelines, setUseGuidelines] = useState(readGuideOn);
  const [showGuide, setShowGuide] = useState(false);

  // 키를 이 브라우저에 저장(선택). 끄면 저장본을 지우고 새로고침 시 사라짐.
  useEffect(() => {
    try {
      if (rememberKey && apiKeyOverride) localStorage.setItem(KEY_STORE, apiKeyOverride);
      else localStorage.removeItem(KEY_STORE);
    } catch {}
  }, [apiKeyOverride, rememberKey]);

  // 모델 저장(빈 값이면 기본값 사용)
  useEffect(() => { try { localStorage.setItem(MODEL_STORE, model || AI_CONFIG.gemini.model); } catch {} }, [model]);

  // 작성요령·사용여부 저장
  useEffect(() => { try { localStorage.setItem(GUIDE_STORE, guidelines); } catch {} }, [guidelines]);
  useEffect(() => { try { localStorage.setItem(GUIDE_ON_STORE, useGuidelines ? "1" : "0"); } catch {} }, [useGuidelines]);

  const activeGuidelines = useGuidelines ? guidelines : "";

  const keyConfigured = (() => {
    const k = apiKeyOverride || AI_CONFIG.gemini.apiKey;
    return k && k !== "YOUR_GEMINI_API_KEY";
  })();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* 헤더 */}
        <header className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><FileSpreadsheet size={18} /></div>
          <div>
            <h1 className="text-lg font-bold leading-tight">생기부 문장 생성기</h1>
            <p className="text-xs text-slate-500">행동특성 · 세부능력 및 특기사항 · 글자수(바이트) 관리</p>
          </div>
          {IS_DIST && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <KeyRound size={12} /> 배포용 · 키 직접 입력
            </span>
          )}
        </header>

        {/* 상단 주의 박스 */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <div>
            입력한 내용은 <b>별도 서버에 저장되지 않아요.</b> 이 브라우저 안에서 처리되고 문장 생성을 위해 AI(구글)로만 전송되니, 자료가 유출될 일은 <b>생기지 않습니다.</b>
            <span className="mt-0.5 block text-xs text-emerald-600">다만 작성에 꼭 필요한 관찰 내용만 넣고, 주민번호·연락처 등 민감정보는 입력하지 마세요.</span>
          </div>
        </div>

        {/* 메인 탭 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setMainTab("behavior")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "behavior" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"}`}>
            <ClipboardList size={16} /> 행동특성
          </button>
          <button onClick={() => setMainTab("subject")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "subject" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"}`}>
            <BookOpen size={16} /> 세부능력 및 특기사항
          </button>
          <button onClick={() => setMainTab("creative")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "creative" ? "bg-purple-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-purple-300"}`}>
            <Compass size={16} /> 창의적 체험활동
          </button>
          <button onClick={() => setMainTab("minach")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "minach" ? "bg-rose-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-rose-300"}`}>
            <Flag size={16} /> 최소성취 대상
          </button>
        </div>

        {/* 키 미설정 안내 */}
        {!keyConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <KeyRound size={16} className="mt-0.5 shrink-0" />
            <div>
              <b>시작하려면 본인 Gemini API 키를 입력하세요.</b>{" "}
              <button onClick={() => setShowKey(true)} className="font-medium underline">키 입력 열기</button>
              {!IS_DIST && <> · 또는 코드 상단 <code className="rounded bg-amber-100 px-1">AI_CONFIG.gemini.apiKey</code>에 넣기</>}
              <span className="mt-0.5 block text-xs text-amber-600">키 발급: aistudio.google.com/apikey · 입력한 키는 구글에만 전송되며 별도 서버에 저장되지 않습니다.</span>
            </div>
          </div>
        )}

        {/* 공통 설정 바: 글자수 기준 + 키 */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">한글 바이트 기준</span>
            <div className="flex overflow-hidden rounded-md border border-slate-300">
              {[2, 3].map((m) => (
                <button key={m} onClick={() => setByteMode(m)} className={`px-2.5 py-1 text-sm ${byteMode === m ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{m}B</button>
              ))}
            </div>
            <span className="text-xs text-slate-400">{byteMode === 3 ? "현재 NEIS 기준" : "옛 기준"}</span>
          </label>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setShowGuide((v) => !v)} className={`inline-flex items-center gap-1 text-xs hover:text-indigo-600 ${useGuidelines ? "text-indigo-600" : "text-slate-500"}`}>
              <BookOpen size={13} /> 작성요령 {useGuidelines ? "(적용 중)" : "(미적용)"}
            </button>
            <button onClick={() => setShowKey((v) => !v)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600"><KeyRound size={13} /> 키 입력</button>
          </div>
          {showGuide && (
            <div className="w-full space-y-2 border-t border-slate-100 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5"><BookOpen size={13} /> 생기부 작성요령 (AI 생성의 기준)</div>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={useGuidelines} onChange={(e) => setUseGuidelines(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  AI 생성 시 이 작성요령을 기준으로 반영
                </label>
              </div>
              <p className="text-xs text-slate-400">기본은 <b>2026학년도 일반 작성 원칙 요약본</b>입니다. 학교/교육청 공식 기재요령 문구로 바꿔 붙여넣으면 그 기준으로 생성됩니다. (평소엔 숨겨져 있어요)</p>
              <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} rows={10}
                className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-indigo-500 focus:outline-none" spellCheck={false} />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setGuidelines(GUIDELINES_DEFAULT)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-400"><RefreshCw size={12} /> 기본값으로 초기화</button>
              </div>
            </div>
          )}
          {showKey && (
            <div className="w-full space-y-2 border-t border-slate-100 pt-2">
              {/* 키 입력 가이드 */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-slate-600">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-indigo-700"><KeyRound size={13} /> Gemini API 키 발급·입력 방법</div>
                <ol className="list-decimal space-y-1 pl-4 leading-relaxed">
                  <li>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-indigo-600 underline hover:text-indigo-700">
                      Google AI Studio 키 발급 페이지 <ExternalLink size={11} />
                    </a>{" "}열기 (구글 계정 로그인)
                  </li>
                  <li><b>Create API key</b>(API 키 만들기) 클릭 → 프로젝트 선택/생성하면 <code className="rounded bg-white px-1">AIza…</code>로 시작하는 키가 만들어집니다.</li>
                  <li>키 오른쪽 <b>복사</b> 버튼을 눌러 복사합니다.</li>
                  <li>아래 칸에 <b>붙여넣기</b>(Ctrl/⌘+V) → 오른쪽에 <span className="text-emerald-600 font-medium">● 사용 가능</span>이 뜨면 완료!</li>
                  <li>같은 브라우저에서 계속 쓰려면 <b>‘이 브라우저에 저장’</b>을 체크하세요(다음에 다시 입력 안 해도 됩니다).</li>
                </ol>
                <p className="mt-1.5 text-[11px] text-slate-400">키는 구글(생성 요청)로만 전송되고 별도 서버에 저장되지 않아요. 무료 등급으로도 충분히 사용할 수 있습니다.</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input type="password" value={apiKeyOverride} onChange={(e) => setApiKeyOverride(e.target.value)} placeholder="여기에 Gemini API 키 붙여넣기 (AIza… 로 시작)" className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
                <span className={`text-xs ${keyConfigured ? "text-emerald-600" : "text-slate-400"}`}>{keyConfigured ? "● 사용 가능" : "○ 미설정"}</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-500" title="끄면 새로고침 시 키가 사라집니다">
                  <input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} className="accent-indigo-600" /> 이 브라우저에 저장
                </label>
                {apiKeyOverride && <button onClick={() => setApiKeyOverride("")} className="text-xs text-slate-400 hover:text-red-500">지우기</button>}
              </div>
              {/* 모델 선택(고급) — 구글이 모델을 바꾸면 여기서 교체 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  모델
                  <select value={GEMINI_MODELS.includes(model) ? model : "__custom__"}
                    onChange={(e) => { const v = e.target.value; setModel(v === "__custom__" ? "" : v); }}
                    className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none">
                    {GEMINI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="__custom__">직접 입력…</option>
                  </select>
                </label>
                {!GEMINI_MODELS.includes(model) && (
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="모델명 직접 입력 (예: gemini-2.5-flash)"
                    className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                )}
                {model !== AI_CONFIG.gemini.model && (
                  <button onClick={() => setModel(AI_CONFIG.gemini.model)} className="text-xs text-slate-400 hover:text-indigo-600">기본값({AI_CONFIG.gemini.model})</button>
                )}
                <span className="text-[11px] text-slate-400">‘모델을 쓸 수 없다’는 404가 나면 목록에서 다른 모델로 바꿔 보세요.</span>
              </div>
            </div>
          )}
        </div>

        {/* 탭 본문 (둘 다 마운트 유지 → 전환해도 입력 보존) */}
        <div className={mainTab === "behavior" ? "" : "hidden"}>
          <BehaviorTab byteMode={byteMode} apiKeyOverride={apiKeyOverride} keyConfigured={keyConfigured} guidelines={activeGuidelines} model={model} />
        </div>
        <div className={mainTab === "subject" ? "" : "hidden"}>
          <SubjectTab byteMode={byteMode} apiKeyOverride={apiKeyOverride} keyConfigured={keyConfigured} guidelines={activeGuidelines} model={model} />
        </div>
        <div className={mainTab === "creative" ? "" : "hidden"}>
          <ActivityTab byteMode={byteMode} apiKeyOverride={apiKeyOverride} keyConfigured={keyConfigured} guidelines={activeGuidelines} model={model} />
        </div>
        <div className={mainTab === "minach" ? "" : "hidden"}>
          <MinAchievementTab />
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          생성 결과는 초안입니다. 반드시 교사가 검토·수정한 뒤 기록하세요. · 민감한 개인정보는 입력하지 마세요.
        </footer>
      </div>
    </div>
  );
}
