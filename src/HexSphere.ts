import * as pc from 'playcanvas';

/**
 * 六边形球面网格生成器（PlayCanvas版本）
 * 基于二十面体细分，生成包含大量六边形和12个五边形的测地球体
 * 类似 RimWorld 的星球地块划分系统
 */

interface HexTile {
  centerPoint: pc.Vec3;
  vertices: pc.Vec3[];
  neighborIndices: number[];
  isPentagon: boolean;
  index: number;
}

export class HexSphere {
  public tiles: HexTile[] = [];
  public radius: number;
  public subdivisions: number;
  
  private vertices: pc.Vec3[] = [];
  private faces: number[][] = [];
  
  constructor(radius: number = 1, subdivisions: number = 3) {
    this.radius = radius;
    this.subdivisions = subdivisions;
    this.generate();
  }

  /**
   * 球面上的球面插值（slerp），a 和 b 假设归一化
   */
  private slerp(a: pc.Vec3, b: pc.Vec3, t: number): pc.Vec3 {
    const dot = Math.max(-1, Math.min(1, a.dot(b)));
    const omega = Math.acos(dot);
    if (omega < 1e-6) return a.clone();
    const sinOmega = Math.sin(omega);
    const s1 = Math.sin((1 - t) * omega) / sinOmega;
    const s2 = Math.sin(t * omega) / sinOmega;
    return new pc.Vec3(
      a.x * s1 + b.x * s2,
      a.y * s1 + b.y * s2,
      a.z * s1 + b.z * s2
    );
  }
  
  /**
   * 生成六边形球面网格
   */
  private generate(): void {
    this.createIcosahedron();
    this.subdivide(this.subdivisions);
    this.projectToSphere();
    this.generateTiles();
  }
  
  /**
   * 创建基础二十面体的顶点和面
   */
  private createIcosahedron(): void {
    const t = (1 + Math.sqrt(5)) / 2; // 黄金比例
    
    const vertices = [
      [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
      [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
      [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1]
    ];
    
    this.vertices = vertices.map(v => {
      const vec = new pc.Vec3(v[0], v[1], v[2]);
      vec.normalize();
      return vec;
    });
    
    this.faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
  }
  
  /**
   * 细分三角形面
   */
  private subdivide(subdivisions: number): void {
    const vertexCache = new Map<string, number>();
    
    const getMiddlePoint = (p1: number, p2: number): number => {
      const smallerIndex = Math.min(p1, p2);
      const greaterIndex = Math.max(p1, p2);
      const key = `${smallerIndex}_${greaterIndex}`;
      
      if (vertexCache.has(key)) {
        return vertexCache.get(key)!;
      }
      
      const point1 = this.vertices[p1];
      const point2 = this.vertices[p2];
      const middle = new pc.Vec3(
        (point1.x + point2.x) / 2,
        (point1.y + point2.y) / 2,
        (point1.z + point2.z) / 2
      );
      
      const index = this.vertices.length;
      this.vertices.push(middle);
      vertexCache.set(key, index);
      
      return index;
    };
    
    for (let i = 0; i < subdivisions; i++) {
      const newFaces: number[][] = [];
      
      for (const face of this.faces) {
        const [v1, v2, v3] = face;
        
        const a = getMiddlePoint(v1, v2);
        const b = getMiddlePoint(v2, v3);
        const c = getMiddlePoint(v3, v1);
        
        newFaces.push([v1, a, c]);
        newFaces.push([v2, b, a]);
        newFaces.push([v3, c, b]);
        newFaces.push([a, b, c]);
      }
      
      this.faces = newFaces;
      vertexCache.clear();
    }
  }
  
  /**
   * 将所有顶点投影到球面
   */
  private projectToSphere(): void {
    this.vertices = this.vertices.map(v => {
      const normalized = v.clone().normalize();
      return normalized.mulScalar(this.radius);
    });
  }
  
  /**
   * 生成六边形和五边形地块
   */
  private generateTiles(): void {
    this.tiles = [];
    
    const vertexToFaces = new Map<number, number[]>();
    this.faces.forEach((face, faceIndex) => {
      face.forEach(vertexIndex => {
        if (!vertexToFaces.has(vertexIndex)) {
          vertexToFaces.set(vertexIndex, []);
        }
        vertexToFaces.get(vertexIndex)!.push(faceIndex);
      });
    });
    
    const faceCenters = this.faces.map(face => {
      const center = new pc.Vec3();
      face.forEach(vi => {
        center.add(this.vertices[vi]);
      });
      center.divScalar(face.length);
      center.normalize().mulScalar(this.radius);
      return center;
    });
    
    this.vertices.forEach((vertex, vertexIndex) => {
      const adjacentFaces = vertexToFaces.get(vertexIndex) || [];
      
      if (adjacentFaces.length === 0) return;
      
      const sortedFaces = this.sortFacesAroundVertex(vertexIndex, adjacentFaces);
      const tileVertices = sortedFaces.map(faceIndex => faceCenters[faceIndex]);
      
      const tile: HexTile = {
        centerPoint: vertex.clone(),
        vertices: tileVertices,
        neighborIndices: [],
        isPentagon: tileVertices.length === 5,
        index: this.tiles.length
      };
      
      this.tiles.push(tile);
    });
    
    this.buildNeighborRelations();
  }
  
  /**
   * 将顶点周围的面按顺序排列
   */
  private sortFacesAroundVertex(vertexIndex: number, faceIndices: number[]): number[] {
    if (faceIndices.length <= 1) return faceIndices;
    
    const sorted = [faceIndices[0]];
    const remaining = new Set(faceIndices.slice(1));
    
    while (remaining.size > 0) {
      const currentFace = sorted[sorted.length - 1];
      const currentFaceVertices = this.faces[currentFace];
      
      const edgeVertices = this.getAdjacentVerticesInFace(vertexIndex, currentFaceVertices);
      
      let found = false;
      for (const nextFaceIndex of remaining) {
        const nextFaceVertices = this.faces[nextFaceIndex];
        
        for (const edgeVertex of edgeVertices) {
          if (nextFaceVertices.includes(edgeVertex)) {
            sorted.push(nextFaceIndex);
            remaining.delete(nextFaceIndex);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      if (!found) break;
    }
    
    return sorted;
  }
  
  /**
   * 获取面中与指定顶点相邻的其他顶点
   */
  private getAdjacentVerticesInFace(vertexIndex: number, faceVertices: number[]): number[] {
    const idx = faceVertices.indexOf(vertexIndex);
    if (idx === -1) return [];
    
    const prev = faceVertices[(idx + 2) % 3];
    const next = faceVertices[(idx + 1) % 3];
    return [prev, next];
  }
  
  /**
   * 构建地块之间的邻接关系
   */
  private buildNeighborRelations(): void {
    const vertexToTiles = new Map<string, number[]>();
    
    this.tiles.forEach((tile, tileIndex) => {
      tile.vertices.forEach(vertex => {
        const key = this.vertexKey(vertex);
        if (!vertexToTiles.has(key)) {
          vertexToTiles.set(key, []);
        }
        vertexToTiles.get(key)!.push(tileIndex);
      });
    });
    
    this.tiles.forEach((tile, tileIndex) => {
      const neighbors = new Set<number>();
      
      tile.vertices.forEach(vertex => {
        const key = this.vertexKey(vertex);
        const adjacentTiles = vertexToTiles.get(key) || [];
        
        adjacentTiles.forEach(neighborIndex => {
          if (neighborIndex !== tileIndex) {
            neighbors.add(neighborIndex);
          }
        });
      });
      
      tile.neighborIndices = Array.from(neighbors);
    });
  }
  
  /**
   * 生成顶点的唯一键
   */
  private vertexKey(vertex: pc.Vec3): string {
    const precision = 6;
    return `${vertex.x.toFixed(precision)}_${vertex.y.toFixed(precision)}_${vertex.z.toFixed(precision)}`;
  }
  
  /**
   * 创建线框网格用于可视化
   */
  public createWireframeMesh(device: pc.GraphicsDevice, color: pc.Color = new pc.Color(0, 1, 0.5)): pc.Entity {
    const entity = new pc.Entity('HexGridWireframe');
    
    const positions: number[] = [];
    
    this.tiles.forEach(tile => {
      const vertices = tile.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];
        // 把直线边细分为沿球面弧段，避免边缘悬空（只在顶点贴合球面）
        const a = v1.clone().normalize();
        const b = v2.clone().normalize();
        const dot = Math.max(-1, Math.min(1, a.dot(b)));
        const angle = Math.acos(dot);
        // 根据角度决定分段数，最小 2 段
        const segments = Math.max(2, Math.ceil((angle / (Math.PI)) * 8));
        for (let s = 0; s < segments; s++) {
          const t0 = s / segments;
          const t1 = (s + 1) / segments;
          const p0 = this.slerp(a, b, t0).mulScalar(this.radius);
          const p1 = this.slerp(a, b, t1).mulScalar(this.radius);
          positions.push(p0.x, p0.y, p0.z);
          positions.push(p1.x, p1.y, p1.z);
        }
      }
    });
    
    const vertexFormat = new pc.VertexFormat(device, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
    ]);
    
    const vertexBuffer = new pc.VertexBuffer(
      device,
      vertexFormat,
      positions.length / 3
    );
    
    const posData = new Float32Array(positions);
    vertexBuffer.setData(posData.buffer);
    
    const mesh = new pc.Mesh(device);
    mesh.vertexBuffer = vertexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = positions.length / 3;
    
    const material = new pc.BasicMaterial();
    material.color = color;
    material.update();
    
    const meshInstance = new pc.MeshInstance(mesh, material);
    
    entity.addComponent('render', {
      type: 'asset',
      meshInstances: [meshInstance]
    });
    
    return entity;
  }
  
  /**
   * 获取统计信息
   */
  public getStats(): { total: number; hexagons: number; pentagons: number } {
    const pentagons = this.tiles.filter(t => t.isPentagon).length;
    const hexagons = this.tiles.filter(t => !t.isPentagon).length;
    
    return {
      total: this.tiles.length,
      hexagons,
      pentagons
    };
  }
}
