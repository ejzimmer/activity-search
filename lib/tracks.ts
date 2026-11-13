/**
 * Reads GPS points out of activity files and boils them down to what we store:
 * start/end coordinates and a simplified encoded polyline.
 *
 * Garmin's download endpoint returns the original file wrapped in a ZIP. That's
 * normally a .fit from the watch, but manually uploaded activities can be
 * .gpx or .tcx, so all three are handled.
 */
import { gunzipSync } from 'node:zlib'
import { unzipSync } from 'fflate'
import polyline from '@mapbox/polyline'
import { XMLParser } from 'fast-xml-parser'
import FitParser from 'fit-file-parser'

export type LatLng = [number, number]

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true })

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

/** Turns raw values from a file into a point, dropping missing, 0,0 and out-of-range ones. */
function validPoint(rawLatitude: unknown, rawLongitude: unknown): LatLng | null {
  const latitude = Number(rawLatitude)
  const longitude = Number(rawLongitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return [latitude, longitude]
}

export function pointsFromGpx(text: string): LatLng[] {
  const doc = xml.parse(text)
  const points: LatLng[] = []
  for (const trk of asArray(doc?.gpx?.trk)) {
    for (const seg of asArray(trk?.trkseg)) {
      for (const pt of asArray(seg?.trkpt)) {
        const p = validPoint(pt?.lat, pt?.lon)
        if (p) points.push(p)
      }
    }
  }
  return points
}

export function pointsFromTcx(text: string): LatLng[] {
  const doc = xml.parse(text.trimStart()) // some TCX files have leading whitespace
  const points: LatLng[] = []
  for (const act of asArray(doc?.TrainingCenterDatabase?.Activities?.Activity)) {
    for (const lap of asArray(act?.Lap)) {
      for (const track of asArray(lap?.Track)) {
        for (const tp of asArray(track?.Trackpoint)) {
          const p = validPoint(tp?.Position?.LatitudeDegrees, tp?.Position?.LongitudeDegrees)
          if (p) points.push(p)
        }
      }
    }
  }
  return points
}

export async function pointsFromFit(buffer: Buffer<ArrayBuffer>): Promise<LatLng[]> {
  const parser = new FitParser({ force: true, mode: 'list' })
  const data = await parser.parseAsync(buffer)
  const points: LatLng[] = []
  for (const r of (data as { records?: Array<Record<string, unknown>> }).records ?? []) {
    const p = validPoint(r.position_lat, r.position_long)
    if (p) points.push(p)
  }
  return points
}

/** Reads a track file from the export, transparently handling .gz. */
export async function pointsFromFile(filename: string, contents: Buffer): Promise<LatLng[]> {
  let name = filename.toLowerCase()
  let buf = contents as Buffer<ArrayBuffer>
  if (name.endsWith('.gz')) {
    buf = gunzipSync(buf) as Buffer<ArrayBuffer>
    name = name.slice(0, -3)
  }
  if (name.endsWith('.gpx')) return pointsFromGpx(buf.toString('utf8'))
  if (name.endsWith('.tcx')) return pointsFromTcx(buf.toString('utf8'))
  if (name.endsWith('.fit')) return pointsFromFit(buf)
  if (name.endsWith('.zip')) return pointsFromZip(buf)
  return []
}

/** Garmin wraps the original file in a ZIP; use the first track file inside it. */
export async function pointsFromZip(contents: Uint8Array): Promise<LatLng[]> {
  const entries = unzipSync(contents)
  for (const [name, data] of Object.entries(entries)) {
    if (!/\.(fit|gpx|tcx)(\.gz)?$/i.test(name)) continue
    const points = await pointsFromFile(name, Buffer.from(data.buffer, data.byteOffset, data.byteLength) as Buffer<ArrayBuffer>)
    if (points.length) return points
  }
  return []
}

function perpendicularDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const [x, y] = p
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Ramer–Douglas–Peucker, iterative so long tracks can't blow the stack. */
export function simplify(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let maxDist = 0
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }
  return points.filter((_, i) => keep[i])
}

export interface TrackSummary {
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  summary_polyline: string
}

/**
 * Turns a full track into the summary we store: start/end points and a
 * simplified encoded polyline (≈5 m tolerance, which is plenty for a map overview).
 */
export function summariseTrack(points: LatLng[]): TrackSummary | null {
  if (points.length === 0) return null
  const simplified = simplify(points, 0.00005)
  const [start_lat, start_lng] = points[0]
  const [end_lat, end_lng] = points[points.length - 1]
  return { start_lat, start_lng, end_lat, end_lng, summary_polyline: polyline.encode(simplified) }
}
