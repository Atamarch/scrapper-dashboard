/**
 * Cron validation and timezone utilities for frontend
 */

// Basic cron validation regex
const CRON_REGEX = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|[12]\d|3[01])) (\*|([01]?\d)) (\*|[0-6])$/;

// More detailed field validation
const CRON_FIELDS = {
  minute: { min: 0, max: 59, regex: /^(\*|([0-5]?\d))$/ },
  hour: { min: 0, max: 23, regex: /^(\*|([01]?\d|2[0-3]))$/ },
  day: { min: 1, max: 31, regex: /^(\*|([01]?\d|[12]\d|3[01]))$/ },
  month: { min: 1, max: 12, regex: /^(\*|([01]?\d))$/ },
  weekday: { min: 0, max: 6, regex: /^(\*|[0-6])$/ }
};

export interface CronValidationResult {
  isValid: boolean;
  error?: string;
  nextRuns?: string[];
  description?: string;
}

/**
 * Validate cron expression
 */
export function validateCronExpression(cronExpression: string): CronValidationResult {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return {
      isValid: false,
      error: 'Cron expression is required'
    };
  }

  const trimmed = cronExpression.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length !== 5) {
    return {
      isValid: false,
      error: 'Cron expression must have exactly 5 fields (minute hour day month weekday)'
    };
  }

  // Basic regex validation
  if (!CRON_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid cron expression format'
    };
  }

  // Validate each field
  const fieldNames = ['minute', 'hour', 'day', 'month', 'weekday'] as const;
  for (let i = 0; i < parts.length; i++) {
    const field = fieldNames[i];
    const value = parts[i];
    
    if (!CRON_FIELDS[field].regex.test(value)) {
      return {
        isValid: false,
        error: `Invalid ${field} field: ${value}`
      };
    }
  }

  try {
    const nextRuns = calculateNextRuns(trimmed, 3);
    const description = describeCronExpression(trimmed);
    
    return {
      isValid: true,
      nextRuns,
      description
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to calculate next run times'
    };
  }
}

/**
 * Calculate next run times (simplified version)
 */
function calculateNextRuns(cronExpression: string, count: number = 3): string[] {
  const parts = cronExpression.split(' ');
  const [minute, hour, day, month, weekday] = parts;
  
  const now = new Date();
  const nextRuns: string[] = [];
  
  // Simple calculation for common patterns
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
    // Daily at specific time
    const targetHour = parseInt(hour);
    const targetMinute = parseInt(minute);
    
    for (let i = 0; i < count; i++) {
      const nextRun = new Date(now);
      nextRun.setDate(now.getDate() + i);
      nextRun.setHours(targetHour, targetMinute, 0, 0);
      
      // If today's time has passed, start from tomorrow
      if (i === 0 && nextRun <= now) {
        nextRun.setDate(now.getDate() + 1);
      }
      
      nextRuns.push(nextRun.toLocaleString());
    }
  } else {
    // For complex patterns, show approximate times
    for (let i = 0; i < count; i++) {
      const nextRun = new Date(now);
      nextRun.setDate(now.getDate() + i);
      nextRuns.push(`${nextRun.toDateString()} (approximate)`);
    }
  }
  
  return nextRuns;
}

/**
 * Describe cron expression in human-readable format
 */
function describeCronExpression(cronExpression: string): string {
  const parts = cronExpression.split(' ');
  const [minute, hour, day, month, weekday] = parts;
  
  // Common patterns
  if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '*') {
    return 'Daily at midnight';
  }
  
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return `Daily at ${time}`;
  }
  
  if (minute === '0' && hour === '9' && day === '*' && month === '*' && weekday === '1') {
    return 'Every Monday at 9:00 AM';
  }
  
  if (minute === '0' && hour === '0' && day === '1' && month === '*' && weekday === '*') {
    return 'Monthly on the 1st at midnight';
  }
  
  // Generic description
  let desc = 'Runs ';
  
  if (minute === '*') desc += 'every minute';
  else desc += `at minute ${minute}`;
  
  if (hour !== '*') desc += ` of hour ${hour}`;
  if (day !== '*') desc += ` on day ${day}`;
  if (month !== '*') desc += ` of month ${month}`;
  if (weekday !== '*') desc += ` on weekday ${weekday}`;
  
  return desc;
}

/**
 * Get current timezone information
 */
export function getTimezoneInfo() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  
  return {
    timezone,
    current_time: now.toISOString(),
    formatted_time: now.toLocaleString(),
    utc_offset: now.getTimezoneOffset()
  };
}

/**
 * Common cron expression presets
 */
export const CRON_PRESETS = {
  'Every minute': '* * * * *',
  'Every 5 minutes': '*/5 * * * *',
  'Every 15 minutes': '*/15 * * * *',
  'Every 30 minutes': '*/30 * * * *',
  'Every hour': '0 * * * *',
  'Every 2 hours': '0 */2 * * *',
  'Every 6 hours': '0 */6 * * *',
  'Every 12 hours': '0 */12 * * *',
  'Daily at midnight': '0 0 * * *',
  'Daily at 6 AM': '0 6 * * *',
  'Daily at 9 AM': '0 9 * * *',
  'Daily at 12 PM': '0 12 * * *',
  'Daily at 6 PM': '0 18 * * *',
  'Weekly (Monday 9 AM)': '0 9 * * 1',
  'Weekly (Friday 5 PM)': '0 17 * * 5',
  'Monthly (1st at midnight)': '0 0 1 * *',
  'Monthly (15th at noon)': '0 12 15 * *'
};