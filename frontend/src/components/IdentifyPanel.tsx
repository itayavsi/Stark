import { useMemo, useState, type CSSProperties } from 'react';

import type { IdentifiedFeature, IdentifyResults } from '../types/domain';
import { formatDD } from '../utils/geo';

interface IdentifyPanelProps {
  results: IdentifyResults | null;
  onClose: () => void;
  onFeatureSelect: (feature: IdentifiedFeature) => void;
  selectedFeatureId: string | number | null;
}

export default function IdentifyPanel({ results, onClose, onFeatureSelect, selectedFeatureId }: IdentifyPanelProps) {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const groupedFeatures = useMemo(() => {
    if (!results?.features.length) {
      return {};
    }
    const groups: Record<string, IdentifiedFeature[]> = {};
    results.features.forEach((f) => {
      const key = f.layerName;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(f);
    });
    return groups;
  }, [results]);

  const toggleLayer = (layer: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  if (!results) {
    return null;
  }

  const layers = Object.keys(groupedFeatures);

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={S.title}>Identify Results</span>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={S.location}>
        Location: {formatDD(results.location)}
      </div>

      <div style={S.count}>
        {results.features.length} feature{results.features.length !== 1 ? 's' : ''} found
      </div>

      <div style={S.list}>
        {layers.map((layer) => (
          <div key={layer} style={S.layerGroup}>
            <div style={S.layerHeader} onClick={() => toggleLayer(layer)}>
              <span style={S.expandIcon}>{expandedLayers.has(layer) ? '▼' : '▶'}</span>
              <span style={S.layerName}>{layer}</span>
              <span style={S.layerCount}>({groupedFeatures[layer].length})</span>
            </div>

            {expandedLayers.has(layer) && (
              <div style={S.features}>
                {groupedFeatures[layer].map((f, idx) => {
                  const featureId = f.feature.properties?.quest_id || f.feature.id || `idx-${idx}`;
                  const isSelected = featureId === selectedFeatureId;
                  return (
                    <div
                      key={String(featureId)}
                      style={{ ...S.featureRow, ...(isSelected ? S.featureRowSelected : {}) }}
                      onClick={() => onFeatureSelect(f)}
                    >
                      <div style={S.featureType}>
                        {f.geometryType === 'point' ? '●' : '■'} {f.geometryType}
                      </div>
                      {f.feature.properties && (
                        <div style={S.attributes}>
                          {Object.entries(f.feature.properties).map(([key, value]) => {
                            if (key === 'quest_type' || key === 'ft') {
                              return null;
                            }
                            const displayValue = value !== null && value !== undefined ? String(value) : '-';
                            return (
                              <div key={key} style={S.attrRow}>
                                <span style={S.attrKey}>{key}:</span>
                                <span style={S.attrValue}>{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    width: 300,
    maxHeight: '60vh',
    overflowY: 'auto',
    background: 'var(--overlay-strong)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 12,
    boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 16,
  },
  location: {
    fontSize: 13,
    color: 'var(--text3)',
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
    color: 'var(--text2)',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid var(--border)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  layerGroup: {
    background: 'var(--surface)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  layerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'var(--surface2)',
  },
  expandIcon: {
    fontSize: 12,
    color: 'var(--text3)',
  },
  layerName: {
    flex: 1,
  },
  layerCount: {
    fontSize: 13,
    color: 'var(--text3)',
    fontWeight: 400,
  },
  features: {
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  featureRow: {
    padding: '8px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    background: 'var(--overlay)',
    border: '1px solid transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  featureRowSelected: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  featureType: {
    fontSize: 13,
    color: 'var(--text2)',
    marginBottom: 4,
  },
  attributes: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  attrRow: {
    fontSize: 13,
    display: 'flex',
    gap: 6,
  },
  attrKey: {
    color: 'var(--text3)',
    minWidth: 80,
  },
  attrValue: {
    color: 'var(--text)',
    wordBreak: 'break-word',
  },
};
