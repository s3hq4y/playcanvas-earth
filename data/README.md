# Data Folder

This folder is for GeoJSON data files (optional).

## Usage

If you want to use GeoJSON border rendering, copy the data files from `threejs-earth/data/` to this folder.

## Example Files

- `custom.geo.json` - Custom GeoJSON boundaries
- `oceans-seas.geo.json` - Ocean and sea boundaries
- `World Bank Official Boundaries - Admin 1.geojson` - Country boundaries

## Configuration

Enable GeoJSON rendering in `config.json`:

```json
{
  "borders": {
    "enabled": true,
    "renderMode": "pre-render",
    "lonOffset": 0.4,
    "geojson": {
      "enabled": true,
      "path": "data/custom.geo.json"
    }
  }
}
```

## Note

GeoJSON border rendering is not yet implemented in the PlayCanvas version.
This feature is on the roadmap.
