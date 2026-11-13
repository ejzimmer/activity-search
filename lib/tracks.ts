/**
 * Reads GPS points out of activity files and boils them down to what we store:
 * start/end coordinates and a simplified encoded polyline.
 *
 * Garmin's download endpoint returns the original file wrapped in a ZIP. That's
 * normally a .fit from the watch, but manually uploaded activities can be
 * .gpx or .tcx, so all three are handled.
 */
import { gunzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import polyline from '@mapbox/polyline';
import { XMLParser } from 'fast-xml-parser';
import FitParser from 'fit-file-parser';

export type LatLng = [number, number];

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
});

function wrapInArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function parsePoint(
  rawLatitude: unknown,
  rawLongitude: unknown,
): LatLng | null {
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [latitude, longitude];
}

export function readGpxPoints(text: string): LatLng[] {
  const doc = xml.parse(text);
  const points: LatLng[] = [];
  for (const trk of wrapInArray(doc?.gpx?.trk)) {
    for (const seg of wrapInArray(trk?.trkseg)) {
      for (const pt of wrapInArray(seg?.trkpt)) {
        const p = parsePoint(pt?.lat, pt?.lon);
        if (p) points.push(p);
      }
    }
  }
  return points;
}

export function readTcxPoints(text: string): LatLng[] {
  const doc = xml.parse(text.trimStart()); // some TCX files have leading whitespace
  const points: LatLng[] = [];
  for (const act of wrapInArray(
    doc?.TrainingCenterDatabase?.Activities?.Activity,
  )) {
    for (const lap of wrapInArray(act?.Lap)) {
      for (const track of wrapInArray(lap?.Track)) {
        for (const tp of wrapInArray(track?.Trackpoint)) {
          const p = parsePoint(
            tp?.Position?.LatitudeDegrees,
            tp?.Position?.LongitudeDegrees,
          );
          if (p) points.push(p);
        }
      }
    }
  }
  return points;
}

export async function readFitPoints(
  buffer: Buffer<ArrayBuffer>,
): Promise<LatLng[]> {
  const parser = new FitParser({ force: true, mode: 'list' });
  const data = await parser.parseAsync(buffer);
  const points: LatLng[] = [];
  for (const r of (data as { records?: Array<Record<string, unknown>> })
    .records ?? []) {
    const p = parsePoint(r.position_lat, r.position_long);
    if (p) points.push(p);
  }
  return points;
}

export async function readFilePoints(
  filename: string,
  contents: Buffer,
): Promise<LatLng[]> {
  let name = filename.toLowerCase();
  let buf = contents as Buffer<ArrayBuffer>;
  if (name.endsWith('.gz')) {
    buf = gunzipSync(buf) as Buffer<ArrayBuffer>;
    name = name.slice(0, -3);
  }
  if (name.endsWith('.gpx')) return readGpxPoints(buf.toString('utf8'));
  if (name.endsWith('.tcx')) return readTcxPoints(buf.toString('utf8'));
  if (name.endsWith('.fit')) return readFitPoints(buf);
  if (name.endsWith('.zip')) return readZipPoints(buf);
  return [];
}

export async function readZipPoints(contents: Uint8Array): Promise<LatLng[]> {
  const entries = unzipSync(contents);
  for (const [name, data] of Object.entries(entries)) {
    if (!/\.(fit|gpx|tcx)(\.gz)?$/i.test(name)) continue;
    const points = await readFilePoints(
      name,
      Buffer.from(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      ) as Buffer<ArrayBuffer>,
    );
    if (points.length) return points;
  }
  return [];
}

function measurePerpendicularDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(
    0,
    Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Ramer–Douglas–Peucker, iterative so long tracks can't blow the stack. */
export function simplifyTrack(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = measurePerpendicularDistance(
        points[i],
        points[start],
        points[end],
      );
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export interface TrackSummary {
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  summary_polyline: string;
}

/** A tolerance of 0.00005° is about 5 m, plenty for a map overview. */
export function summariseTrack(points: LatLng[]): TrackSummary | null {
  if (points.length === 0) return null;
  const simplified = simplifyTrack(points, 0.00005);
  const [start_lat, start_lng] = points[0];
  const [end_lat, end_lng] = points[points.length - 1];
  return {
    start_lat,
    start_lng,
    end_lat,
    end_lng,
    summary_polyline: polyline.encode(simplified),
  };
}
