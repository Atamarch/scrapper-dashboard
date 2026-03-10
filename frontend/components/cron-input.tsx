'use client';

import React, { useState, useEffect } from 'react';
import { validateCronExpression, getTimezoneInfo, CRON_PRESETS, CronValidationResult } from '@/lib/cron-utils';

interface CronInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CronInput({ value, onChange, placeholder = "0 9 * * *" }: CronInputProps) {
  const [validation, setValidation] = useState<CronValidationResult>({ isValid: true });
  const [showPresets, setShowPresets] = useState(false);
  const [timezoneInfo] = useState(() => getTimezoneInfo());

  useEffect(() => {
    if (value) {
      const result = validateCronExpression(value);
      setValidation(result);
    } else {
      setValidation({ isValid: true });
    }
  }, [value]);

  const handlePresetSelect = (preset: string) => {
    onChange(preset);
    setShowPresets(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-md ${
            validation.isValid ? 'border-gray-300' : 'border-red-500'
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="absolute right-2 top-2 text-sm text-blue-600 hover:text-blue-800"
        >
          Presets
        </button>
      </div>

      {/* Validation Error */}
      {!validation.isValid && validation.error && (
        <div className="text-red-600 text-sm">
          {validation.error}
        </div>
      )}

      {/* Description */}
      {validation.isValid && validation.description && (
        <div className="text-green-600 text-sm">
          {validation.description}
        </div>
      )}

      {/* Next Runs */}
      {validation.isValid && validation.nextRuns && validation.nextRuns.length > 0 && (
        <div className="text-gray-600 text-sm">
          <div className="font-medium">Next runs:</div>
          <ul className="list-disc list-inside ml-2">
            {validation.nextRuns.map((run, index) => (
              <li key={index}>{run}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Timezone Info */}
      <div className="text-gray-500 text-xs">
        Timezone: {timezoneInfo.timezone} | Current: {timezoneInfo.formatted_time}
      </div>

      {/* Presets Dropdown */}
      {showPresets && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {Object.entries(CRON_PRESETS).map(([label, cronExpr]) => (
            <button
              key={label}
              type="button"
              onClick={() => handlePresetSelect(cronExpr)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex justify-between"
            >
              <span>{label}</span>
              <span className="text-gray-500 text-sm font-mono">{cronExpr}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}