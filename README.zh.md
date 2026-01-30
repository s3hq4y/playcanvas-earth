# PlayCanvas Earth — PlayCanvas 实现的交互地球场景

本项目将一个高分辨率 Earth 示例移植到 PlayCanvas 引擎，包含昼夜着色器、高分辨率贴图、六边形网格、GeoJSON 边界渲染与交互控制。

## 特性

- 高分辨率地球渲染（支持 1k / 16k 贴图）
- 六边形星球网格（`HexSphere`）与可选线框
- 可控的昼/夜混合着色器
- 云层（材质与贴图预加载，支持开关）
- GeoJSON 国界渲染（支持经度偏移与翻转）
- 可配置的星空背景
- 鼠标/触摸轨道相机交互
- 运行时配置（`config.json`）并支持热重载

## 快速开始

1. 安装依赖：

```bash
npm install
```

2. 复制纹理，或手动把 `textures` 文件夹放到项目根目录。

3. 启动开发服务：

```bash
npm run dev
```

4. 构建生产版本：

```bash
npm run build
```

## 项目结构

主要文件：

- `index.ts` — 应用入口
- `src/HexSphere.ts` — 六边形网格生成
- `src/getEarthMaterial.ts` — 昼夜着色器
- `config.json` — 运行时配置

## 许可与鸣谢

与原始 THREE.js 版本相同。贴图来自 Planet Pixel Emporium，原始 demo 作者 Robot Bobby。
