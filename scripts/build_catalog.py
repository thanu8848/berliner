#!/usr/bin/env python3
"""Build a compact ODbL POI catalogue from Geofabrik's Berlin extract.
Run offline with --input, or download conditionally using Last-Modified/ETag.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import urllib.error
import osmium

SOURCE = 'https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf'
CATEGORIES = {'restaurant': 'restaurant', 'fast_food': 'imbiss', 'cafe': 'cafe', 'bar': 'bar', 'pub': 'kneipe'}

def address(tags):
    street = ' '.join(filter(None, [tags.get('addr:street', tags.get('addr:place', '')), tags.get('addr:housenumber', '')]))
    city = ' '.join(filter(None, [tags.get('addr:postcode', ''), tags.get('addr:city', '')]))
    return ', '.join(filter(None, [street, city]))

class Places(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.places = {}

    def add(self, obj, osm_id, coords):
        tags = dict(obj.tags)
        category = CATEGORIES.get(tags.get('amenity'))
        name = tags.get('name', '').strip()
        if not category or not name or not coords:
            return
        # Bounding-box center for area POIs, like the former Overpass out center.
        lon = (min(p[0] for p in coords) + max(p[0] for p in coords)) / 2
        lat = (min(p[1] for p in coords) + max(p[1] for p in coords)) / 2
        if not (52.3 <= lat <= 52.75 and 13.05 <= lon <= 13.8):
            return
        place = dict(osmId=osm_id, name=name, category=category, latitude=round(lat, 7), longitude=round(lon, 7),
                     cuisine=[c.strip() for c in tags.get('cuisine', '').split(';') if c.strip()])
        for key, val in {'address': address(tags), 'website': tags.get('website', tags.get('contact:website', '')),
                         'neighborhood': tags.get('addr:suburb', '')}.items():
            if val:
                if key == 'website' and not val.startswith(('https://', 'http://')):
                    continue
                place[key] = val
        self.places[osm_id] = place

    def node(self, obj):
        if obj.location.valid():
            self.add(obj, f'node/{obj.id}', [(obj.lon, obj.lat)])

    def way(self, obj):
        if obj.tags.get('amenity') in CATEGORIES and obj.tags.get('name'):
            self.add(obj, f'way/{obj.id}', [(n.lon, n.lat) for n in obj.nodes if n.location.valid()])

    def area(self, obj):
        if obj.tags.get('amenity') in CATEGORIES and obj.tags.get('name'):
            coords = [(n.lon, n.lat) for ring in obj.outer_rings() for n in ring if n.location.valid()]
            self.add(obj, f'{"way" if obj.from_way() else "relation"}/{obj.orig_id()}', coords)

def build(input_path, output):
    reader = osmium.io.Reader(str(input_path))
    timestamp = reader.header().get('osmosis_replication_timestamp')
    reader.close()
    if not timestamp:
        raise RuntimeError('Source timestamp missing; do not publish an undated catalogue')
    handler = Places()
    handler.apply_file(str(input_path), locations=True, idx='flex_mem')
    records = sorted(handler.places.values(), key=lambda p: p['osmId'])
    if len(records) < 1000:
        raise RuntimeError(f'Only {len(records)} POIs: refusing to replace the last valid catalogue')
    previous_manifest = output / 'manifest.json'
    if previous_manifest.exists():
        previous_count = json.loads(previous_manifest.read_text()).get('count', 0)
        if len(records) < previous_count * 0.75:
            raise RuntimeError('Unexpected loss of over 25% of POIs; manual review required')
    catalogue = dict(schemaVersion=1, source=SOURCE, sourceDate=timestamp,
                     attribution='© OpenStreetMap contributors', license='ODbL-1.0', places=records)
    encoded = json.dumps(catalogue, ensure_ascii=False, separators=(',', ':')).encode()
    digest = hashlib.sha256(encoded).hexdigest()[:16]
    output.mkdir(parents=True, exist_ok=True)
    target = output / f'places-{digest}.json'
    temp = output / 'catalog.tmp'
    temp.write_bytes(encoded)
    os.replace(temp, target)
    manifest = dict(schemaVersion=1, file=target.name, sourceDate=timestamp, count=len(records), bytes=len(encoded), version=digest)
    temp.write_text(json.dumps(manifest, indent=2) + '\n')
    os.replace(temp, output / 'manifest.json')
    for previous in output.glob('places-*.json'):
        if previous != target:
            previous.unlink()
    print(f'{len(records)} places, {len(encoded)} bytes, source {timestamp}, version {digest}')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path, default=Path('public/catalog'))
    parser.add_argument('--cache', type=Path, default=Path('.catalog-cache'))
    args = parser.parse_args()
    if args.input:
        build(args.input, args.output)
        return
    args.cache.mkdir(parents=True, exist_ok=True)
    pbf = args.cache / 'berlin.osm.pbf'
    meta_path = args.cache / 'download.json'
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    headers = {'User-Agent': 'Berliner-catalog-build/1.0'}
    if pbf.exists():
        if meta.get('etag'): headers['If-None-Match'] = meta['etag']
        if meta.get('modified'): headers['If-Modified-Since'] = meta['modified']
    try:
        with urllib.request.urlopen(urllib.request.Request(SOURCE, headers=headers), timeout=120) as response:
            tmp = args.cache / 'download.tmp'
            with tmp.open('wb') as stream:
                while chunk := response.read(1024 * 1024):
                    stream.write(chunk)
            os.replace(tmp, pbf)
            meta_path.write_text(json.dumps({'etag': response.headers.get('ETag'), 'modified': response.headers.get('Last-Modified')}))
    except urllib.error.HTTPError as error:
        if error.code != 304: raise
        print('Source unchanged; reusing downloaded extract')
    build(pbf, args.output)

if __name__ == '__main__': main()
