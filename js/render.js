// ══════════════════════════════════════════════
//  render.js  —  화면 렌더링 함수 모음
//  DOM 조작만 담당합니다. 데이터 변경은 handlers.js에서.
// ══════════════════════════════════════════════

// ── 토스트 알림 ───────────────────────────────
const toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 2300);
};

// ── 다운로드 버튼 HTML ────────────────────────
/** 모든 로그인 사용자가 접근 가능한 다운로드 버튼 */
const downloadLinks = (items) => {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return '—';
  return arr.map(f => {
    const su = escAttr(f.url || ''), sn = escAttr(f.name || '다운로드');
    return `<button class="btn btn-sm" onclick="forceDownload('${su}','${sn}')">${esc(f.name || '다운로드')}</button>`;
  }).join(' ');
};

/** 과제 안내 + 실습파일 리소스 렌더링 */
const renderAssignmentResources = (a) => {
  const guideName = a.guideName || ((a.guideUrl || '').split('/').pop() || '과제 안내 HTML');
  const files = parsePracticeFiles(a.practiceFiles);
  const guide = a.guideUrl
    ? `<div class="resource-box">
        <div class="resource-title">📄 과제 안내 HTML</div>
        <div class="resource-item">
          <div>
            <div class="resource-name">${esc(guideName)}</div>
            <div class="link-muted">${esc(a.guideUrl)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <a class="btn btn-sm" href="${esc(a.guideUrl)}" target="_blank" rel="noopener">열기</a>
            <button class="btn btn-sm" onclick="forceDownload('${escAttr(a.guideUrl)}','${escAttr(guideName)}')">다운로드</button>
          </div>
        </div>
      </div>` : '';
  const practice = files.length
    ? `<div class="resource-box">
        <div class="resource-title">📦 실습파일</div>
        <div class="resource-list">
          ${files.map(f => `
            <div class="resource-item">
              <div>
                <div class="resource-name">${esc(f.name)}</div>
                <div class="link-muted">${esc(f.url)}</div>
              </div>
              <div style="flex-shrink:0">
                <button class="btn btn-sm" onclick="forceDownload('${escAttr(f.url)}','${escAttr(f.name)}')">다운로드</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';
  return guide + practice;
};

// ── 로그인 프로필 ─────────────────────────────
const updateLoginProfile = () => {
  const u = currentUser, e = String(u?.email || '').trim();
  const n = String(u?.displayName || '').trim() || (e ? e.split('@')[0] : '사용자');
  const pn = document.querySelector('.profile-name');
  const pm = document.querySelector('.profile-mail');
  const av = document.querySelector('.avatar');
  if (pn) pn.textContent = u ? n : '로그인 정보 확인 중';
  if (pm) pm.textContent = u ? e : 'Google 계정 연동 전';
  if (av) {
    if (u?.photoURL) {
      av.style.backgroundImage = `url(${u.photoURL})`;
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
      av.textContent = '';
    } else {
      av.style.backgroundImage = '';
      av.textContent = (n || e || 'U').slice(0, 1).toUpperCase();
    }
  }
  const dp = document.getElementById('page-dashboard');
  if (dp?.classList.contains('active')) {
    const pt = document.getElementById('page-title');
    if (pt) pt.textContent = `안녕하세요, ${getDisplayName()}님! 🎈`;
  }
  const rp = document.getElementById('sidebar-role-pill');
  if (rp) rp.textContent = u ? (isAdmin() ? '운영진 · 참여자 겸용' : '참여자') : '계정 확인 중';
};

// ── 페이지 전환 ───────────────────────────────
const applyMode = () => {
  if (currentMode === 'admin' && !isAdmin()) currentMode = 'member';
  document.body.classList.toggle('member-mode', currentMode === 'member');
  document.body.classList.toggle('admin-mode', currentMode === 'admin');
  document.getElementById('mode-member').classList.toggle('active', currentMode === 'member');
  document.getElementById('mode-admin').classList.toggle('active', currentMode === 'admin');
  document.getElementById('mode-admin').style.display = isAdmin() ? '' : 'none';
  if (currentMode === 'member') {
    const ap = ['admin', 'members'].some(p => document.getElementById('page-' + p)?.classList.contains('active'));
    if (ap) showPage('dashboard');
  }
};

const showPage = (page) => {
  if ((currentMode === 'member' || !isAdmin()) && ['admin', 'members'].includes(page)) {
    toast('운영진 계정만 접근할 수 있습니다.', 'info');
    page = 'dashboard';
  }
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const titles = {
    dashboard: [`안녕하세요, ${getDisplayName()}님! 🎈`, ''],
    assignments: ['주차별 과제 목록', ''],
    submit: ['과제 상세 및 제출', ''],
    my: ['나의 제출 현황', ''],
    submissions: ['전체 제출 현황', '모든 멤버의 제출물을 확인하고 파일을 다운받을 수 있습니다.'],
    admin: ['운영진 관리 대시보드', ''],
    members: ['멤버 관리', ''],
    notices: ['공지사항', ''],
    talk: ['대화방', '']
  };
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-subtitle').textContent = titles[page][1];
  applyMode();
};

// ── 전체 렌더 ─────────────────────────────────
const renderAll = () => {
  renderDashboard();
  renderAssignments();
  renderSubmit();
  renderMy();
  renderAllSubmissions();   // 전체 제출 현황 (참여자 공개)
  renderAdmin();
  renderMembers();
  renderNotices();
  renderTalk();
  updateLoginProfile();
  applyMode();
  rotateMotivationQuote();
};

// ── 대시보드 ──────────────────────────────────
const renderDashboard = () => {
  const c = calc();
  document.getElementById('stat-participation').innerHTML = `${c.participation}<span>%</span>`;
  document.getElementById('stat-total-rate').innerHTML = `${c.totalRate}<span>%</span>`;
  document.getElementById('stat-week-rate').innerHTML = `${c.weekRate}<span>%</span>`;
  document.getElementById('stat-missing').innerHTML = `${c.missing.length}<span>명</span>`;
  document.getElementById('stat-week-label').textContent = c.cur ? `${c.cur.week || ''} ${c.cur.title}` : '최근 등록 과제 없음';
  document.getElementById('current-week-badge').textContent = c.cur ? c.cur.week || '이번 주' : '과제 없음';

  if (!c.cur) {
    document.getElementById('current-assignment').innerHTML = '<div class="empty">아직 등록된 과제가 없습니다.</div>';
  } else {
    const sub = getSubmissionAny(myId(), c.cur.id), due = dueState(c.cur.due);
    const statusHtml = sub
      ? '<div class="current-status-value done">✅ 제출 완료</div>'
      : '<div class="current-status-value pending">⚠️ 미제출</div>';
    const dueClass = due.overdue ? 'overdue' : (due.diff === 0 ? 'today' : '');
    document.getElementById('current-assignment').innerHTML = `
      <div class="assignment-card current-focus-card">
        <div class="assignment-top">
          <div>
            <div class="week">${esc(c.cur.week || '')}</div>
            <div class="assignment-title">${esc(c.cur.title)}</div>
          </div>
          ${sub ? '<span class="badge badge-done">제출 완료</span>' : '<span class="badge badge-warn">미제출</span>'}
        </div>
        <div class="current-status-row">
          <div class="current-status-box">
            <div class="current-status-label">이번 주 과제 제출 상태</div>${statusHtml}
          </div>
          <div class="current-status-box">
            <div class="current-status-label">마감일까지 남은 시간</div>
            <div class="current-dday ${dueClass}">${esc(due.label)}</div>
          </div>
        </div>
        <div class="assignment-desc">${esc(c.cur.desc || '과제 설명이 없습니다.')}</div>
        <div class="current-quick-meta">
          <span>🛠 ${esc(c.cur.tool || '도구 미정')}</span>
          <span>📅 ${esc(c.cur.due || '마감일 미정')}</span>
        </div>
        ${renderAssignmentResources(c.cur)}
        <button class="btn btn-primary" onclick="showPage('submit')">바로 제출하기</button>
      </div>`;
  }

  document.getElementById('my-progress').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
      <strong>${esc((state.members[myId()] && state.members[myId()].name) || '나')}님의 진행률</strong>
      <span class="mono">${c.myDone}/${c.as.length}개</span>
    </div>
    <div class="progress"><div class="bar ${rateClass(c.myRate)}" style="width:${c.myRate}%"></div></div>
    <div class="check-list" style="margin-top:14px">
      ${c.as.slice(-4).reverse().map(a => `
        <div class="check-item">
          <div class="check-icon">${getSub(myId(), a.id) ? '✓' : '!'}</div>
          <div>
            <strong>${esc(a.week || '')} ${esc(a.title)}</strong>
            <div class="helper">${getSub(myId(), a.id) ? '제출 완료' : '아직 제출하지 않았습니다.'}</div>
          </div>
        </div>`).join('') || '<div class="empty">과제가 없습니다.</div>'}
    </div>`;

  document.getElementById('recent-notices').innerHTML = getNotices().slice(0, 3).map(n =>
    `<div class="notice-card">
      <strong>${esc(n.title)}</strong>
      <div class="notice-body">${esc(n.content)}</div>
      <div class="helper">${fmtDate(n.createdAt)}</div>
    </div>`).join('') || '<div class="empty">공지사항이 없습니다.</div>';

  document.getElementById('recent-submissions').innerHTML = getSubmissions().slice(0, 5).map(s =>
    `<div class="check-item">
      <div class="check-icon">✓</div>
      <div>
        <strong>${memberName(s.memberId)}</strong>
        <div class="helper">${assignmentTitle(s.assignmentId)} · ${fmtDate(s.submittedAt)}</div>
      </div>
    </div>`).join('') || '<div class="empty">제출 내역이 없습니다.</div>';
};

// ── 주차별 과제 ───────────────────────────────
const renderAssignments = () => {
  document.getElementById('assignment-cards').innerHTML = getAssignments().map(a => {
    const r = getMembers().length ? Math.round(getMembers().filter(m => getSub(m.id, a.id)).length / getMembers().length * 100) : 0;
    const my = getSub(myId(), a.id);
    return `
      <div class="assignment-card">
        <div class="assignment-top">
          <div>
            <div class="week">${esc(a.week || '')}</div>
            <div class="assignment-title">${esc(a.title)}</div>
          </div>
          ${my ? '<span class="badge badge-done">나 제출완료</span>' : '<span class="badge badge-warn">나 미제출</span>'}
        </div>
        <div class="assignment-desc">${esc(a.desc || '')}</div>
        <div class="assignment-meta">
          <span>🛠 ${esc(a.tool || '미정')}</span>
          <span>⏰ ${dueText(a.due)}</span>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px">
            <span>전체 제출률</span><span class="mono">${r}%</span>
          </div>
          <div class="progress"><div class="bar ${rateClass(r)}" style="width:${r}%"></div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:auto">
          <button class="btn btn-sm btn-primary" onclick="selectAssignmentAndSubmit('${a.id}')">상세 보기/제출</button>
          <button class="btn btn-sm btn-danger admin-only" onclick="deleteAssignment('${a.id}')">삭제</button>
        </div>
      </div>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1">등록된 과제가 없습니다.</div>';
};

// ── 과제 제출 페이지 ──────────────────────────
const renderSubmit = () => {
  const as = getAssignments();
  const prevA = document.getElementById('submit-assignment').value;
  const me = state.members[myId()];
  document.getElementById('submit-assignment').innerHTML = as.map(a =>
    `<option value="${a.id}">${esc(a.week || '')} ${esc(a.title)}</option>`
  ).join('') || '<option value="">과제 없음</option>';
  document.getElementById('submit-member').innerHTML = me
    ? `<option value="${me.id}">${esc(me.name)}${me.role === 'admin' ? ' (운영진)' : ''}</option>`
    : '<option value="">로그인 사용자</option>';
  document.getElementById('submit-member').value = myId();
  document.getElementById('submit-member').disabled = true;
  if (prevA) document.getElementById('submit-assignment').value = prevA;
  renderAssignmentDetail();
};

const renderAssignmentDetail = () => {
  const a = state.assignments[document.getElementById('submit-assignment').value];
  if (!a) {
    document.getElementById('assignment-detail-box').innerHTML = '<div class="empty">과제를 먼저 등록해주세요.</div>';
    return;
  }
  document.getElementById('assignment-detail-box').innerHTML = `
    <div class="assignment-card">
      <div class="week">${esc(a.week || '')}</div>
      <div class="assignment-title">${esc(a.title)}</div>
      <div class="assignment-desc">${esc(a.desc || '설명이 없습니다.')}</div>
      <div class="assignment-meta">
        <span>🛠 ${esc(a.tool || '도구 미정')}</span>
        <span>📅 ${a.due || '마감일 미정'}</span>
        <span>⏰ ${dueText(a.due)}</span>
      </div>
      ${renderAssignmentResources(a)}
    </div>`;
};

// ── 나의 제출 현황 ────────────────────────────
const renderMy = () => {
  const rows = getAssignments().map(a => {
    const s = getSubmissionAny(myId(), a.id);
    const canEdit = s && canManageSubmission(s);
    return `
      <tr>
        <td><span class="badge badge-brand">${esc(a.week || '')}</span></td>
        <td><strong>${esc(a.title)}</strong><div class="helper">${esc(a.tool || '')}</div></td>
        <td>${s ? '<span class="badge badge-done">제출 완료</span>' : '<span class="badge badge-warn">미제출</span>'}</td>
        <td>${s && s.githubUrl ? `<a href="${esc(s.githubUrl)}" target="_blank">GitHub</a>` : '—'}</td>
        <td>${s ? downloadLinks(s.files) || '—' : '—'}</td>
        <td>${s ? downloadLinks(s.images) || '—' : '—'}</td>
        <td class="mono">${s ? fmtDate(s.submittedAt) : '—'}</td>
        <td>
          ${canEdit
            ? `<div style="display:flex;gap:6px">
                <button class="btn btn-sm" onclick="startEditSubmission('${s.id}')">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSubmission('${s.id}')">삭제</button>
               </div>`
            : '—'}
        </td>
      </tr>`;
  }).join('');
  document.getElementById('my-submission-list').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>주차</th><th>과제</th><th>상태</th><th>GitHub</th>
            <th>파일</th><th>이미지</th><th>제출일</th><th>관리</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8" class="empty">과제가 없습니다.</td></tr>'}</tbody>
      </table>
    </div>`;
};

// ══════════════════════════════════════════════
//  ✅ 전체 제출 현황 — 주차별 토글(accordion)
//     - 모든 로그인 사용자가 파일 열람·다운 가능
//     - 토글 열기/닫기 상태를 유지하며 재렌더 시 복원
// ══════════════════════════════════════════════

/** 토글 열림 상태 유지용 (assignmentId → boolean) */
const _submissionToggleOpen = {};

/** 토글 헤더 클릭 핸들러 — window에 노출하여 onclick에서 호출 */
window.toggleSubmissionPanel = (id) => {
  _submissionToggleOpen[id] = !_submissionToggleOpen[id];
  const panel = document.getElementById('sub-panel-' + id);
  const arrow  = document.getElementById('sub-arrow-' + id);
  const bar    = document.getElementById('sub-bar-' + id);
  if (!panel) return;
  const open = _submissionToggleOpen[id];
  panel.style.display  = open ? 'block' : 'none';
  arrow.textContent    = open ? '▲' : '▼';
  bar.style.opacity    = open ? '0' : '1';   // 열리면 프로그레스 바 숨김 (내부에 다시 표시)
};

const renderAllSubmissions = () => {
  const container = document.getElementById('all-submissions-content');
  if (!container) return;

  const as = getAssignments();
  if (!as.length) {
    container.innerHTML = '<div class="empty">등록된 과제가 없습니다.</div>';
    return;
  }

  container.innerHTML = as.map((a, idx) => {
    const subs        = getSubmissions().filter(s => s.assignmentId === a.id && s.status !== 'draft');
    const allMembers  = getMembers();
    const submittedIds = new Set(subs.map(s => s.memberId));
    const missing     = allMembers.filter(m => !submittedIds.has(m.id));
    const rate        = allMembers.length ? Math.round(subs.length / allMembers.length * 100) : 0;

    if (_submissionToggleOpen[a.id] === undefined) _submissionToggleOpen[a.id] = false;
    const open = _submissionToggleOpen[a.id];

    // 제출 상태 뱃지 색상
    const statusBadge = (s) => s.status === 'late'
      ? '<span class="badge badge-red">지각</span>'
      : '<span class="badge badge-done">완료</span>';

    // 멤버 카드 그리드 (제출자 목록)
    const memberCards = allMembers.map(m => {
      const s = subs.find(s => s.memberId === m.id);
      if (s) {
        // 제출 완료 카드
        return `
          <div class="sub-member-card sub-member-done">
            <div class="sub-member-header">
              <div class="sub-member-avatar">${esc(m.name.slice(0,1))}</div>
              <div>
                <div class="sub-member-name">${esc(m.name)}</div>
                <div class="helper">${esc(m.department || '')}</div>
              </div>
              ${statusBadge(s)}
            </div>
            ${s.memo ? `<div class="sub-memo">${esc(s.memo)}</div>` : ''}
            <div class="sub-file-row">
              ${s.githubUrl ? `<a class="btn btn-sm" href="${esc(s.githubUrl)}" target="_blank">🔗 GitHub</a>` : ''}
              ${(s.files||[]).map(f => `<button class="btn btn-sm" onclick="forceDownload('${escAttr(f.url)}','${escAttr(f.name)}')">📎 ${esc(f.name)}</button>`).join('')}
              ${(s.images||[]).map(f => `<button class="btn btn-sm" onclick="forceDownload('${escAttr(f.url)}','${escAttr(f.name)}')">🖼 ${esc(f.name)}</button>`).join('')}
              ${!s.githubUrl && !(s.files||[]).length && !(s.images||[]).length ? '<span class="helper">첨부 없음</span>' : ''}
            </div>
            <div class="sub-date mono">${fmtDate(s.submittedAt)}</div>
          </div>`;
      } else {
        // 미제출 카드
        return `
          <div class="sub-member-card sub-member-missing">
            <div class="sub-member-header">
              <div class="sub-member-avatar sub-avatar-missing">${esc(m.name.slice(0,1))}</div>
              <div>
                <div class="sub-member-name">${esc(m.name)}</div>
                <div class="helper">${esc(m.department || '')}</div>
              </div>
              <span class="badge badge-warn">미제출</span>
            </div>
          </div>`;
      }
    }).join('');

    return `
      <!-- 주차 토글 블록 -->
      <div class="sub-accordion">

        <!-- 헤더 (클릭하면 토글) -->
        <button class="sub-accordion-header" onclick="toggleSubmissionPanel('${esc(a.id)}')">
          <div class="sub-accordion-left">
            <span class="badge badge-brand">${esc(a.week || '')}</span>
            <span class="sub-accordion-title">${esc(a.title)}</span>
            <span class="badge ${rate === 100 ? 'badge-done' : rate >= 50 ? 'badge-blue' : 'badge-warn'}">${subs.length}/${allMembers.length}명</span>
          </div>
          <div class="sub-accordion-right">
            <div id="sub-bar-${esc(a.id)}" class="sub-mini-bar-wrap" style="opacity:${open ? 0 : 1}">
              <div class="sub-mini-bar">
                <div class="sub-mini-bar-fill ${rateClass(rate)}" style="width:${rate}%"></div>
              </div>
              <span class="mono" style="font-size:11px;color:var(--muted);min-width:32px;text-align:right">${rate}%</span>
            </div>
            <span id="sub-arrow-${esc(a.id)}" class="sub-arrow">${open ? '▲' : '▼'}</span>
          </div>
        </button>

        <!-- 패널 (열림/닫힘) -->
        <div id="sub-panel-${esc(a.id)}" class="sub-accordion-panel" style="display:${open ? 'block' : 'none'}">

          <!-- 패널 내 프로그레스 바 -->
          <div class="sub-panel-progress">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px">
              <span>제출률</span><span class="mono">${rate}%</span>
            </div>
            <div class="progress"><div class="bar ${rateClass(rate)}" style="width:${rate}%"></div></div>
          </div>

          <!-- 멤버 카드 그리드 -->
          <div class="sub-member-grid">${memberCards}</div>

          ${missing.length ? `
            <div class="sub-missing-banner">
              ⚠️ 미제출: ${missing.map(m => `<strong>${esc(m.name)}</strong>`).join(', ')}
            </div>` : `
            <div class="sub-all-done-banner">🎉 이번 주차는 모두 제출 완료!</div>`}
        </div>
      </div>`;
  }).join('');
};

// ── 운영진 대시보드 ───────────────────────────
const renderAdmin = () => {
  const c = calc();
  document.getElementById('admin-members').innerHTML = `${c.ms.length}<span>명</span>`;
  document.getElementById('admin-assignments').innerHTML = `${c.as.length}<span>개</span>`;
  document.getElementById('admin-submissions').innerHTML = `${c.ss.length}<span>건</span>`;
  document.getElementById('admin-missing').innerHTML = `${c.missing.length}<span>명</span>`;

  document.getElementById('weekly-rates').innerHTML = c.as.map(a => {
    const r = c.ms.length ? Math.round(c.ms.filter(m => getSub(m.id, a.id)).length / c.ms.length * 100) : 0;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px">
          <strong>${esc(a.week || '')} ${esc(a.title)}</strong>
          <span class="mono muted">${r}%</span>
        </div>
        <div class="progress"><div class="bar ${rateClass(r)}" style="width:${r}%"></div></div>
      </div>`;
  }).join('') || '<div class="empty">과제가 없습니다.</div>';

  document.getElementById('missing-list').innerHTML = c.cur
    ? c.missing.map(m =>
        `<div class="check-item">
          <div class="check-icon">!</div>
          <div>
            <strong>${esc(m.name)}</strong>
            <div class="helper">${esc(m.email || '이메일 없음')} · ${esc(c.cur.week || '')} 미제출</div>
          </div>
        </div>`).join('') || '<div class="empty">이번 주 미제출자가 없습니다.</div>'
    : '<div class="empty">기준 과제가 없습니다.</div>';

  document.getElementById('all-submission-tbody').innerHTML = getSubmissions().map(s =>
    `<tr>
      <td>${memberName(s.memberId)}</td>
      <td>${assignmentTitle(s.assignmentId)}</td>
      <td><span class="badge ${s.status === 'draft' ? 'badge-warn' : s.status === 'late' ? 'badge-red' : 'badge-done'}">${s.status}</span></td>
      <td>${s.githubUrl ? `<a href="${esc(s.githubUrl)}" target="_blank">링크</a>` : '—'}</td>
      <td>${downloadLinks(s.files) || '—'}</td>
      <td>${downloadLinks(s.images) || '—'}</td>
      <td class="mono">${fmtDate(s.submittedAt)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteSubmission('${s.id}')">삭제</button></td>
    </tr>`
  ).join('') || '<tr><td colspan="8" class="empty">제출 내역이 없습니다.</td></tr>';
};

// ── 멤버 관리 ─────────────────────────────────
const renderMembers = () => {
  document.getElementById('member-list').innerHTML = getMembers().map(m => {
    const done = getAssignments().filter(a => getSub(m.id, a.id)).length;
    const rate = getAssignments().length ? Math.round(done / getAssignments().length * 100) : 0;
    return `
      <div class="member-card">
        <div class="member-actions">
          <button class="icon-btn" onclick="startEditMember('${m.id}')">수정</button>
          <button class="icon-btn" onclick="toggleRole('${m.id}')">${m.role === 'admin' ? '운영' : '참여'}</button>
          <button class="icon-btn" onclick="deleteMember('${m.id}')">✕</button>
        </div>
        <div class="profile-top">
          <div class="avatar">${esc(m.name.slice(0, 1))}</div>
          <div>
            <div class="profile-name">${esc(m.name)}</div>
            <div class="profile-mail">${esc(m.email || '')}</div>
          </div>
        </div>
        <div style="margin-top:12px">
          <span class="badge ${m.role === 'admin' ? 'badge-brand' : 'badge-blue'}">${m.role}</span>
          <span class="helper">${esc(m.department || '')}</span>
        </div>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px">
            <span>진행률</span><span class="mono">${done}/${getAssignments().length} (${rate}%)</span>
          </div>
          <div class="progress"><div class="bar ${rateClass(rate)}" style="width:${rate}%"></div></div>
        </div>
      </div>`;
  }).join('') || '<div class="empty">등록된 멤버가 없습니다.</div>';
};

// ── 공지사항 ──────────────────────────────────
const renderNotices = () => {
  document.getElementById('notice-list').innerHTML = getNotices().map(n =>
    `<div class="notice-card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <strong>${esc(n.title)}</strong>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-sm admin-only" onclick="startEditNotice('${n.id}')">수정</button>
          <button class="btn btn-sm btn-danger admin-only" onclick="deleteNotice('${n.id}')">삭제</button>
        </div>
      </div>
      <div class="notice-body">${esc(n.content)}</div>
      <div class="helper">${fmtDate(n.updatedAt || n.createdAt)}</div>
    </div>`
  ).join('') || '<div class="empty">등록된 공지사항이 없습니다.</div>';
};

// ── 대화방 ────────────────────────────────────
const renderTalk = () => {
  const items = getChats().filter(c => c && !c.deleted);
  document.getElementById('talk-list').innerHTML = items.map(c => {
    const cm = canManageTalk(c), author = c.anonymous ? '익명' : (c.authorName || '멤버'), id = esc(c.id || '');
    return `
      <div class="talk-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <span class="talk-category">${esc(c.category || '💬 이야기')}</span>
          ${cm ? `<div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm" data-edit-talk-id="${id}">수정</button>
            <button type="button" class="icon-btn" data-delete-talk-id="${id}">✕</button>
          </div>` : ''}
        </div>
        <div class="talk-title">${esc(c.title)}</div>
        <div class="talk-content">${esc(c.content)}</div>
        <div class="talk-foot">
          <span>${esc(author)}</span>
          <span class="mono">${fmtDate(c.updatedAt || c.createdAt)}</span>
        </div>
      </div>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1">아직 등록된 대화가 없습니다.</div>';
};
