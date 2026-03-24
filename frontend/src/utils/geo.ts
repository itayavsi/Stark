import type { AppLayer, GeoFeature, GeoFeatureCollection, LngLatPoint, MapBounds } from '../types/domain';

const UTM_SCALE_FACTOR = 0.9996;
const UTM_EQUATORIAL_RADIUS = 6378137.0;
const UTM_ECC_SQUARED = 0.00669438;
const UTM_ECC_PRIME_SQUARED = UTM_ECC_SQUARED / (1 - UTM_ECC_SQUARED);
const LAT_BANDS = 'CDEFGHJKLMNPQRSTUVWX';

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

function visitCoordinates(coordinates: unknown, visitor: (lng: number, lat: number) => void): void {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return;
  }

  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visitor(coordinates[0], coordinates[1]);
    return;
  }

  coordinates.forEach((item) => visitCoordinates(item, visitor));
}

export function getGeoJsonBounds(collection?: GeoFeatureCollection): MapBounds | null {
  if (!collection?.features?.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  collection.features.forEach((feature) => {
    if (!feature.geometry) {
      return;
    }

    visitCoordinates(feature.geometry.coordinates, (lng, lat) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
    return null;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

export function getLayersBounds(layers: AppLayer[]): MapBounds | null {
  let combined: MapBounds | null = null;

  layers.forEach((layer) => {
    const bounds = getGeoJsonBounds(layer.data || layer.geojson);
    if (!bounds) {
      return;
    }

    if (!combined) {
      combined = bounds;
      return;
    }

    combined = [
      [
        Math.min(combined[0][0], bounds[0][0]),
        Math.min(combined[0][1], bounds[0][1]),
      ],
      [
        Math.max(combined[1][0], bounds[1][0]),
        Math.max(combined[1][1], bounds[1][1]),
      ],
    ];
  });

  return combined;
}

function hemisphere(value: number, positive: string, negative: string): string {
  return value >= 0 ? positive : negative;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDD(point: LngLatPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function toDegreesDecimalMinutes(value: number) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutes = (absolute - degrees) * 60;
  return { degrees, minutes };
}

export function formatD(point: LngLatPoint): string {
  const lat = toDegreesDecimalMinutes(point.lat);
  const lng = toDegreesDecimalMinutes(point.lng);
  return `${lat.degrees}deg ${lat.minutes.toFixed(4)}' ${hemisphere(point.lat, 'N', 'S')}, ${lng.degrees}deg ${lng.minutes.toFixed(4)}' ${hemisphere(point.lng, 'E', 'W')}`;
}

function toDegreesMinutesSeconds(value: number) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return { degrees, minutes, seconds };
}

export function formatDMS(point: LngLatPoint): string {
  const lat = toDegreesMinutesSeconds(point.lat);
  const lng = toDegreesMinutesSeconds(point.lng);
  return `${lat.degrees}deg ${pad(lat.minutes)}' ${lat.seconds.toFixed(2)}" ${hemisphere(point.lat, 'N', 'S')}, ${lng.degrees}deg ${pad(lng.minutes)}' ${lng.seconds.toFixed(2)}" ${hemisphere(point.lng, 'E', 'W')}`;
}

function getLatitudeBand(lat: number): string {
  const clamped = Math.max(-80, Math.min(84, lat));
  const index = Math.min(LAT_BANDS.length - 1, Math.floor((clamped + 80) / 8));
  return LAT_BANDS[index];
}

export function formatUTM(point: LngLatPoint): string {
  const lat = point.lat;
  const lng = point.lng;
  const zoneNumber = Math.floor((lng + 180) / 6) + 1;
  const latitudeBand = getLatitudeBand(lat);
  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;

  const latRad = lat * (Math.PI / 180);
  const lonRad = lng * (Math.PI / 180);
  const lonOriginRad = lonOrigin * (Math.PI / 180);

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const n = UTM_EQUATORIAL_RADIUS / Math.sqrt(1 - UTM_ECC_SQUARED * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = UTM_ECC_PRIME_SQUARED * cosLat * cosLat;
  const a = cosLat * (lonRad - lonOriginRad);

  const m =
    UTM_EQUATORIAL_RADIUS *
    (
      (1 - UTM_ECC_SQUARED / 4 - 3 * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 64 - 5 * UTM_ECC_SQUARED * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 256) * latRad
      - (3 * UTM_ECC_SQUARED / 8 + 3 * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 32 + 45 * UTM_ECC_SQUARED * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 1024) * Math.sin(2 * latRad)
      + (15 * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 256 + 45 * UTM_ECC_SQUARED * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 1024) * Math.sin(4 * latRad)
      - (35 * UTM_ECC_SQUARED * UTM_ECC_SQUARED * UTM_ECC_SQUARED / 3072) * Math.sin(6 * latRad)
    );

  let easting =
    UTM_SCALE_FACTOR *
      n *
      (
        a
        + (1 - t + c) * Math.pow(a, 3) / 6
        + (5 - 18 * t + t * t + 72 * c - 58 * UTM_ECC_PRIME_SQUARED) * Math.pow(a, 5) / 120
      )
    + 500000.0;

  let northing =
    UTM_SCALE_FACTOR *
    (
      m +
      n *
        tanLat *
        (
          (a * a) / 2
          + (5 - t + 9 * c + 4 * c * c) * Math.pow(a, 4) / 24
          + (61 - 58 * t + t * t + 600 * c - 330 * UTM_ECC_PRIME_SQUARED) * Math.pow(a, 6) / 720
        )
    );

  if (lat < 0) {
    northing += 10000000.0;
  }

  easting = Math.round(easting * 100) / 100;
  northing = Math.round(northing * 100) / 100;

  return `${zoneNumber}${latitudeBand} ${easting.toFixed(2)}E ${northing.toFixed(2)}N`;
}

export function formatAllCoordinateTypes(point: LngLatPoint): string {
  return [
    `DD: ${formatDD(point)}`,
    `D: ${formatD(point)}`,
    `DMS: ${formatDMS(point)}`,
    `UTM: ${formatUTM(point)}`,
  ].join('\n');
}
