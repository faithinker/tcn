// L13: 스크롤 진입 리빌 — 단일 IntersectionObserver, 1회성.
// 대상: 명시적으로 data-reveal을 선언한 섹션. 초기 은닉은 초기화 성공 후에만 활성화.
// 메모리: 노출 즉시 unobserve, 전부 끝나면 disconnect -> 참조 해제(누수 없음).

const SELECTOR = '[data-reveal]';

function reveal(): void {
  const targets = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (targets.length === 0) return;

  // 모션 비선호 또는 IO 미지원 -> 즉시 전부 표시(관찰자 생성 안 함).
  const noMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window);
  if (noMotion) return;

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

  // 모든 관찰 등록에 성공한 경우에만 CSS 은닉을 켠다.
  // 번들 요청이나 초기화가 실패하면 이 클래스가 없어 콘텐츠는 계속 표시된다.
  document.documentElement.classList.add('reveal-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reveal, { once: true });
} else {
  reveal();
}
