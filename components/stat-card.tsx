import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor = 'text-blue-500' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-700 bg-[#1a1f2e] p-6 transition-all hover:border-gray-600">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
          {subtitle && (
            <p className="mt-1 text-sm text-green-500">{subtitle}</p>
          )}
        </div>
        <div className={cn('rounded-lg bg-blue-500/10 p-3', iconColor)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
