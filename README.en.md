# PlayCanvas Earth — PlayCanvas implementation of an interactive Earth scene

This project ports a high-resolution Earth example to the PlayCanvas engine, including day/night shaders, high-res textures, a hexagonal sphere mesh, GeoJSON border rendering, and interactive controls.

## Features

- High-resolution Earth rendering (1k / 16k textures)
- Hexagonal planet mesh (HexSphere) with optional wireframe
- Controllable day/night blending shader
- Cloud layer (preloaded material/textures)
- GeoJSON borders with longitude offset and flip support
- Configurable starfield background
- Mouse/touch orbit camera controls
- Runtime configuration via `config.json` with hot-reload

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy textures or manually place the `textures` folder into the project root.

3. Run development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Project Structure

Key files:

- `index.ts` — application entry
- `src/HexSphere.ts` — hex grid generator
- `src/getEarthMaterial.ts` — day/night shader
- `config.json` — runtime configuration

## Configuration

Main config is in `config.json`. Example fields control borders, clouds, and texture selection.

## License & Credits

Same as the original THREE.js version. Textures from Planet Pixel Emporium. Original three.js demo credited to Robot Bobby.
