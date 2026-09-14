import { useEffect, useState } from 'react';

// Direct port of the website's hook (frontend/hooks/useCountUp.ts) - requestAnimationFrame and
// performance.now() both exist in Hermes, so the exact same ease-out-cubic curve/duration works
// unmodified in React Native.
export function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}
