/**
 * Pure helpers for reading a Strava bulk export
 * (Settings → My Account → Download or Delete Your Account → Request your archive).
 *
 * The export contains activities.csv plus an activities/ folder of
 * .gpx / .tcx / .fit files (often gzipped). The CSV has no coordinates, so
 * start/end points and the polyline come from those files.
 */
import { gunzipSync } from 'node:zlib'
import polyline from '@mapbox/polyline'
import { XMLParser } from 'fast-xml-parser'
import FitParser from 'fit-file-parser'

export type LatLng = [number, number]

export interface ActivityRow {
  id: string
  name: string
  sport_type: string | null
  description: string | null
  start_date: string
  distance_m: number | null
  moving_time_s: number | null
  elapsed_time_s: number | null
  elevation_gain_m: number | null
  average_speed_mps: number | null
  max_speed_mps: number | null
  average_heartrate: number | null
  max_heartrate: number | null
  calories: number | null
  commute: boolean
  gear: string | null
  source_file: string | null
  raw: Record<string, string>
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Parses the export's "Mar 4, 2019, 7:12:45 AM" format (always UTC) into an ISO string. */
export function parseStravaDate(value: string): string {
  const m = value
    .trim()
    .match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?$/i)
  if (!m) throw new Error(`Unrecognised activity date: "${value}"`)
  const [, mon, day, year, h, min, sec, ampm] = m
  const month = MONTHS[mon.toLowerCase()]
  if (month === undefined) throw new Error(`Unrecognised month in date: "${value}"`)
  let hour = Number(h)
  if (ampm) {
    const pm = ampm.toUpperCase() === 'PM'
    if (hour === 12) hour = pm ? 12 : 0
    else if (pm) hour += 12
  }
  return new Date(Date.UTC(Number(year), month, Number(day), hour, Number(min), Number(sec))).toISOString()
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const cleaned = value.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function toText(value: string | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

/**
 * activities.csv repeats several headers (Distance, Elapsed Time, Max Heart Rate,
 * Commute...). The first block is the human-friendly summary (distance in km);
 * the second block is the detailed data (distance in metres). Prefer the detailed
 * one and fall back to the summary.
 */
export function rowFromCsv(header: string[], values: string[]): ActivityRow {
  const all = new Map<string, string[]>()
  header.forEach((h, i) => {
    const key = h.trim()
    if (!all.has(key)) all.set(key, [])
    all.get(key)!.push(values[i] ?? '')
  })
  const first = (k: string) => all.get(k)?.[0]
  const detailed = (k: string) => {
    const vs = all.get(k)
    if (!vs) return undefined
    return [...vs].reverse().find((v) => v.trim() !== '') ?? vs[0]
  }

  const id = toText(first('Activity ID'))
  if (!id || !/^\d+$/.test(id)) throw new Error(`Row has no valid Activity ID: "${first('Activity ID')}"`)
  const date = first('Activity Date')
  if (!date) throw new Error(`Activity ${id} has no Activity Date`)

  const distances = all.get('Distance') ?? []
  let distance_m: number | null = null
  if (distances.length > 1) distance_m = toNumber(distances[distances.length - 1])
  if (distance_m === null) {
    const km = toNumber(distances[0])
    distance_m = km === null ? null : km * 1000
  }

  const commuteRaw = (all.get('Commute') ?? []).map((v) => v.trim().toLowerCase())
  const commute = commuteRaw.some((v) => v === 'true' || v === '1' || v === '1.0')

  const raw: Record<string, string> = {}
  header.forEach((h, i) => {
    const key = raw[h] === undefined ? h : `${h} (${i})`
    raw[key] = values[i] ?? ''
  })

  return {
    id,
    name: toText(first('Activity Name')) ?? 'Untitled activity',
    sport_type: toText(first('Activity Type')),
    description: toText(first('Activity Description')),
    start_date: parseStravaDate(date),
    distance_m,
    moving_time_s: toNumber(detailed('Moving Time')),
    elapsed_time_s: toNumber(detailed('Elapsed Time')),
    elevation_gain_m: toNumber(detailed('Elevation Gain')),
    average_speed_mps: toNumber(detailed('Average Speed')),
    max_speed_mps: toNumber(detailed('Max Speed')),
    average_heartrate: toNumber(detailed('Average Heart Rate')),
    max_heartrate: toNumber(detailed('Max Heart Rate')),
    calories: toNumber(detailed('Calories')),
    commute,
    gear: toText(first('Activity Gear')),
    source_file: toText(first('Filename')),
    raw,
  }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true })

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

function validPoint(lat: unknown, lng: unknown): LatLng | null {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (la === 0 && ln === 0) return null
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  return [la, ln]
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
  const doc = xml.parse(text.trimStart()) // some Strava TCX files have leading whitespace
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
