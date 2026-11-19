import { AlertCircle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'text-[var(--text-secondary)]',
  info: 'text-[var(--status-info-text)]',
  warning: 'text-[var(--status-warning-text)]',
  success: 'text-[var(--status-success-text)]',
  danger: 'text-[var(--status-danger-text)]',
};

const TONE_ICONS: Record<StatusTone, typeof Info> = {
  neutral: Clock,
  info: Info,
  warning: AlertCircle,
  success: CheckCircle2,
  danger: XCircle,
};

export function StatusLabel({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusTone;
}) {
  const Icon = TONE_ICONS[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
