import { gzipSync } from 'node:zlib';
import polyline from '@mapbox/polyline';
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import {
  readFilePoints,
  readGpxPoints,
  readTcxPoints,
  readZipPoints,
  simplifyTrack,
  summariseTrack,
} from '../lib/tracks.ts';

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="test" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Morning Run</name><trkseg>
  <trkpt lat="-33.8688" lon="151.2093"><ele>10</ele></trkpt>
  <trkpt lat="-33.8690" lon="151.2100"><ele>11</ele></trkpt>
  <trkpt lat="-33.8700" lon="151.2110"><ele>12</ele></trkpt>
 </trkseg></trk>
</gpx>`;

const tcx = `
<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
 <Activities><Activity Sport="Running"><Lap><Track>
  <Trackpoint><Time>2024-01-01T00:00:00Z</Time></Trackpoint>
  <Trackpoint><Position><LatitudeDegrees>-37.8136</LatitudeDegrees><LongitudeDegrees>144.9631</LongitudeDegrees></Position></Trackpoint>
  <Trackpoint><Position><LatitudeDegrees>-37.8140</LatitudeDegrees><LongitudeDegrees>144.9640</LongitudeDegrees></Position></Trackpoint>
 </Track></Lap></Activity></Activities>
</TrainingCenterDatabase>`;

describe('readGpxPoints', () => {
  it('reads every track point', () => {
    expect(readGpxPoints(gpx)).toEqual([
      [-33.8688, 151.2093],
      [-33.869, 151.21],
      [-33.87, 151.211],
    ]);
  });
});

describe('readTcxPoints', () => {
  describe('when some trackpoints have no position', () => {
    it('reads only the ones that do', () => {
      expect(readTcxPoints(tcx)).toEqual([
        [-37.8136, 144.9631],
        [-37.814, 144.964],
      ]);
    });
  });
});

describe('readFilePoints', () => {
  describe('given a gzipped file', () => {
    it('reads the points inside it', async () => {
      const points = await readFilePoints(
        'activities/1.gpx.gz',
        gzipSync(Buffer.from(gpx)),
      );
      expect(points).toHaveLength(3);
    });
  });

  describe('given a file type it does not know', () => {
    it('returns no points', async () => {
      expect(
        await readFilePoints('activities/1.jpg', Buffer.from('not a track')),
      ).toEqual([]);
    });
  });
});

describe('readZipPoints', () => {
  describe('when the ZIP holds a track file among other files', () => {
    it('reads the track file', async () => {
      const zip = zipSync({
        'notes.txt': Buffer.from('hi'),
        '123_ACTIVITY.gpx': Buffer.from(gpx),
      });
      expect(await readZipPoints(zip)).toHaveLength(3);
    });
  });

  describe('when the ZIP holds no track file', () => {
    it('returns no points', async () => {
      expect(
        await readZipPoints(zipSync({ 'notes.txt': Buffer.from('hi') })),
      ).toEqual([]);
    });
  });
});

describe('simplifyTrack', () => {
  describe('given points on a straight line', () => {
    it('keeps only the two ends', () => {
      const line = Array.from(
        { length: 1000 },
        (_, i) => [i * 0.0001, i * 0.0001] as [number, number],
      );
      expect(simplifyTrack(line, 0.00005)).toEqual([line[0], line[999]]);
    });
  });
});

describe('summariseTrack', () => {
  describe('for an activity with no GPS', () => {
    it('returns null', () => {
      expect(summariseTrack([])).toBeNull();
    });
  });

  describe('for an activity with a track', () => {
    const summary = summariseTrack(readGpxPoints(gpx))!;

    it('keeps the real start and end points', () => {
      expect(summary).toMatchObject({
        start_lat: -33.8688,
        start_lng: 151.2093,
        end_lat: -33.87,
        end_lng: 151.211,
      });
    });

    it('encodes the route as a polyline', () => {
      expect(polyline.decode(summary.summary_polyline)[0]).toEqual([
        -33.8688, 151.2093,
      ]);
    });
  });
});
