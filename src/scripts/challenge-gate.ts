// Turnstile 위젯 상태를 화면 제어와 이어 주는 공용 게이트(로그인·가입·재설정 요청).
// 위젯은 `interaction-only` 라 평소엔 보이지 않으므로, 토큰이 올 때까지 버튼을 잠그고 "확인 중…"을 보인다.
// 스크립트나 네트워크가 막혀 토큰이 끝내 오지 않으면 `failed` 로 바꿔 사용자가 이유를 알고 다시 시도하게 한다.

declare global {
  interface Window {
    onTcnChallengeSuccess?: (token: string) => void;
    onTcnChallengeExpired?: () => void;
    onTcnChallengeError?: () => void;
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

/** 위젯 `data-callback` 에 넣는 이름. 한 화면에 위젯이 하나뿐이라 공용으로 쓴다. */
export const CHALLENGE_CALLBACKS = {
  success: 'onTcnChallengeSuccess',
  expired: 'onTcnChallengeExpired',
  error: 'onTcnChallengeError',
} as const;

export const CHECKING_LABEL = 'Checking…';
export const CHALLENGE_FAILED_MESSAGE =
  'The security check could not finish. Reload the page or turn off extensions that block Cloudflare, then try again.';
// 토큰이 이 시간 안에 오지 않으면 로드 실패로 본다(정상이면 1~2초, 느린 망도 이보다 짧다).
const STUCK_AFTER_MS = 15_000;

export interface ChallengeGate {
  /** 현재 1회용 토큰. 없으면 빈 문자열. */
  token(): string;
  /** 켜져 있고 토큰을 기다리는 중이다. */
  pending(): boolean;
  /** 위젯이 오류를 냈거나 제한 시간 안에 토큰이 오지 않았다. */
  failed(): boolean;
  /** 토큰을 비우고 위젯을 다시 돌려 새 토큰을 받는다. */
  reset(): void;
}

// 위젯을 품은 요소(폼·루트)나 document. Workers 타입이 ParentNode 를 덮어써서 필요한 메서드만 적는다.
interface WidgetHost {
  querySelector(selectors: string): Element | null;
}

export function createChallengeGate(options: {
  enabled: boolean;
  widgetRoot: WidgetHost;
  onChange: () => void;
}): ChallengeGate {
  let token = '';
  let failed = false;
  let timer: number | undefined;

  function watch(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!token) {
        failed = true;
        options.onChange();
      }
    }, STUCK_AFTER_MS);
  }

  if (options.enabled) {
    window.onTcnChallengeSuccess = (value) => {
      window.clearTimeout(timer);
      token = value;
      failed = false;
      options.onChange();
    };
    window.onTcnChallengeExpired = () => {
      token = '';
      failed = false;
      watch();
      options.onChange();
    };
    window.onTcnChallengeError = () => {
      window.clearTimeout(timer);
      token = '';
      failed = true;
      options.onChange();
    };
    watch();
  }

  return {
    token: () => token,
    pending: () => options.enabled && !token && !failed,
    failed: () => options.enabled && failed,
    reset() {
      token = '';
      failed = false;
      if (!options.enabled) return;
      watch();
      const widget = options.widgetRoot.querySelector('.cf-turnstile');
      if (widget) window.turnstile?.reset(widget as HTMLElement);
      options.onChange();
    },
  };
}

/** 대기 중이면 라벨을 "확인 중…"으로 바꾸고, 끝나면 처음 라벨로 되돌린다. */
export function setCheckingLabel(button: HTMLElement, checking: boolean): void {
  button.dataset.idleLabel ??= button.textContent ?? '';
  button.textContent = checking ? CHECKING_LABEL : button.dataset.idleLabel;
}
