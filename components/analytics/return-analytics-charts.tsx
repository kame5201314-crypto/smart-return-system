'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
] as const;

interface CountPoint {
  [key: string]: string | number;
  name: string;
  value: number;
}

interface TrendPoint {
  [key: string]: string | number;
  month: string;
  returns: number;
}

export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray='3 3' />
        <XAxis dataKey='month' />
        <YAxis />
        <Tooltip />
        <Line
          type='monotone'
          dataKey='returns'
          stroke='#3b82f6'
          strokeWidth={2}
          name='退貨數量'
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ChannelDistributionChart({ data }: { data: CountPoint[] }) {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey='value'
          nameKey='name'
          cx='50%'
          cy='50%'
          outerRadius={100}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((item, index) => (
            <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ReasonDistributionChart({ data }: { data: CountPoint[] }) {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <BarChart data={data} layout='vertical'>
        <CartesianGrid strokeDasharray='3 3' />
        <XAxis type='number' />
        <YAxis type='category' dataKey='name' width={100} />
        <Tooltip />
        <Bar dataKey='value' fill='#3b82f6' name='數量' />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDistributionChart({ data }: { data: CountPoint[] }) {
  return (
    <ResponsiveContainer width='100%' height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray='3 3' />
        <XAxis dataKey='name' />
        <YAxis />
        <Tooltip />
        <Bar dataKey='value' fill='#8b5cf6' name='數量' />
      </BarChart>
    </ResponsiveContainer>
  );
}
