/**
 * ResQ — map.
 *
 * Leaflet over OpenStreetMap tiles. Chosen over Google Maps and Mapbox because
 * both need a billing-enabled key, and a prototype that cannot render a map
 * without one is a prototype nobody can run. The provider lives behind
 * TILE_LAYER so swapping it later touches this file only (master prompt §3).
 *
 * The map is never load-bearing: every screen that uses it also renders the
 * same facilities as a list, so a failed tile server degrades to a list rather
 * than an empty page (TDD §15.3).
 */

import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistance } from '../utils/display.js';

const TILE_LAYER = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
};

/**
 * Leaflet's default marker is a PNG resolved relative to the CSS, which breaks
 * under a bundler. divIcon avoids the asset problem and lets the marker carry
 * the same meaning as the list: emergency-capable facilities are distinct in
 * shape, not only colour.
 */
function pin({ emergency, verified }) {
  const fill = emergency ? '#d01b2c' : '#0b5fff';
  const ring = verified ? '#0f7a5a' : 'rgba(255,255,255,.9)';
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:22px;height:22px;border-radius:${
      emergency ? '4px' : '50%'
    };background:${fill};box-shadow:0 0 0 2px ${ring},0 1px 4px rgba(0,0,0,.4)"></span>`,
  });
}

const userPin = L.divIcon({
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#11161c;box-shadow:0 0 0 3px #fff,0 0 0 5px #11161c"></span>',
});

function Recentre({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
}

export function MapView({ center, facilities = [], height = 'h-[320px]', onError }) {
  if (!center) return null;

  return (
    <div className={`${height} overflow-hidden rounded-[6px] border border-line`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="size-full"
        // Keyboard users can pan with arrows once the map has focus.
        keyboard
      >
        <TileLayer
          url={TILE_LAYER.url}
          attribution={TILE_LAYER.attribution}
          eventHandlers={{ tileerror: () => onError?.() }}
        />
        <Recentre center={center} />

        <Marker position={[center.lat, center.lng]} icon={userPin}>
          <Popup>You are searching from here</Popup>
        </Marker>

        {facilities.map((f) => (
          <Marker
            key={f.id}
            position={[f.latitude, f.longitude]}
            icon={pin({
              emergency: f.hasEmergency,
              verified: f.verificationStatus === 'VERIFIED',
            })}
          >
            <Popup>
              <span className="block font-semibold">{f.name}</span>
              {f.distanceMeters != null && (
                <span className="block text-sm">{formatDistance(f.distanceMeters)} away</span>
              )}
              <Link to={`/facility/${f.id}`} className="text-signal underline">
                Open details
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
