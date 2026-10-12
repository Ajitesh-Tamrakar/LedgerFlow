import { useEffect, useRef, useState } from "react";

/*
 * A number that eases from wherever it sits to its new value — the
 * dashboard mock's `count()`: ease-out-cubic over `duration` on a
 * requestAnimationFrame loop. No CSS file: it renders a plain <span>,
 * so there is nothing to style (the parent owns the typography).
 *
 * `format` receives the number currently on screen and returns the text
 * (pass formatInr for money); without one it renders whole numbers.
 * It starts from zero on first paint and, on each new value, glides
 * from the last shown value — it never recounts from zero.
 * Under prefers-reduced-motion it snaps straight to the value.
 */

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function CountUp({ value, duration = 700, format, className }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? target : 0
  );
  // The animation's origin, kept in a ref so a retarget mid-flight
  // starts from the number on screen, not the old target.
  const shownRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }

    const from = shownRef.current;

    if (from === target) {
      return;
    }

    let raf;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // the mock's easing
      const current = from + (target - from) * eased;

      shownRef.current = current;
      setShown(progress === 1 ? target : current);

      if (progress < 1) {
        raf = requestAnimationFrame(frame);
      }
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  const text = format ? format(shown) : String(Math.round(shown));

  return <span className={className}>{text}</span>;
}

export default CountUp;
