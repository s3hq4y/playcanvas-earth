import * as pc from 'playcanvas';

interface EarthMaterialOptions {
  dayTexture: pc.Texture;
  nightTexture: pc.Texture;
  sunDirection?: pc.Vec3;
}

/**
 * 创建支持日夜过渡的地球材质
 * 根据太阳方向和晨昏线实现日夜光照混合
 */
export function getEarthMaterial(
  device: pc.GraphicsDevice,
  { dayTexture, nightTexture, sunDirection = new pc.Vec3(1, 0, 0) }: EarthMaterialOptions
): pc.Material {
  const material = new pc.Material();
  material.name = 'EarthDayNightMaterial';

  // 创建着色器
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec2 aUv0;
    attribute vec3 aNormal;
    
    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    uniform mat3 matrix_normal;
    
    varying vec2 vUv0;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main(void) {
      vUv0 = aUv0;
      vNormal = normalize(matrix_normal * aNormal);
      vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = matrix_viewProjection * worldPos;
    }
  `;

  const fragmentShader = `
    precision highp float;
    
    uniform sampler2D uDayTexture;
    uniform sampler2D uNightTexture;
    uniform sampler2D uSpecularTexture;
    uniform float uSpecularIntensity;
    uniform float uSpecularShininess;
    uniform vec3 uSunDirection;
    uniform vec3 uCameraPosition;
    uniform float uTwilightWidth;
    uniform float uDarkSideDayRatio;
    uniform vec3 uDayColorMul;
    
    varying vec2 vUv0;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    vec3 srgbToLinear(vec3 c) {
      return pow(c, vec3(2.2));
    }

    vec3 linearToSrgb(vec3 c) {
      return pow(c, vec3(1.0 / 2.2));
    }
    
    void main(void) {
      // 计算法线与太阳方向的点积（光照强度）
      vec3 normalizedPos = normalize(vWorldPosition);
      float sunDot = dot(normalizedPos, normalize(uSunDirection));
      
      // 采样日间和夜间纹理
      vec4 dayColor = texture2D(uDayTexture, vUv0);
      vec4 nightColor = texture2D(uNightTexture, vUv0);
      vec3 dayLinear = srgbToLinear(dayColor.rgb) * uDayColorMul;
      vec3 nightLinear = srgbToLinear(nightColor.rgb);
      
      // 晨昏线混合因子
      float t = smoothstep(-uTwilightWidth, uTwilightWidth, sunDot);
      float mixFactor = mix(clamp(uDarkSideDayRatio, 0.0, 1.0), 1.0, t);
      
      // 在晨昏线区域添加微弱的橙红色辉光
      float twilightGlow = 0.0;
      float absFromCenter = abs(sunDot);
      if (absFromCenter < uTwilightWidth) {
        twilightGlow = (1.0 - absFromCenter / uTwilightWidth) * 0.15;
      }
      vec3 twilightColor = srgbToLinear(vec3(1.0, 0.6, 0.3));
      
      // 混合日夜纹理
      vec4 color = vec4(mix(nightLinear, dayLinear, mixFactor), dayColor.a);
      
      // 添加晨昏线辉光
      color.rgb += twilightColor * twilightGlow;
      
      // 夜间侧稍微提亮灯光效果
      if (mixFactor < 0.5) {
        float nightBoost = (1.0 - mixFactor) * 0.3;
        color.rgb += nightLinear * nightBoost;
      }
      // 镜面高光（基于太阳方向与观测方向近似）
      // 观测方向近似为指向原点的向量（假设相机在原点附近）
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(uCameraPosition - vWorldPosition);
      vec3 H = normalize(L + V);
      float specMap = texture2D(uSpecularTexture, vUv0).r;
      float shininess = max(uSpecularShininess, 1.0);
      float intensity = max(uSpecularIntensity, 0.0);
      if (intensity > 0.0001) {
        float specFactor = pow(max(dot(N, H), 0.0), shininess) * intensity * specMap;
        color.rgb += vec3(specFactor);
      }
      
      color.rgb = linearToSrgb(color.rgb);
      gl_FragColor = color;
    }
  `;

  const shaderDefinition = {
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aUv0: pc.SEMANTIC_TEXCOORD0,
      aNormal: pc.SEMANTIC_NORMAL
    },
    vshader: vertexShader,
    fshader: fragmentShader
  };

  material.shader = new pc.Shader(device, shaderDefinition);

  // 设置材质参数
  material.setParameter('uDayTexture', dayTexture);
  material.setParameter('uNightTexture', nightTexture);
  material.setParameter('uSunDirection', [sunDirection.x, sunDirection.y, sunDirection.z]);
  material.setParameter('uTwilightWidth', 0.1);
  material.setParameter('uDarkSideDayRatio', 0.0);
  material.setParameter('uSpecularIntensity', 1.0);
  material.setParameter('uSpecularShininess', 16.0);
  material.setParameter('uDayColorMul', [1, 1, 1]);
  // 默认相机位置（会在运行时由 index.ts 每帧更新为真实相机位置）
  material.setParameter('uCameraPosition', [0, 0, 5]);

  material.update();

  return material;
}

/**
 * 更新太阳方向
 */
export function updateSunDirection(material: pc.Material, sunDirection: pc.Vec3): void {
  material.setParameter('uSunDirection', [sunDirection.x, sunDirection.y, sunDirection.z]);
  material.update();
}

/**
 * 更新暗面日间贴图占比
 */
export function updateDarkSideDayRatio(material: pc.Material, ratio: number): void {
  material.setParameter('uDarkSideDayRatio', ratio);
  material.update();
}
