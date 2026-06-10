// ══════════════════════════════════════════════
//  firebase.js  —  Firebase 연동 (DB · Auth · Storage)
//  모든 네트워크 요청이 이 파일을 통해 이루어집니다.
// ══════════════════════════════════════════════

// ── 인증 토큰 ─────────────────────────────────
const getAuthToken = async () => currentUser ? await currentUser.getIdToken() : '';
const withAuthUrl = async (url) => {
  const token = await getAuthToken();
  return token ? url + (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(token) : url;
};

// ── Realtime Database REST API ────────────────
const fbGet = async (path = '') => {
  const res = await fetch(await withAuthUrl(DB_URL + path + '.json'));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

const fbSet = async (path, data) => {
  if (demoMode) { setLocal(path, data); renderAll(); return data; }
  const res = await fetch(await withAuthUrl(DB_URL + path + '.json'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

const fbDelete = async (path) => {
  if (demoMode) { deleteLocal(path); renderAll(); return; }
  const res = await fetch(await withAuthUrl(DB_URL + path + '.json'), { method: 'DELETE' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
};

const fbPatch = async (path, data) => {
  if (demoMode) {
    Object.entries(data || {}).forEach(([k, v]) => { if (v === null) deleteLocal(k); else setLocal(k, v); });
    renderAll(); return data;
  }
  const res = await fetch(await withAuthUrl(DB_URL + path + '.json'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

// ── Firebase Storage ──────────────────────────
const storagePath = (type, fileName, meta = {}) => {
  const week = safeFileName(meta.week || 'common');
  const aId = safeFileName(meta.assignmentId || 'unassigned');
  const mId = safeFileName(meta.memberId || 'unknown');
  const stamp = Date.now();
  if (type === 'assignment-guide')    return `assignments/${week}/${aId}/guide/${stamp}_${safeFileName(fileName)}`;
  if (type === 'assignment-practice') return `assignments/${week}/${aId}/practice/${stamp}_${safeFileName(fileName)}`;
  if (type === 'submission-image')    return `submissions/${aId}/${mId}/images/${stamp}_${safeFileName(fileName)}`;
  return `submissions/${aId}/${mId}/files/${stamp}_${safeFileName(fileName)}`;
};

const publicStorageUrl = (path) =>
  `https://firebasestorage.googleapis.com/v0/b/${FIXED_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;

const uploadOneFile = async (file, type, meta = {}) => {
  if (!file) return null;
  const path = storagePath(type, file.name, meta);
  const url = `https://firebasestorage.googleapis.com/v0/b/${FIXED_FIREBASE_STORAGE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const token = await getAuthToken();
  const headers = { 'Content-Type': file.type || 'application/octet-stream' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { method: 'POST', headers, body: file });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Storage 업로드 실패: ${file.name} (${res.status}) ${msg}`);
  }
  return { name: file.name, url: publicStorageUrl(path), path, size: file.size, type: file.type || 'application/octet-stream', uploadedAt: Date.now() };
};

const uploadFileList = async (fileList, type, meta = {}) => {
  const files = Array.from(fileList || []);
  const results = [];
  for (const f of files) results.push(await uploadOneFile(f, type, meta));
  return results.filter(Boolean);
};

// ── 강제 다운로드 (CORS 우회 포함) ───────────
const forceDownload = async (url, filename) => {
  if (!url || url === '#') { toast('다운로드 URL이 없습니다', 'error'); return; }
  const name = filename ||
    decodeURIComponent((url.split('/').pop() || 'file').split('?')[0]).replace(/^\d+_/, '');
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    toast('다운로드 시작: ' + name, 'success');
  } catch (e) {
    window.open(url, '_blank');
    toast('자동 다운로드 실패. 열린 페이지에서 우클릭 → 다른 이름으로 저장하세요.', 'info');
  }
};

// ── 폴링 ──────────────────────────────────────
const poll = async () => {
  if (demoMode) return;
  try {
    const data = await fbGet('');
    ['members', 'assignments', 'submissions', 'notices', 'chats'].forEach(k =>
      state[k] = (data && data[k]) ? data[k] : {}
    );
    ensureMe();
    renderAll();
    setConn(true);
  } catch (e) { setConn(false); }
};

const startPolling = () => { clearInterval(pollTimer); poll(); pollTimer = setInterval(poll, 3000); };

// ── 자동 멤버 등록 ────────────────────────────
const ensureMe = () => {
  if (!currentUser) return;
  const email = String(currentUser.email || '').trim();
  const emailLower = email.toLowerCase();
  const admin = emailLower === ADMIN_EMAIL.toLowerCase();
  const existing = Object.values(state.members || {}).find(m => String(m.email || '').trim().toLowerCase() === emailLower);
  const id = existing?.id || currentUser.uid;
  currentMemberId = id;
  const next = {
    ...(existing || {}), id,
    name: currentUser.displayName || existing?.name || (email ? email.split('@')[0] : '사용자'),
    email,
    department: existing?.department || '',
    role: admin ? 'admin' : 'member',
    photoURL: currentUser.photoURL || existing?.photoURL || '',
    joinedAt: existing?.joinedAt || Date.now(),
    lastLoginAt: Date.now()
  };
  state.members[id] = next;
  if (DB_URL && !demoMode) fbSet('members/' + id, next).catch(e => console.warn('자동 멤버 저장 실패:', e));
};

// ── 연결 상태 표시 ────────────────────────────
const setConn = (v) => {
  document.getElementById('conn-dot').className = 'dot' + (v ? ' online' : '');
  document.getElementById('conn-text').textContent = v ? 'Firebase 연결됨' : '연결 끊김';
};

// ── 연결 초기화 ───────────────────────────────
const normalizedFixedUrl = () => {
  const u = (FIXED_FIREBASE_DATABASE_URL || '').trim();
  if (!u || u.includes('PASTE_')) return '';
  return u.endsWith('/') ? u : u + '/';
};

const isFirebaseConfigReady = () =>
  FIREBASE_WEB_CONFIG.apiKey && !FIREBASE_WEB_CONFIG.apiKey.includes('PASTE_');

// ── Firebase Auth 초기화 ──────────────────────
const initGoogleAuth = () => {
  if (!isFirebaseConfigReady()) {
    document.getElementById('auth-config-warning')?.classList.add('show');
    return;
  }
  firebase.initializeApp(FIREBASE_WEB_CONFIG);
  auth = firebase.auth();
  auth.onAuthStateChanged(u => {
    if (u) startAppAfterLogin(u);
    else {
      currentUser = null;
      currentMemberId = null;
      updateLoginProfile();
      showAuthOverlay();
    }
  });
};

const startAppAfterLogin = async (user) => {
  currentUser = user;
  currentMemberId = user.uid;
  updateLoginProfile();
  hideAuthOverlay();
  currentMode = isAdmin() ? 'admin' : 'member';
  const f = normalizedFixedUrl();
  const saved = localStorage.getItem('study_dashboard_firebase_url');
  if (f) {
    DB_URL = f;
    document.getElementById('fb-url-input').value = f;
    localStorage.setItem('study_dashboard_firebase_url', f);
    hideSetup();
    startPolling();
  } else if (saved) {
    DB_URL = saved;
    document.getElementById('fb-url-input').value = saved;
    hideSetup();
    startPolling();
  } else {
    showSetup();
  }
  applyMode();
};
