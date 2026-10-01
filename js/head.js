import * as THREE from "three";

// Calibrated against assets/bapu.png (385x597): the skull fits an ellipse centred at
// (184, 199) px with radii 156 x 181 px. Changing the photo means re-measuring these.
const IMG = { w: 385, h: 597, cx: 184, cy: 199, rx: 156, ry: 181 };
const NOSE = { x: 275, y: 265 };
const SHAPE = new THREE.Vector3(1, IMG.ry / IMG.rx, 0.95);
export const HEAD_SHAPE = SHAPE;

const vertexShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec4 uImg;     // cx, cy, rx, ry in uv units (y measured from the top)
  uniform vec2 uNose;
  attribute vec3 aUnit;  // position on the undeformed unit sphere
  varying vec2 vUvF;
  varying vec2 vUvB;
  varying float vFront;
  varying vec3 vView;

  void main() {
    vec3 p = aUnit;
    vUvF = vec2(uImg.x + p.x * uImg.z, 1.0 - (uImg.y - p.y * uImg.w));

    // The photo has no back of the head, so stretch the bald scalp band over it.
    float bandTop = 60.0 / 597.0;
    float bandH = 90.0 / 597.0;
    vUvB = vec2(uImg.x - p.x * uImg.z * 0.55, 1.0 - (bandTop + (1.0 - p.y) * 0.5 * bandH));

    vFront = smoothstep(-0.15, 0.3, p.z);

    float lum = dot(texture2D(uMap, vUvF).rgb, vec3(0.299, 0.587, 0.114));
    vec2 dn = (vUvF - uNose) / vec2(0.05, 0.065);
    float relief = vFront * ((lum - 0.5) * 0.07 + 0.11 * exp(-dot(dn, dn)));

    vec4 mv = modelViewMatrix * vec4(position + normal * relief, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  varying vec2 vUvF;
  varying vec2 vUvB;
  varying float vFront;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 f = texture2D(uMap, vUvF).rgb;
    // Unsharp mask so glasses, eyes and moustache survive the 1-bit dither.
    vec2 tx = vec2(1.5 / 385.0, 1.5 / 597.0);
    vec3 blur = (texture2D(uMap, vUvF + vec2(tx.x, 0.0)).rgb + texture2D(uMap, vUvF - vec2(tx.x, 0.0)).rgb
               + texture2D(uMap, vUvF + vec2(0.0, tx.y)).rgb + texture2D(uMap, vUvF - vec2(0.0, tx.y)).rgb) * 0.25;
    f = clamp(f + (f - blur) * 1.6, 0.0, 1.0);
    vec3 b = texture2D(uMap, vUvB).rgb;

    // Near-white texels are photo background poking into the ellipse; patch them with scalp.
    float lf = dot(f, vec3(0.299, 0.587, 0.114));
    vec3 front = mix(f, b, smoothstep(0.9, 0.97, lf));
    vec3 col = mix(b * 0.92, front, vFront);

    float diff = max(dot(n, normalize(uLight)), 0.0);
    float rim = pow(1.0 - max(dot(n, normalize(-vView)), 0.0), 2.4);
    col = col * (0.48 + 0.72 * diff) - rim * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createHead(texture) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;

  const geo = new THREE.SphereGeometry(1, 192, 144);
  geo.setAttribute("aUnit", geo.attributes.position.clone());
  geo.scale(SHAPE.x, SHAPE.y, SHAPE.z);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uMap: { value: texture },
      uImg: { value: new THREE.Vector4(IMG.cx / IMG.w, IMG.cy / IMG.h, IMG.rx / IMG.w, IMG.ry / IMG.h) },
      uNose: { value: new THREE.Vector2(NOSE.x / IMG.w, 1 - NOSE.y / IMG.h) },
      uLight: { value: new THREE.Vector3(-0.55, 0.6, 0.85) },
    },
  });

  const head = new THREE.Mesh(geo, mat);
  head.name = "bapu";
  return head;
}

export function createShadow() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uStrength: { value: 0.55 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        gl_FragColor = vec4(vec3(0.0), (1.0 - smoothstep(0.0, 1.0, d)) * uStrength);
      }
    `,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mat);
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}
