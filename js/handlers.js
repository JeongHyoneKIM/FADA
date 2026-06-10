// ══════════════════════════════════════════════
//  handlers.js  —  사용자 이벤트 핸들러
//  버튼 클릭, 폼 제출, 모드 전환 등 모든 인터랙션을 처리합니다.
// ══════════════════════════════════════════════

// ── 페이지 네비게이션 ─────────────────────────
document.querySelectorAll('.nav-item').forEach(btn =>
  btn.addEventListener('click', () => showPage(btn.dataset.page))
);

document.getElementById('mode-member').onclick = () => {
  currentMode = 'member'; applyMode(); showPage('dashboard');
};
document.getElementById('mode-admin').onclick = () => {
  if (!isAdmin()) { toast('운영진 계정만 사용할 수 있습니다', 'error'); return; }
  currentMode = 'admin'; applyMode(); showPage('admin');
};

// ── Firebase URL 설정 ─────────────────────────
document.getElementById('btn-reset-url').onclick = () => {
  localStorage.removeItem('study_dashboard_firebase_url');
  const f = normalizedFixedUrl();
  DB_URL = f; demoMode = false; clearInterval(pollTimer);
  if (f) { hideSetup(); startPolling(); toast('고정 Firebase URL로 재연결', 'info'); }
  else { showSetup(); setConn(false); }
};

document.getElementById('btn-connect').onclick = async () => {
  let u = document.getElementById('fb-url-input').value.trim();
  if (!u) { document.getElementById('setup-error').textContent = 'URL을 입력해주세요.'; return; }
  if (!u.endsWith('/')) u += '/';
  try {
    DB_URL = u;
    await fbGet('');
    localStorage.setItem('study_dashboard_firebase_url', u);
    demoMode = false; hideSetup(); startPolling(); toast('Firebase 연결 성공', 'success');
  } catch (e) { document.getElementById('setup-error').textContent = '연결 실패: ' + e.message; }
};

document.getElementById('btn-demo').onclick = () => {
  Object.assign(state, JSON.parse(JSON.stringify(SAMPLE_DATA)));
  demoMode = true; hideSetup(); ensureMe(); renderAll(); setConn(true);
  document.getElementById('conn-text').textContent = '샘플 데이터';
  toast('샘플 데이터로 실행합니다', 'success');
};

// ── 오버레이 제어 ─────────────────────────────
const hideSetup = () => document.getElementById('setup-overlay').style.display = 'none';
const showSetup = () => document.getElementById('setup-overlay').style.display = 'flex';
const showAuthOverlay = () => document.getElementById('auth-overlay').style.display = 'flex';
const hideAuthOverlay = () => document.getElementById('auth-overlay').style.display = 'none';

// ── 과제 등록 ─────────────────────────────────
document.getElementById('btn-add-assignment').onclick = async () => {
  const title = document.getElementById('a-title').value.trim();
  if (!title) { toast('과제명을 입력해주세요', 'error'); return; }
  const id = 'a_' + Date.now(), week = document.getElementById('a-week').value.trim(), meta = { assignmentId: id, week };
  let guideUrl = document.getElementById('a-guide-url').value.trim();
  let guideName = document.getElementById('a-guide-name').value.trim();
  let practiceText = document.getElementById('a-practice-files').value.trim();
  try {
    document.getElementById('btn-add-assignment').disabled = true;
    document.getElementById('btn-add-assignment').textContent = '업로드 중...';
    const gf = document.getElementById('a-guide-file').files[0];
    if (gf) { const u = await uploadOneFile(gf, 'assignment-guide', meta); guideUrl = u.url; guideName = guideName || u.name; }
    const pu = await uploadFileList(document.getElementById('a-practice-upload-files').files, 'assignment-practice', meta);
    if (pu.length) { const ul = pu.map(f => `${f.name}|${f.url}`).join('\n'); practiceText = [practiceText, ul].filter(Boolean).join('\n'); }
    await fbSet('assignments/' + id, {
      id, title, week, tool: document.getElementById('a-tool').value.trim(),
      due: document.getElementById('a-due').value, desc: document.getElementById('a-desc').value.trim(),
      guideUrl, guideName, practiceFiles: practiceText, createdAt: Date.now()
    });
    ['a-title', 'a-week', 'a-tool', 'a-due', 'a-desc', 'a-guide-url', 'a-guide-name', 'a-practice-files', 'a-guide-file', 'a-practice-upload-files']
      .forEach(i => document.getElementById(i).value = '');
    toast('과제가 추가되었습니다', 'success'); poll();
  } catch (e) { toast(e.message || '과제 등록 중 오류', 'error'); }
  finally {
    document.getElementById('btn-add-assignment').disabled = false;
    document.getElementById('btn-add-assignment').textContent = '+ 과제 추가';
  }
};

const deleteAssignment = async (id) => {
  if (!confirm('과제와 관련 제출 내역을 삭제할까요?')) return;
  await fbDelete('assignments/' + id);
  for (const s of getSubmissions().filter(s => s.assignmentId === id)) await fbDelete('submissions/' + s.id);
  toast('과제가 삭제되었습니다', 'info'); poll();
};

// ── 과제 제출 ─────────────────────────────────
document.getElementById('submit-assignment').addEventListener('change', renderAssignmentDetail);

document.getElementById('btn-save-submission').onclick = async () => {
  const aId = document.getElementById('submit-assignment').value, mId = myId();
  if (!aId || !mId) { toast('과제와 로그인 사용자를 확인해주세요', 'error'); return; }

  // 수정 모드인지 확인
  const editingId = document.getElementById('btn-save-submission').dataset.editingId;
  const old = editingId ? state.submissions[editingId] : getSubmissionAny(mId, aId);
  const id = old ? old.id : 's_' + Date.now();
  try {
    document.getElementById('btn-save-submission').disabled = true;
    document.getElementById('btn-save-submission').textContent = '업로드 중...';
    const files = await uploadFileList(document.getElementById('submit-files').files, 'submission-file', { assignmentId: aId, memberId: mId });
    const images = await uploadFileList(document.getElementById('submit-images').files, 'submission-image', { assignmentId: aId, memberId: mId });

    // 수정 모드일 때 기존 파일 유지 여부 결정
    const keepOldFiles = document.getElementById('keep-old-files')?.checked !== false;
    const finalFiles = (keepOldFiles && old) ? mergeFiles(old.files, files) : files;
    const finalImages = (keepOldFiles && old) ? mergeFiles(old.images, images) : images;

    await fbSet('submissions/' + id, {
      id, assignmentId: aId, memberId: mId,
      status: document.getElementById('submit-status').value,
      githubUrl: document.getElementById('submit-github').value.trim(),
      memo: document.getElementById('submit-memo').value.trim(),
      files: finalFiles, images: finalImages,
      submittedAt: Date.now()
    });
    toast(editingId ? '제출물이 수정되었습니다' : '제출 파일이 Storage에 업로드되고 저장되었습니다', 'success');
    clearSubmitForm(); poll(); showPage('my');
  } catch (e) { toast(e.message || '제출 저장 중 오류', 'error'); }
  finally {
    document.getElementById('btn-save-submission').disabled = false;
    document.getElementById('btn-save-submission').textContent = document.getElementById('btn-save-submission').dataset.editingId ? '수정 저장' : '제출하기';
  }
};

document.getElementById('btn-clear-submit').onclick = () => { clearSubmitForm(); toast('입력값을 초기화했습니다', 'info'); };

/** 제출 폼 초기화 */
const clearSubmitForm = () => {
  ['submit-github', 'submit-memo', 'submit-files', 'submit-images'].forEach(i => document.getElementById(i).value = '');
  const btn = document.getElementById('btn-save-submission');
  delete btn.dataset.editingId;
  btn.textContent = '제출하기';
  const cancelBtn = document.getElementById('btn-cancel-edit-submission');
  if (cancelBtn) cancelBtn.style.display = 'none';
  // 수정 안내 배너 제거
  document.getElementById('submit-edit-banner')?.remove();
};

/** 본인 제출 수정 시작 — 제출 페이지로 이동하고 기존 데이터 채움 */
const startEditSubmission = (id) => {
  const s = state.submissions[id];
  if (!s) return;
  if (!canManageSubmission(s)) { toast('본인이 제출한 내역만 수정할 수 있습니다', 'error'); return; }
  showPage('submit');
  setTimeout(() => {
    document.getElementById('submit-assignment').value = s.assignmentId;
    renderAssignmentDetail();
    document.getElementById('submit-status').value = s.status || 'submitted';
    document.getElementById('submit-github').value = s.githubUrl || '';
    document.getElementById('submit-memo').value = s.memo || '';

    // 수정 모드 표시
    const btn = document.getElementById('btn-save-submission');
    btn.dataset.editingId = id;
    btn.textContent = '수정 저장';

    // 수정 중 안내 배너 추가
    const existing = document.getElementById('submit-edit-banner');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'submit-edit-banner';
      banner.style.cssText = 'padding:10px 14px;border-radius:14px;background:var(--blue-bg);color:var(--blue);font-size:13px;font-weight:700;margin-bottom:12px';
      banner.innerHTML = `✏️ 기존 제출물을 수정 중입니다. 새 파일을 업로드하면 기존 파일에 추가됩니다. 
        <button id="btn-cancel-edit-submission" class="btn btn-sm" style="margin-left:10px">수정 취소</button>`;
      document.getElementById('btn-save-submission').parentElement.insertBefore(banner, document.getElementById('btn-save-submission'));
      document.getElementById('btn-cancel-edit-submission').onclick = () => { clearSubmitForm(); toast('수정을 취소했습니다', 'info'); };
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 0);
};

/** 제출 삭제 (본인 또는 운영진) */
const deleteSubmission = async (id) => {
  const s = state.submissions[id];
  if (!canManageSubmission(s)) { toast('본인이 제출한 내역만 삭제할 수 있습니다', 'error'); return; }
  if (!confirm('제출 내역을 삭제할까요?')) return;
  await fbDelete('submissions/' + id);
  toast('제출 내역이 삭제되었습니다', 'info'); poll();
};

const selectAssignmentAndSubmit = (id) => {
  showPage('submit');
  setTimeout(() => {
    document.getElementById('submit-assignment').value = id;
    renderAssignmentDetail();
  }, 0);
};

// ── 멤버 관리 ─────────────────────────────────
document.getElementById('btn-add-member').onclick = async () => {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { toast('이름을 입력해주세요', 'error'); return; }
  const now = Date.now(), id = editingMemberId || 'm_' + now;
  const prev = editingMemberId ? (state.members[editingMemberId] || {}) : {};
  await fbSet('members/' + id, {
    ...prev, id, name,
    email: document.getElementById('m-email').value.trim(),
    department: document.getElementById('m-dept').value.trim(),
    role: document.getElementById('m-role').value,
    joinedAt: prev.joinedAt || now, updatedAt: now
  });
  const was = !!editingMemberId;
  resetMemberForm();
  toast(was ? '멤버 정보가 수정되었습니다' : '멤버가 추가되었습니다', 'success'); poll();
};

document.getElementById('btn-cancel-member-edit').onclick = () => { resetMemberForm(); toast('멤버 수정을 취소했습니다', 'info'); };

const startEditMember = (id) => {
  const m = state.members[id]; if (!m) return;
  editingMemberId = id;
  document.getElementById('m-name').value = m.name || '';
  document.getElementById('m-email').value = m.email || '';
  document.getElementById('m-dept').value = m.department || '';
  document.getElementById('m-role').value = m.role || 'member';
  document.getElementById('member-form-title').textContent = '멤버 정보 수정';
  document.getElementById('btn-add-member').textContent = '수정 저장';
  document.getElementById('btn-cancel-member-edit').style.display = 'inline-flex';
  showPage('members'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

const resetMemberForm = () => {
  editingMemberId = null;
  ['m-name', 'm-email', 'm-dept'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('m-role').value = 'member';
  document.getElementById('member-form-title').textContent = '멤버 추가';
  document.getElementById('btn-add-member').textContent = '+ 멤버 추가';
  document.getElementById('btn-cancel-member-edit').style.display = 'none';
};

const toggleRole = async (id) => {
  const m = state.members[id]; if (!m) return;
  m.role = m.role === 'admin' ? 'member' : 'admin';
  await fbSet('members/' + id, m); toast('권한이 변경되었습니다', 'success'); poll();
};

const deleteMember = async (id) => {
  if (id === myId()) { toast('현재 로그인한 계정은 삭제할 수 없습니다', 'error'); return; }
  if (!confirm('멤버와 제출 내역을 삭제할까요?')) return;
  await fbDelete('members/' + id);
  for (const s of getSubmissions().filter(s => s.memberId === id)) await fbDelete('submissions/' + s.id);
  toast('멤버가 삭제되었습니다', 'info'); poll();
};

// ── 공지사항 ──────────────────────────────────
document.getElementById('btn-add-notice').onclick = async () => {
  const title = document.getElementById('n-title').value.trim();
  if (!title) { toast('공지 제목을 입력해주세요', 'error'); return; }
  const now = Date.now(), id = editingNoticeId || 'n_' + now;
  const prev = editingNoticeId ? (state.notices[editingNoticeId] || {}) : {};
  await fbSet('notices/' + id, { ...prev, id, title, content: document.getElementById('n-content').value.trim(), createdAt: prev.createdAt || now, updatedAt: now });
  const was = !!editingNoticeId; resetNoticeForm();
  toast(was ? '공지사항이 수정되었습니다' : '공지사항이 저장되었습니다', 'success'); poll();
};

document.getElementById('btn-cancel-notice-edit').onclick = () => { resetNoticeForm(); toast('공지 수정을 취소했습니다', 'info'); };

const startEditNotice = (id) => {
  const n = state.notices[id]; if (!n) return;
  editingNoticeId = id;
  document.getElementById('n-title').value = n.title || '';
  document.getElementById('n-content').value = n.content || '';
  document.getElementById('notice-form-title').textContent = '공지 수정';
  document.getElementById('btn-add-notice').textContent = '수정 저장';
  document.getElementById('btn-cancel-notice-edit').style.display = 'inline-flex';
  showPage('notices'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

const resetNoticeForm = () => {
  editingNoticeId = null;
  document.getElementById('n-title').value = '';
  document.getElementById('n-content').value = '';
  document.getElementById('notice-form-title').textContent = '공지 등록';
  document.getElementById('btn-add-notice').textContent = '공지 저장';
  document.getElementById('btn-cancel-notice-edit').style.display = 'none';
};

const deleteNotice = async (id) => {
  await fbDelete('notices/' + id); toast('공지가 삭제되었습니다', 'info'); poll();
};

// ── 대화방 ────────────────────────────────────
document.getElementById('btn-toggle-talk-form').onclick = () => {
  resetTalkForm();
  document.getElementById('talk-write-panel').classList.toggle('show');
};

document.getElementById('btn-cancel-talk').onclick = () => {
  resetTalkForm();
  document.getElementById('talk-write-panel').classList.remove('show');
};

const resetTalkForm = () => {
  editingTalkId = null;
  document.getElementById('talk-title').value = '';
  document.getElementById('talk-content').value = '';
  document.getElementById('talk-category').value = '💡 아이디어';
  document.getElementById('talk-anonymous').checked = false;
  document.getElementById('btn-add-talk').textContent = '등록하기';
};

const startEditTalk = (id) => {
  const c = state.chats[id]; if (!c) return;
  const oe = String(c.ownerEmail || c.authorEmail || '').toLowerCase();
  const mine = currentUser && oe === String(currentUser.email || '').toLowerCase();
  if (!isAdmin() && !mine) { toast('본인이 작성한 글만 수정할 수 있습니다', 'error'); return; }
  editingTalkId = id;
  document.getElementById('talk-category').value = c.category || '💡 아이디어';
  document.getElementById('talk-title').value = c.title || '';
  document.getElementById('talk-content').value = c.content || '';
  document.getElementById('talk-anonymous').checked = !!c.anonymous;
  document.getElementById('btn-add-talk').textContent = '수정 저장';
  document.getElementById('talk-write-panel').classList.add('show');
  showPage('talk'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('btn-add-talk').onclick = async () => {
  const title = document.getElementById('talk-title').value.trim(), content = document.getElementById('talk-content').value.trim();
  if (!title) { toast('제목을 입력해주세요', 'error'); return; }
  if (!content) { toast('내용을 입력해주세요', 'error'); return; }
  const now = Date.now(), id = editingTalkId || 'c_' + now;
  const prev = editingTalkId ? (state.chats[editingTalkId] || {}) : {};
  const oe = prev.ownerEmail || prev.authorEmail || (currentUser?.email || '');
  const ou = prev.ownerUid || prev.uid || (currentUser?.uid || '');
  const om = prev.ownerMemberId || prev.memberId || myId();
  const anon = document.getElementById('talk-anonymous').checked;
  await fbSet('chats/' + id, {
    ...prev, id, category: document.getElementById('talk-category').value, title, content,
    anonymous: anon, authorName: anon ? '익명' : (currentUser?.displayName || prev.authorName || '멤버'),
    authorEmail: anon ? '' : (currentUser?.email || prev.authorEmail || ''),
    ownerEmail: oe, ownerUid: ou, memberId: anon ? '' : om, ownerMemberId: om,
    createdAt: prev.createdAt || now, updatedAt: now
  });
  const was = !!editingTalkId;
  resetTalkForm(); document.getElementById('talk-write-panel').classList.remove('show');
  toast(was ? '글이 수정되었습니다' : '글이 등록되었습니다', 'success'); poll();
};

const deleteTalk = async (id) => {
  const key = String(id || '').trim(), c = state.chats && state.chats[key];
  if (!key || !c) { toast('삭제할 글을 찾을 수 없습니다', 'error'); return; }
  if (!canManageTalk(c)) { toast('본인이 작성한 글만 삭제할 수 있습니다', 'error'); return; }
  if (!confirm('이 글을 삭제할까요?')) return;
  try { await fbDelete('chats/' + key); }
  catch (e1) {
    try { const p = {}; p['chats/' + key] = null; await fbPatch('', p); }
    catch (e2) { toast('삭제 실패', 'error'); return; }
  }
  if (state.chats) delete state.chats[key];
  renderTalk(); toast('글이 삭제되었습니다', 'info'); poll();
};

// ── 대화방 이벤트 위임 ────────────────────────
const bindTalkEvents = () => {
  const el = document.getElementById('talk-list');
  if (!el || el.dataset.bound === '1') return;
  el.dataset.bound = '1';
  el.addEventListener('click', e => {
    const d = e.target.closest('[data-delete-talk-id]');
    if (d) { e.preventDefault(); e.stopPropagation(); deleteTalk(d.getAttribute('data-delete-talk-id')); return; }
    const ed = e.target.closest('[data-edit-talk-id]');
    if (ed) { e.preventDefault(); e.stopPropagation(); startEditTalk(ed.getAttribute('data-edit-talk-id')); }
  });
};
bindTalkEvents();

// ── Google 로그인/로그아웃 ────────────────────
document.getElementById('btn-google-login').onclick = async () => {
  if (!auth) { toast('Firebase 설정값을 확인해주세요', 'error'); return; }
  const p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try { await auth.signInWithPopup(p); }
  catch (e) {
    const c = e && e.code ? String(e.code) : '';
    if (c.includes('popup')) {
      try { await auth.signInWithRedirect(p); }
      catch (err) { toast((err && err.message) || 'Google 로그인 실패', 'error'); }
    } else { toast((e && e.message) || 'Google 로그인 실패', 'error'); }
  }
};

document.getElementById('btn-logout').onclick = async () => {
  try { if (auth) await auth.signOut(); } catch (e) { }
  currentUser = null; currentMemberId = null;
  updateLoginProfile(); showAuthOverlay();
};

// ── 초기화 ────────────────────────────────────
initGoogleAuth();

if (window.firebase && firebase.apps && firebase.apps.length && firebase.auth) {
  firebase.auth().getRedirectResult().catch(e => { if (e && e.message) toast(e.message, 'error'); });
}

rotateMotivationQuote();
setInterval(rotateMotivationQuote, 120000);
