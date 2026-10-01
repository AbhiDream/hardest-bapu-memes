import * as THREE from "three";

// Ordered (Bayer 8x8) dithering down to two tones: ink on white paper.
const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uPx;
  uniform float uContrast;
  uniform float uBright;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  varying vec2 vUv;

  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  #define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
  #define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

  void main() {
    vec2 cell = floor(gl_FragCoord.xy / uPx);
    vec2 uv = (cell + 0.5) * uPx / uRes;
    vec3 c = texture2D(tScene, uv).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    l = (l - 0.5) * uContrast + 0.5 + uBright;
    float t = bayer8(cell) + 0.5 / 64.0;
    gl_FragColor = vec4(l < t ? uInk : uPaper, 1.0);
  }
`;

export function createDither(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });

  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tScene: { value: target.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPx: { value: 2 },
      uContrast: { value: 1.35 },
      uBright: { value: -0.04 },
      uInk: { value: new THREE.Color(0x111111) },
      uPaper: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    uniforms: material.uniforms,
    setSize(width, height, pixelRatio) {
      const w = Math.floor(width * pixelRatio);
      const h = Math.floor(height * pixelRatio);
      // Dither cells are >= 2 device px, so half resolution is plenty for the scene pass.
      target.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
      material.uniforms.uRes.value.set(w, h);
    },
    render(scene, camera) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
  };
}
