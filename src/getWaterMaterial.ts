import * as pc from 'playcanvas';

interface WaterOptions {
  color?: number[]; // rgb 0..1
  opacity?: number;
  rippleIntensity?: number;
  rippleSpeed?: number;
  rippleScale?: number;
}

export function getWaterMaterial(device: pc.GraphicsDevice, opts: WaterOptions = {}): pc.Material {
  const material = new pc.Material();
  material.name = 'WaterMaterial';

  const color = opts.color || [0.12, 0.53, 0.9];
  const opacity = (typeof opts.opacity === 'number') ? opts.opacity : 0.35;
  const rippleIntensity = (typeof opts.rippleIntensity === 'number') ? opts.rippleIntensity : 0.12;
  const rippleSpeed = (typeof opts.rippleSpeed === 'number') ? opts.rippleSpeed : 0.6;
  const rippleScale = (typeof opts.rippleScale === 'number') ? opts.rippleScale : 6.0;

  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv0;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    uniform mat3 matrix_normal;

    varying vec2 vUv0;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main(void) {
      vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
      vWorldPosition = worldPos.xyz;
      vUv0 = aUv0;
      vNormal = normalize(matrix_normal * aNormal);
      gl_Position = matrix_viewProjection * worldPos;
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv0;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    uniform float uTime;
    uniform vec3 uWaterColor;
    uniform float uOpacity;
    uniform float uRippleIntensity;
    uniform float uRippleSpeed;
    uniform float uRippleScale;
    uniform vec3 uSunDirection;
    uniform vec3 view_position;
    uniform sampler2D uSpecularTexture;
    uniform float uSpecularThreshold;

    void main(void) {
      // 波纹效果（基于世界坐标的局部波动）已被用户选择注释/禁用。
      // 原始实现：基于 uTime 与 vWorldPosition 的 sin 叠加产生 wave，
      // 并用 specular 贴图作为掩膜只在海面显示波纹。为临时禁用该效果，
      // 将 wave 固定为 0，并保留 mask 逻辑以供未来复用。
      float wave = 0.0;
      float specMap = texture2D(uSpecularTexture, vUv0).r;
      float mask = smoothstep(uSpecularThreshold, 1.0, specMap);

      // 无法动的法线扰动（wave == 0）保持原法线
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(view_position - vWorldPosition);
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.8 * mask;

      vec3 col = mix(vec3(0.0), uWaterColor, mask) + vec3(spec);
      // 根据 mask 引入轻微透明效果：非 spec 区域更透明
      float alpha = uOpacity * mix(0.25, 1.0, mask);
      alpha = clamp(alpha, 0.0, 1.0);

      // 如果完全不在 specular 区域，则保持高度透明（几乎不渲染）
      if (mask <= 0.001) discard;

      gl_FragColor = vec4(col, alpha);
    }
  `;

  const shaderDefinition = {
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aNormal: pc.SEMANTIC_NORMAL,
      aUv0: pc.SEMANTIC_TEXCOORD0
    },
    vshader: vertexShader,
    fshader: fragmentShader
  };

  material.shader = new pc.Shader(device, shaderDefinition);

  material.setParameter('uTime', 0.0);
  material.setParameter('uWaterColor', color);
  material.setParameter('uOpacity', opacity);
  material.setParameter('uRippleIntensity', rippleIntensity);
  material.setParameter('uRippleSpeed', rippleSpeed);
  material.setParameter('uRippleScale', rippleScale);
  material.setParameter('uSpecularThreshold', 0.05);
  // uSpecularTexture 将在运行时由 index.ts 绑定（若可用）

  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.depthTest = true;
  material.cull = pc.CULLFACE_BACK;
  material.update();

  return material;
}
