import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

// Shared SaaS admin page header. Keeps title / description / action layout
// consistent across authenticated pages and responsive on small screens.
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold text-gray-950">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
