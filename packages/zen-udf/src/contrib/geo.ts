import { defineContrib, defineTool } from '../register.ts';

// geo 域(geo_distance / geo_fence 函数)：Haversine 大圆距离与围栏判定。
// 纯数学、datum 无关——调用方必须保证同 datum 坐标（GCJ-02/WGS-84 混用会差 100–700m）。
const EARTH_RADIUS_KM = 6371.0088; // IUGG 平均半径
const MAX_POLYGON_POINTS = 256;

const toRad = (deg: number) => (deg * Math.PI) / 180;

interface Coordinate {
  lat: number;
  lon: number;
}

const asCoordinate = (value: unknown): Coordinate | null => {
  const record = value as Coordinate | undefined;
  if (!record || typeof record.lat !== 'number' || typeof record.lon !== 'number') return null;
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return null;
  if (record.lat < -90 || record.lat > 90 || record.lon < -180 || record.lon > 180) return null;
  return { lat: record.lat, lon: record.lon };
};

const haversineKm = (p1: Coordinate, p2: Coordinate): number => {
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** 射线法（even-odd）：小范围平面近似，跨 ±180° 经线不适用 */
const pointInPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = [polygon[i].lon, polygon[i].lat];
    const [xj, yj] = [polygon[j].lon, polygon[j].lat];
    const intersects = yi > point.lat !== yj > point.lat && point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

const geoErrorResult = (error: string) => ({ distance: null, inside: null, error });

export const geo_distance = defineTool({
  name: 'distance',
  description:
    '计算两经纬度点的 Haversine 大圆距离（球面近似，误差约 0.5%，决策场景够用）。' +
    'unit 支持 km/m；坐标需同 datum（GCJ-02/WGS-84 混用会差 100–700m）。非法坐标返回结构化错误。',
  parametersSchema: {
    properties: {
      lat1: { type: 'number', title: 'Lat1', description: '起点纬度 [-90, 90]' },
      lon1: { type: 'number', title: 'Lon1', description: '起点经度 [-180, 180]' },
      lat2: { type: 'number', title: 'Lat2', description: '终点纬度' },
      lon2: { type: 'number', title: 'Lon2', description: '终点经度' },
      unit: { type: 'string', title: 'Unit', description: '距离单位 km/m，默认 km', default: 'km' },
    },
    required: ['lat1', 'lon1', 'lat2', 'lon2'],
    title: 'geo_distance',
    type: 'object',
  },
  returnsSchema: { type: 'number', title: '距离' },
  fn: (kwargs: Record<string, unknown>) => {
    const p1 = asCoordinate({ lat: kwargs?.lat1, lon: kwargs?.lon1 });
    const p2 = asCoordinate({ lat: kwargs?.lat2, lon: kwargs?.lon2 });
    if (!p1 || !p2) {
      return geoErrorResult('coordinates must be finite numbers within lat [-90,90] and lon [-180,180]');
    }
    const unit = kwargs?.unit === 'm' ? 'm' : 'km';
    const distanceKm = haversineKm(p1, p2);
    return { distance: unit === 'm' ? distanceKm * 1000 : distanceKm, unit };
  },
});

export const geo_fence = defineTool({
  name: 'fence',
  description:
    '围栏判定：圆形（circle: {lat, lon, radius km}）或多边形（polygon: [[lat,lon],...]，射线法）。' +
    '返回 { inside, distance }——distance 为点到圆心/多边形的最近大圆距离(km)。',
  parametersSchema: {
    properties: {
      point: { type: 'object', title: 'Point', description: '{ lat, lon }' },
      circle: { type: 'object', title: 'Circle', description: '{ lat, lon, radius(km) }' },
      polygon: { type: 'array', title: 'Polygon', description: '[[lat,lon],...] 顶点序列，自动闭合' },
    },
    required: ['point'],
    title: 'geo_fence',
    type: 'object',
  },
  returnsSchema: {
    type: 'object',
    title: 'geo_fence 函数返回',
    properties: {
      inside: { type: 'boolean' },
      distance: { type: 'number', description: '到圆心或围栏的公里数' },
      error: { type: 'string' },
    },
  },
  fn: (kwargs: Record<string, unknown>) => {
    const point = asCoordinate(kwargs?.point);
    if (!point) {
      return geoErrorResult('point must be { lat, lon } with finite valid coordinates');
    }
    const circle = kwargs?.circle as { lat?: unknown; lon?: unknown; radius?: unknown } | undefined;
    const polygonRaw = kwargs?.polygon as unknown[] | undefined;

    if (circle) {
      const center = asCoordinate(circle);
      const radius = Number(circle?.radius);
      if (!center || !Number.isFinite(radius) || radius <= 0) {
        return geoErrorResult('circle must be { lat, lon, radius(km) } with a positive radius');
      }
      const distance = haversineKm(point, center);
      return { inside: distance <= radius, distance };
    }
    if (Array.isArray(polygonRaw)) {
      if (polygonRaw.length < 3 || polygonRaw.length > MAX_POLYGON_POINTS) {
        return geoErrorResult(`polygon requires 3–${MAX_POLYGON_POINTS} points`);
      }
      const polygon = polygonRaw.map((p) =>
        Array.isArray(p) ? asCoordinate({ lat: p[0], lon: p[1] }) : asCoordinate(p),
      );
      if (polygon.some((p) => !p)) {
        return geoErrorResult('polygon contains an invalid coordinate');
      }
      const inside = pointInPolygon(point, polygon as Coordinate[]);
      const nearest = Math.min(...(polygon as Coordinate[]).map((p) => haversineKm(point, p)));
      return { inside, distance: nearest };
    }
    return geoErrorResult('provide circle or polygon');
  },
});

export const { fn: geoDistance } = geo_distance;
export const { fn: geoFence } = geo_fence;

export default defineContrib(import.meta.url, {
  tools: [geo_distance, geo_fence],
});
