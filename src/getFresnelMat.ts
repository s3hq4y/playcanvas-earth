import * as pc from 'playcanvas';

interface FresnelMatOptions {
  rimHex?: number;
  facingHex?: number;
}

/**
 * 创建 Fresnel 光晕材质
 * 用于地球边缘的大气辉光效果
 */
export function getFresnelMat(
  device: pc.GraphicsDevice,
  { rimHex = 0x0088ff, facingHex = 0x000000 }: FresnelMatOptions = {}
): pc.Material {
  const material = new pc.Material();

  material.name = 'FresnelGlowMaterial';

  // 转换十六进制颜色为 RGB
  const hexToRgb = (hex: number) => {
    return [
      ((hex >> 16) & 255) / 255,
      ((hex >> 8) & 255) / 255,
      (hex & 255) / 255
    ];
  };


  // color1: 边缘色（rim），color2: 正面色（facing）
  const color1 = hexToRgb(rimHex);
  const color2 = hexToRgb(facingHex);


  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    
    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    uniform mat3 matrix_normal;
    uniform vec3 view_position;
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main(void) {
      vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
      vec3 worldNormal = normalize(matrix_normal * aNormal);
      vec3 I = worldPos.xyz - view_position;
      vReflectionFactor = fresnelBias + fresnelScale * pow(1.0 + dot(normalize(I), worldNormal), fresnelPower);
      gl_Position = matrix_viewProjection * worldPos;
    }
  `;


  const fragmentShader = `
    precision highp float;
    uniform vec3 color1;
    uniform vec3 color2;
    varying float vReflectionFactor;
    void main(void) {
      float f = clamp(vReflectionFactor, 0.0, 1.0);
      // concentrate effect to a tighter rim and reduce bleed onto surface
      float rim = pow(f, 1.6);
      vec3 rimColor = color1 * rim;
      // output premultiplied-looking alpha for normal blending
      gl_FragColor = vec4(rimColor, rim);
    }
  `;


  const shaderDefinition = {
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aNormal: pc.SEMANTIC_NORMAL
    },
    vshader: vertexShader,
    fshader: fragmentShader
  };


  material.shader = new pc.Shader(device, shaderDefinition);

  // 设置参数（与Three.js一致）
  material.setParameter('color1', color1); // rim
  material.setParameter('color2', color2); // facing
  material.setParameter('fresnelBias', 0.1);
  material.setParameter('fresnelScale', 1.0);
  material.setParameter('fresnelPower', 4.0);

  // 使用普通透明混合，避免对地表产生明显的加色染色
  material.blendType = pc.BLEND_NORMAL;
  material.depthTest = true;
  material.cull = pc.CULLFACE_BACK;
  material.depthWrite = false;
  material.update();
  return material;
}
