# PlayCanvas Earth - 项目说明

## 项目结构

```
playcanvas-earth/
├── index.html              # 主 HTML 文件
├── index.ts                # 主应用入口
├── package.json            # 项目依赖
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 构建配置
├── config.json             # 应用配置文件
├── src/                    # 源代码目录
│   ├── getEarthMaterial.ts # 地球日夜材质
│   ├── getFresnelMat.ts    # Fresnel 光晕材质
│   ├── getStarfield.ts     # 星空背景
│   └── HexSphere.ts        # 六边形球面网格
├── styles/                 # 样式文件
│   └── ui.css
├── textures/               # 纹理文件（需要从 threejs-earth 复制）
│   ├── 1k/
│   └── 16k/
└── data/                   # GeoJSON 数据（可选）
```

## 技术栈

- **PlayCanvas Engine**: 3D 渲染引擎
- **TypeScript**: 类型安全的 JavaScript
- **Vite**: 快速的构建工具

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 复制纹理文件：
将 `threejs-earth/textures` 文件夹复制到 `playcanvas-earth/` 目录下

3. 运行开发服务器：
```bash
npm run dev
```

4. 构建生产版本：
```bash
npm run build
```

## 主要功能

### 1. 地球渲染
- 高分辨率地球纹理（支持 16k）
- 日夜纹理动态混合
- 晨昏线辉光效果
- 云层透明渲染

### 2. 六边形网格系统
- 基于二十面体细分算法
- 生成均匀分布的六边形和五边形地块
- 可配置细分级别
- 支持数据可视化

### 3. 交互控制
- 轨道相机控制（鼠标/触摸）
- 太阳角度调节
- 自动/手动旋转
- 六边形网格显示切换

## 配置说明

编辑 `config.json` 可以修改以下设置：

```json
{
  "initialRotation": false,        // 初始是否旋转
  "dayNight": {
    "enabled": false,               // 是否启用日夜效果
    "darkSideDayRatio": 0.2         // 暗面日间贴图占比
  },
  "sunAngle": 0,                    // 初始太阳角度
  "hexGrid": {
    "enabled": false,               // 是否启用六边形网格
    "subdivisions": 7,              // 细分级别（2-8）
    "wireframeColor": "#00ff88",    // 线框颜色
    "showWireframe": true           // 是否显示线框
  }
}
```

## PlayCanvas 与 Three.js 的主要差异

### 1. 场景组织
- **Three.js**: 使用 `Scene`、`Group`、`Mesh` 对象
- **PlayCanvas**: 使用 `Entity` 层级结构，组件化设计

### 2. 材质系统
- **Three.js**: `ShaderMaterial`、`MeshBasicMaterial` 等
- **PlayCanvas**: 自定义 `Material` + `Shader`，或使用 `StandardMaterial`

### 3. 相机控制
- **Three.js**: `OrbitControls` 插件
- **PlayCanvas**: 自定义 `Script` 组件实现轨道控制

### 4. 纹理加载
- **Three.js**: `TextureLoader`
- **PlayCanvas**: 直接创建 `Texture` 对象并设置图像源

### 5. 渲染循环
- **Three.js**: 手动调用 `renderer.render(scene, camera)`
- **PlayCanvas**: 应用自动管理渲染循环，通过 `app.on('update')` 监听

## 开发注意事项

1. **纹理路径**: 确保纹理文件路径正确，PlayCanvas 使用相对路径
2. **着色器**: PlayCanvas 的着色器语法与 Three.js 略有不同
3. **坐标系**: PlayCanvas 使用右手坐标系，与 Three.js 一致
4. **性能**: PlayCanvas 对移动设备优化更好，但需要注意纹理大小

## 待实现功能

- [ ] GeoJSON 边界渲染
- [ ] HexTileRenderer 数据可视化
- [ ] 昼夜模式切换
- [ ] 更多交互控制选项

## 参考资源

- [PlayCanvas 官方文档](https://developer.playcanvas.com/)
- [PlayCanvas API 参考](https://api.playcanvas.com/)
- [原始 Three.js 版本](../threejs-earth/)
