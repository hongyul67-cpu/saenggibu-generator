import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Sparkles, Download, Copy, Check, AlertTriangle, Users, Loader2,
  Table, LayoutGrid, KeyRound, FileSpreadsheet, RefreshCw, X, ListPlus, BookOpen, ClipboardList
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
    model: "gemini-2.5-flash",          // 대안: "gemini-2.0-flash", "gemini-1.5-flash"
  },
};

async function callGemini(prompt, apiKey, model, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens || 1024 },
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
  gemini: (prompt, keyOverride, maxTokens) =>
    callGemini(prompt, keyOverride || AI_CONFIG.gemini.apiKey, AI_CONFIG.gemini.model, maxTokens),
};

async function generateText(prompt, keyOverride, maxTokens) {
  const fn = aiProviders[AI_CONFIG.provider];
  if (!fn) throw new Error(`알 수 없는 provider: ${AI_CONFIG.provider}`);
  return fn(prompt, keyOverride, maxTokens);
}

/* ============================================================
   행특용 데이터 (계열 × 학년)
   ============================================================ */
const TRACK_LABELS = { humanities: "인문계", tech: "특성화고(공업계)", biz: "특성화고(상업계)", meister: "마이스터고" };
const TRACK_ORDER = ["humanities", "tech", "biz", "meister"];
const isVoc = (t) => t !== "humanities";

const COMMON = [
  { group: "학습 태도", items: ["수업 집중도 우수", "과제 성실 수행", "자기주도 학습", "학업 열의", "탐구심"] },
  { group: "생활 태도", items: ["규칙 준수", "출결 성실", "시간 약속 엄수", "바른 언어 사용", "정직함"] },
  { group: "대인 관계", items: ["협동심", "배려심", "리더십", "갈등 조율", "원만한 교우관계"] },
  { group: "인성·태도", items: ["책임감", "예의·인사성", "긍정적 태도", "끈기·인내", "봉사 정신"] },
];
const VOC = [
  { group: "전공·실습", items: ["실습 적극 참여", "안전수칙 준수", "공구·장비 관리", "실습실 정리정돈", "실습 집중도"] },
  { group: "진로·자격", items: ["자격증 취득 노력", "뚜렷한 진로목표", "전공 역량 향상", "직무 관심도"] },
];
const MEISTER = [{ group: "산업체 마인드", items: ["직업윤리 의식", "현장 적응력", "산업체 이해도", "기술 숙련 의지"] }];
const GRADE = {
  1: [{ group: "적응 (1학년)", items: ["학교생활 적응", "새 환경 적응력", "교우관계 형성", "기초 학습습관 형성", "자기관리 시작"] }],
  2: [{ group: "자치·주도 (2학년)", items: ["학급 역할 수행", "동아리 활동 적극", "자치활동 참여", "후배 지도", "주도성 향상"] }],
  3: {
    humanities: [{ group: "진로·진학 (3학년)", items: ["뚜렷한 진학 목표", "수능 준비 성실", "진로 구체화", "면접·자소서 준비", "학업 마무리 충실"] }],
    voc: [{ group: "진로·취업 (3학년)", items: ["취업 의지 확고", "현장실습 성실", "직업의식", "구직 활동 적극", "사회 진출 준비"] }],
  },
};
function getCategories(track, grade) {
  const list = [...COMMON];
  if (isVoc(track)) list.push(...VOC);
  if (track === "meister") list.push(...MEISTER);
  if (grade === 3) list.push(...(isVoc(track) ? GRADE[3].voc : GRADE[3].humanities));
  else list.push(...GRADE[grade]);
  return list;
}
const validItemSet = (track, grade) => new Set(getCategories(track, grade).flatMap((c) => c.items));

/* ============================================================
   세특용 데이터
   ============================================================ */
const ACTIVITY_GENERAL = ["토론", "발표", "탐구활동", "실험", "프로젝트", "보고서 작성", "모둠활동", "자료조사", "독서·서평", "질의응답"];
const ACTIVITY_NCS = ["실습", "직무 수행", "과제 수행", "장비·기기 운용", "도면·문서 작성", "작품·결과물 제작", "안전관리", "품질관리", "협업 실무", "현장 적용"];
const TEACHER_PERSPECTIVES = ["성장·변화 중시", "산출물·기능 숙련도 중심", "진로 연계 부각", "협업 역할 강조", "구체적 사례 중심", "핵심 역량 부각", "자기주도성 강조", "인성·태도 부각"];
const LEVELS = ["주도적", "적극적", "보통", "미흡"];
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
function joinList(arr, etc) {
  const all = [...(arr || [])];
  if (etc && etc.trim()) all.push(etc.trim());
  return all.join(", ");
}

/* ============================================================
   프롬프트 빌더
   ============================================================ */
function buildBehaviorPrompt({ track, grade, checks, memo, byteLimit, byteMode, teacher }) {
  const trackLabel = TRACK_LABELS[track];
  const checkedText = checks.length ? checks.join(", ") : "(선택된 항목 없음)";
  const L = [];
  L.push(`당신은 한국 고등학교 담임교사로서 학교생활기록부의 '행동특성 및 종합의견'을 작성하는 전문가입니다.`);
  L.push(`다음 정보를 바탕으로 한 학생의 행동특성 및 종합의견을 작성하세요.\n`);
  L.push(`[학생 정보]`);
  L.push(`- 계열: ${trackLabel}`);
  L.push(`- 학년: ${grade}학년`);
  L.push(`- 관찰된 특성(체크 항목): ${checkedText}`);
  L.push(`- 교사 관찰 메모: ${memo && memo.trim() ? memo.trim() : "(없음)"}`);
  if (teacher) { L.push(``); L.push(`[작성 방향(교사 관점)]`); L.push(`- ${teacher}`); }
  L.push(``);
  L.push(`[작성 규칙]`);
  L.push(`1. 학교생활기록부 문체: 객관적·관찰 중심, 문장 종결은 '~함','~임','~을 보임' 등 명사형/음슴체로 통일.`);
  L.push(`2. 제3자 관찰 시점. '저는/나는' 1인칭이나 '~했습니다' 경어체는 절대 사용 금지.`);
  L.push(`3. 주어진 정보에만 근거. 제공되지 않은 구체적 수치·대회명·상장 등 거짓 사실은 지어내지 말 것.`);
  L.push(`4. 체크 항목과 메모를 자연스럽게 한 문단으로 엮되, 단순 나열이 아니라 맥락 있게 서술.`);
  if (teacher) L.push(`5. 위 '작성 방향'을 반영하여 서술의 초점을 맞출 것.`);
  L.push(`${teacher ? 6 : 5}. ${trackLabel} ${grade}학년의 발달 단계·진로 맥락에 맞는 어조 사용.`);
  L.push(`${teacher ? 7 : 6}. 분량은 약 ${byteLimit}바이트(한글 기준 약 ${approxChars(byteLimit, byteMode)}자) 이내. 완성된 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(``);
  L.push(`행동특성 및 종합의견:`);
  return L.join("\n");
}

function buildSubjectPrompt({ subject, student, byteMode }) {
  const { name, type, standard, activities, activityEtc, commonActivity, evalMemo, byteLimit } = subject;
  const isNcs = type === "ncs";
  const teacher = joinList(subject.teacherChecks, subject.teacherEtc);
  const acts = joinList(activities, activityEtc);
  const L = [];
  L.push(`당신은 한국 고등학교 ${name ? `'${name}' ` : ""}교과 담당교사로서 학교생활기록부의 '세부능력 및 특기사항'을 작성하는 전문가입니다.`);
  L.push(`다음 정보를 바탕으로 한 학생의 세부능력 및 특기사항을 작성하세요.\n`);
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
  L.push(`4. 참여 수준에 맞춰 톤을 차등할 것: '주도적/적극적'은 능동성과 구체적 기여를 부각, '보통'은 과장 없이 사실 위주로 담백하게, '미흡'은 부정적 낙인 없이 기본적 참여와 성장 가능성 위주로 절제하여 서술.`);
  L.push(`5. 활동 유형과 공통 활동을 배경으로 삼되, 개별 메모로 그 학생만의 모습이 드러나게 함. 비어 있는 정보는 자연스럽게 생략.`);
  if (teacher) L.push(`6. 위 '작성 방향'을 반영하여 서술 초점을 맞출 것.`);
  L.push(`${teacher ? 7 : 6}. 분량은 약 ${byteLimit}바이트(한글 기준 약 ${approxChars(byteLimit, byteMode)}자) 이내. 완성된 세특 문단만 출력하고 머리말·제목·따옴표·번호는 붙이지 말 것.`);
  L.push(``);
  L.push(`세부능력 및 특기사항:`);
  return L.join("\n");
}

/* ============================================================
   공용 헬퍼/팩토리
   ============================================================ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 9);
const maxTokensFor = (byteLimit) => Math.min(8192, Math.max(1024, byteLimit));

const newBehaviorStudent = (name = "", number = "") => ({
  id: uid(), name, number, checks: [], memo: "", result: "", status: "idle", error: null,
});
const newSubStudent = (name = "", number = "") => ({
  id: uid(), name, number, level: "보통", memo: "", result: "", status: "idle", error: null,
});
const newSubject = (name = "") => ({
  id: uid(), name, type: "general", standard: "",
  activities: [], activityEtc: "", commonActivity: "", evalMemo: "",
  teacherChecks: [], teacherEtc: "", byteLimit: 1500,
  students: [newSubStudent()],
});

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

function CheckGroups({ track, grade, checks, onToggle }) {
  const cats = useMemo(() => getCategories(track, grade), [track, grade]);
  const set = useMemo(() => new Set(checks), [checks]);
  return (
    <div className="space-y-3">
      {cats.map((cat) => (
        <div key={cat.group}>
          <div className="text-xs font-semibold text-indigo-700 mb-1.5">{cat.group}</div>
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map((item) => {
              const on = set.has(item);
              return (
                <button key={item} onClick={() => onToggle(item)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-indigo-400"
                  }`}>{item}</button>
              );
            })}
          </div>
        </div>
      ))}
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
function BehaviorTab({ byteMode, apiKeyOverride, keyConfigured }) {
  const [track, setTrack] = useState("tech");
  const [grade, setGrade] = useState(1);
  const [byteLimit, setByteLimit] = useState(1500);
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
      const prompt = buildBehaviorPrompt({ track, grade, checks, memo: s.memo, byteLimit, byteMode, teacher });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(byteLimit));
      patch(id, { result: text, status: "done" });
    } catch (e) { patch(id, { status: "error", error: e.message || "생성 실패" }); }
  };
  const genAll = async () => {
    setBusyAll(true);
    for (const s of ref.current) {
      if (!s.name && s.checks.length === 0 && !s.memo) continue;
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
            const bytes = countBytes(s.result, byteMode), over = bytes > byteLimit;
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">{s.number || i + 1}</div>
                  <input value={s.number} onChange={(e) => patch(s.id, { number: e.target.value })} placeholder="번호" className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                  <input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} placeholder="이름" className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-slate-400">{s.checks.length}개</span>
                    <button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
                <CheckGroups track={track} grade={grade} checks={s.checks}
                  onToggle={(item) => { const has = s.checks.includes(item); patch(s.id, { checks: has ? s.checks.filter((c) => c !== item) : [...s.checks, item] }); }} />
                <textarea value={s.memo} onChange={(e) => patch(s.id, { memo: e.target.value })} placeholder="자유 메모·키워드 (선택)" rows={2} className="mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                <button onClick={() => genOne(s.id)} disabled={s.status === "loading"} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                  {s.status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{s.status === "loading" ? "생성 중…" : s.result ? "다시 생성" : "생성"}
                </button>
                {s.error && <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {s.error}</div>}
                {(s.result || s.status === "loading") && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <textarea value={s.result} onChange={(e) => patch(s.id, { result: e.target.value })} rows={4} placeholder="생성 결과 (직접 수정 가능)"
                      className={`w-full resize-none rounded-md border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none ${over ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-indigo-500"}`} />
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
                    <td className="px-3 py-2"><textarea value={s.result} onChange={(e) => patch(s.id, { result: e.target.value })} rows={3} placeholder={s.status === "loading" ? "생성 중…" : "생성 또는 직접 입력"} className="w-full resize-none rounded border border-slate-200 px-2 py-1.5 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none" /></td>
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
function SubjectStudentRow({ st, idx, byteMode, byteLimit, onChange, onRemove, onGenerate }) {
  const bytes = countBytes(st.result, byteMode), over = bytes > byteLimit;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">{st.number || idx + 1}</div>
        <input value={st.number} onChange={(e) => onChange({ number: e.target.value })} placeholder="번호" className="w-12 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
        <input value={st.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="이름" className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
        <select value={st.level} onChange={(e) => onChange({ level: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none">
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input value={st.memo} onChange={(e) => onChange({ memo: e.target.value })} placeholder="개별 메모·특이사항 (선택)" className="min-w-[140px] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
        <button onClick={onGenerate} disabled={st.status === "loading"} className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
          {st.status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
        <button onClick={onRemove} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
      </div>
      {st.error && <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {st.error}</div>}
      {(st.result || st.status === "loading") && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <textarea value={st.result} onChange={(e) => onChange({ result: e.target.value })} rows={4} placeholder="생성 결과 (직접 수정 가능)"
            className={`w-full resize-none rounded-md border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none ${over ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-teal-500"}`} />
          <div className="mt-2 flex items-center gap-3"><div className="flex-1"><ByteGauge bytes={bytes} limit={byteLimit} /></div><CopyBtn text={st.result} /></div>
        </div>
      )}
    </div>
  );
}

function SubjectTab({ byteMode, apiKeyOverride, keyConfigured }) {
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

  const genStudent = async (sid, stid) => {
    const sub = ref.current.find((s) => s.id === sid); if (!sub) return;
    const st = sub.students.find((x) => x.id === stid); if (!st) return;
    patchStudent(sid, stid, { status: "loading", error: null });
    try {
      const prompt = buildSubjectPrompt({ subject: sub, student: st, byteMode });
      const text = await generateText(prompt, apiKeyOverride, maxTokensFor(sub.byteLimit));
      patchStudent(sid, stid, { result: text, status: "done" });
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
        return { "번호": st.number || i + 1, "이름": st.name || "", "과목": sub.name || `과목${si + 1}`, "참여수준": st.level,
          "세부능력 및 특기사항": st.result || "", [`글자수(${byteMode}B)`]: b, "제한초과": st.result && b > sub.byteLimit ? "O" : "" };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 90 }, { wch: 12 }, { wch: 8 }];
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
            <span className="text-slate-500">제한</span>
            <input type="number" value={active.byteLimit} min={0} step={100} onChange={(e) => patchSubject(active.id, { byteLimit: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none" />
            <span className="text-slate-400 text-xs">바이트</span>
          </label>
        </div>

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
        <button onClick={genAll} disabled={busyAll || !keyConfigured} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {busyAll ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}{busyAll ? "생성 중…" : "이 과목 전체 생성"}
        </button>
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
          <SubjectStudentRow key={st.id} st={st} idx={i} byteMode={byteMode} byteLimit={active.byteLimit}
            onChange={(p) => patchStudent(active.id, st.id, p)} onRemove={() => removeStudent(st.id)} onGenerate={() => genStudent(active.id, st.id)} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   메인 (탭 전환)
   ============================================================ */
export default function App() {
  const [mainTab, setMainTab] = useState("behavior");
  const [byteMode, setByteMode] = useState(3);
  const [apiKeyOverride, setApiKeyOverride] = useState("");
  const [showKey, setShowKey] = useState(false);

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
        </header>

        {/* 메인 탭 */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setMainTab("behavior")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "behavior" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"}`}>
            <ClipboardList size={16} /> 행동특성
          </button>
          <button onClick={() => setMainTab("subject")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${mainTab === "subject" ? "bg-teal-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300"}`}>
            <BookOpen size={16} /> 세부능력 및 특기사항
          </button>
        </div>

        {/* 키 미설정 안내 */}
        {!keyConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <KeyRound size={16} className="mt-0.5 shrink-0" />
            <div><b>API 키가 아직 설정되지 않았어요.</b> 코드 상단 <code className="rounded bg-amber-100 px-1">AI_CONFIG.gemini.apiKey</code>에 키를 넣거나, 아래 <button onClick={() => setShowKey(true)} className="underline">키 직접 입력</button>으로 지금 테스트할 수 있어요.</div>
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
          <button onClick={() => setShowKey((v) => !v)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600"><KeyRound size={13} /> 키 입력</button>
          {showKey && (
            <div className="flex w-full items-center gap-2 border-t border-slate-100 pt-2">
              <input type="password" value={apiKeyOverride} onChange={(e) => setApiKeyOverride(e.target.value)} placeholder="테스트용 Gemini API 키 (이 세션에서만 사용)" className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
              <span className={`text-xs ${keyConfigured ? "text-emerald-600" : "text-slate-400"}`}>{keyConfigured ? "● 사용 가능" : "○ 미설정"}</span>
            </div>
          )}
        </div>

        {/* 탭 본문 (둘 다 마운트 유지 → 전환해도 입력 보존) */}
        <div className={mainTab === "behavior" ? "" : "hidden"}>
          <BehaviorTab byteMode={byteMode} apiKeyOverride={apiKeyOverride} keyConfigured={keyConfigured} />
        </div>
        <div className={mainTab === "subject" ? "" : "hidden"}>
          <SubjectTab byteMode={byteMode} apiKeyOverride={apiKeyOverride} keyConfigured={keyConfigured} />
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          생성 결과는 초안입니다. 반드시 교사가 검토·수정한 뒤 기록하세요. · 민감한 개인정보는 입력하지 마세요.
        </footer>
      </div>
    </div>
  );
}
