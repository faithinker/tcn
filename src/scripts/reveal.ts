// 대상: main 직속 2번째 섹션부터(히어로 제외). 초기 은닉은 global.css(html.js).

const SELECTOR = 'main > section:not(:first-of-type)';

function reveal(): void {
  const targets = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (targets.length === 0) return;

  // 모션 비선호 또는 IO 미지원 환경에서는 콘텐츠를 숨기지 않는다.
  const noMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window);
  if (noMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  let remaining = targets.length;
  // threshold 는 0 이어야 한다. 비율 임계값(예: 0.15)을 쓰면 뷰포트보다 훨씬 긴 섹션은
  // 최대 intersectionRatio 가 임계값에 못 미쳐 영구히 opacity:0 으로 남는다.
  // 진입 시점은 rootMargin 의 하단 여백이 담당한다.
  const io = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
        if (--remaining === 0) observer.disconnect();
      }
    },
    { threshold: 0, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => io.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reveal, { once: true });
} else {
  reveal();
}
