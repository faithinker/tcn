// L13: 스크롤 진입 리빌 — 단일 IntersectionObserver, 1회성.
// 대상: main 직속 2번째 섹션부터(히어로 제외). 초기 은닉은 global.css(html.js).
// 메모리: 노출 즉시 unobserve, 전부 끝나면 disconnect -> 참조 해제(누수 없음).

const SELECTOR = 'main > section:not(:first-of-type)';

function reveal(): void {
  const targets = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (targets.length === 0) return;

  // 모션 비선호 또는 IO 미지원 -> 즉시 전부 표시(관찰자 생성 안 함).
  const noMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window);
  if (noMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  let remaining = targets.length;
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
        if (--remaining === 0) observer.disconnect();
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => io.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reveal, { once: true });
} else {
  reveal();
}
