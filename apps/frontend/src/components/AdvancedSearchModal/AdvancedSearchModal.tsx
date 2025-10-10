import React, { useState } from 'react';

interface AdvancedSearchModalProps {
  show: boolean;
  onHide: () => void;
  onSearch: (filters: SearchFilters) => void;
}

export interface SearchFilters {
  odlagalne_zone?: string;
  od_operacije?: number;
  do_operacije?: number;
  status?: string[];
  artikel?: string;
  dodatne_oznake?: string[];
  mode?: string;
  indicator_mode?: string;
  nalog?: string;
  onk?: string;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  show,
  onHide,
  onSearch
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    odlagalne_zone: '',
    od_operacije: 30,
    do_operacije: 200,
    status: ['Prevzeto'],
    artikel: '02',
    dodatne_oznake: [],
    mode: 'agg_Artikel_Cona',
    indicator_mode: 'Artikel',
    nalog: '',
    onk: ''
  });

  const dodatneOznakeOptions = [
    { label: '01 - Impregnacija', value: '1' },
    { label: '10 - Ponovno peskanje', value: '10' },
    { label: '20 - 100% RTG', value: '20' },
    { label: '30 - Ročno čiščenje', value: '30' }
  ];

  const statusOptions = [
    { label: 'Za popra', value: 'Za popra' },
    { label: 'Prevzeto', value: 'Prevzeto' },
    { label: 'Defekt', value: 'Defekt' },
    { label: 'Dodelava', value: 'Dodelava' },
    { label: 'Izmet', value: 'Izmet' }
  ];

  const handleInputChange = (field: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
    onHide();
  };

  const handleReset = () => {
    setFilters({
      odlagalne_zone: '',
      od_operacije: 30,
      do_operacije: 200,
      status: ['Prevzeto'],
      artikel: '02',
      dodatne_oznake: [],
      mode: 'agg_Artikel_Cona',
      indicator_mode: 'Artikel',
      nalog: '',
      onk: ''
    });
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        width: '90vw',
        maxWidth: '1000px',
        height: '90vh',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Napredno iskanje
          </h2>
          <button
            onClick={onHide}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
          {/* Row 1: Odlagalna zona, Artikel, Status */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 2 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Odlagalna zona (npr. 5006)
                </label>
                <input
                  type="text"
                  placeholder="Vnesi odlagalno zono"
                  value={filters.odlagalne_zone || ''}
                  onChange={(e) => handleInputChange('odlagalne_zone', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Artikel
                </label>
                <input
                  type="text"
                  placeholder="Artikel"
                  value={filters.artikel || ''}
                  onChange={(e) => handleInputChange('artikel', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Status
                </label>
                <select
                  multiple
                  value={filters.status || []}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    handleInputChange('status', values);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    minHeight: '42px'
                  }}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Od operacije, Do operacije, Dodatne oznake */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Od operacije
                </label>
                <input
                  type="number"
                  placeholder="Od operacije"
                  value={filters.od_operacije || ''}
                  onChange={(e) => handleInputChange('od_operacije', parseInt(e.target.value) || 0)}
                  step={1}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Do operacije
                </label>
                <input
                  type="number"
                  placeholder="Do operacije"
                  value={filters.do_operacije || ''}
                  onChange={(e) => handleInputChange('do_operacije', parseInt(e.target.value) || 0)}
                  step={1}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 2 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Dodatne oznake zabojnikov
                </label>
                <select
                  multiple
                  value={filters.dodatne_oznake || []}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    handleInputChange('dodatne_oznake', values);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    minHeight: '42px'
                  }}
                >
                  {dodatneOznakeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 3: Mode and Indicator Mode */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Način prikaza
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: filters.mode === 'agg_Nalog_Artikel' ? '#3b82f6' : 'white',
                    color: filters.mode === 'agg_Nalog_Artikel' ? 'white' : '#374151',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="mode"
                      value="agg_Nalog_Artikel"
                      checked={filters.mode === 'agg_Nalog_Artikel'}
                      onChange={(e) => handleInputChange('mode', e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    Na vseh conah skupaj
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: filters.mode === 'agg_Artikel_Cona' ? '#3b82f6' : 'white',
                    color: filters.mode === 'agg_Artikel_Cona' ? 'white' : '#374151',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="mode"
                      value="agg_Artikel_Cona"
                      checked={filters.mode === 'agg_Artikel_Cona'}
                      onChange={(e) => handleInputChange('mode', e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    Na posamezni coni
                  </label>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Indikator način
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: filters.indicator_mode === 'Artikel' ? '#3b82f6' : 'white',
                    color: filters.indicator_mode === 'Artikel' ? 'white' : '#374151',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="indicator_mode"
                      value="Artikel"
                      checked={filters.indicator_mode === 'Artikel'}
                      onChange={(e) => handleInputChange('indicator_mode', e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    Po artiklu
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: filters.indicator_mode === 'Nalog' ? '#3b82f6' : 'white',
                    color: filters.indicator_mode === 'Nalog' ? 'white' : '#374151',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="radio"
                      name="indicator_mode"
                      value="Nalog"
                      checked={filters.indicator_mode === 'Nalog'}
                      onChange={(e) => handleInputChange('indicator_mode', e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    Po nalogu
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Nalog and ONK */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Nalog
                </label>
                <input
                  type="text"
                  placeholder="Vnesi nalog"
                  value={filters.nalog || ''}
                  onChange={(e) => handleInputChange('nalog', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '15px'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '16px', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  ONK
                </label>
                <input
                  type="text"
                  placeholder="Vnesi ONK"
                  value={filters.onk || ''}
                  onChange={(e) => handleInputChange('onk', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
          >
            Ponastavi
          </button>
          <button
            onClick={handleSearch}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Išči
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchModal;