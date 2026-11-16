import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { InfoTip } from './ui';
import { cls } from '../lib/format';

export function Kpi({ label, value, sub, help, tone, delta, deltaGoodWhen = 'down', icon, onClick, spark }: {
  label: string; value: ReactNode; sub?: ReactNode; help?: string; tone?: 'crit' | 'high' | 'ok' | 'accent' | 'med';
  delta?: number; deltaGoodWhen?: 'up' | 'down'; icon?: ReactNode; onClick?: () => void; spark?: ReactNode;
}) {
  const toneCls = tone === 'crit' ? 'text-crit' : tone === 'high' ? 'text-high' : tone === 'ok' ? 'text-ok' : tone === 'med' ? 'text-med' : 'text-ink';
  const good = delta === undefined || delta === 0 ? null : (delta < 0) === (deltaGoodWhen === 'down');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cls('card p-3.5 text-left flex flex-col gap-1 min-w-0 relative overflow-hidden', onClick && 'hover:border-accent/60 transition-colors')}>
      <div className="flex items-center gap-1.5 label">{icon}<span className="truncate">{label}</span>{help && <InfoTip text={help} />}</div>
      <div className={cls('text-[26px] leading-tight font-semibold tabular-nums', toneCls)}>{value}</div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted min-h-[16px]">
        <span className="truncate">{sub}</span>
        {delta !== undefined && (
          <span className={cls('inline-flex items-center gap-0.5 font-semibold shrink-0', good === null ? 'text-muted' : good ? 'text-ok' : 'text-crit')} title="Change vs. previous period">
            {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}{delta > 0 ? '+' : ''}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
          </span>
        )}
      </div>
      {spark}
    </Tag>
  );
}
