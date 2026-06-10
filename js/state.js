// ══════════════════════════════════════════════
//  state.js  —  전역 상태 관리 + 순수 계산 함수
//  DB 호출이나 DOM 조작 없이 순수하게 데이터만 다룹니다.
// ══════════════════════════════════════════════

// ── 앱 전역 상태 ──────────────────────────────
let DB_URL = '';
let demoMode = false;
let pollTimer = null;
let currentMode = 'member';
let auth = null;
let currentUser = null;
let currentMemberId = null;

// 편집 상태
let editingMemberId = null;
let editingNoticeId = null;
let editingTalkId = null;

// Firebase 데이터 캐시
const state = {
  members: {},
  assignments: {},
  submissions: {},
  notices: {},
  chats: {}
};

// ── 정렬된 배열 접근자 ────────────────────────
const getMembers = () => Object.values(state.members || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
const getAssignments = () => Object.values(state.assignments || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const getSubmissions = () => Object.values(state.submissions || {}).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
const getNotices = () => Object.values(state.notices || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const getChats = () => Object.values(state.chats || {}).filter(c => c && !c.deleted).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

// ── 헬퍼 ──────────────────────────────────────
const memberName = (id) => state.members[id]?.name || '—';
const assignmentTitle = (id) => state.assignments[id]?.title || '—';
const myId = () => currentMemberId || (currentUser && currentUser.uid) || 'guest';
const isAdmin = () => !!(currentUser && String(currentUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase());

/** 로그인 사용자 표시 이름 */
const getDisplayName = () => {
  const u = currentUser, e = String(u?.email || '').trim();
  return String(u?.displayName || '').trim() || (e ? e.split('@')[0] : '사용자');
};

/** 특정 멤버가 특정 과제를 제출했는지 확인 (draft 제외) */
const getSub = (mId, aId) => getSubmissions().find(s => s.memberId === mId && s.assignmentId === aId && s.status !== 'draft');

/** draft 포함 제출 여부 */
const getSubmissionAny = (mId, aId) => getSubmissions().find(s => s.memberId === mId && s.assignmentId === aId);

/** 가장 최근 등록된 과제 */
const latestAssignment = () => { const a = getAssignments(); return a[a.length - 1] || null; };

/** 통계 계산 */
const calc = () => {
  const ms = getMembers(), as = getAssignments(), ss = getSubmissions().filter(s => s.status !== 'draft');
  const totalSlots = ms.length * as.length;
  const totalRate = totalSlots ? Math.round(ss.length / totalSlots * 100) : 0;
  const participated = ms.filter(m => ss.some(s => s.memberId === m.id)).length;
  const participation = ms.length ? Math.round(participated / ms.length * 100) : 0;
  const cur = latestAssignment();
  const weekSubmitted = cur ? ms.filter(m => getSub(m.id, cur.id)).length : 0;
  const weekRate = cur && ms.length ? Math.round(weekSubmitted / ms.length * 100) : 0;
  const missing = cur ? ms.filter(m => !getSub(m.id, cur.id)) : [];
  const myDone = as.filter(a => getSub(myId(), a.id)).length;
  const myRate = as.length ? Math.round(myDone / as.length * 100) : 0;
  return { ms, as, ss, totalRate, participation, cur, weekRate, missing, myDone, myRate };
};

/** 제출 파일을 기존 목록과 병합 */
const mergeFiles = (oldList, newList) => [
  ...(Array.isArray(oldList) ? oldList : []),
  ...(Array.isArray(newList) ? newList : [])
];

/** 대화 글 수정/삭제 권한 확인 */
const canManageTalk = (c) => {
  if (isAdmin()) return true;
  if (!currentUser || !c) return false;
  const le = String(currentUser.email || '').toLowerCase(), lu = String(currentUser.uid || '');
  return (String(c.ownerEmail || c.authorEmail || '').toLowerCase() === le)
    || (String(c.ownerUid || c.uid || '') === lu)
    || (String(c.ownerMemberId || c.memberId || '') === myId());
};

/** 본인 제출 건만 수정/삭제 가능 */
const canManageSubmission = (s) => {
  if (!s) return false;
  if (isAdmin()) return true;
  return String(s.memberId || '') === myId();
};

// ── 데모 모드 로컬 상태 조작 ──────────────────
const setLocal = (path, data) => { const [k, id] = path.split('/'); state[k][id] = data; };
const deleteLocal = (path) => { const [k, id] = path.split('/'); delete state[k][id]; };

// ── 날짜/포맷 유틸 ────────────────────────────
const today = () => new Date(new Date().toDateString());
const fmtDate = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const dueText = (d) => {
  if (!d) return '마감일 미정';
  const x = new Date(d), diff = Math.ceil((x - today()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return '오늘 마감';
  return `${diff}일 남음`;
};
const dueState = (d) => {
  if (!d) return { label: '마감일 미정', diff: null, overdue: false };
  const x = new Date(d), diff = Math.ceil((x - today()) / 86400000);
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, diff, overdue: true };
  if (diff === 0) return { label: 'D-DAY', diff, overdue: false };
  return { label: `D-${diff}`, diff, overdue: false };
};
const rateClass = (n) => n >= 80 ? 'green' : n >= 40 ? 'amber' : 'blue';

// ── HTML 이스케이프 ────────────────────────────
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escAttr = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

// ── 파일명 유틸 ───────────────────────────────
const safeFileName = (n) => String(n || 'file').replace(/[\/:*?"<>|#%{}\^~[\]`]/g, '_');
const parsePracticeFiles = (raw) => {
  if (Array.isArray(raw)) return raw;
  return String(raw || '').split('\n').map(x => x.trim()).filter(Boolean).map((line, i) => {
    const parts = line.split('|');
    const url = (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim();
    const name = (parts.length > 1 ? parts[0].trim() : decodeURIComponent((url.split('/').pop() || `실습파일_${i + 1}`).split('?')[0]));
    return { name: name || `실습파일_${i + 1}`, url };
  });
};

// ── 동기부여 문구 ─────────────────────────────
const rotateMotivationQuote = () => {
  const el = document.getElementById('motivation-quote');
  if (!el) return;
  el.textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '"';
};
