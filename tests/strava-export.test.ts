import { gzipSync } from 'node:zlib'
import polyline from '@mapbox/polyline'
import { describe, expect, it } from 'vitest'
import {
  parseStravaDate,
  pointsFromFile,
  pointsFromGpx,
  pointsFromTcx,
  rowFromCsv,
  simplify,
  summariseTrack,
} from '../lib/strava-export.ts'

describe('parseStravaDate', () => {
  it('parses the export format as UTC', () => {
    expect(parseStravaDate('Mar 4, 2019, 7:12:45 AM')).toBe('2019-03-04T07:12:45.000Z')
    expect(parseStravaDate('Dec 31, 2023, 11:59:59 PM')).toBe('2023-12-31T23:59:59.000Z')
  })

  it('handles 12 AM and 12 PM', () => {
    expect(parseStravaDate('Jan 1, 2024, 12:05:00 AM')).toBe('2024-01-01T00:05:00.000Z')
    expect(parseStravaDate('Jan 1, 2024, 12:05:00 PM')).toBe('2024-01-01T12:05:00.000Z')
  })

  it('throws on something unexpected', () => {
    expect(() => parseStravaDate('2024-01-01')).toThrow(/Unrecognised/)
  })
})

describe('rowFromCsv', () => {
  // Trimmed version of a real activities.csv header, with its repeated columns.
  const header = [
    'Activity ID', 'Activity Date', 'Activity Name', 'Activity Type', 'Activity Description',
    'Elapsed Time', 'Distance', 'Max Heart Rate', 'Relative Effort', 'Commute', 'Activity Gear',
    'Filename', 'Elapsed Time', 'Moving Time', 'Distance', 'Max Speed', 'Average Speed',
    'Elevation Gain', 'Max Heart Rate', 'Average Heart Rate', 'Calories', 'Commute',
  ]
  const values = [
    '1234567890', 'Mar 4, 2019, 7:12:45 AM', 'Morning Run', 'Run', '',
    '1900', '5.23', '171', '42', 'false', 'Pegasus',
    'activities/1234567890.gpx.gz', '1900.0', '1800.0', '5230.4', '4.5', '2.9',
    '48.2', '171.0', '152.3', '410', '0.0',
  ]

  it('maps the columns, preferring the detailed (metric) block', () => {
    const row = rowFromCsv(header, values)
    expect(row).toMatchObject({
      id: '1234567890',
      name: 'Morning Run',
      sport_type: 'Run',
      description: null,
      start_date: '2019-03-04T07:12:45.000Z',
      distance_m: 5230.4,
      moving_time_s: 1800,
      elapsed_time_s: 1900,
      elevation_gain_m: 48.2,
      average_speed_mps: 2.9,
      max_speed_mps: 4.5,
      average_heartrate: 152.3,
      max_heartrate: 171,
      calories: 410,
      commute: false,
      gear: 'Pegasus',
      source_file: 'activities/1234567890.gpx.gz',
    })
    expect(Object.keys(row.raw)).toHaveLength(header.length)
  })

  it('falls back to km distance when there is only one Distance column', () => {
    const row = rowFromCsv(['Activity ID', 'Activity Date', 'Distance'], ['1', 'Jan 1, 2024, 1:00:00 PM', '1,234.5'])
    expect(row.distance_m).toBe(1234500)
    expect(row.name).toBe('Untitled activity')
  })

  it('rejects rows without an id', () => {
    expect(() => rowFromCsv(header, ['', ...values.slice(1)])).toThrow(/Activity ID/)
  })
})

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Morning Run</name><trkseg>
  <trkpt lat="-33.8688" lon="151.2093"><ele>10</ele></trkpt>
  <trkpt lat="-33.8690" lon="151.2100"><ele>11</ele></trkpt>
  <trkpt lat="-33.8700" lon="151.2110"><ele>12</ele></trkpt>
 </trkseg></trk>
</gpx>`

const tcx = `
<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
 <Activities><Activity Sport="Running"><Lap><Track>
  <Trackpoint><Time>2024-01-01T00:00:00Z</Time></Trackpoint>
  <Trackpoint><Position><LatitudeDegrees>-37.8136</LatitudeDegrees><LongitudeDegrees>144.9631</LongitudeDegrees></Position></Trackpoint>
  <Trackpoint><Position><LatitudeDegrees>-37.8140</LatitudeDegrees><LongitudeDegrees>144.9640</LongitudeDegrees></Position></Trackpoint>
 </Track></Lap></Activity></Activities>
</TrainingCenterDatabase>`

describe('track files', () => {
  it('reads GPX points', () => {
    expect(pointsFromGpx(gpx)).toEqual([
      [-33.8688, 151.2093],
      [-33.869, 151.21],
      [-33.87, 151.211],
    ])
  })

  it('reads TCX points, skipping trackpoints with no position', () => {
    expect(pointsFromTcx(tcx)).toEqual([
      [-37.8136, 144.9631],
      [-37.814, 144.964],
    ])
  })

  it('unzips .gz files', async () => {
    const points = await pointsFromFile('activities/1.gpx.gz', gzipSync(Buffer.from(gpx)))
    expect(points).toHaveLength(3)
  })

  it('ignores file types it does not know', async () => {
    expect(await pointsFromFile('activities/1.jpg', Buffer.from(''))).toEqual([])
  })
})

describe('summariseTrack', () => {
  it('returns null for an activity with no GPS', () => {
    expect(summariseTrack([])).toBeNull()
  })

  it('keeps the real start and end and an encoded polyline', () => {
    const s = summariseTrack(pointsFromGpx(gpx))!
    expect(s.start_lat).toBe(-33.8688)
    expect(s.end_lng).toBe(151.211)
    expect(polyline.decode(s.summary_polyline)[0]).toEqual([-33.8688, 151.2093])
  })

  it('drops points on a straight line', () => {
    const line = Array.from({ length: 1000 }, (_, i) => [i * 0.0001, i * 0.0001] as [number, number])
    expect(simplify(line, 0.00005)).toEqual([line[0], line[999]])
  })
})
