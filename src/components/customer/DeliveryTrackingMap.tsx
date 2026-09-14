import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

interface LatLng {
  lat: number;
  lng: number;
}

interface DeliveryTrackingMapProps {
  riderLat: number;
  riderLng: number;
  isStale: boolean;
  destination?: LatLng | null;
  store?: LatLng | null;
  style?: StyleProp<ViewStyle>;
}

// Ports frontend/components/DeliveryMap.tsx: react-native-maps needs native code Expo Go doesn't
// bundle (it requires a custom dev-client build, which isn't this project's workflow), so this
// uses the exact same approach the website already does instead - Leaflet + free OpenStreetMap
// tiles inside a WebView, no API key, works in Expo Go out of the box. Store/destination are
// static circle markers with a dashed route line between them, matching the website 1:1; the one
// deliberate difference is the rider marker itself - a bike emoji instead of a plain pin, and its
// position is smoothly animated between poll fixes (requestAnimationFrame tween + a panned camera)
// rather than jumping, so it actually reads as "moving" the way live navigation apps do.
const buildHtml = (rider: LatLng, store: LatLng | null, destination: LatLng | null, isStale: boolean) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #f1f5f9; }
    .rider-emoji { font-size: 28px; line-height: 28px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.45)); transition: opacity 0.3s ease; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${rider.lat}, ${rider.lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var riderIcon = L.divIcon({
      html: '<div class="rider-emoji" id="rider-emoji" style="opacity:${isStale ? '0.55' : '1'}">\u{1F3CD}️</div>',
      className: '', iconSize: [28, 28], iconAnchor: [14, 14],
    });
    var riderMarker = L.marker([${rider.lat}, ${rider.lng}], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);

    var bounds = [[${rider.lat}, ${rider.lng}]];
    ${store ? `
    L.circleMarker([${store.lat}, ${store.lng}], { radius: 8, color: '#065f46', fillColor: '#10b981', fillOpacity: 1, weight: 2 })
      .addTo(map).bindPopup('Store');
    bounds.push([${store.lat}, ${store.lng}]);
    ` : ''}
    ${destination ? `
    L.circleMarker([${destination.lat}, ${destination.lng}], { radius: 8, color: '#9a3412', fillColor: '#f97316', fillOpacity: 1, weight: 2 })
      .addTo(map).bindPopup('Delivery address');
    bounds.push([${destination.lat}, ${destination.lng}]);
    ` : ''}
    ${store && destination ? `
    L.polyline([[${store.lat}, ${store.lng}], [${destination.lat}, ${destination.lng}]], {
      color: '#2563eb', weight: 3, dashArray: '8, 6', opacity: 0.7,
    }).addTo(map);
    ` : ''}
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36] });

    // Called from React Native (injectJavaScript) on every poll - tweens the marker from its
    // current position to the new fix instead of teleporting, and pans the camera along with it.
    window.moveRider = function (lat, lng, stale) {
      var start = riderMarker.getLatLng();
      var end = L.latLng(lat, lng);
      var emojiEl = document.getElementById('rider-emoji');
      if (emojiEl) emojiEl.style.opacity = stale ? '0.55' : '1';
      if (start.equals(end)) return;
      var duration = 1200;
      var startTime = performance.now();
      function step(now) {
        var t = Math.min(1, (now - startTime) / duration);
        var eased = 1 - Math.pow(1 - t, 2);
        riderMarker.setLatLng([
          start.lat + (end.lat - start.lat) * eased,
          start.lng + (end.lng - start.lng) * eased,
        ]);
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      map.panTo(end, { animate: true, duration: 1 });
    };
  </script>
</body>
</html>`;

const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({ riderLat, riderLng, isStale, destination, store, style }) => {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const [initial] = useState({ lat: riderLat, lng: riderLng, store: store ?? null, destination: destination ?? null });

  // The HTML (map/markers/route) is built once from whatever coordinates were available at
  // mount - store/destination never change mid-order, and rebuilding the whole page on every
  // rider poll would reload the map and lose the smooth-move effect entirely.
  const html = useMemo(
    () => buildHtml({ lat: initial.lat, lng: initial.lng }, initial.store, initial.destination, isStale),
    [initial]
  );

  useEffect(() => {
    if (!isReadyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.moveRider && window.moveRider(${riderLat}, ${riderLng}, ${isStale}); true;`
    );
  }, [riderLat, riderLng, isStale]);

  return (
    <View style={style}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onLoadEnd={() => { isReadyRef.current = true; }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
};

export default DeliveryTrackingMap;
