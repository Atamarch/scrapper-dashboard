'use client';

import { useRef, useEffect } from 'react';
import { useMascotAnimation } from '@/hooks/useMascotAnimation';

interface RobotCatMascotProps {
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  passwordInputRef?: React.RefObject<HTMLInputElement | null>;
  showPassword?: boolean;
  passwordValue?: string;
}

export default function RobotCatMascot({ 
  emailInputRef, 
  passwordInputRef, 
  showPassword,
  passwordValue = ''
}: RobotCatMascotProps) {
  // SVG element refs
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const leftEyeShapeRef = useRef<SVGCircleElement>(null);
  const rightEyeShapeRef = useRef<SVGCircleElement>(null);
  const leftEyebrowRef = useRef<SVGPathElement>(null);
  const rightEyebrowRef = useRef<SVGPathElement>(null);

  // Animation hook
  const {
    enableTracking,
    disableTracking,
    movePupil,
    closeEyes,
    peekOneEye,
    unseePeek,
    resetToIdle,
  } = useMascotAnimation({
    leftEye: leftEyeRef,
    rightEye: rightEyeRef,
    leftPupil: leftPupilRef,
    rightPupil: rightPupilRef,
    leftEyeShape: leftEyeShapeRef,
    rightEyeShape: rightEyeShapeRef,
    leftEyebrow: leftEyebrowRef,
    rightEyebrow: rightEyebrowRef,
  });

  // Email input tracking
  useEffect(() => {
    const emailInput = emailInputRef?.current;
    if (!emailInput) return;

    const handleFocus = () => {
      enableTracking();
    };

    const handleInput = (e: Event) => {
      const input = e.target as HTMLInputElement;
      const caretPos = input.selectionStart || 0;
      const textLength = input.value.length;
      const percentX = textLength > 0 ? (caretPos / textLength) * 2 - 1 : 0;
      movePupil(percentX);
    };

    const handleBlur = () => {
      disableTracking();
    };

    emailInput.addEventListener('focus', handleFocus);
    emailInput.addEventListener('input', handleInput);
    emailInput.addEventListener('blur', handleBlur);

    return () => {
      emailInput.removeEventListener('focus', handleFocus);
      emailInput.removeEventListener('input', handleInput);
      emailInput.removeEventListener('blur', handleBlur);
    };
  }, [emailInputRef, enableTracking, disableTracking, movePupil]);

  // Password input - close eyes
  useEffect(() => {
    const passwordInput = passwordInputRef?.current;
    if (!passwordInput) return;

    const handleFocus = () => {
      closeEyes();
    };

    const handleBlur = () => {
      resetToIdle();
    };

    passwordInput.addEventListener('focus', handleFocus);
    passwordInput.addEventListener('blur', handleBlur);

    return () => {
      passwordInput.removeEventListener('focus', handleFocus);
      passwordInput.removeEventListener('blur', handleBlur);
    };
  }, [passwordInputRef, closeEyes, resetToIdle]);

  // Show password toggle - peek one eye (only when password field is focused AND has value)
  useEffect(() => {
    const passwordInput = passwordInputRef?.current;
    const isPasswordFocused = passwordInput === document.activeElement;
    const hasPassword = passwordValue.length > 0;
    
    if (showPassword && isPasswordFocused && hasPassword) {
      peekOneEye();
    } else if (!showPassword && isPasswordFocused) {
      closeEyes();
    }
  }, [showPassword, passwordValue, peekOneEye, closeEyes, passwordInputRef]);

  return (
    <div className="relative w-40 h-40 mx-auto">
      {/* Robot PNG - existing image */}
      <img
        src="/robot.png"
        alt="Robot Cat"
        className="w-full h-full object-contain"
      />
      
      {/* Eyes SVG Overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Glow effect for pupils */}
          <filter id="pupilGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          {/* Glow effect for antenna light */}
          <filter id="antennaGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        
        {/* Antenna Light - blinking red light */}
        <g id="antenna-light" transform="translate(80, 12)">
          <circle cx="0" cy="0" r="6" fill="#EF4444" opacity="0.3">
            <animate
              attributeName="opacity"
              values="-0;0.7;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="0" cy="0" r="4" fill="#EF4444" filter="url(#antennaGlow)">
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="0" cy="0" r="2.5" fill="#FCA5A5">
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
        
        <g id="eyes">
          {/* Left eye */}
          <g id="left-eye" ref={leftEyeRef} transform="translate(55, 75)">
            {/* Eyebrow - alis di posisi mata nutup */}
            <path
              ref={leftEyebrowRef}
              className="eyebrow"
              d="M -12 0 L 12 0"
              stroke="#374151"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              opacity="0"
            />
            {/* Eye background - circle dark grey */}
            <circle
              ref={leftEyeShapeRef}
              className="eye-shape"
              cx="0"
              cy="0"
              r="12"
              fill="#4B5563"
            />
            {/* Pupil - white glowing circle */}
            <circle
              ref={leftPupilRef}
              className="pupil"
              cx="0"
              cy="0"
              r="5"
              fill="#FFFFFF"
            />
            {/* Highlight */}
            <circle cx="1.5" cy="-1.5" r="2" fill="#E0E7FF" opacity="0.95" />
          </g>

          {/* Right eye */}
          <g id="right-eye" ref={rightEyeRef} transform="translate(105, 75)">
            {/* Eyebrow - alis di posisi mata nutup */}
            <path
              ref={rightEyebrowRef}
              className="eyebrow"
              d="M -12 0 L 12 0"
              stroke="#374151"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              opacity="0"
            />
            {/* Eye background - circle dark grey */}
            <circle
              ref={rightEyeShapeRef}
              className="eye-shape"
              cx="0"
              cy="0"
              r="12"
              fill="#4B5563"
            />
            {/* Pupil - white glowing circle */}
            <circle
              ref={rightPupilRef}
              className="pupil"
              cx="0"
              cy="0"
              r="5"
              fill="#FFFFFF"
            />
            {/* Highlight */}
            <circle cx="1.5" cy="-1.5" r="2" fill="#E0E7FF" opacity="0.95" />
          </g>
        </g>
      </svg>
    </div>
  );
}
