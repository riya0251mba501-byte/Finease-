import { Check, XCircle } from 'lucide-react';
import { getOrderTimelineIndex, ORDER_TIMELINE_STEPS } from '../../utils/workflow';
import type { Order } from '../../types';

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--status-danger-bg)] p-4 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-[var(--status-danger-text)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[var(--status-danger-text)]">
            Order Cancelled
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {order.statusHistory[order.statusHistory.length - 1]?.note ||
              'This order was cancelled and will not be charged.'}
          </p>
        </div>
      </div>
    );
  }

  const activeIdx = getOrderTimelineIndex(order.status);

  return (
    <div className="space-y-3">
      <ol className="grid grid-cols-1 sm:grid-cols-7 gap-3">
        {ORDER_TIMELINE_STEPS.map((step, idx) => {
          const completed = idx < activeIdx || (idx === activeIdx && order.status === 'delivered');
          const current = idx === activeIdx && order.status !== 'delivered';
          return (
            <li
              key={step.status}
              className={`rounded-lg border p-3 ${
                completed
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                  : current
                    ? 'border-[var(--brand-primary)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] opacity-70'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono-num font-bold shrink-0 ${
                    completed
                      ? 'bg-[var(--brand-primary)] text-white'
                      : current
                        ? 'border-2 border-[var(--brand-primary)] text-[var(--brand-primary-text)]'
                        : 'border border-[var(--border-strong)] text-[var(--text-muted)]'
                  }`}
                >
                  {completed ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                  {step.label}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--text-secondary)] leading-snug">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
