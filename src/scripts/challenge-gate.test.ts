import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChallengeGate, solvedToken } from './challenge-gate';

// 위젯은 `.cf-turnstile` 로 자동 렌더돼 이 모듈이 콜백을 정의하기 전에 풀릴 수 있다(개발 서버처럼 모듈이 늦게 뜰 때).
// 그때 Turnstile 은 정의되지 않은 콜백을 부르지 못하므로, 이미 받은 토큰을 getResponse 로 되찾아야 한다.
const widget = { id: 'widget' } as unknown as HTMLElement;
const root = {
  querySelector: (selector: string) => (selector === '.cf-turnstile' ? widget : null),
};

interface FakeWindow {
  onTcnChallengeSuccess?: (token: string) => void;
  onTcnChallengeExpired?: () => void;
  onTcnChallengeError?: () => void;
  turnstile?: { reset: (w?: unknown) => void; getResponse?: (w?: unknown) => string | undefined };
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}
let win: FakeWindow;

beforeEach(() => {
  vi.useFakeTimers();
  win = { setTimeout, clearTimeout };
  vi.stubGlobal('window', win);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('solvedToken', () => {
  it('returns the token the widget already holds', () => {
    win.turnstile = { reset: vi.fn(), getResponse: vi.fn(() => 'solved-token') };
    expect(solvedToken(root)).toBe('solved-token');
    expect(win.turnstile.getResponse).toHaveBeenCalledWith(widget);
  });

  it('is empty when the API is missing, there is no widget, or the widget has no token', () => {
    expect(solvedToken(root)).toBe('');
    win.turnstile = { reset: vi.fn() };
    expect(solvedToken(root)).toBe('');
    win.turnstile = { reset: vi.fn(), getResponse: () => undefined };
    expect(solvedToken(root)).toBe('');
    win.turnstile = { reset: vi.fn(), getResponse: () => 'token' };
    expect(solvedToken({ querySelector: () => null })).toBe('');
  });

  it('survives a getResponse that throws', () => {
    win.turnstile = {
      reset: vi.fn(),
      getResponse: () => {
        throw new Error('widget not rendered');
      },
    };
    expect(solvedToken(root)).toBe('');
  });
});

describe('createChallengeGate with a widget that solved before the gate existed', () => {
  it('picks up the token at creation and never reports a failure', () => {
    win.turnstile = { reset: vi.fn(), getResponse: () => 'early-token' };

    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange: vi.fn() });

    expect(gate.token()).toBe('early-token');
    expect(gate.pending()).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(gate.failed()).toBe(false);
  });

  it('does not call onChange while it is being created, because the caller reads the gate there', () => {
    win.turnstile = { reset: vi.fn(), getResponse: () => 'early-token' };
    const make = () => {
      const gate = createChallengeGate({
        enabled: true,
        widgetRoot: root,
        // Callers pass a function that reads `gate`, which does not exist yet while the gate is created.
        onChange: () => gate.pending(),
      });
      return gate;
    };

    expect(make).not.toThrow();
  });

  it('takes the token it finds when the stuck timer fires, instead of reporting a failure', () => {
    let held: string | undefined;
    win.turnstile = { reset: vi.fn(), getResponse: () => held };
    const onChange = vi.fn();
    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange });
    expect(gate.pending()).toBe(true);

    held = 'lost-callback-token';
    vi.advanceTimersByTime(15_000);

    expect(gate.failed()).toBe(false);
    expect(gate.token()).toBe('lost-callback-token');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when nothing was solved yet, then takes the callback token', () => {
    win.turnstile = { reset: vi.fn(), getResponse: () => undefined };
    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange: vi.fn() });
    expect(gate.pending()).toBe(true);

    win.onTcnChallengeSuccess?.('late-token');

    expect(gate.token()).toBe('late-token');
    expect(gate.pending()).toBe(false);
  });

  it('finds a token whose callback never arrived, when the form asks for it', () => {
    let held: string | undefined;
    win.turnstile = { reset: vi.fn(), getResponse: () => held };
    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange: vi.fn() });
    expect(gate.token()).toBe('');

    held = 'lost-callback-token';

    expect(gate.token()).toBe('lost-callback-token');
    expect(gate.pending()).toBe(false);
    expect(gate.failed()).toBe(false);
  });

  it('forgets the token when it expires, and does not take back an expired one', () => {
    let held: string | undefined = 'first';
    win.turnstile = { reset: vi.fn(), getResponse: () => held };
    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange: vi.fn() });
    expect(gate.token()).toBe('first');

    held = undefined;
    win.onTcnChallengeExpired?.();

    expect(gate.token()).toBe('');
    expect(gate.pending()).toBe(true);
  });

  it('leaves a disabled gate alone: no token, no widget access', () => {
    const getResponse = vi.fn(() => 'token');
    win.turnstile = { reset: vi.fn(), getResponse };
    const gate = createChallengeGate({ enabled: false, widgetRoot: root, onChange: vi.fn() });

    expect(gate.token()).toBe('');
    expect(gate.pending()).toBe(false);
    expect(getResponse).not.toHaveBeenCalled();
  });

  it('still reports a failure when no token ever shows up', () => {
    win.turnstile = { reset: vi.fn(), getResponse: () => undefined };
    const gate = createChallengeGate({ enabled: true, widgetRoot: root, onChange: vi.fn() });

    vi.advanceTimersByTime(15_000);

    expect(gate.failed()).toBe(true);
  });
});
