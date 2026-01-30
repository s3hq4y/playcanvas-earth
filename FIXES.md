# 修复说明

## 修复的问题

### 1. 地球纹理不显示
**原因**: 材质在纹理加载完成前就被应用了
**修复**: 
- 添加纹理加载完成回调 `checkTexturesLoaded()`
- 等待所有纹理（日间+夜间）加载完成后再应用材质
- 使用 `StandardMaterial` 替代自定义着色器以确保兼容性
- 添加控制台日志确认纹理加载和材质应用

### 2. 六边形网格遮挡地球
**原因**: 网格半径（1.0）与地球半径相同，完全覆盖地球表面
**修复**: 
- 将六边形网格半径从 1.0 调整为 1.05
- 这样网格会浮在地球+光晕（1.01）之上
- 调整网格颜色透明度，使其更协调

### 3. 缺少光照
**原因**: 场景中没有光源，StandardMaterial 需要光照才能正确显示
**修复**:
- 添加方向光（模拟太阳光）
- 添加环境光（确保整体可见）
- 光照强度和颜色已调整

### 4. 代码格式问题
**原因**: 渲染循环中的 if 语句不完整
**修复**: 修复了地球旋转的条件判断

## 当前配置

```json
{
  "initialRotation": true,      // 自动旋转
  "dayNight": {
    "enabled": true,             // 日夜效果（暂未完全实现）
    "darkSideDayRatio": 0.2
  },
  "hexGrid": {
    "enabled": true,             // 显示六边形网格
    "subdivisions": 4,           // 细分级别（2562个地块）
    "showWireframe": true        // 显示线框
  }
}
```

## 材质说明

当前使用 `StandardMaterial`:
- `diffuseMap`: 日间地球纹理（16k）
- `emissiveMap`: 夜间灯光纹理（16k）
- `emissive`: 降低发光强度为 0.3
- `useLighting`: 启用光照

## 性能优化建议

如果性能不佳，可以：
1. 降低六边形网格细分级别（subdivisions: 3 或 2）
2. 使用较低分辨率纹理（1k 而非 16k）
3. 减少星星数量（目前2000颗）

## 浏览器检查

在浏览器控制台中应该看到：
```
Config loaded: {initialRotation: true, ...}
Textures loaded, applying material...
Earth material applied!
Hex grid created: 2562 tiles (2550 hexagons, 12 pentagons)
```

如果看不到这些日志，说明：
- 配置文件未加载
- 纹理加载失败
- 代码执行出错

## 下一步改进

1. 实现真正的日夜着色器（当前只是简单的emissive混合）
2. 添加云层渲染
3. 实现 Fresnel 大气辉光
4. 优化六边形网格渲染性能
