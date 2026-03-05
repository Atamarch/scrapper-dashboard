'use client';

import { useEffect, useRef, MutableRefObject } from 'react';
import gsap from 'gsap';

interface MascotRefs {
  leftEye: MutableRefObject<SVGGElement | null>;
  rightEye: MutableRefObject<SVGGElement | null>;
  leftPupil: MutableRefObject<SVGCircleElement | null>;
  rightPupil: MutableRefObject<SVGCircleElement | null>;
  leftEyeShape: MutableRefObject<SVGCircleElement | null>;
  rightEyeShape: MutableRefObject<SVGCircleElement | null>;
  leftEyebrow: MutableRefObject<SVGPathElement | null>;
  rightEyebrow: MutableRefObject<SVGPathElement | null>;
}

export function useMascotAnimation(refs: MascotRefs) {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTrackingRef = useRef(false);
  const isClosedRef = useRef(false);
  const isPeekingRef = useRef(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Start idle blinking
      startBlinking();
    });

    return () => {
      ctx.revert();
      stopBlinking();
    };
  }, []);

  const blink = () => {
    if (!refs.leftEyeShape.current || !refs.rightEyeShape.current || isClosedRef.current) return;

    const tl = gsap.timeline();
    
    // Shrink from top (transform origin top)
    tl.to([refs.leftEyeShape.current, refs.rightEyeShape.current], {
      attr: { r: 1 },
      transformOrigin: 'center top',
      duration: 0.08,
      ease: 'power2.in',
    })
    .to([refs.leftEyeShape.current, refs.rightEyeShape.current], {
      attr: { r: 12 },
      duration: 0.12,
      ease: 'power2.out',
    });
  };

  const startBlinking = () => {
    stopBlinking();
    const blinkRandomly = () => {
      blink();
      const nextBlink = 4000 + Math.random() * 2000; // 4-6 seconds
      blinkIntervalRef.current = setTimeout(blinkRandomly, nextBlink);
    };
    blinkRandomly();
  };

  const stopBlinking = () => {
    if (blinkIntervalRef.current) {
      clearTimeout(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
  };

  const enableTracking = () => {
    isTrackingRef.current = true;
  };

  const disableTracking = () => {
    isTrackingRef.current = false;
  };

  const movePupil = (percentX: number) => {
    if (!isTrackingRef.current || isClosedRef.current || isPeekingRef.current) return;
    if (!refs.leftPupil.current || !refs.rightPupil.current) return;

    // Clamp movement within eye bounds (-6 to 6 pixels)
    const clampedX = Math.max(-6, Math.min(6, percentX * 6));

    gsap.to([refs.leftPupil.current, refs.rightPupil.current], {
      x: clampedX,
      duration: 0.25,
      ease: 'power3.out',
    });
  };

  const closeEyes = () => {
    if (isClosedRef.current) return;
    isClosedRef.current = true;
    isPeekingRef.current = false;
    stopBlinking();

    if (!refs.leftEyeShape.current || !refs.rightEyeShape.current) return;
    if (!refs.leftPupil.current || !refs.rightPupil.current) return;
    if (!refs.leftEyebrow.current || !refs.rightEyebrow.current) return;

    const tl = gsap.timeline();
    
    // Hide pupils completely
    tl.to([refs.leftPupil.current, refs.rightPupil.current], {
      opacity: 0,
      scale: 0,
      duration: 0.15,
    }, 0);

    // Shrink eye radius to close (circle)
    tl.to([refs.leftEyeShape.current, refs.rightEyeShape.current], {
      attr: { r: 1 },
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0);

    // Show eyebrows when eyes closed
    tl.to([refs.leftEyebrow.current, refs.rightEyebrow.current], {
      opacity: 1,
      duration: 0.2,
    }, 0.1);
  };

  const peekOneEye = () => {
    if (!isClosedRef.current) return;
    isPeekingRef.current = true;

    if (!refs.leftEye.current || !refs.rightEye.current) return;
    if (!refs.leftPupil.current || !refs.rightPupil.current) return;
    if (!refs.leftEyeShape.current || !refs.rightEyeShape.current) return;

    const tl = gsap.timeline();

    // Open left eye partially (radius 5)
    tl.to(refs.leftEyeShape.current, {
      attr: { r: 5 },
      duration: 0.25,
      ease: 'power2.out',
    }, 0);

    // Show left pupil (smaller)
    tl.to(refs.leftPupil.current, {
      opacity: 1,
      scale: 0.5,
      duration: 0.2,
    }, 0.1);
  };

  const unseePeek = () => {
    if (!isPeekingRef.current) return;
    isPeekingRef.current = false;

    if (!refs.leftEye.current) return;
    if (!refs.leftPupil.current) return;
    if (!refs.leftEyeShape.current) return;

    const tl = gsap.timeline();

    // Hide left pupil
    tl.to(refs.leftPupil.current, {
      opacity: 0,
      scale: 0,
      duration: 0.15,
    }, 0);

    // Close left eye back (radius 1)
    tl.to(refs.leftEyeShape.current, {
      attr: { r: 1 },
      duration: 0.2,
      ease: 'power2.inOut',
    }, 0);
  };

  const resetToIdle = () => {
    isClosedRef.current = false;
    isPeekingRef.current = false;

    if (!refs.leftEyeShape.current || !refs.rightEyeShape.current) return;
    if (!refs.leftPupil.current || !refs.rightPupil.current) return;
    if (!refs.leftEye.current || !refs.rightEye.current) return;
    if (!refs.leftEyebrow.current || !refs.rightEyebrow.current) return;

    const tl = gsap.timeline({
      onComplete: () => startBlinking(),
    });

    // Hide eyebrows
    tl.to([refs.leftEyebrow.current, refs.rightEyebrow.current], {
      opacity: 0,
      duration: 0.2,
    }, 0);

    // Reset eye shapes to open (radius 12)
    tl.to([refs.leftEyeShape.current, refs.rightEyeShape.current], {
      attr: { r: 12 },
      duration: 0.3,
      ease: 'power2.out',
    }, 0);

    // Show pupils at normal size
    tl.to([refs.leftPupil.current, refs.rightPupil.current], {
      opacity: 1,
      scale: 1,
      duration: 0.2,
    }, 0.1);

    // Center pupils
    tl.to([refs.leftPupil.current, refs.rightPupil.current], {
      x: 0,
      y: 0,
      duration: 0.3,
      ease: 'power2.out',
    }, 0);
  };

  return {
    blink,
    enableTracking,
    disableTracking,
    movePupil,
    closeEyes,
    peekOneEye,
    unseePeek,
    resetToIdle,
  };
}
