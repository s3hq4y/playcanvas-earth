import * as pc from 'playcanvas';

type GeoJsonPosition = [number, number] | [number, number, number];

type GeoJsonGeometry = {
  type: string;
  coordinates: any;
};

type GeoJsonFeature = {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

type GeoJsonRoot = {
  type: 'FeatureCollection' | 'Feature' | string;
  features?: GeoJsonFeature[];
  geometry?: GeoJsonGeometry | null;
};

export interface GeoJsonBorderOptions {
  radius: number;
  color?: pc.Color;
  lonOffset?: number;
  flipLongitude?: boolean;
  maxSegmentAngleDeg?: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

const lonLatToVec3 = (
  lon: number,
  lat: number,
  radius: number,
  lonOffset: number,
  flipLongitude: boolean
): pc.Vec3 => {
  const adjustedLon = (flipLongitude ? -lon : lon) + lonOffset;
  const lonRad = toRad(adjustedLon);
  const latRad = toRad(lat);
  const cosLat = Math.cos(latRad);
  return new pc.Vec3(
    radius * cosLat * Math.cos(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.sin(lonRad)
  );
};

const slerpVec3 = (a: pc.Vec3, b: pc.Vec3, t: number): pc.Vec3 => {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a.clone();
  const sinOmega = Math.sin(omega);
  const s1 = Math.sin((1 - t) * omega) / sinOmega;
  const s2 = Math.sin(t * omega) / sinOmega;
  return new pc.Vec3(
    a.x * s1 + b.x * s2,
    a.y * s1 + b.y * s2,
    a.z * s1 + b.z * s2
  );
};

const addSegmentArc = (
  positions: number[],
  p0: pc.Vec3,
  p1: pc.Vec3,
  radius: number,
  maxSegmentAngleRad: number
) => {
  const a = p0.clone().normalize();
  const b = p1.clone().normalize();
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const angle = Math.acos(dot);
  const segments = Math.max(1, Math.ceil(angle / maxSegmentAngleRad));
  for (let s = 0; s < segments; s++) {
    const t0 = s / segments;
    const t1 = (s + 1) / segments;
    const q0 = slerpVec3(a, b, t0).mulScalar(radius);
    const q1 = slerpVec3(a, b, t1).mulScalar(radius);
    positions.push(q0.x, q0.y, q0.z);
    positions.push(q1.x, q1.y, q1.z);
  }
};

const addLineString = (
  positions: number[],
  coords: GeoJsonPosition[],
  radius: number,
  lonOffset: number,
  flipLongitude: boolean,
  maxSegmentAngleRad: number,
  closeLoop: boolean
) => {
  if (!coords || coords.length < 2) return;
  const maxIndex = closeLoop ? coords.length : coords.length - 1;
  for (let i = 0; i < maxIndex; i++) {
    const curr = coords[i];
    const next = coords[(i + 1) % coords.length];
    if (!curr || !next) continue;
    const lon0 = Number(curr[0]);
    const lat0 = Number(curr[1]);
    const lon1 = Number(next[0]);
    const lat1 = Number(next[1]);
    if (!Number.isFinite(lon0) || !Number.isFinite(lat0) || !Number.isFinite(lon1) || !Number.isFinite(lat1)) {
      continue;
    }
    const p0 = lonLatToVec3(lon0, lat0, radius, lonOffset, flipLongitude);
    const p1 = lonLatToVec3(lon1, lat1, radius, lonOffset, flipLongitude);
    addSegmentArc(positions, p0, p1, radius, maxSegmentAngleRad);
  }
};

const extractGeometryLines = (
  geometry: GeoJsonGeometry,
  positions: number[],
  radius: number,
  lonOffset: number,
  flipLongitude: boolean,
  maxSegmentAngleRad: number
) => {
  if (!geometry) return;
  const { type, coordinates } = geometry;
  switch (type) {
    case 'LineString':
      addLineString(positions, coordinates as GeoJsonPosition[], radius, lonOffset, flipLongitude, maxSegmentAngleRad, false);
      break;
    case 'MultiLineString':
      (coordinates as GeoJsonPosition[][]).forEach((line) => {
        addLineString(positions, line, radius, lonOffset, flipLongitude, maxSegmentAngleRad, false);
      });
      break;
    case 'Polygon':
      (coordinates as GeoJsonPosition[][]).forEach((ring) => {
        addLineString(positions, ring, radius, lonOffset, flipLongitude, maxSegmentAngleRad, true);
      });
      break;
    case 'MultiPolygon':
      (coordinates as GeoJsonPosition[][][]).forEach((poly) => {
        poly.forEach((ring) => {
          addLineString(positions, ring, radius, lonOffset, flipLongitude, maxSegmentAngleRad, true);
        });
      });
      break;
    default:
      break;
  }
};

export const createGeoJsonBorderLines = (
  geojson: GeoJsonRoot,
  device: pc.GraphicsDevice,
  options: GeoJsonBorderOptions
): pc.Entity => {
  const radius = options.radius;
  const color = options.color ?? new pc.Color(0, 1, 0.5, 0.9);
  const lonOffset = options.lonOffset ?? 0;
  const flipLongitude = options.flipLongitude ?? false;
  const maxSegmentAngleDeg = options.maxSegmentAngleDeg ?? 2.5;
  const maxSegmentAngleRad = toRad(Math.max(0.1, maxSegmentAngleDeg));

  const positions: number[] = [];

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    geojson.features.forEach((feature) => {
      if (feature?.geometry) {
        extractGeometryLines(feature.geometry, positions, radius, lonOffset, flipLongitude, maxSegmentAngleRad);
      }
    });
  } else if (geojson.type === 'Feature' && (geojson as any).geometry) {
    extractGeometryLines((geojson as any).geometry, positions, radius, lonOffset, flipLongitude, maxSegmentAngleRad);
  } else if ((geojson as any).coordinates && (geojson as any).type) {
    extractGeometryLines(geojson as unknown as GeoJsonGeometry, positions, radius, lonOffset, flipLongitude, maxSegmentAngleRad);
  }

  const entity = new pc.Entity('GeoJsonBorders');

  if (positions.length === 0) {
    return entity;
  }

  const vertexFormat = new pc.VertexFormat(device, [
    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
  ]);

  const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
  const posData = new Float32Array(positions);
  vertexBuffer.setData(posData.buffer);

  const mesh = new pc.Mesh(device);
  mesh.vertexBuffer = vertexBuffer;
  mesh.primitive[0].type = pc.PRIMITIVE_LINES;
  mesh.primitive[0].base = 0;
  mesh.primitive[0].count = positions.length / 3;

  const material = new pc.BasicMaterial();
  material.color = color;
  material.update();

  const meshInstance = new pc.MeshInstance(mesh, material);
  entity.addComponent('render', {
    type: 'asset',
    meshInstances: [meshInstance]
  });

  return entity;
};
