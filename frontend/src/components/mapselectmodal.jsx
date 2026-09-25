import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Rectangle,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapselectmodal.css';

// Free satellite basemap — no API key required.
const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function boundsToBbox(bounds) {
  if (!bounds) return null;
  return [
    Number(bounds.getWest().toFixed(6)),
    Number(bounds.getSouth().toFixed(6)),
    Number(bounds.getEast().toFixed(6)),
    Number(bounds.getNorth().toFixed(6)),
  ];
}

/**
 * Controller to smoothly animate the map when a location is selected from search.
 */
function MapNavigator({ targetLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!targetLocation) return;

    if (targetLocation.bbox && targetLocation.bbox.length === 4) {
      // Nominatim bbox: [southLat, northLat, westLon, eastLon]
      const [south, north, west, east] = targetLocation.bbox.map(Number);
      if (!isNaN(south) && !isNaN(north) && !isNaN(west) && !isNaN(east)) {
        map.flyToBounds(
          [
            [south, west],
            [north, east],
          ],
          { duration: 1.6, maxZoom: 15, padding: [40, 40] }
        );
        return;
      }
    }

    if (targetLocation.lat && targetLocation.lon) {
      const lat = parseFloat(targetLocation.lat);
      const lon = parseFloat(targetLocation.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        map.flyTo([lat, lon], 13, { duration: 1.6 });
      }
    }
  }, [targetLocation, map]);

  return null;
}

/**
 * Lives inside <MapContainer>. Handles the actual click-drag rectangle
 * drawing and toggles Leaflet's own pan/zoom-drag off while drawing so
 * the two gestures don't fight each other.
 */
function DrawController({ drawing, onBoundsChange, onDrawEnd }) {
  const map = useMap();
  const [start, setStart] = useState(null);

  useEffect(() => {
    if (drawing) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
    }
  }, [drawing, map]);

  useMapEvents({
    mousedown(e) {
      if (!drawing) return;
      setStart(e.latlng);
      onBoundsChange(L.latLngBounds(e.latlng, e.latlng));
    },
    mousemove(e) {
      if (!drawing || !start) return;
      onBoundsChange(L.latLngBounds(start, e.latlng));
    },
    mouseup(e) {
      if (!drawing || !start) return;
      onBoundsChange(L.latLngBounds(start, e.latlng));
      setStart(null);
      onDrawEnd();
    },
  });

  return null;
}

export default function MapSelectModal({ onClose, onConfirm }) {
  const [drawing, setDrawing] = useState(false);
  const [bounds, setBounds] = useState(null);

  // Location search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [targetLocation, setTargetLocation] = useState(null);

  const searchContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const bbox = useMemo(() => boundsToBbox(bounds), [bounds]);

  const handleDrawEnd = useCallback(() => setDrawing(false), []);

  const handleDrawClick = () => {
    setBounds(null);
    setDrawing(true);
  };

  const handleConfirm = () => {
    if (bbox) onConfirm(bbox);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const executeSearch = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&limit=5&addressdetails=1`;
      const res = await fetch(endpoint, {
        signal: abortControllerRef.current.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Search failed. Please try again.');
      }

      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Location search error:', err);
        setSearchError('Unable to load locations. Please try again.');
        setShowDropdown(true);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setHasSearched(false);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // Debounce search while typing (450ms)
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(val);
    }, 450);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (searchResults.length > 0 && showDropdown) {
        handleSelectLocation(searchResults[0]);
      } else {
        executeSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSelectLocation = (item) => {
    const primaryName = item.display_name.split(',')[0];
    setSearchQuery(primaryName);
    setShowDropdown(false);
    setTargetLocation({
      lat: item.lat,
      lon: item.lon,
      bbox: item.boundingbox,
      name: item.display_name,
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSearchError(null);
    setHasSearched(false);
    setTargetLocation(null);
  };

  const subtitle = drawing
    ? 'Click and drag to draw a box'
    : bounds
    ? 'Redraw or confirm your selection'
    : 'Search a location or pan/zoom, then draw a box';

  return (
    <div className="map-modal-backdrop">
      <div className="map-modal-shell">
        <div className="map-modal-header">
          <div className="map-modal-title">
            <span className="map-modal-title-main">Select a region</span>
            <span className="map-modal-title-sub">{subtitle}</span>
          </div>
          <button className="map-modal-close" onClick={onClose} aria-label="Close map selector">
            ×
          </button>
        </div>

        <div className="map-modal-body">
          {/* Floating Location Search */}
          <div
            className="map-search-container"
            ref={searchContainerRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="map-search-bar">
              <svg
                className="map-search-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="map-search-input"
                placeholder="Search city, address, or landmark..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
              />
              {isSearching && <span className="map-search-spinner" />}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  className="map-search-clear"
                  onClick={handleClearSearch}
                  aria-label="Clear location search"
                >
                  ×
                </button>
              )}
              <button
                type="button"
                className="map-search-btn"
                onClick={() => executeSearch(searchQuery)}
                disabled={!searchQuery.trim() || isSearching}
              >
                Search
              </button>
            </div>

            {showDropdown && searchResults.length > 0 && (
              <ul className="map-search-dropdown">
                {searchResults.map((item, idx) => {
                  const parts = item.display_name.split(',');
                  const primary = parts[0];
                  const secondary = parts.slice(1).join(',').trim();
                  return (
                    <li
                      key={item.place_id || idx}
                      className="map-search-result-item"
                      onClick={() => handleSelectLocation(item)}
                    >
                      <svg
                        className="result-pin-icon"
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="#00B4D8"
                        strokeWidth="2"
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                        <circle cx="12" cy="9" r="2.5"></circle>
                      </svg>
                      <div className="result-info">
                        <span className="result-primary">{primary}</span>
                        {secondary && <span className="result-secondary">{secondary}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {showDropdown &&
              !isSearching &&
              searchQuery.trim() &&
              searchResults.length === 0 &&
              !searchError &&
              hasSearched && (
                <div className="map-search-dropdown empty">
                  <span>No locations found for &ldquo;{searchQuery}&rdquo;</span>
                </div>
              )}

            {showDropdown && searchError && (
              <div className="map-search-dropdown error">
                <span>{searchError}</span>
              </div>
            )}
          </div>

          <MapContainer center={[20, 78]} zoom={4} scrollWheelZoom className="map-modal-map">
            <TileLayer url={SATELLITE_TILE_URL} attribution={SATELLITE_ATTRIBUTION} />
            <MapNavigator targetLocation={targetLocation} />
            <DrawController drawing={drawing} onBoundsChange={setBounds} onDrawEnd={handleDrawEnd} />
            {targetLocation && targetLocation.lat && targetLocation.lon && (
              <CircleMarker
                center={[parseFloat(targetLocation.lat), parseFloat(targetLocation.lon)]}
                radius={6}
                pathOptions={{
                  color: '#00B4D8',
                  fillColor: '#ffffff',
                  fillOpacity: 1,
                  weight: 3,
                }}
              />
            )}
            {bounds && (
              <Rectangle
                bounds={bounds}
                pathOptions={{
                  color: '#00B4D8',
                  weight: 2,
                  fillColor: '#00B4D8',
                  fillOpacity: 0.15,
                  dashArray: '6 4',
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="map-modal-footer">
          <div className="map-modal-coords">
            {bbox ? (
              <>
                <span className="coord-item">
                  <b>min_lon</b>
                  {bbox[0]}
                </span>
                <span className="coord-item">
                  <b>min_lat</b>
                  {bbox[1]}
                </span>
                <span className="coord-item">
                  <b>max_lon</b>
                  {bbox[2]}
                </span>
                <span className="coord-item">
                  <b>max_lat</b>
                  {bbox[3]}
                </span>
              </>
            ) : (
              <span className="coord-placeholder">No region drawn yet</span>
            )}
          </div>

          <div className="map-modal-actions">
            <button className="map-btn map-btn-ghost" onClick={handleDrawClick}>
              {bounds ? 'Redraw' : 'Draw box'}
            </button>
            <button className="map-btn map-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="map-btn map-btn-primary" onClick={handleConfirm} disabled={!bbox}>
              Use this region
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
