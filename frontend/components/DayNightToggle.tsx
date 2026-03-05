'use client';

import { useEffect, useState } from 'react';

interface DayNightToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function DayNightToggle({ isDark, onToggle }: DayNightToggleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg border border-gray-700 bg-[#141C33]" />
    );
  }

  return (
    <label className="dayNight cursor-pointer">
      <input 
        type="checkbox" 
        checked={!isDark}
        onChange={onToggle}
        className="hidden"
      />
      <div className={`toggle-circle ${!isDark ? 'checked' : ''}`} />
      
      <style jsx>{`
        .toggle-circle {
          border-radius: 50%;
          width: 36px;
          height: 36px;
          position: relative;
          box-shadow: inset 16px -16px 0 0 #fff;
          transform: scale(1) rotate(-2deg);
          transition: box-shadow 0.5s ease 0s, transform 0.4s ease 0.1s;
        }

        .toggle-circle:before {
          content: "";
          width: inherit;
          height: inherit;
          border-radius: inherit;
          position: absolute;
          left: 0;
          top: 0;
          transition: background 0.3s ease;
        }

        .toggle-circle:after {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin: -4px 0 0 -4px;
          position: absolute;
          top: 50%;
          left: 50%;
          box-shadow: 0 -23px 0 #000, 0 23px 0 #000, 23px 0 0 #000, -23px 0 0 #000, 
                      15px 15px 0 #000, -15px 15px 0 #000, 15px -15px 0 #000, -15px -15px 0 #000;
          transform: scale(0);
          transition: all 0.3s ease;
        }

        .toggle-circle.checked {
          box-shadow: inset 32px -32px 0 0 #fff;
          transform: scale(0.5) rotate(0deg);
          transition: transform 0.3s ease 0.1s, box-shadow 0.2s ease 0s;
        }

        .toggle-circle.checked:before {
          background: #000;
          transition: background 0.3s ease 0.1s;
        }

        .toggle-circle.checked:after {
          transform: scale(1.5);
          transition: transform 0.5s ease 0.15s;
        }
      `}</style>
    </label>
  );
}
