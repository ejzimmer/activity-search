import { gzipSync } from 'node:zlib'
import polyline from '@mapbox/polyline'
import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import {
  pointsFromFile,
  pointsFromGpx,
  pointsFromTcx,
  pointsFromZip,
  simplify,
  summariseTrack,
} from '../lib/tracks.ts'

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="test" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
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

  it('reads the track file inside a Garmin ZIP', async () => {
    const zip = zipSync({ 'notes.txt': Buffer.from('hi'), '123_ACTIVITY.gpx': Buffer.from(gpx) })
    expect(await pointsFromZip(zip)).toHaveLength(3)
  })

  it('returns no points for a ZIP with no track file', async () => {
    expect(await pointsFromZip(zipSync({ 'notes.txt': Buffer.from('hi') }))).toEqual([])
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
