// ══════════════════════════════════════════════
//  config.js  —  Firebase 설정 및 전역 상수
//  이 파일만 수정하면 프로젝트 전체 설정이 바뀝니다.
// ══════════════════════════════════════════════

const FIXED_FIREBASE_DATABASE_URL = 'https://aiproject-b8d0f-default-rtdb.firebaseio.com/';
const FIXED_FIREBASE_STORAGE_BUCKET = 'aiproject-b8d0f.firebasestorage.app';
const ADMIN_EMAIL = 'vdk7458@gmail.com';

const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyCAEs44KRqsXXRlu2kXCimg1HyoHprrYgQ',
  authDomain: 'aiproject-b8d0f.firebaseapp.com',
  databaseURL: FIXED_FIREBASE_DATABASE_URL,
  projectId: 'aiproject-b8d0f',
  storageBucket: FIXED_FIREBASE_STORAGE_BUCKET
};

const QUOTES = [
  "작은 실천이 쌓이면 일하는 방식이 바뀝니다.",
  "오늘의 한 줄 제출이 내일의 실력을 만듭니다.",
  "완벽한 시작보다 멈추지 않는 실행이 더 강합니다.",
  "배움은 속도가 아니라 누적입니다.",
  "기록하는 사람은 어제보다 빠르게 성장합니다.",
  "AI를 잘 쓰는 사람은 먼저 질문하고, 다시 다듬고, 끝까지 적용합니다.",
  "한 번의 실습은 열 번의 구경보다 오래 남습니다.",
  "오늘 해낸 작은 과제가 내일의 자동화 아이디어가 됩니다.",
  "성장은 익숙하지 않은 버튼을 눌러보는 데서 시작됩니다.",
  "완료한 과제는 작아 보여도 나의 실행 증거입니다."
];

// 샘플 데이터 (데모 모드용)
const SAMPLE_DATA = {
  members: {
    me_admin: { id: 'me_admin', name: '김정현', email: 'vdk7458@gmail.com', department: 'FA기술담당', role: 'admin', joinedAt: Date.now() - 100000 },
    m_1: { id: 'm_1', name: '박서연', email: 'seoyeon@study.local', department: '물류설비', role: 'member', joinedAt: Date.now() - 90000 },
    m_2: { id: 'm_2', name: '이도윤', email: 'doyoon@study.local', department: '자동화', role: 'member', joinedAt: Date.now() - 80000 },
    m_3: { id: 'm_3', name: '최민지', email: 'minji@study.local', department: '설비기술', role: 'member', joinedAt: Date.now() - 70000 }
  },
  assignments: {
    a_1: { id: 'a_1', week: '1주차', title: '생성형 AI 업무 적용 사례 찾기', tool: 'ChatGPT', due: '2026-05-29', desc: '업무에서 바로 활용 가능한 AI 적용 사례를 3개 찾고, 기대효과를 정리합니다.', createdAt: Date.now() - 60000 },
    a_2: { id: 'a_2', week: '2주차', title: '프롬프트 개선 실습', tool: 'ChatGPT / Gemini', due: '2026-06-05', desc: '같은 업무 질문을 일반 프롬프트와 구조화 프롬프트로 비교해 결과 차이를 정리합니다.', createdAt: Date.now() - 50000 },
    a_3: { id: 'a_3', week: '3주차', title: '실습 결과 파일과 캡쳐 이미지 제출하기', tool: '파일 업로드', due: '2026-06-12', desc: '개인 노트북에 저장된 결과 파일과 캡쳐 이미지를 업로드합니다.', createdAt: Date.now() - 40000 }
  },
  submissions: {
    s_1: { id: 's_1', assignmentId: 'a_1', memberId: 'me_admin', status: 'submitted', githubUrl: 'https://github.com/sample/ai-task', memo: 'AI 활용 아이디어를 정리했습니다.', files: [{ name: '과제1_정리.pdf', url: '#' }], images: [{ name: '결과화면.png', url: '#' }], submittedAt: Date.now() - 30000 },
    s_2: { id: 's_2', assignmentId: 'a_1', memberId: 'm_1', status: 'submitted', githubUrl: '', memo: '업무 자동화 사례 중심으로 작성했습니다.', files: [{ name: '1주차.docx', url: '#' }], images: [], submittedAt: Date.now() - 22000 }
  },
  notices: { n_1: { id: 'n_1', title: '이번 주 과제 제출 안내', content: '과제 제출 시 결과 파일, 캡쳐 이미지, 간단한 회고 메모를 남겨주세요.', createdAt: Date.now() - 60000 } },
  chats: { c_1: { id: 'c_1', category: '💡 아이디어', title: '다음 실습 아이디어', content: '업무 메일 초안 자동화 실습을 해보면 좋겠습니다.', anonymous: false, authorName: '김정현', authorEmail: 'vdk7458@gmail.com', createdAt: Date.now() - 45000 } }
};
