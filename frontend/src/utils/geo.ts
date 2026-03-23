import type { GeoFeature, LngLatPoint } from '../types/domain';

function extractPointCoordinates(coordinates: unknown): [number, number] | null {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return [coordinates[0], coordinates[1]];
  }

  return extractPointCoordinates(coordinates[0]);
}

export function getFeaturePoint(feature?: GeoFeature): LngLatPoint | null {
  if (!feature?.geometry) {
    return null;
  }

  const point = extractPointCoordinates(feature.geometry.coordinates);
  if (!point) {
    return null;
  }

  return {
    lng: point[0],
    lat: point[1],
  };
}
