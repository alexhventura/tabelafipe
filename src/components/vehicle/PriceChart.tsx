import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { HistoricoPreco } from '../../types';

interface PriceChartProps {
  data: HistoricoPreco[];
}

export default function PriceChart({ data }: PriceChartProps) {
  const sampled = data.filter((_, i) => i % 2 === 0 || i === data.length - 1);

  return (
    <div className="h-48 sm:h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampled} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            width={48}
          />
          <Tooltip
            formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'FIPE']}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
