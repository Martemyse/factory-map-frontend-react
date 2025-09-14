import Viewer from '../viewer/Viewer';
import React, { useState } from 'react';

export default function ViewerPage() {
  const [filters, setFilters] = useState({
    leanTeam: '',
    proizvodniNalog: '',
    artikel: '',
    operacija: '',
    polje: '',
    cona: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }

  return (
    <div>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#ffffff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.5rem' }}>
          <input name="leanTeam" placeholder="Lean Team" value={filters.leanTeam} onChange={handleChange} />
          <input name="proizvodniNalog" placeholder="Proizvodni nalog" value={filters.proizvodniNalog} onChange={handleChange} />
          <input name="artikel" placeholder="Artikel" value={filters.artikel} onChange={handleChange} />
          <input name="operacija" placeholder="Operacija" value={filters.operacija} onChange={handleChange} />
          <input name="polje" placeholder="Polje" value={filters.polje} onChange={handleChange} />
          <input name="cona" placeholder="Cona" value={filters.cona} onChange={handleChange} />
        </div>
      </div>
      <Viewer />
    </div>
  );
}


