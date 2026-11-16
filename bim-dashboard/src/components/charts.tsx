import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { useStore } from '../data/store';
import { SERIES } from '../lib/constants';

export function useChartTheme() {
  const { theme } = useStore();
  const dark = theme === 'dark';
  return {
    dark,
    series: dark ? SERIES.dark : SERIES.light,
    grid: dark ? '#1e2c45' : '#e4e9f1',
    axis: dark ? '#8c9db8' : '#58677f',
    ink: dark ? '#ecf1f8' : '#0f172a',
    surface: dark ? '#0e1728' : '#ffffff',
    tooltip: {
      contentStyle: { background: dark ? '#14203a' : '#ffffff', border: `1px solid ${dark ? '#24344f' : '#dee4ee'}`, borderRadius: 8, fontSize: 12, color: dark ? '#ecf1f8' : '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,.25)' },
      labelStyle: { color: dark ? '#8c9db8' : '#58677f', fontWeight: 600, marginBottom: 4 },
      itemStyle: { color: dark ? '#ecf1f8' : '#0f172a', padding: 0 },
      cursor: { fill: dark ? 'rgba(57,135,229,.08)' : 'rgba(42,120,214,.06)', stroke: dark ? '#3987e5' : '#2a78d6', strokeWidth: 1 },
    },
    tick: { fill: dark ? '#8c9db8' : '#58677f', fontSize: 11 },
  };
}

export function ChartBox({ height = 240, children }: { height?: number; children: ReactNode }) {
  return <div style={{ height }} className="w-full"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
    {items.map((i) => <span key={i.label} className="inline-flex items-center gap-1.5">
      <span className="w-3 h-[3px] rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 3px, transparent 3px 5px)` : i.color }} />{i.label}</span>)}
  </div>;
}
