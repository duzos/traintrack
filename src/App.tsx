// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import './App.css';

import './services/signalbox.ts'; 

// Fix for default Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { fetchData, getTrainPositions } from './services/signalbox';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Types
export interface TrainPosition {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  service: string;
  operator: string;
  destination: string;
  delay: number;
}


interface RailwayTrack {
  id: string;
  coordinates: [number, number][];
  type: 'main' | 'branch' | 'siding';
}

// Train Icon Component
const TrainIcon: React.FC<{
  position: TrainPosition;
  onTrainClick: (train: TrainPosition) => void;
}> = ({ position, onTrainClick }) => {
  const map = useMap();
  const trainRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const trainIcon = L.divIcon({
      className: 'train-marker',
      html: `
        <div style="
          width: 24px;
          height: 10px;
          background: ${position.speed > 0 ? '#2563eb' : '#dc2626'};
          border: 2px solid ${position.speed > 0 ? '#1e40af' : '#b91c1c'};
          border-radius: 3px;
          transform: rotate(${position.heading}deg);
          transform-origin: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <div style="
            width: 3px;
            height: 3px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [24, 10],
      iconAnchor: [12, 5],
    });

    if (trainRef.current) {
      map.removeLayer(trainRef.current);
    }

    trainRef.current = L.marker([position.lat, position.lng], {
      icon: trainIcon,
    })
      .addTo(map)
      .on('click', () => onTrainClick(position));

    // Add service label
    const labelIcon = L.divIcon({
      className: 'train-label',
      html: `
        <div style="
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          color: #333;
          border: 1px solid #ccc;
          white-space: nowrap;
          text-align: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        ">
          ${position.service}
        </div>
      `,
      iconSize: [40, 15],
      iconAnchor: [20, -8],
    });

    const labelMarker = L.marker([position.lat, position.lng], {
      icon: labelIcon,
    }).addTo(map);

    return () => {
      if (trainRef.current) {
        map.removeLayer(trainRef.current);
      }
      map.removeLayer(labelMarker);
    };
  }, [position, map, onTrainClick]);

  return null;
};

// Railway Track Component
const RailwayTrack: React.FC<{ track: RailwayTrack }> = ({ track }) => {
  const getTrackColor = (type: string) => {
    switch (type) {
      case 'main': return '#4a5568';
      case 'branch': return '#718096';
      case 'siding': return '#a0aec0';
      default: return '#4a5568';
    }
  };

  return (
    <Polyline
      positions={track.coordinates}
      color={getTrackColor(track.type)}
      weight={4}
      opacity={0.8}
    />
  );
};

// Statistics Panel
const StatisticsPanel: React.FC<{ trains: TrainPosition[] }> = ({ trains }) => {
  const movingTrains = trains.filter(t => t.speed > 0).length;
  const delayedTrains = trains.filter(t => t.delay > 0).length;
  const avgSpeed = trains.length > 0 
    ? Math.round(trains.reduce((sum, t) => sum + t.speed, 0) / trains.length)
    : 0;

  return (
    <div className="stats-panel">
      <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '0.75rem', color: '#1f2937' }}>
        Live Statistics
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: '180px' }}>
          <span style={{ color: '#6b7280' }}>Total Trains:</span>
          <span className="status-blue" style={{ fontWeight: '500' }}>{trains.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Moving:</span>
          <span className="status-green" style={{ fontWeight: '500' }}>{movingTrains}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Stopped:</span>
          <span className="status-red" style={{ fontWeight: '500' }}>{trains.length - movingTrains}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Delayed:</span>
          <span className="status-orange" style={{ fontWeight: '500' }}>{delayedTrains}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Avg Speed:</span>
          <span style={{ fontWeight: '500', color: '#1f2937' }}>{avgSpeed} mph</span>
        </div>
      </div>
    </div>
  );
};

// Train Info Panel
const TrainInfoPanel: React.FC<{
  selectedTrain: TrainPosition | null;
  onClose: () => void;
}> = ({ selectedTrain, onClose }) => {
  if (!selectedTrain) return null;

  return (
    <div className="train-info-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#1f2937' }}>
          {selectedTrain.service} - {selectedTrain.operator}
        </h3>
        <button 
          onClick={onClose}
          style={{ 
            color: '#6b7280', 
            fontSize: '1.25rem', 
            background: 'none', 
            border: 'none',
            cursor: 'pointer',
            lineHeight: '1'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#374151'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
        >
          ×
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Destination:</span>
          <span style={{ fontWeight: '500' }}>{selectedTrain.destination}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Speed:</span>
          <span style={{ fontWeight: '500' }}>{Math.round(selectedTrain.speed)} mph</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Delay:</span>
          <span 
            className={
              selectedTrain.delay === 0 
                ? 'status-green' 
                : selectedTrain.delay > 5 
                  ? 'status-red' 
                  : 'status-yellow'
            }
            style={{ fontWeight: '500' }}
          >
            {selectedTrain.delay === 0 ? 'On time' : `${Math.round(selectedTrain.delay)} min late`}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Status:</span>
          <span 
            className={selectedTrain.speed > 0 ? 'status-green' : 'status-red'}
            style={{ fontWeight: '500' }}
          >
            {selectedTrain.speed > 0 ? 'Moving' : 'Stopped'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6b7280' }}>Heading:</span>
          <span style={{ fontWeight: '500' }}>{Math.round(selectedTrain.heading)}°</span>
        </div>
      </div>
    </div>
  );
};

// Legend Component
const Legend: React.FC<{ lastUpdate: Date }> = ({ lastUpdate }) => {
  return (
    <div className="legend-panel">
      <h4 style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Legend</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="train-legend-box train-legend-moving"></div>
          <span>Moving Train</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="train-legend-box train-legend-stopped"></div>
          <span>Stopped Train</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="track-legend-line track-main"></div>
          <span>Main Line</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="track-legend-line track-branch"></div>
          <span>Branch Line</span>
        </div>
      </div>
      <div style={{ 
        marginTop: '0.5rem', 
        paddingTop: '0.5rem', 
        borderTop: '1px solid #e5e7eb', 
        fontSize: '0.75rem', 
        color: '#6b7280' 
      }}>
        Last update: {lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
};

// Styles
enum MapStyle {
  Standard = 'standard',
  Signals = 'signals',
  Maxspeed = 'maxspeed',
  Electrification = 'electrification',
}

const StyleSelectButton: React.FC<{
  style: MapStyle;
  current: MapStyle;
  setCurrentStyle: (style: MapStyle) => void;
}> = ({ style, current, setCurrentStyle }) => {
  const isSelected = current === style;
  const colors = {
    [MapStyle.Standard]: { border: '#2563eb', background: '#2563eb', color: '#fff' },
    [MapStyle.Signals]: { border: '#059669', background: '#059669', color: '#fff' },
    [MapStyle.Maxspeed]: { border: '#f59e42', background: '#f59e42', color: '#fff' },
    [MapStyle.Electrification]: { border: '#a855f7', background: '#a855f7', color: '#fff' },
  };

  return (
    <button
      className={`style-select-btn${isSelected ? ' selected' : ''}`}
      style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '4px',
        border: isSelected ? `2px solid ${colors[style].border}` : '1px solid #d1d5db',
        background: isSelected ? colors[style].background : '#f3f4f6',
        color: isSelected ? colors[style].color : '#1f2937',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
      disabled={isSelected}
      title={`${style.charAt(0).toUpperCase() + style.slice(1)} railway map`}
      onClick={() => setCurrentStyle(style)}
    >
      {style.charAt(0).toUpperCase() + style.slice(1)}
    </button>
  );
} 

const StyleSelect: React.FC<{ current: MapStyle, setCurrentStyle: (style: MapStyle) => void }> = ({ current, setCurrentStyle }) => {
  return (
    <div className="style-panel">
      <h4 style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Styles</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {Object.values(MapStyle).map(style => (
          <StyleSelectButton
        key={style}
        style={style as MapStyle}
        current={current}
        setCurrentStyle={setCurrentStyle}
          />
        ))}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        Select a map style to highlight different railway features.
      </div>
      </div>
    </div>
  );
};

const TrainLayer: React.FC<{ trains: TrainPosition[], onTrainClick: (train: TrainPosition) => void }> = ({ trains, onTrainClick }) => {
  const [updateKey, setUpdateKey] = useState(0);
  
  useEffect(() => {
    setUpdateKey(prev => prev + 1);
  }, [trains]);
  
  return (
    <>
      {trains.map(train => (
        <TrainIcon
          key={`${train.id}-${updateKey}`}
          position={train}
          onTrainClick={onTrainClick}
        />
      ))}
    </>
  );
};

// Main App Component
const App: React.FC = () => {
  const [trains, setTrains] = useState<TrainPosition[]>([]);
  const [tracks] = useState<RailwayTrack[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<TrainPosition | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentStyle, setCurrentStyle] = useState<MapStyle>(MapStyle.Standard);
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getTrainPositions();
        console.log('SignalBox data:', data);
        setTrains(data);
        setUpdateKey(prev => prev + 1); // This forces complete re-render
        setLastUpdate(new Date()); // Update the timestamp
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    // Load data immediately
    loadData();

    // Set up interval to load data every 10 seconds
    const interval = setInterval(loadData, 10000); // 10000ms = 10 seconds

    // Cleanup function to clear interval when component unmounts
    return () => clearInterval(interval);
  }, []); // Empty dependency array

  const handleTrainClick = (train: TrainPosition) => {
    setSelectedTrain(train);
  };

  return (
    <div className="App">
      <MapContainer 
        center={[52.0, -1.0]} 
        zoom={6}
        style={{ height: '100vh', width: '100vw' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          className='greyscale'
        />
        <TileLayer
          url={`https://{s}.tiles.openrailwaymap.org/${currentStyle.toLowerCase()}/{z}/{x}/{y}.png`}
          subdomains={['a','b','c']}
          attribution='&copy; OpenRailwayMap'
        />

        {tracks.map(track => (
          <RailwayTrack key={track.id} track={track} />
        ))}
        
        <TrainLayer trains={trains} onTrainClick={handleTrainClick} />
      </MapContainer>

      <StatisticsPanel trains={trains} />
      
      <TrainInfoPanel 
        selectedTrain={selectedTrain}
        onClose={() => setSelectedTrain(null)}
      />

      <StyleSelect current={currentStyle} setCurrentStyle={setCurrentStyle} />
      <Legend lastUpdate={lastUpdate} />

      <div className="controls-info">
        <div>🗺️ Drag to pan around</div>
        <div>🔍 Mouse wheel to zoom</div>
        <div>🚂 Click trains for details</div>
      </div>
    </div>
  );
};

export default App;