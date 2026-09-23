import React, { useMemo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

interface AddressMapPreviewProps {
  lat: number;
  lng: number;
  label: string;
  style?: StyleProp<ViewStyle>;
}

// A small, honest "here's where this is" map - one static pin, no live tracking. Modeled on
// DeliveryTrackingMap.tsx's WebView+Leaflet technique, stripped down: no rider marker, no
// animation, no polling, since a saved address never moves.
const buildHtml = (lat: number, lng: number, label: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>html, body, #map { height: 100%; margin: 0; padding: 0; background: #f1f5f9; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.circleMarker([${lat}, ${lng}], { radius: 9, color: '#065f46', fillColor: '#10b981', fillOpacity: 1, weight: 2 })
      .addTo(map)
      .bindTooltip(${JSON.stringify(label)});
  </script>
</body>
</html>`;

const AddressMapPreview: React.FC<AddressMapPreviewProps> = ({ lat, lng, label, style }) => {
  const html = useMemo(() => buildHtml(lat, lng, label), [lat, lng, label]);

  return (
    <View style={style}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
};

export default AddressMapPreview;
