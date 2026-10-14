import type { AccountStatus, UserRole } from '../db/types';

// 세션이 유효할 때 가드가 돌려주는 계정 정보. 비밀번호 해시와 세션 버전은 담지 않는다.
export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  status: AccountStatus;
  isExecutive: boolean;
}

// 등급 순서: (비로그인) < associate(준회원) < member(회원) < director(이사진) < executive(회장·부회장).
// rejected 는 순서에 넣지 않는다(tierOf 가 null 을 돌려준다).
export type Tier = 'associate' | 'member' | 'director' | 'executive';

const TIER_RANK: Record<Tier, number> = { associate: 1, member: 2, director: 3, executive: 4 };

export type ForumBoard = 'directors' | 'assembly';

// 게시판별 최소 등급. 2단계의 forum 엔진이 같은 표를 쓴다.
export const FORUM_MIN_TIER: Record<ForumBoard, Tier> = {
  directors: 'director',
  assembly: 'associate',
};

export type Requirement = 'officer' | 'executive' | 'activeAccount';

// 상태를 먼저 본다. pending 은 role 과 is_executive 를 무시하고, 결정권은 승인된 임원에게만 유효하다.
export function tierOf(user: SessionUser | null): Tier | null {
  if (!user || user.status === 'rejected') return null;
  if (user.status === 'pending') return 'associate';
  if (user.role === 'member') return 'member';
  return user.isExecutive ? 'executive' : 'director';
}

export function hasTier(user: SessionUser | null, minimum: Tier): boolean {
  const tier = tierOf(user);
  return tier !== null && TIER_RANK[tier] >= TIER_RANK[minimum];
}

export function meetsRequirement(user: SessionUser, requirement: Requirement): boolean {
  switch (requirement) {
    case 'officer':
      return hasTier(user, 'director');
    case 'executive':
      return hasTier(user, 'executive');
    case 'activeAccount':
      return user.status !== 'rejected';
  }
}

export type Action =
  | { kind: 'seminar.read' }
  | { kind: 'seminar.write' }
  | { kind: 'media.write' }
  | { kind: 'qna.ask' }
  | { kind: 'qna.answer' }
  | { kind: 'forum.read'; board: ForumBoard }
  | { kind: 'forum.write'; board: ForumBoard }
  | { kind: 'forum.edit'; board: ForumBoard; authorId: string }
  | { kind: 'forum.delete'; board: ForumBoard; authorId: string }
  | { kind: 'users.list' }
  | { kind: 'users.decide' }
  | { kind: 'account.view' };

// 명세서 4.2 의 매트릭스를 그대로 옮긴 순수 함수다.
export function canAccess(user: SessionUser | null, action: Action): boolean {
  switch (action.kind) {
    case 'seminar.read':
    case 'qna.ask':
      return true;
    case 'seminar.write':
    case 'media.write':
    case 'qna.answer':
      return hasTier(user, 'director');
    case 'forum.read':
    case 'forum.write':
      return hasTier(user, FORUM_MIN_TIER[action.board]);
    case 'forum.edit':
      // 수정은 작성자 본인만. 등급이 내려가 게시판 접근을 잃었으면 본인 글도 수정하지 못한다.
      return hasTier(user, FORUM_MIN_TIER[action.board]) && user?.id === action.authorId;
    case 'forum.delete':
      return (
        hasTier(user, FORUM_MIN_TIER[action.board]) &&
        (user?.id === action.authorId || hasTier(user, 'executive'))
      );
    case 'users.list':
    case 'users.decide':
      return hasTier(user, 'executive');
    case 'account.view':
      return user !== null;
  }
}
