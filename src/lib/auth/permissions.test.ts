import { describe, expect, it } from 'vitest';
import {
  canAccess,
  hasTier,
  meetsRequirement,
  tierOf,
  type Action,
  type SessionUser,
} from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'me',
    username: 'me@example.org',
    displayName: 'Me',
    role: 'member',
    status: 'approved',
    isExecutive: false,
    canAccessDirectorsForum: false,
    ...overrides,
  };
}

const PERSONAS = {
  anonymous: null,
  rejected: account({ status: 'rejected' }),
  associate: account({ status: 'pending' }),
  member: account(),
  director: account({ role: 'officer' }),
  executive: account({ role: 'officer', isExecutive: true }),
} satisfies Record<string, SessionUser | null>;

type Persona = keyof typeof PERSONAS;
const COLUMNS: Persona[] = [
  'anonymous',
  'rejected',
  'associate',
  'member',
  'director',
  'executive',
];

const OWN = 'me';
const OTHERS = 'someone-else';

type Row = [boolean, boolean, boolean, boolean, boolean, boolean];

// 명세서 4.2 권한 매트릭스. 열 순서는 COLUMNS 와 같다.
const MATRIX: Array<[string, Action, Row]> = [
  ['seminar read', { kind: 'seminar.read' }, [true, true, true, true, true, true]],
  ['seminar write', { kind: 'seminar.write' }, [false, false, false, false, true, true]],
  ['media write', { kind: 'media.write' }, [false, false, false, false, true, true]],
  ['qna ask', { kind: 'qna.ask' }, [true, true, true, true, true, true]],
  ['qna answer', { kind: 'qna.answer' }, [false, false, false, false, true, true]],
  [
    'directors read',
    { kind: 'forum.read', board: 'directors' },
    [false, false, false, false, true, true],
  ],
  [
    'directors write',
    { kind: 'forum.write', board: 'directors' },
    [false, false, false, false, true, true],
  ],
  [
    'assembly read',
    { kind: 'forum.read', board: 'assembly' },
    [false, false, true, true, true, true],
  ],
  [
    'assembly write',
    { kind: 'forum.write', board: 'assembly' },
    [false, false, true, true, true, true],
  ],
  [
    'assembly edit own',
    { kind: 'forum.edit', board: 'assembly', authorId: OWN },
    [false, false, true, true, true, true],
  ],
  [
    'assembly edit other',
    { kind: 'forum.edit', board: 'assembly', authorId: OTHERS },
    [false, false, false, false, false, false],
  ],
  [
    'assembly delete own',
    { kind: 'forum.delete', board: 'assembly', authorId: OWN },
    [false, false, true, true, true, true],
  ],
  [
    'assembly delete other',
    { kind: 'forum.delete', board: 'assembly', authorId: OTHERS },
    [false, false, false, false, false, true],
  ],
  [
    'directors edit own',
    { kind: 'forum.edit', board: 'directors', authorId: OWN },
    [false, false, false, false, true, true],
  ],
  [
    'directors delete other',
    { kind: 'forum.delete', board: 'directors', authorId: OTHERS },
    [false, false, false, false, false, true],
  ],
  ['users list', { kind: 'users.list' }, [false, false, false, false, false, true]],
  ['users decide', { kind: 'users.decide' }, [false, false, false, false, false, true]],
  ['account view', { kind: 'account.view' }, [false, true, true, true, true, true]],
];

describe('canAccess matrix (spec 4.2)', () => {
  for (const [label, action, expected] of MATRIX) {
    it.each(COLUMNS.map((persona, index) => [persona, expected[index]] as const))(
      `${label}: %s -> %s`,
      (persona, allowed) => {
        expect(canAccess(PERSONAS[persona], action)).toBe(allowed);
      },
    );
  }
});

describe('status is checked before role and executive flag (spec 4.1)', () => {
  const ignoredFlag: Array<[string, SessionUser]> = [
    ['an approved member', account({ isExecutive: true })],
    ['a pending officer', account({ role: 'officer', status: 'pending', isExecutive: true })],
    ['a rejected officer', account({ role: 'officer', status: 'rejected', isExecutive: true })],
  ];

  it.each(ignoredFlag)('ignores is_executive for %s', (_label, user) => {
    expect(canAccess(user, { kind: 'users.list' })).toBe(false);
    expect(canAccess(user, { kind: 'users.decide' })).toBe(false);
    expect(canAccess(user, { kind: 'forum.delete', board: 'assembly', authorId: OTHERS })).toBe(
      false,
    );
    expect(meetsRequirement(user, 'executive')).toBe(false);
  });

  it('gives a pending officer only the associate permissions', () => {
    const pendingOfficer = account({ role: 'officer', status: 'pending' });
    expect(tierOf(pendingOfficer)).toBe('associate');
    expect(canAccess(pendingOfficer, { kind: 'forum.write', board: 'assembly' })).toBe(true);
    expect(canAccess(pendingOfficer, { kind: 'forum.read', board: 'directors' })).toBe(false);
    expect(canAccess(pendingOfficer, { kind: 'seminar.write' })).toBe(false);
    expect(meetsRequirement(pendingOfficer, 'officer')).toBe(false);
  });

  it('gives a rejected officer only public access and the account page', () => {
    const rejectedOfficer = account({ role: 'officer', status: 'rejected' });
    expect(tierOf(rejectedOfficer)).toBeNull();
    expect(canAccess(rejectedOfficer, { kind: 'seminar.read' })).toBe(true);
    expect(canAccess(rejectedOfficer, { kind: 'account.view' })).toBe(true);
    expect(canAccess(rejectedOfficer, { kind: 'forum.write', board: 'assembly' })).toBe(false);
    expect(canAccess(rejectedOfficer, { kind: 'seminar.write' })).toBe(false);
    expect(meetsRequirement(rejectedOfficer, 'officer')).toBe(false);
    expect(meetsRequirement(rejectedOfficer, 'activeAccount')).toBe(false);
  });
});

describe('accounts migrated by 0008 (officer, approved, no executive flag)', () => {
  const migrated = account({ role: 'officer', status: 'approved', isExecutive: false });

  it.each([{ kind: 'seminar.write' }, { kind: 'media.write' }, { kind: 'qna.answer' }] as Action[])(
    'keeps the permission %j',
    (action) => {
      expect(canAccess(migrated, action)).toBe(true);
    },
  );

  it('has no executive authority until an operator grants it', () => {
    expect(canAccess(migrated, { kind: 'users.decide' })).toBe(false);
    expect(tierOf(migrated)).toBe('director');
  });
});

describe('tiers and requirements', () => {
  it('orders anonymous < associate < member < director < executive', () => {
    expect(COLUMNS.map((persona) => tierOf(PERSONAS[persona]))).toEqual([
      null,
      null,
      'associate',
      'member',
      'director',
      'executive',
    ]);
    expect(hasTier(PERSONAS.member, 'associate')).toBe(true);
    expect(hasTier(PERSONAS.associate, 'member')).toBe(false);
    expect(hasTier(null, 'associate')).toBe(false);
  });

  // 기대 배열의 순서는 rejected, associate, member, director, executive다.
  // activeAccount는 rejected만 막고, 나머지 두 요구 조건은 등급으로 판정한다.
  it.each([
    ['officer', [false, false, false, true, true]],
    ['executive', [false, false, false, false, true]],
    ['activeAccount', [false, true, true, true, true]],
  ] as const)('requirement %s from rejected up to executive', (requirement, expected) => {
    const accounts = [
      PERSONAS.rejected,
      PERSONAS.associate,
      PERSONAS.member,
      PERSONAS.director,
      PERSONAS.executive,
    ];
    expect(accounts.map((user) => meetsRequirement(user, requirement))).toEqual(expected);
  });
});
