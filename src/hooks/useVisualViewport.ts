import { useLayoutEffect } from 'react';

/** Safari can resize/pan only the visual viewport when its keyboard opens. */
export function useVisualViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let baseline = window.innerHeight;
    let width = window.innerWidth;
    const update = () => {
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        baseline = window.innerHeight;
      }
      baseline = Math.max(baseline, window.innerHeight);
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const focused = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      const keyboard = Boolean(focused && (viewport?.scale ?? 1) === 1 && baseline - height > 140);
      root.style.setProperty('--visual-height', `${height}px`);
      root.style.setProperty('--visual-top', `${top}px`);
      root.style.setProperty('--visual-bottom', `${Math.max(0, window.innerHeight - height - top)}px`);
      root.dataset.keyboard = String(keyboard);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      for (const name of ['--visual-height', '--visual-top', '--visual-bottom']) root.style.removeProperty(name);
      delete root.dataset.keyboard;
    };
  }, []);
}
