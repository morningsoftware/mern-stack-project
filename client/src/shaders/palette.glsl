// Shared GLSL color helpers built from the application's green palette.
// Imported from other shaders with: #include palette.glsl;

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318530718 * (c * t + d));
}

// Light theme: forest -> moss -> sage -> cream-gold.
// #283c31 -> #5e6759 -> #94ae8b -> #e7dba9
vec3 forestPalette(float t) {
  vec3 forest = vec3(0.157, 0.235, 0.192);
  vec3 moss   = vec3(0.369, 0.404, 0.349);
  vec3 sage   = vec3(0.580, 0.682, 0.545);
  vec3 cream  = vec3(0.906, 0.859, 0.663);

  vec3 col = mix(forest, moss, smoothstep(0.0, 0.33, t));
  col = mix(col, sage, smoothstep(0.33, 0.66, t));
  col = mix(col, cream, smoothstep(0.66, 1.0, t));
  return col;
}

// Dark theme: pine -> sage -> mint -> cream.
// #25614a -> #8fa08a -> #8fc7ac -> #e7dba9
vec3 nightPalette(float t) {
  vec3 pine  = vec3(0.145, 0.380, 0.290);
  vec3 sage  = vec3(0.561, 0.627, 0.541);
  vec3 mint  = vec3(0.561, 0.780, 0.675);
  vec3 cream = vec3(0.906, 0.859, 0.663);

  vec3 col = mix(pine, sage, smoothstep(0.0, 0.4, t));
  col = mix(col, mint, smoothstep(0.4, 0.75, t));
  col = mix(col, cream, smoothstep(0.75, 1.0, t));
  return col;
}

// Cosine preset that sweeps through moss and olive with a gold lift.
vec3 greenGold(float t) {
  return palette(t,
    vec3(0.30, 0.36, 0.28),
    vec3(0.22, 0.18, 0.12),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0, 0.35, 0.70));
}
