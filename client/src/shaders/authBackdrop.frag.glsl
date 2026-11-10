precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;

#include noise.glsl;
#include palette.glsl;

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float n = gnoise2(vUv + uTime * 0.1);
  float m = gnoise2(n * 0.2 + uMouse * 0.00003 + vUv + uTime * 0.2);
  m = max(0.0, m);

  vec3 col = mix(vec3(0.090, 0.114, 0.098),
                 vec3(0.129, 0.161, 0.137),
                 m);

  gl_FragColor = vec4(col, 1.0);
}
