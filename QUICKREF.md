# PlayCanvas Earth - Quick Reference

## 快速开始

```bash
# 安装依赖
npm install

# 复制纹理文件（从 threejs-earth）
# Windows
xcopy /E /I ..\threejs-earth\textures textures

# Linux/Mac
# cp -r ../threejs-earth/textures ./

# 启动开发服务器
npm run dev

# 构建
npm run build
```

## 核心 API

### 创建地球材质
```typescript
import { getEarthMaterial } from './src/getEarthMaterial';

const material = getEarthMaterial(device, {
  dayTexture: dayTex,
  nightTexture: nightTex,
  sunDirection: new pc.Vec3(1, 0, 0)
});
```

### 创建六边形网格
```typescript
import { HexSphere } from './src/HexSphere';

const hexSphere = new HexSphere(1.0, 4); // 半径, 细分级别
const wireframe = hexSphere.createWireframeMesh(device, new pc.Color(0, 1, 0.5));
```

### 轨道相机控制
```typescript
camera.addComponent('script');
camera.script.create('orbitCamera', {
  attributes: {
    distanceMin: 1.15,
    distanceMax: 50,
    inertiaFactor: 0.93
  }
});
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.ts` | 主应用入口，初始化场景和相机 |
| `src/getEarthMaterial.ts` | 日夜混合着色器材质 |
| `src/getFresnelMat.ts` | Fresnel 大气辉光 |
| `src/getStarfield.ts` | 星空背景点云 |
| `src/HexSphere.ts` | 六边形球面网格生成器 |
| `config.json` | 应用配置（网格、纹理、旋转等） |

## 常用配置

### 六边形网格细分级别
- `subdivisions: 2` → 162 tiles
- `subdivisions: 3` → 642 tiles
- `subdivisions: 4` → 2,562 tiles (推荐)
- `subdivisions: 5` → 10,242 tiles
- `subdivisions: 6` → 40,962 tiles

### 材质参数
```typescript
// 晨昏线宽度
twilightWidth: 0.1

// 暗面日间占比（0.0 = 全黑，1.0 = 全亮）
darkSideDayRatio: 0.0
```

## 常见问题

**Q: 纹理无法加载？**
A: 确保纹理文件路径正确，检查浏览器控制台错误信息。

**Q: 性能较差？**
A: 尝试降低六边形网格细分级别，或使用较低分辨率纹理。

**Q: 相机控制不流畅？**
A: 调整 `inertiaFactor` 参数（0.9-0.95 之间）。

## PlayCanvas vs Three.js 对照表

| Three.js | PlayCanvas |
|----------|------------|
| `Scene` | `Entity` (root) |
| `Group` | `Entity` (with children) |
| `Mesh` | `Entity` + `render` component |
| `PerspectiveCamera` | `Entity` + `camera` component |
| `OrbitControls` | Custom script component |
| `ShaderMaterial` | `Material` + `Shader` |
| `TextureLoader` | `new Texture()` + `setSource()` |
| `renderer.render()` | `app.on('update')` |
| `requestAnimationFrame` | App render loop |

## 构建输出

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── textures/
    └── ...
```
