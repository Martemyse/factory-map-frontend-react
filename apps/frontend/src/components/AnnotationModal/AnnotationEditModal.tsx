import { useEffect, useState } from 'react';
import { config } from '../../config';
import AdvancedSearchModal, { type SearchFilters } from '../AdvancedSearchModal/AdvancedSearchModal';

interface AnnotationEditModalProps {
  annotationName: string;
  maxCapacity: number | undefined;
  onClose: () => void;
  onUpdateCapacity: (newCapacity: number) => void;
  searchFilters?: SearchFilters;
}

// Extract number from parentheses in annotation name
// Examples: "LJ Za peskanje, vrsta 12 (500112)" -> "500112"
//           "LJ, STGH 2 (5022)" -> "5022"
function extractNumberFromName(name: string): string | null {
  const match = name.match(/\((\d+)\)/);
  return match ? match[1] : null;
}

export default function AnnotationEditModal({
  annotationName,
  maxCapacity,
  onClose,
  onUpdateCapacity,
  searchFilters: initialSearchFilters
}: AnnotationEditModalProps) {
  const [capacity, setCapacity] = useState<string>(maxCapacity?.toString() || '0');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(initialSearchFilters || {});
  const locationCode = extractNumberFromName(annotationName);

  // Determine the iframe URL based on environment
  const baseUrl = config.isDevelopment 
    ? 'http://127.0.0.1:8050' 
    : 'http://ecotech.utlth-ol.si:8082/iframe';
  
  // Build iframe URL with search filters
  const buildIframeUrl = () => {
    const params = new URLSearchParams();
    
    // Add location code if available
    if (locationCode) {
      params.append('input_odlagalne_zone', locationCode);
    }
    
    // Add search filters
    if (searchFilters.odlagalne_zone) {
      params.set('input_odlagalne_zone', searchFilters.odlagalne_zone);
    }
    if (searchFilters.od_operacije) {
      params.append('input_od_operacije', searchFilters.od_operacije.toString());
    }
    if (searchFilters.do_operacije) {
      params.append('input_do_operacije', searchFilters.do_operacije.toString());
    }
    if (searchFilters.status && searchFilters.status.length > 0) {
      params.append('dropdown_status', searchFilters.status.join(','));
    }
    if (searchFilters.artikel) {
      params.append('input_artikel', searchFilters.artikel);
    }
    if (searchFilters.dodatne_oznake && searchFilters.dodatne_oznake.length > 0) {
      params.append('logistika_dropdown_dodatne_oznake', searchFilters.dodatne_oznake.join(','));
    }
    if (searchFilters.mode) {
      params.append('radiobutton_mode_agg', searchFilters.mode);
    }
    if (searchFilters.indicator_mode) {
      params.append('radiobutton_indicator_mode', searchFilters.indicator_mode);
    }
    if (searchFilters.nalog) {
      params.append('input_nalog', searchFilters.nalog);
    }
    if (searchFilters.onk) {
      params.append('input_onk', searchFilters.onk);
    }
    
    const queryString = params.toString();
    return queryString 
      ? `${baseUrl}/findzabojnikilokacije?${queryString}`
      : `${baseUrl}/findzabojnikilokacije`;
  };
  
  const iframeUrl = buildIframeUrl();

  // Update capacity immediately when input changes
  const handleCapacityChange = (value: string) => {
    setCapacity(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      onUpdateCapacity(numValue);
    }
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      style={{
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
      }}
      onClick={handleBackdropClick}
    >
      <div 
        style={{
          width: '90vw',
          height: '90vh',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
              Edit Annotation
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
              {annotationName}
            </p>
          </div>
          <button
            onClick={onClose}
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
        <div style={{ 
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: 1,
          overflow: 'auto'
        }}>
          {/* Capacity Input */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#374151'
            }}>
              Max Capacity
            </label>
            <input
              type="number"
              min="0"
              value={capacity}
              onChange={(e) => handleCapacityChange(e.target.value)}
              style={{
                width: '200px',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
            />
            <p style={{ 
              marginTop: '6px', 
              fontSize: '12px', 
              color: '#6b7280' 
            }}>
              Changes are saved automatically
            </p>
          </div>

          {/* Location Code Info */}
          {locationCode && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1e40af'
            }}>
              <strong>Odlagalna cona:</strong> {locationCode}
            </div>
          )}

          {/* Advanced Search Button */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={() => setShowAdvancedSearch(true)}
              style={{
                padding: '10px 16px',
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
              Napredno iskanje
            </button>
            {Object.keys(searchFilters).length > 0 && (
              <div style={{
                padding: '6px 12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1e40af'
              }}>
                Filters applied: {Object.keys(searchFilters).length}
              </div>
            )}
          </div>

          {/* Iframe */}
          <div style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '400px'
          }}>
            <label style={{ 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500',
              color: '#374151'
            }}>
              Location Details
            </label>
            <iframe
              src={iframeUrl}
              style={{
                flex: 1,
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}
              title="Location Details"
            />
          </div>
        </div>
      </div>

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        show={showAdvancedSearch}
        onHide={() => setShowAdvancedSearch(false)}
        onSearch={(filters) => {
          setSearchFilters(filters);
          setShowAdvancedSearch(false);
        }}
      />
    </div>
  );
}

