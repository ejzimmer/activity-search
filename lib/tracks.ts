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

function wrapInArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
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
  const parsedXml = xml.parse(text);
  const points: LatLng[] = [];
  for (const track of wrapInArray(parsedXml?.gpx?.trk)) {
    for (const segment of wrapInArray(track?.trkseg)) {
      for (const trackPoint of wrapInArray(segment?.trkpt)) {
        const point = parsePoint(trackPoint?.lat, trackPoint?.lon);
        if (point) points.push(point);
      }
    }
  }
  return points;
}

export function readTcxPoints(text: string): LatLng[] {
  const parsedXml = xml.parse(text.trimStart()); // some TCX files have leading whitespace
  const points: LatLng[] = [];
  for (const activity of wrapInArray(
    parsedXml?.TrainingCenterDatabase?.Activities?.Activity,
  )) {
    for (const lap of wrapInArray(activity?.Lap)) {
      for (const track of wrapInArray(lap?.Track)) {
        for (const trackPoint of wrapInArray(track?.Trackpoint)) {
          const point = parsePoint(
            trackPoint?.Position?.LatitudeDegrees,
            trackPoint?.Position?.LongitudeDegrees,
          );
          if (point) points.push(point);
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
  for (const record of (data as { records?: Array<Record<string, unknown>> })
    .records ?? []) {
    const point = parsePoint(record.position_lat, record.position_long);
    if (point) points.push(point);
  }
  return points;
}

export async function readFilePoints(
  filename: string,
  contents: Buffer,
): Promise<LatLng[]> {
  let name = filename.toLowerCase();
  let fileContents = contents as Buffer<ArrayBuffer>;
  if (name.endsWith('.gz')) {
    fileContents = gunzipSync(fileContents) as Buffer<ArrayBuffer>;
    name = name.slice(0, -3);
  }
  if (name.endsWith('.gpx'))
    return readGpxPoints(fileContents.toString('utf8'));
  if (name.endsWith('.tcx'))
    return readTcxPoints(fileContents.toString('utf8'));
  if (name.endsWith('.fit')) return readFitPoints(fileContents);
  if (name.endsWith('.zip')) return readZipPoints(fileContents);
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

function measurePerpendicularDistance(
  point: LatLng,
  lineStart: LatLng,
  lineEnd: LatLng,
): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
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
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = measurePerpendicularDistance(
        points[i],
        points[start],
        points[end],
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
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
