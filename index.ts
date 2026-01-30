import * as pc from 'playcanvas';
import { getEarthMaterial, updateSunDirection, updateDarkSideDayRatio } from './src/getEarthMaterial';
import { getFresnelMat } from './src/getFresnelMat';
import { getWaterMaterial } from './src/getWaterMaterial';
import getStarfield from './src/getStarfield';
import { HexSphere } from './src/HexSphere';
import { createGeoJsonBorderLines } from './src/getGeoJsonBorders';

// 创建 PlayCanvas 应用
const canvas = document.getElementById('application') as HTMLCanvasElement;
const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
  keyboard: new pc.Keyboard(window),
});

// 设置画布填充窗口并自动调整分辨率
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// 窗口大小改变时调整
window.addEventListener('resize', () => app.resizeCanvas());

// 创建相机实体
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0, 0, 0),
  farClip: 1000,
  fov: 75
});
camera.setPosition(0, 0, 5);
app.root.addChild(camera);

// 添加方向光（从太阳方向照射）
const light = new pc.Entity('light');
light.addComponent('light', {
  type: 'directional',
  color: new pc.Color(1, 1, 1),
  intensity: 1.0,
  castShadows: false
});
light.setEulerAngles(0, 0, 0);
light.setPosition(5, 0, 0);
app.root.addChild(light);

// 添加环境光
const ambientLight = new pc.Entity('ambientLight');
ambientLight.addComponent('light', {
  type: 'ambient',
  color: new pc.Color(0.3, 0.3, 0.3),
  intensity: 0.5
});
app.root.addChild(ambientLight);

// 创建地球组（倾斜23.4度）
const earthGroup = new pc.Entity('earthGroup');
earthGroup.setLocalEulerAngles(0, 0, -23.4);
app.root.addChild(earthGroup);

// 简化的轨道相机控制（不使用脚本系统）
let cameraDistance = 5;
let cameraPitch = 0;
let cameraYaw = 0;
let targetDistance = 5;
let targetPitch = 0;
let targetYaw = 0;

const distanceMin = 1.15;
const distanceMax = 50;
const pitchMin = 0.01;
const pitchMax = 179.99;

let isDragging = false;
let lastTouchDistance = 0;

// 鼠标事件
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) isDragging = true;
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    targetYaw -= e.movementX * 0.3;
    targetPitch -= e.movementY * 0.3;
    // 限制 pitch 保证极轴竖直（不允许翻转）
    targetPitch = Math.max(5, Math.min(175, targetPitch));
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  targetDistance = Math.max(distanceMin, Math.min(distanceMax, targetDistance + e.deltaY * 0.01));
});

// 触摸事件
let touches: Touch[] = [];

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touches = Array.from(e.touches);
  if (touches.length === 2) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const newTouches = Array.from(e.touches);
  
  if (newTouches.length === 1 && touches.length === 1) {
    const dx = newTouches[0].clientX - touches[0].clientX;
    const dy = newTouches[0].clientY - touches[0].clientY;
    targetYaw -= dx * 0.3;
    targetPitch -= dy * 0.3;
    targetPitch = Math.max(pitchMin, Math.min(pitchMax, targetPitch));
  } else if (newTouches.length === 2) {
    const dx = newTouches[0].clientX - newTouches[1].clientX;
    const dy = newTouches[0].clientY - newTouches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const scale = (distance - lastTouchDistance) * 0.01;
    targetDistance = Math.max(distanceMin, Math.min(distanceMax, targetDistance - scale));
    lastTouchDistance = distance;
  }
  
  touches = newTouches;
});

canvas.addEventListener('touchend', () => {
  lastTouchDistance = 0;
});

// 配置接口
interface AppConfig {
  initialRotation?: boolean;
  dayNight?: {
    enabled?: boolean;
    darkSideDayRatio?: number;
    twilightWidth?: number;
  };
  filter?: {
    enabled?: boolean;
    oceanColor?: string;
    landDarken?: number; // 0..1, multiplier for day texture
    landColor?: string; // #RRGGBB, land tint multiplier
  };
  sunAngle?: number;
  sunInclination?: number; // 太阳照射倾斜角（极昼极夜模拟）
  hexGrid?: {
    enabled?: boolean;
    subdivisions?: number;
    wireframeColor?: string;
    wireframeLineWidth?: number;
    showWireframe?: boolean;
  };
  textures?: {
    bump?: { path?: string; enabled?: boolean };
    specular?: { path?: string; enabled?: boolean; intensity?: number; shininess?: number };
    day?: { path?: string; enabled?: boolean };
    night?: { path?: string; enabled?: boolean };
    clouds?: {
      enabled?: boolean;
      map?: { path?: string };
      alpha?: { path?: string };
    };
    anisotropy?: number; // <=0 or undefined 使用设备最大值
  };
  water?: {
    enabled?: boolean;
    color?: string;
    opacity?: number;
    ripple?: {
      intensity?: number;
      speed?: number;
      scale?: number;
    };
  };
  borders?: {
    enabled?: boolean;
    renderMode?: 'pre-render' | 'real-time' | string;
    lonOffset?: number;
    flipLongitude?: boolean;
    color?: string;
    radius?: number;
    altitude?: number;
    maxSegmentAngleDeg?: number;
    geojson?: {
      enabled?: boolean;
      path?: string;
    };
  };
}

let appConfig: AppConfig = {};

let bordersRoot: pc.Entity | null = null;
let bordersMeshEntity: pc.Entity | null = null;
let cachedGeojson: any | null = null;
let cachedGeojsonPath: string | null = null;

const clearBorders = () => {
  if (bordersMeshEntity) {
    bordersMeshEntity.destroy();
    bordersMeshEntity = null;
  }
  if (bordersRoot) {
    bordersRoot.enabled = false;
  }
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parseHexColor = (hex: string | undefined, fallback: number[]): number[] => {
  if (!hex) return fallback;
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return fallback;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
  return [r, g, b];
};

const applyBordersFromConfig = (cfg: AppConfig | any) => {
  const bordersCfg = cfg?.borders;
  const geojsonCfg = bordersCfg?.geojson;
  if (!bordersCfg?.enabled || !geojsonCfg?.enabled) {
    clearBorders();
    return;
  }

  const path = geojsonCfg?.path || 'data/custom.geo.json';
  const lonOffset = typeof bordersCfg.lonOffset === 'number' ? bordersCfg.lonOffset : 0;
  const flipLongitude = Boolean(bordersCfg.flipLongitude);
  const maxSegmentAngleDeg = typeof bordersCfg.maxSegmentAngleDeg === 'number' ? bordersCfg.maxSegmentAngleDeg : 2.5;
  const radius = typeof bordersCfg.radius === 'number' ? bordersCfg.radius : earthRadius;
  const altitude = typeof bordersCfg.altitude === 'number' ? bordersCfg.altitude : 0.0025;

  let rgb = [0, 1, 0.5];
  if (bordersCfg.color) rgb = parseHexColor(bordersCfg.color, rgb);

  const buildBorders = (geojson: any) => {
    if (!bordersRoot) {
      bordersRoot = new pc.Entity('borders');
      earthGroup.addChild(bordersRoot);
    }
    bordersRoot.enabled = true;

    if (bordersMeshEntity) {
      bordersMeshEntity.destroy();
      bordersMeshEntity = null;
    }

    const color = new pc.Color(rgb[0], rgb[1], rgb[2], 0.9);
    bordersMeshEntity = createGeoJsonBorderLines(geojson, app.graphicsDevice, {
      radius: radius + altitude,
      color,
      lonOffset,
      flipLongitude,
      maxSegmentAngleDeg
    });
    bordersRoot.addChild(bordersMeshEntity);
  };

  if (cachedGeojson && cachedGeojsonPath === path) {
    // Yield to event loop before heavy build
    setTimeout(() => buildBorders(cachedGeojson), 0);
    return;
  }

  fetch(path)
    .then((r) => r.json())
    .then((geojson: any) => {
      cachedGeojson = geojson;
      cachedGeojsonPath = path;
      // 异步构建以避免阻塞 UI
      setTimeout(() => buildBorders(geojson), 0);
    })
    .catch((err) => {
      console.warn('Failed to load GeoJSON borders:', err);
      clearBorders();
    });
};

let pendingDayColorMul: number[] | null = null;

const applyDayColorMul = (mul: number[] | null) => {
  pendingDayColorMul = mul;
  if (mul && earthDayNightMaterial) {
    earthDayNightMaterial.setParameter('uDayColorMul', mul);
    earthDayNightMaterial.update();
  }
  if (mul && dayOnlyMaterial) {
    const color = new pc.Color(mul[0], mul[1], mul[2]);
    dayOnlyMaterial.diffuse = color;
    dayOnlyMaterial.emissive = color;
    dayOnlyMaterial.update();
  }
};

const applyFilterFromConfig = (cfg: AppConfig | any) => {
  const filterCfg = cfg?.filter;
  if (!filterCfg || filterCfg.enabled === false) {
    applyDayColorMul([1, 1, 1]);
    return;
  }
  if (filterCfg.landColor) {
    const mul = parseHexColor(filterCfg.landColor, [1, 1, 1]);
    applyDayColorMul(mul);
    return;
  }
  const landDarken = (typeof filterCfg.landDarken === 'number') ? filterCfg.landDarken : 0.9;
  const mul = clamp01(landDarken);
  applyDayColorMul([mul, mul, mul]);
};

const applyTextureSettingsFromConfig = (cfg: AppConfig | any) => {
  const anisoCfg = cfg?.textures?.anisotropy;
  const maxAniso = app.graphicsDevice.maxAnisotropy;
  const aniso = (typeof anisoCfg === 'number')
    ? (anisoCfg <= 0 ? maxAniso : anisoCfg)
    : maxAniso;
  const anisoClamped = Math.min(aniso, maxAniso);

  dayTexture.anisotropy = anisoClamped;
  nightTexture.anisotropy = anisoClamped;
  // 日夜贴图的 sRGB 解码在自定义 shader 中处理
};

// 加载纹理
const dayTexture = new pc.Texture(app.graphicsDevice, {
  name: 'dayTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
  magFilter: pc.FILTER_LINEAR,
  anisotropy: app.graphicsDevice.maxAnisotropy
});

const nightTexture = new pc.Texture(app.graphicsDevice, {
  name: 'nightTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
  magFilter: pc.FILTER_LINEAR,
  anisotropy: app.graphicsDevice.maxAnisotropy
});

// 加载图像（路径将从 config 读取）
const dayImage = new Image();
dayImage.crossOrigin = 'anonymous';

const nightImage = new Image();
nightImage.crossOrigin = 'anonymous';

// Bump 和 Specular 纹理（可选）
const bumpTexture = new pc.Texture(app.graphicsDevice, {
  name: 'bumpTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

const specularTexture = new pc.Texture(app.graphicsDevice, {
  name: 'specularTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

let bumpImage: HTMLImageElement | null = null;
let specularImage: HTMLImageElement | null = null;
let bumpEnabled = false;
let specularEnabled = false;

// 初始太阳方向
const sunDirection = new pc.Vec3(5, 0, 0);

// 创建高分段球体mesh，提升地球表面光滑度
const earthEntity = new pc.Entity('earth');
const earthRadius = 1.0;
const latitudeBands = 128; // 可调，越大越光滑
const longitudeBands = 256;
const earthMesh = pc.createSphere(app.graphicsDevice, {
  radius: earthRadius,
  latitudeBands,
  longitudeBands
});
// 先用一个默认材质，后续会被替换
const defaultMat = new pc.StandardMaterial();
defaultMat.diffuse = new pc.Color(0.5, 0.5, 1);
defaultMat.update();
earthEntity.addComponent('render', {
  type: 'asset',
  meshInstances: [new pc.MeshInstance(earthMesh, defaultMat)],
  castShadows: false,
  receiveShadows: false
});
earthEntity.setLocalScale(1, 1, 1);

// 地球材质（昼夜 + 仅日间）
let earthDayNightMaterial: pc.Material | null = null;
// let dayOnlyMaterial: pc.StandardMaterial | null = null;
let dayOnlyMaterial: pc.StandardMaterial | null = null;
let isDayNightEnabled = true;
let pendingDayNightEnabled: boolean | null = null;
let pendingDarkSideDayRatio: number | null = null;
let pendingTwilightWidth: number | null = null;
let texturesLoaded = 0;
const totalTextures = 2;

const applyEarthMaterial = (material: pc.Material | pc.StandardMaterial | null) => {
  if (!material) return;
  if (earthEntity.render) {
    earthEntity.render.meshInstances[0].material = material;
  }
};

const setDayNightEnabled = (enabled: boolean) => {
  isDayNightEnabled = enabled;
  applyEarthMaterial(enabled ? earthDayNightMaterial : dayOnlyMaterial);
  const toggleBtn = document.getElementById('toggle-daynight');
  if (toggleBtn) toggleBtn.textContent = enabled ? 'Disable Day/Night' : 'Enable Day/Night';
};

const checkTexturesLoaded = () => {
  texturesLoaded++;
  if (texturesLoaded === totalTextures) {
    // 所有纹理加载完成，应用材质
    console.log('Textures loaded, applying material...');
    
    // 日夜混合材质（自定义 Shader）
    earthDayNightMaterial = getEarthMaterial(app.graphicsDevice, {
      dayTexture,
      nightTexture,
      sunDirection
    });
    // bump/specular 贴图支持（通过 material.setParameter）
    if (bumpEnabled && bumpImage) {
      earthDayNightMaterial.setParameter('uBumpTexture', bumpTexture);
      // 可在 shader 中实现法线扰动（如需更强效果需同步 shader 代码）
    }
    if (specularEnabled && specularImage) {
      earthDayNightMaterial.setParameter('uSpecularTexture', specularTexture);
      // 可在 shader 中实现高光（如需更强效果需同步 shader 代码）
    }
    // 从配置读取 specular 参数（若存在）并设置到昼夜材质
    try {
      const specCfg = appConfig?.textures?.specular;
      const specIntensity = (specCfg && typeof specCfg.intensity === 'number') ? specCfg.intensity : 1.0;
      const rawShininess = (specCfg && typeof specCfg.shininess === 'number') ? specCfg.shininess : 16.0;
      const specShininess = Math.max(1.0, rawShininess);
      earthDayNightMaterial.setParameter('uSpecularIntensity', specIntensity);
      earthDayNightMaterial.setParameter('uSpecularShininess', specShininess);
    } catch (e) {
      // ignore
    }

    // 仅日间材质（用于禁用日夜效果）
    dayOnlyMaterial = new pc.StandardMaterial();
    dayOnlyMaterial.diffuseMap = dayTexture;
    // 为避免在禁用日夜后出现黑色，设置为自发光（emissive）并保留可见性
    dayOnlyMaterial.emissiveMap = dayTexture;
    dayOnlyMaterial.emissive = new pc.Color(1, 1, 1);
    dayOnlyMaterial.useLighting = true;
    
    // 应用 bump 和 specular（如果启用）
    if (bumpEnabled && bumpImage) {
      dayOnlyMaterial.normalMap = bumpTexture;
    }
    if (specularEnabled && specularImage) {
      dayOnlyMaterial.specularMap = specularTexture;
      dayOnlyMaterial.gloss = 0.7; // 更高光泽
    }
    if (bumpEnabled && bumpImage) {
      dayOnlyMaterial.normalMap = bumpTexture;
      dayOnlyMaterial.bumpiness = 1.0;
    }
    
    dayOnlyMaterial.cull = pc.CULLFACE_BACK;
    dayOnlyMaterial.update();

    if (pendingDayColorMul) {
      applyDayColorMul(pendingDayColorMul);
    } else {
      applyFilterFromConfig(appConfig);
    }

    if (pendingDarkSideDayRatio !== null) {
      updateDarkSideDayRatio(earthDayNightMaterial, pendingDarkSideDayRatio);
      pendingDarkSideDayRatio = null;
    }

    if (pendingTwilightWidth !== null) {
      earthDayNightMaterial.setParameter('uTwilightWidth', pendingTwilightWidth);
      earthDayNightMaterial.update();
      pendingTwilightWidth = null;
    }

    if (pendingDayNightEnabled !== null) {
      setDayNightEnabled(pendingDayNightEnabled);
      pendingDayNightEnabled = null;
    } else {
      applyEarthMaterial(isDayNightEnabled ? earthDayNightMaterial : dayOnlyMaterial);
    }
    console.log('Earth material applied!');
  }
};

earthGroup.addChild(earthEntity);

// 创建 Fresnel 光晕（使用与地球相同的高分段球体确保平滑效果）
const glowEntity = new pc.Entity('glow');
const glowMesh = pc.createSphere(app.graphicsDevice, {
  radius: earthRadius,
  latitudeBands: latitudeBands,
  longitudeBands: longitudeBands
});
const glowDefaultMat = new pc.StandardMaterial();
glowDefaultMat.diffuse = new pc.Color(0, 0.5, 1);
glowDefaultMat.update();
glowEntity.addComponent('render', {
  type: 'asset',
  meshInstances: [new pc.MeshInstance(glowMesh, glowDefaultMat)],
  castShadows: false,
  receiveShadows: false
});
glowEntity.setLocalScale(1.01, 1.01, 1.01);

const fresnelMat = getFresnelMat(app.graphicsDevice);
setTimeout(() => {
  if (glowEntity.render) {
    glowEntity.render.meshInstances[0].material = fresnelMat;
  }
}, 100);

earthGroup.addChild(glowEntity);

// 添加星空
const starfield = getStarfield(app.graphicsDevice, { numStars: 2000 });
app.root.addChild(starfield);

// 云层：使用与地球相同的网格以保证半径一致，避免内置 primitive 尺寸差异
const cloudsEntity = new pc.Entity('clouds');
// 稍微放大云层，确保在地表之上并避免与地表 z-fighting
cloudsEntity.setLocalScale(1.01, 1.01, 1.01);

const cloudTexture = new pc.Texture(app.graphicsDevice, {
  name: 'cloudTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

const cloudAlphaTexture = new pc.Texture(app.graphicsDevice, {
  name: 'cloudAlphaTexture',
  addressU: pc.ADDRESS_REPEAT,
  addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

const cloudImage = new Image();
cloudImage.crossOrigin = 'anonymous';

const cloudAlphaImage = new Image();
cloudAlphaImage.crossOrigin = 'anonymous';


const cloudMaterial = new pc.StandardMaterial();
cloudMaterial.diffuseMap = cloudTexture;
cloudMaterial.opacityMap = cloudAlphaTexture;
cloudMaterial.opacityMapChannel = 'r';
// 使用 emissiveMap 使云层在无光照条件下也能保持明亮（白色云）
cloudMaterial.emissiveMap = cloudTexture;
cloudMaterial.emissive = new pc.Color(1, 1, 1);
cloudMaterial.opacity = 1.0;
cloudMaterial.alphaTest = 0.1;
cloudMaterial.blendType = pc.BLEND_NORMAL;
cloudMaterial.depthWrite = false;
cloudMaterial.depthTest = true;
cloudMaterial.useLighting = false;
cloudMaterial.update();

// 使用 earthMesh 以保证云层尺寸和顶点精度一致
if (earthMesh) {
  const cloudMeshInstance = new pc.MeshInstance(earthMesh, cloudMaterial);
  cloudsEntity.addComponent('render', {
    type: 'asset',
    meshInstances: [cloudMeshInstance]
  });
} else {
  // 备选：如果 earthMesh 未就绪，使用 primitive（后续会被替换）
  cloudsEntity.addComponent('render', { type: 'sphere' });
}

earthGroup.addChild(cloudsEntity);

// 水面实体（使用与地球相同网格，以保证贴合）
const waterEntity = new pc.Entity('water');
waterEntity.setLocalScale(1.001, 1.001, 1.001);
let waterMaterial: pc.Material | null = null;
if (earthMesh) {
  const waterMeshInstance = new pc.MeshInstance(earthMesh, defaultMat);
  waterEntity.addComponent('render', {
    type: 'asset',
    meshInstances: [waterMeshInstance]
  });
} else {
  waterEntity.addComponent('render', { type: 'sphere' });
}
earthGroup.addChild(waterEntity);

// 六边形网格
const hexGridEntity = new pc.Entity('hexGrid');
earthGroup.addChild(hexGridEntity);
let hexSphere: HexSphere | null = null;
let isHexGridVisible = false;

// 旋转控制
let isRotating = false;
let elapsedTime = 0;

// UI 事件监听
const toggleRotationBtn = document.getElementById('toggle-rotation');
if (toggleRotationBtn) {
  toggleRotationBtn.addEventListener('click', () => {
    isRotating = !isRotating;
    toggleRotationBtn.textContent = isRotating ? 'Pause Rotation' : 'Resume Rotation';
  });
}

const toggleDayNightBtn = document.getElementById('toggle-daynight');
if (toggleDayNightBtn) {
  toggleDayNightBtn.addEventListener('click', () => {
    setDayNightEnabled(!isDayNightEnabled);
  });
}

// 切换云层按钮
const toggleCloudsBtn = document.getElementById('toggle-clouds');
if (toggleCloudsBtn) {
  toggleCloudsBtn.addEventListener('click', () => {
    if (cloudsEntity) {
      cloudsEntity.enabled = !cloudsEntity.enabled;
      toggleCloudsBtn.textContent = cloudsEntity.enabled ? 'Hide Clouds' : 'Show Clouds';
    }
  });
}

const toggleHexGridBtn = document.getElementById('toggle-hexgrid');
if (toggleHexGridBtn) {
  toggleHexGridBtn.addEventListener('click', () => {
    isHexGridVisible = !isHexGridVisible;
    if (hexGridEntity) {
      hexGridEntity.enabled = isHexGridVisible;
    }
    toggleHexGridBtn.textContent = isHexGridVisible ? 'Hide Hex Grid' : 'Show Hex Grid';
  });
}

const toggleBordersBtn = document.getElementById('toggle-borders');
const toggleFlipLonBtn = document.getElementById('toggle-flip-lon');

const ensureBordersConfig = () => {
  if (!appConfig.borders) appConfig.borders = {};
  if (!appConfig.borders.geojson) appConfig.borders.geojson = {};
};

const updateBordersButtons = () => {
  const enabled = Boolean(appConfig.borders?.enabled);
  const flip = Boolean(appConfig.borders?.flipLongitude);
  if (toggleBordersBtn) {
    toggleBordersBtn.style.display = 'block';
    toggleBordersBtn.textContent = enabled ? 'Hide Borders' : 'Show Borders';
  }
  if (toggleFlipLonBtn) {
    toggleFlipLonBtn.style.display = 'block';
    toggleFlipLonBtn.textContent = flip ? 'Unflip Longitude' : 'Flip Longitude';
  }
};

const updateLonOffsetUI = (value: number) => {
  const lonOffsetSlider = document.getElementById('lon-offset') as HTMLInputElement | null;
  const lonOffsetNum = document.getElementById('lon-offset-num') as HTMLInputElement | null;
  const lonOffsetVal = document.getElementById('lon-offset-val');
  if (lonOffsetSlider) lonOffsetSlider.value = String(value);
  if (lonOffsetNum) lonOffsetNum.value = String(value);
  if (lonOffsetVal) lonOffsetVal.textContent = String(value);
};

const setLonOffset = (value: number, apply: boolean = true) => {
  ensureBordersConfig();
  appConfig.borders!.lonOffset = value;
  updateLonOffsetUI(value);
  if (apply) applyBordersFromConfig(appConfig);
};

if (toggleBordersBtn) {
  toggleBordersBtn.addEventListener('click', () => {
    ensureBordersConfig();
    appConfig.borders!.enabled = !Boolean(appConfig.borders!.enabled);
    if (appConfig.borders!.geojson) {
      if (appConfig.borders!.geojson!.enabled === undefined) {
        appConfig.borders!.geojson!.enabled = true;
      }
    }
    updateBordersButtons();
    applyBordersFromConfig(appConfig);
  });
}

if (toggleFlipLonBtn) {
  toggleFlipLonBtn.addEventListener('click', () => {
    ensureBordersConfig();
    appConfig.borders!.flipLongitude = !Boolean(appConfig.borders!.flipLongitude);
    updateBordersButtons();
    applyBordersFromConfig(appConfig);
  });
}

// 重新读取配置（运行时）
const reloadConfigBtn = document.getElementById('reload-config');
if (reloadConfigBtn) {
  reloadConfigBtn.addEventListener('click', () => {
    fetch('./config.json')
      .then(r => r.json())
      .then((cfg: AppConfig & any) => {
        console.log('Config reloaded:', cfg);
        appConfig = cfg;
        applyTextureSettingsFromConfig(cfg);
        if (cfg.sunAngle !== undefined) updateAzimuthAngle(cfg.sunAngle);
        if (cfg.sunInclination !== undefined) updateSunInclination(cfg.sunInclination);

        // 云层开关
        if (cfg.textures?.clouds?.enabled !== undefined) {
          cloudsEntity.enabled = Boolean(cfg.textures.clouds.enabled);
          const tbtn = document.getElementById('toggle-clouds');
          if (tbtn) tbtn.textContent = cloudsEntity.enabled ? 'Hide Clouds' : 'Show Clouds';
        }

        // 更新水面参数
        const filterEnabled = cfg.filter?.enabled !== false;
        const filterOceanColor = filterEnabled ? cfg.filter?.oceanColor : undefined;
        const wcfg = cfg.water;
        if (wcfg) {
          if (wcfg.enabled) {
            let rgb = [0.12, 0.53, 0.9];
            if (wcfg.color) rgb = parseHexColor(wcfg.color as string, rgb);
            if (filterOceanColor) rgb = parseHexColor(filterOceanColor, rgb);
            const opacity = typeof wcfg.opacity === 'number' ? wcfg.opacity : 0.35;
            const ripple = wcfg.ripple || {};
            const rippleIntensity = typeof ripple.intensity === 'number' ? ripple.intensity : 0.12;
            const rippleSpeed = typeof ripple.speed === 'number' ? ripple.speed : 0.6;
            const rippleScale = typeof ripple.scale === 'number' ? ripple.scale : 6.0;
            waterMaterial = getWaterMaterial(app.graphicsDevice, {
              color: rgb,
              opacity,
              rippleIntensity,
              rippleSpeed,
              rippleScale
            });
            // 如果存在 specular 贴图，则将其绑定到水材质，用作掩膜
            if (specularEnabled && specularImage && waterMaterial) {
              try {
                waterMaterial.setParameter('uSpecularTexture', specularTexture);
                waterMaterial.setParameter('uSpecularThreshold', 0.05);
                waterMaterial.update();
              } catch (e) {
                // ignore
              }
            }
            if (waterEntity && waterEntity.render) waterEntity.render.meshInstances[0].material = waterMaterial;
            waterEntity.enabled = true;
          } else {
            waterEntity.enabled = false;
          }
        }

        // 更新 specular 参数
        try {
          const spec = cfg.textures?.specular;
          if (spec && earthDayNightMaterial) {
            const si = typeof spec.intensity === 'number' ? spec.intensity : 1.0;
            const rawSs = typeof spec.shininess === 'number' ? spec.shininess : 16.0;
            const ss = Math.max(1.0, rawSs);
            earthDayNightMaterial.setParameter('uSpecularIntensity', si);
            earthDayNightMaterial.setParameter('uSpecularShininess', ss);
            earthDayNightMaterial.update();
          }
        } catch (e) {
          // ignore
        }

        // 晨昏宽度
        if (cfg.dayNight?.twilightWidth !== undefined) {
          const width = Number(cfg.dayNight.twilightWidth);
          if (earthDayNightMaterial) {
            earthDayNightMaterial.setParameter('uTwilightWidth', width);
            earthDayNightMaterial.update();
          } else {
            pendingTwilightWidth = width;
          }
        }

        applyFilterFromConfig(cfg);
        applyBordersFromConfig(cfg);
        updateBordersButtons();
        if (cfg.borders?.lonOffset !== undefined) {
          updateLonOffsetUI(Number(cfg.borders.lonOffset));
        }
      })
      .catch(err => console.warn('Reload config failed', err));
  });
}


// 太阳照射方位角（绕Y轴，0=东，90=北，180=西，270=南）
let azimuthAngle = 0;
let sunInclination = 0; // 倾斜角，-90~+90，0为赤道

const sunAngleSlider = document.getElementById('sun-angle') as HTMLInputElement;
const sunAngleNum = document.getElementById('sun-angle-num') as HTMLInputElement;
const sunAngleVal = document.getElementById('sun-angle-val');

const sunInclSlider = document.getElementById('sun-incl') as HTMLInputElement;
const sunInclNum = document.getElementById('sun-incl-num') as HTMLInputElement;
const sunInclVal = document.getElementById('sun-incl-val');

const lonOffsetSlider = document.getElementById('lon-offset') as HTMLInputElement;
const lonOffsetNum = document.getElementById('lon-offset-num') as HTMLInputElement;

function updateSunDirectionFromAngles() {
  // azimuth: 0=东，90=北，180=西，270=南
  // inclination: 0=赤道，+23.4=夏至北极极昼，-23.4=冬至南极极昼
  const azRad = azimuthAngle * pc.math.DEG_TO_RAD;
  const incRad = sunInclination * pc.math.DEG_TO_RAD;
  const y = Math.sin(incRad);
  const x = Math.cos(incRad) * Math.cos(azRad);
  const z = Math.cos(incRad) * Math.sin(azRad);
  sunDirection.set(x * 5, y * 5, z * 5);
  if (isDayNightEnabled && earthDayNightMaterial) {
    updateSunDirection(earthDayNightMaterial, sunDirection);
  }
}

function updateAzimuthAngle(angle: number) {
  azimuthAngle = angle;
  if (sunAngleVal) sunAngleVal.textContent = String(angle);
  if (sunAngleSlider) sunAngleSlider.value = String(angle);
  if (sunAngleNum) sunAngleNum.value = String(angle);
  updateSunDirectionFromAngles();
}

function updateSunInclination(angle: number) {
  sunInclination = angle;
  if (sunInclVal) sunInclVal.textContent = String(angle);
  if (sunInclSlider) sunInclSlider.value = String(angle);
  if (sunInclNum) sunInclNum.value = String(angle);
  updateSunDirectionFromAngles();
}

if (sunAngleSlider) {
  sunAngleSlider.addEventListener('input', (e) => {
    updateAzimuthAngle(Number((e.target as HTMLInputElement).value));
  });
}
if (sunAngleNum) {
  sunAngleNum.addEventListener('change', (e) => {
    updateAzimuthAngle(Number((e.target as HTMLInputElement).value));
  });
}
if (sunInclSlider) {
  sunInclSlider.addEventListener('input', (e) => {
    updateSunInclination(Number((e.target as HTMLInputElement).value));
  });
}
if (sunInclNum) {
  sunInclNum.addEventListener('change', (e) => {
    updateSunInclination(Number((e.target as HTMLInputElement).value));
  });
}

if (lonOffsetSlider) {
  lonOffsetSlider.addEventListener('input', (e) => {
    setLonOffset(Number((e.target as HTMLInputElement).value));
  });
}
if (lonOffsetNum) {
  lonOffsetNum.addEventListener('change', (e) => {
    setLonOffset(Number((e.target as HTMLInputElement).value));
  });
}

// 加载配置
fetch('./config.json')
  .then(response => response.json())
  .then((config: AppConfig) => {
    console.log('Config loaded:', config);
    appConfig = config;
    applyTextureSettingsFromConfig(config);
    applyFilterFromConfig(config);
    
    // 初始旋转
    isRotating = config.initialRotation || false;
    
    // 加载纹理（从 config 读取路径）
    const dayPath = config.textures?.day?.path || './textures/16k/3_no_ice_clouds_16k.jpg';
    const nightPath = config.textures?.night?.path || './textures/16k/5_night_16k.jpg.png';
    
    dayImage.src = dayPath;
    dayImage.onload = () => {
      dayTexture.setSource(dayImage);
      dayTexture.upload();
      checkTexturesLoaded();
    };
    
    nightImage.src = nightPath;
    nightImage.onload = () => {
      nightTexture.setSource(nightImage);
      nightTexture.upload();
      checkTexturesLoaded();
    };
    
    // 加载 bump 贴图（如果启用）
    if (config.textures?.bump?.enabled && config.textures?.bump?.path) {
      bumpEnabled = true;
      bumpImage = new Image();
      bumpImage.crossOrigin = 'anonymous';
      bumpImage.src = config.textures.bump.path;
      bumpImage.onload = () => {
        bumpTexture.setSource(bumpImage!);
        bumpTexture.upload();
        console.log('Bump texture loaded');
      };
    }
    
    // 加载 specular 贴图（如果启用）
    if (config.textures?.specular?.enabled && config.textures?.specular?.path) {
      specularEnabled = true;
      specularImage = new Image();
      specularImage.crossOrigin = 'anonymous';
      specularImage.src = config.textures.specular.path;
      specularImage.onload = () => {
        specularTexture.setSource(specularImage!);
        specularTexture.upload();
        console.log('Specular texture loaded');
      };
    }
    
    // 加载云层纹理（无论配置是否启用都准备好材质与贴图，便于运行时切换）
    // 使用配置的路径（若存在），否则回退到默认小尺寸贴图
    const cloudMapPath = config.textures?.clouds?.map?.path || './textures/1k/04_earthcloudmap.jpg';
    const cloudAlphaPath = config.textures?.clouds?.alpha?.path || './textures/1k/05_earthcloudmaptrans.jpg';

    // 开始加载贴图（即使配置中 clouds.enabled 为 false，也先准备资源）
    cloudImage.src = cloudMapPath;
    cloudImage.onload = () => {
      cloudTexture.setSource(cloudImage);
      cloudTexture.upload();
      // 如果云层当前可见，确保材质使用到最新贴图
      try { cloudMaterial.emissiveMap = cloudTexture; cloudMaterial.update(); } catch (e) { }
    };

    cloudAlphaImage.src = cloudAlphaPath;
    cloudAlphaImage.onload = () => {
      cloudAlphaTexture.setSource(cloudAlphaImage);
      cloudAlphaTexture.upload();
      // 确保 alpha 贴图被用于材质（某些情况下需触发重新编译）
      cloudMaterial.opacityMap = cloudAlphaTexture;
      cloudMaterial.opacityMapChannel = 'r';
      cloudMaterial.update();
    };

    // 根据配置决定是否立即显示云层（但材质资源已准备）
    const cloudsEnabledCfg = Boolean(config.textures?.clouds?.enabled);
    cloudsEntity.enabled = cloudsEnabledCfg;
    const toggleCloudsBtnLocal = document.getElementById('toggle-clouds');
    if (toggleCloudsBtnLocal) {
      toggleCloudsBtnLocal.style.display = 'block';
      toggleCloudsBtnLocal.textContent = cloudsEntity.enabled ? 'Hide Clouds' : 'Show Clouds';
    }

    // 水面（可配置波纹）
    const filterEnabled = config.filter?.enabled !== false;
    const filterOceanColor = filterEnabled ? config.filter?.oceanColor : undefined;
    const waterCfg = (config as any).water;
    if (waterCfg && waterCfg.enabled) {
      // 解析颜色 #RRGGBB
      let rgb = [0.12, 0.53, 0.9];
      if (waterCfg.color) rgb = parseHexColor(waterCfg.color as string, rgb);
      if (filterOceanColor) rgb = parseHexColor(filterOceanColor, rgb);
      const opacity = typeof waterCfg.opacity === 'number' ? waterCfg.opacity : 0.35;
      const ripple = waterCfg.ripple || {};
      const rippleIntensity = typeof ripple.intensity === 'number' ? ripple.intensity : 0.12;
      const rippleSpeed = typeof ripple.speed === 'number' ? ripple.speed : 0.6;
      const rippleScale = typeof ripple.scale === 'number' ? ripple.scale : 6.0;

      waterMaterial = getWaterMaterial(app.graphicsDevice, {
        color: rgb,
        opacity,
        rippleIntensity,
        rippleSpeed,
        rippleScale
      });
      if (waterEntity && waterEntity.render) {
        waterEntity.render.meshInstances[0].material = waterMaterial;
      }
      // 绑定 specular 贴图用于掩膜（若已加载）
      if (specularEnabled && specularImage && waterMaterial) {
        try {
          waterMaterial.setParameter('uSpecularTexture', specularTexture);
          waterMaterial.setParameter('uSpecularThreshold', 0.05);
          waterMaterial.update();
        } catch (e) {
          // ignore
        }
      }
      waterEntity.enabled = true;
    } else {
      waterEntity.enabled = false;
    }
    
    // 六边形网格：延迟创建，避免启动阻塞
    const ensureHexSphere = (subdivisions?: number, wireColorHex?: string, showWire?: boolean) => {
      if (hexSphere) return;
      hexSphere = new HexSphere(1.0, subdivisions || 4);
      // 解析颜色（支持 #RRGGBB 格式）
      let color = new pc.Color(0, 0.8, 0.4, 0.6);
      if (wireColorHex) {
        const hex = wireColorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        color = new pc.Color(r, g, b, 0.6);
      }
      const wireframe = hexSphere.createWireframeMesh(app.graphicsDevice, color);
      hexGridEntity.addChild(wireframe);
      if (showWire) {
        hexGridEntity.enabled = true;
        isHexGridVisible = true;
      }
      if (config.hexGrid?.enabled) {
        const stats = hexSphere.getStats();
        console.log(`Hex grid created: ${stats.total} tiles (${stats.hexagons} hexagons, ${stats.pentagons} pentagons)`);
      }
    };

    if (config.hexGrid?.showWireframe || config.hexGrid?.enabled) {
      ensureHexSphere(config.hexGrid?.subdivisions, config.hexGrid?.wireframeColor, !!config.hexGrid?.showWireframe);
    }
    if (toggleHexGridBtn) {
      toggleHexGridBtn.style.display = 'block';
      toggleHexGridBtn.textContent = (config.hexGrid?.showWireframe) ? 'Hide Hex Grid' : 'Show Hex Grid';
    }
    
    // GeoJSON 边界
    applyBordersFromConfig(config);
    updateBordersButtons();
    if (config.borders?.lonOffset !== undefined) {
      updateLonOffsetUI(Number(config.borders.lonOffset));
    }

    // 太阳方位角/倾斜角
    if (config.sunAngle !== undefined) {
      updateAzimuthAngle(config.sunAngle);
    }
    if (config.sunInclination !== undefined) {
      updateSunInclination(config.sunInclination);
    }

    // 昼夜开关
    if (config.dayNight?.enabled !== undefined) {
      pendingDayNightEnabled = Boolean(config.dayNight.enabled);
      if (earthDayNightMaterial || dayOnlyMaterial) {
        setDayNightEnabled(pendingDayNightEnabled);
        pendingDayNightEnabled = null;
      }
    }

    // 暗面日间比例
    if (config.dayNight?.darkSideDayRatio !== undefined) {
      pendingDarkSideDayRatio = Number(config.dayNight.darkSideDayRatio);
      if (earthDayNightMaterial) {
        updateDarkSideDayRatio(earthDayNightMaterial, pendingDarkSideDayRatio);
        pendingDarkSideDayRatio = null;
      }
    }

    // 晨昏宽度
    if (config.dayNight?.twilightWidth !== undefined) {
      pendingTwilightWidth = Number(config.dayNight.twilightWidth);
      if (earthDayNightMaterial) {
        earthDayNightMaterial.setParameter('uTwilightWidth', pendingTwilightWidth);
        earthDayNightMaterial.update();
        pendingTwilightWidth = null;
      }
    }
  })
  .catch(err => {
    console.warn('Failed to load config:', err);
    // 使用默认路径作为后备
    dayImage.src = './textures/16k/3_no_ice_clouds_16k.jpg';
    dayImage.onload = () => {
      dayTexture.setSource(dayImage);
      dayTexture.upload();
      checkTexturesLoaded();
    };
    
    nightImage.src = './textures/16k/5_night_16k.jpg.png';
    nightImage.onload = () => {
      nightTexture.setSource(nightImage);
      nightTexture.upload();
      checkTexturesLoaded();
    };
  });

// 渲染循环
app.on('update', (dt: number) => {
  // 更新相机位置（手动轨道控制）
  const inertiaFactor = 0.93;
  cameraPitch += (targetPitch - cameraPitch) * (1 - Math.pow(inertiaFactor, dt * 60));
  cameraYaw += (targetYaw - cameraYaw) * (1 - Math.pow(inertiaFactor, dt * 60));
  cameraDistance += (targetDistance - cameraDistance) * (1 - Math.pow(inertiaFactor, dt * 60));
  
  const pitchRad = cameraPitch * pc.math.DEG_TO_RAD;
  const yawRad = cameraYaw * pc.math.DEG_TO_RAD;
  
  const x = cameraDistance * Math.sin(pitchRad) * Math.sin(yawRad);
  const y = cameraDistance * Math.cos(pitchRad);
  const z = cameraDistance * Math.sin(pitchRad) * Math.cos(yawRad);
  
  camera.setPosition(x, y, z);
  camera.lookAt(0, 0, 0);

  // 保持经线竖直：计算地球北轴在相机屏幕平面上的投影，并绕相机前向轴校正 roll
  if (earthGroup) {
    try {
      // world 空间的北向量（地球的 local Y）
      const northWorld = earthGroup.up.clone();
      // 相机坐标系基向量
      const camForward = camera.forward.clone();
      const camUp = camera.up.clone();
      const camRight = camera.right.clone();

      // 将 north 投影到 camera 平面（去掉沿 forward 的分量）
      const proj = northWorld.clone().sub(camForward.clone().mulScalar(northWorld.dot(camForward)));
      if (proj.lengthSq() > 1e-6) {
        proj.normalize();
        const dotR = proj.dot(camRight);
        const dotU = proj.dot(camUp);
        const angleRad = Math.atan2(dotR, dotU); // 以弧度表示的偏角
        const angleDeg = angleRad * pc.math.RAD_TO_DEG;
        // 先 reset 为 lookAt 布局（已执行），再绕本地 Z 轴旋转以修正 roll（负号使北朝上）
        camera.rotateLocal(0, 0, -angleDeg);
      }
    } catch (e) {
      // ignore errors in edge cases
    }
  }

  // 地球旋转
  if (isRotating && earthGroup) {
    earthGroup.rotateLocal(0, 5 * dt, 0);
  }
  
  // 云层旋转
  if (cloudsEntity) {
    cloudsEntity.rotateLocal(0, 2 * dt, 0);
  }

  // 更新材质相关的运行时参数（相机位置 / 时间）
  elapsedTime += dt;
  const camPos = camera.getPosition();
  if (earthDayNightMaterial) {
    try {
      earthDayNightMaterial.setParameter('uCameraPosition', [camPos.x, camPos.y, camPos.z]);
      earthDayNightMaterial.update();
    } catch (e) {
      // ignore
    }
  }
  // 更新 Fresnel 光晕材质的相机位置（用于 rim 计算）
  try {
    if (typeof fresnelMat !== 'undefined' && fresnelMat) {
      try {
        fresnelMat.setParameter('view_position', [camPos.x, camPos.y, camPos.z]);
        fresnelMat.update();
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }

  if (waterMaterial) {
    try {
      waterMaterial.setParameter('uTime', elapsedTime);
      waterMaterial.setParameter('view_position', [camPos.x, camPos.y, camPos.z]);
      waterMaterial.setParameter('uSunDirection', [sunDirection.x, sunDirection.y, sunDirection.z]);
      waterMaterial.update();
    } catch (e) {
      // ignore
    }
  }
});

// 启动应用
app.start();
