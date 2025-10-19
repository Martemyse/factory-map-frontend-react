import { useState, useEffect } from 'react';
import { config } from '../../config';

interface FeatureEditModalProps {
  featureId: string;
  featureName: string;
  opomba: string | undefined;
  color: string | undefined;
  level: string;
  maxCapacity: number | undefined;
  takenCapacity: number | undefined;
  locked: boolean | undefined;
  onClose: () => void;
  onUpdateField: (field: string, value: any) => Promise<boolean>;
}

export default function FeatureEditModal({
  featureId,
  featureName,
  opomba,
  color,
  level,
  maxCapacity,
  takenCapacity,
  locked,
  onClose,
  onUpdateField
}: FeatureEditModalProps) {
  const [name, setName] = useState(featureName);
  const [note, setNote] = useState(opomba || '');
  const [featureColor, setFeatureColor] = useState(color || '#3b82f6');
  const [featureLevel, setFeatureLevel] = useState(level);
  const [capacity, setCapacity] = useState(maxCapacity?.toString() || '0');
  const [taken, setTaken] = useState(takenCapacity?.toString() || '0');
  const [isLocked, setIsLocked] = useState(locked || false);
  
  // Border colors for each field
  const [nameBorder, setNameBorder] = useState('#d1d5db');
  const [noteBorder, setNoteBorder] = useState('#d1d5db');
  const [colorBorder, setColorBorder] = useState('#d1d5db');
  const [levelBorder, setLevelBorder] = useState('#d1d5db');
  const [capacityBorder, setCapacityBorder] = useState('#d1d5db');
  const [takenBorder, setTakenBorder] = useState('#d1d5db');
  const [lockedBorder, setLockedBorder] = useState('#d1d5db');

  // Handle field updates with visual feedback
  const handleFieldUpdate = async (
    field: string,
    value: any,
    setBorderColor: (color: string) => void
  ) => {
    try {
      const success = await onUpdateField(field, value);
      if (success) {
        setBorderColor('#10b981'); // Green border on success
        setTimeout(() => setBorderColor('#d1d5db'), 2000); // Reset after 2s
      } else {
        setBorderColor('#ef4444'); // Red border on failure
        setTimeout(() => setBorderColor('#d1d5db'), 2000);
      }
    } catch (error) {
      setBorderColor('#ef4444');
      setTimeout(() => setBorderColor('#d1d5db'), 2000);
    }
  };

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle Escape key to close modal
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '500px',
          maxWidth: '600px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Edit Feature</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleFieldUpdate('name', name, setNameBorder)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${nameBorder}`,
                borderRadius: '6px',
                fontSize: '14px',
                transition: 'border-color 0.3s ease'
              }}
            />
          </div>

          {/* Locked Field */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              <input
                type="checkbox"
                checked={isLocked}
                onChange={(e) => {
                  setIsLocked(e.target.checked);
                  handleFieldUpdate('locked', e.target.checked, setLockedBorder);
                }}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#3b82f6'
                }}
              />
              Locked
            </label>
          </div>

          {/* Note/Opomba Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Note (Opomba)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => handleFieldUpdate('opomba', note, setNoteBorder)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${noteBorder}`,
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                transition: 'border-color 0.3s ease'
              }}
            />
          </div>

          {/* Color Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={featureColor}
                onChange={(e) => {
                  setFeatureColor(e.target.value);
                  handleFieldUpdate('color', e.target.value, setColorBorder);
                }}
                style={{
                  width: '60px',
                  height: '40px',
                  border: `2px solid ${colorBorder}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'border-color 0.3s ease'
                }}
              />
              <input
                type="text"
                value={featureColor}
                onChange={(e) => setFeatureColor(e.target.value)}
                onBlur={() => handleFieldUpdate('color', featureColor, setColorBorder)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: `2px solid ${colorBorder}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  transition: 'border-color 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Level Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Level *
            </label>
            <input
              type="text"
              value={featureLevel}
              onChange={(e) => setFeatureLevel(e.target.value)}
              onBlur={() => handleFieldUpdate('level', featureLevel, setLevelBorder)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${levelBorder}`,
                borderRadius: '6px',
                fontSize: '14px',
                transition: 'border-color 0.3s ease'
              }}
            />
          </div>

          {/* Max Capacity Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Max Capacity
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              onBlur={() => {
                const numValue = parseInt(capacity, 10);
                if (!isNaN(numValue) && numValue >= 0) {
                  handleFieldUpdate('max_capacity', numValue, setCapacityBorder);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${capacityBorder}`,
                borderRadius: '6px',
                fontSize: '14px',
                transition: 'border-color 0.3s ease'
              }}
            />
          </div>

          {/* Taken Capacity Field */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Taken Capacity
            </label>
            <input
              type="number"
              value={taken}
              onChange={(e) => setTaken(e.target.value)}
              onBlur={() => {
                const numValue = parseInt(taken, 10);
                if (!isNaN(numValue) && numValue >= 0) {
                  handleFieldUpdate('taken_capacity', numValue, setTakenBorder);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${takenBorder}`,
                borderRadius: '6px',
                fontSize: '14px',
                transition: 'border-color 0.3s ease'
              }}
            />
          </div>

        
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

