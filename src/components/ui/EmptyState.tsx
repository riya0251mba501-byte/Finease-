import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] mb-3.5">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
