import * as pc from 'playcanvas';

interface StarfieldOptions {
  numStars?: number;
}

/**
 * 创建星空背景（点云）
 */
export function getStarfield(
  device: pc.GraphicsDevice,
  { numStars = 2000 }: StarfieldOptions = {}
): pc.Entity {
  const entity = new pc.Entity('Starfield');

  // 生成随机球面点
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < numStars; i++) {
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    // 简单的灰白色星星
    const brightness = 0.8 + Math.random() * 0.2;
    colors.push(brightness, brightness, brightness, 1.0);
  }

  // 创建顶点格式
  const vertexFormat = new pc.VertexFormat(device, [
    { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
    { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_FLOAT32 }
  ]);

  // 创建顶点缓冲
  const vertexBuffer = new pc.VertexBuffer(
    device,
    vertexFormat,
    numStars
  );

  // 交错顶点数据
  const vertexData = new Float32Array(numStars * 7);
  for (let i = 0; i < numStars; i++) {
    const offset = i * 7;
    vertexData[offset + 0] = positions[i * 3 + 0];
    vertexData[offset + 1] = positions[i * 3 + 1];
    vertexData[offset + 2] = positions[i * 3 + 2];
    vertexData[offset + 3] = colors[i * 4 + 0];
    vertexData[offset + 4] = colors[i * 4 + 1];
    vertexData[offset + 5] = colors[i * 4 + 2];
    vertexData[offset + 6] = colors[i * 4 + 3];
  }

  vertexBuffer.setData(vertexData.buffer);

  // 创建网格
  const mesh = new pc.Mesh(device);
  mesh.vertexBuffer = vertexBuffer;
  mesh.primitive[0].type = pc.PRIMITIVE_POINTS;
  mesh.primitive[0].base = 0;
  mesh.primitive[0].count = numStars;

  // 创建材质
  const material = new pc.Material();
  material.name = 'StarfieldMaterial';

  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec4 aColor;
    
    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_model;
    
    varying vec4 vColor;
    
    void main(void) {
      vColor = aColor;
      gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
      gl_PointSize = 2.0;
    }
  `;

  const fragmentShader = `
    precision highp float;
    
    varying vec4 vColor;
    
    void main(void) {
      gl_FragColor = vColor;
    }
  `;

  const shaderDefinition = {
    attributes: {
      aPosition: pc.SEMANTIC_POSITION,
      aColor: pc.SEMANTIC_COLOR
    },
    vshader: vertexShader,
    fshader: fragmentShader
  };

  material.shader = new pc.Shader(device, shaderDefinition);
  material.update();

  // 创建网格实例
  const meshInstance = new pc.MeshInstance(mesh, material);

  // 添加渲染组件
  entity.addComponent('render', {
    type: 'asset',
    meshInstances: [meshInstance]
  });

  return entity;
}

export default getStarfield;
