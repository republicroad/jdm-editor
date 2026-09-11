import React, { useMemo, useState } from 'react';

type DecisionRow = {
  id: string;
  tier: string;
  country: string;
  weight: number;
  rate: number;
  status: 'active' | 'draft' | 'archived';
};

const sampleData: DecisionRow[] = [
  { id: 'r1', tier: 'GOLD', country: 'US', weight: 50, rate: 0.85, status: 'active' },
  { id: 'r2', tier: 'SILVER', country: 'US', weight: 30, rate: 0.6, status: 'active' },
  { id: 'r3', tier: 'GOLD', country: 'CN', weight: 45, rate: 0.9, status: 'draft' },
  { id: 'r4', tier: 'BRONZE', country: 'EU', weight: 20, rate: 0.3, status: 'archived' },
  { id: 'r5', tier: 'SILVER', country: 'CN', weight: 35, rate: 0.55, status: 'active' },
  { id: 'r6', tier: 'GOLD', country: 'EU', weight: 60, rate: 0.92, status: 'draft' },
];

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

export const DataGridPage: React.FC = () => {
  const [data] = useState(sampleData);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  const filtered = useMemo(() => {
    if (!globalFilter) return data;
    const q = globalFilter.toLowerCase();
    return data.filter((row) => Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
  }, [data, globalFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const sortedRows = [...filtered].sort((a, b) => {
      const va = a[sort.key as keyof DecisionRow];
      const vb = b[sort.key as keyof DecisionRow];
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sortedRows;
  }, [filtered, sort]);

  const toggleSort = (key: string) => {
    setSort((cur) => (cur?.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const columns: { key: keyof DecisionRow; label: string }[] = [
    { key: 'tier', label: 'Tier' },
    { key: 'country', label: 'Country' },
    { key: 'weight', label: 'Weight' },
    { key: 'rate', label: 'Rate' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Decision Data Grid</h2>
      <input
        className='v-input'
        placeholder='全局筛选…'
        style={{ marginBottom: 12 }}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '2px solid var(--border, #333)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: sort?.key === col.key ? '#60a5fa' : 'inherit',
                }}
              >
                {col.label}
                {sort?.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border, #27272a)' }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '8px 12px' }}>
                  {col.key === 'status' ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background:
                          row.status === 'active' ? '#16653433' : row.status === 'draft' ? '#854d0e33' : '#44403c33',
                      }}
                    >
                      {row.status}
                    </span>
                  ) : (
                    String(row[col.key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.5 }}>
        {sorted.length} / {data.length} 行 · 点击列头排序
      </p>
    </div>
  );
};
