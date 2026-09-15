import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useNearbyPlaces } from "../context/NearbyPlacesContext";

const CATEGORY_EMOJI = {
  food: "🍽️",
  shopping: "🛍️",
};

function formatDistance(place) {
  if (place.distanceMeters == null) return "Nearby";
  if (place.distanceMeters < 1000) return `${place.distanceMeters} m`;
  return `${(place.distanceMeters / 1000).toFixed(1)} km`;
}

function placeIcon(category) {
  const emoji = CATEGORY_EMOJI[category] || "📍";
  const accent = category === "food" ? "#c45c26" : "#2f6fed";

  return L.divIcon({
    className: "nearby-place-marker",
    html: `<div class="nearby-place-marker-pin" style="--place-accent:${accent}">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPopupHtml(place) {
  const meta = [
    formatDistance(place),
    place.walkingMinutes ? `${place.walkingMinutes} min walk` : null,
    place.isOpen === true ? "Open" : place.isOpen === false ? "Closed" : null,
    place.rating != null ? `${place.rating.toFixed(1)} ★` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const directions = place.directionsUrl
    ? `<a class="nearby-place-popup-link" href="${escapeHtml(place.directionsUrl)}" target="_blank" rel="noopener noreferrer">Directions from charger</a>`
    : "";

  return `
    <div class="nearby-place-popup">
      <div class="nearby-place-popup-type">${escapeHtml(place.typeLabel || "Place")}</div>
      <div class="nearby-place-popup-title">${escapeHtml(place.name)}</div>
      ${place.address ? `<div class="nearby-place-popup-address">${escapeHtml(place.address)}</div>` : ""}
      <div class="nearby-place-popup-meta">${escapeHtml(meta)}</div>
      ${directions}
    </div>
  `;
}

/**
 * Renders food/shopping markers from the shared NearbyPlacesContext fetch.
 * Cleared when the sidebar selection is closed / places list empties.
 */
export default function NearbyPlaceMarkers() {
  const map = useMap();
  const { places } = useNearbyPlaces();
  const layerRef = useRef(null);

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.clearLayers();

    places.forEach((place) => {
      const lat = Number(place.latitude);
      const lng = Number(place.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;

      const marker = L.marker([lat, lng], {
        icon: placeIcon(place.category),
        zIndexOffset: 200,
      });
      marker.bindPopup(buildPopupHtml(place), {
        maxWidth: 260,
        className: "nearby-place-popup-container",
      });
      layer.addLayer(marker);
    });
  }, [places, map]);

  return null;
}
