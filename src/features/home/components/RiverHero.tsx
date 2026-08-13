"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { useTheme } from "@/shared/ui/theme/use-theme";

import { useMousePosition } from "../hooks/use-mouse-position";
import { hexToHsl } from "../lib/color";

interface Props {
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  size: number;
  opacity: number;
}

interface ThemeColors {
  accentH: number;
  accentS: number;
  accentL: number;
  accent2H: number;
}

const PARTICLE_COUNT = 800;
const MOUSE_INFLUENCE_RADIUS = 150;

// The three sine waves in `seedParticles` are each individually bounded, so
// the river has a hard structural ceiling around 88% of the canvas height:
// particles simply can't get placed past it, rather than a natural taper.
// These fractions fade particle opacity out before that ceiling so it never
// shows as a visible stop. Baked into each particle's alpha every frame
// (not a CSS `mask-image` on the canvas's container) because Chromium
// promotes a continuously-`requestAnimationFrame`-driven canvas to its own
// compositing layer, and an ancestor's CSS mask isn't reliably applied to
// that layer (confirmed by A/B screenshot testing: toggling the mask on/off
// produced pixel-identical output).
//
// Both this window and `seedParticles`' `baseY` are tuned against the hero
// text card's real measured position (`page.tsx`'s `pt-24 pb-12 sm:pt-32
// sm:pb-16` padding), not just "centered in the canvas": measured directly
// via a real 1440x900 layout (canvas height 484px, card center at 56.6% of
// height, card bottom at 86.8%, almost exactly the 88% ceiling above). 0.56
// centers the river on the card.
//
// A prior version pushed the fade window to 0.72-0.95, past the 88%
// ceiling, on the theory that ending the fade past the point particles can
// physically reach would look softer. It didn't: since no particle ever
// reaches past 88%, the window's back half never renders anything, and at
// the true 88% ceiling the fade math had only reached ~30% opacity, so the
// rare particles that do reach it just stop existing there instead of
// tapering to nothing (an abrupt cutoff, confirmed against a real
// screenshot). Ending the window at 0.84, before the ceiling with margin,
// guarantees opacity has already reached 0 by the time particles run out of
// room to exist in.
const BOTTOM_FADE_START = 0.58;
const BOTTOM_FADE_END = 0.84;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 1 above the canvas's bottom fade zone, 0 below it, linear in between. */
function bottomEdgeFade(y: number, height: number): number {
  const start = height * BOTTOM_FADE_START;
  const end = height * BOTTOM_FADE_END;
  if (y <= start) return 1;
  if (y >= end) return 0;
  return 1 - (y - start) / (end - start);
}

/** Builds an `hsla(...)` color string: a thin wrapper so numeric values
 * are stringified explicitly, satisfying `@typescript-eslint/restrict-
 * template-expressions` (which forbids bare `number`s in template literals
 * under this project's strict-type-checked ESLint config). */
function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${String(h)}, ${String(s)}%, ${String(l)}%, ${String(a)})`;
}

function seedParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const x = t * width;

    const baseY = height * 0.56;
    const wave1 = Math.sin(x * 0.008) * 40;
    const wave2 = Math.sin(x * 0.013 + 1) * 25;
    const wave3 = Math.sin(x * 0.021 + 2) * 15;

    const riverWidth = 120 + Math.sin(x * 0.005) * 30;
    const randomOffset = (Math.random() - 0.5) * riverWidth;

    // `x = t * width` places particles at perfectly regular ~1.6px
    // intervals (width/PARTICLE_COUNT). On high-DPI displays, hundreds of
    // overlapping, evenly-spaced gradient streaks produce a visible moiré
    // (faint vertical banding, most obvious on HiDPI screens), so this
    // jitter needs to be wide enough to break that regularity, not just
    // soften individual particle edges.
    particles.push({
      x: x + (Math.random() - 0.5) * 60,
      y: baseY + wave1 + wave2 + wave3 + randomOffset,
      vx: 0.5 + Math.random() * 0.5,
      vy: 0,
      angle: 0,
      speed: 0.3 + Math.random() * 0.3,
      size: 2 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.4,
    });
  }
  return particles;
}

/**
 * Reads the active theme's `--accent`/`--accent2` tokens (see
 * `src/app/globals.css`) straight from the DOM and converts them to HSL.
 * Called once per theme change (not per animation frame: `getComputedStyle`
 * is real work, and color only changes on theme switch) so that this
 * component never hardcodes a per-theme color table that could drift from
 * `globals.css`.
 */
function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const accent = hexToHsl(styles.getPropertyValue("--accent") || "#18181b");
  const accent2 = hexToHsl(styles.getPropertyValue("--accent2") || "#3f3f46");
  return {
    accentH: accent.h,
    accentS: accent.s,
    accentL: accent.l,
    accent2H: accent2.h,
  };
}

/**
 * Ported from `old/tarkov-tips/src/components/RiverEffect.tsx`: a canvas 2D
 * particle simulation forming a flowing "river" across the hero banner that
 * steers toward the mouse cursor. Two deliberate departures from the legacy
 * version:
 *
 * 1. **Theme-adaptive color**: the legacy version hardcoded a green→emerald
 *    HSL gradient. This version reads the active theme's `--accent`/
 *    `--accent2` tokens (see {@link readThemeColors}) so the effect
 *    re-colors correctly under all 6 themes instead of clashing with
 *    Midnight/Warm Gold/Terminal/Inventory/Briefing's own palettes.
 * 2. **`prefers-reduced-motion` support**: neither legacy site handled this.
 *    When set, the animation loop never starts; one static frame renders
 *    instead (mouse-influence terms fixed at 0, so nothing moves).
 */
export function RiverHero({ className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const dimensionsRef = useRef({ width: 800, height: 400 });
  const colorsRef = useRef<ThemeColors>({ accentH: 0, accentS: 0, accentL: 50, accent2H: 0 });

  const mousePosition = useMousePosition();
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();

  // Size the canvas for retina displays and reseed particles whenever the
  // container is resized, ported as-is from the legacy version (pure
  // canvas/DOM mechanics, no architecture decision needed here).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function updateDimensions() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);

      dimensionsRef.current = { width: rect.width, height: rect.height };
      particlesRef.current = seedParticles(rect.width, rect.height);
    }

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Re-read the theme's colors only when the theme actually changes, never
  // inside the per-frame draw loop (see `readThemeColors`'s doc comment).
  useEffect(() => {
    colorsRef.current = readThemeColors();
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    function draw(withMotion: boolean) {
      if (!canvas || !ctx) return;
      const { width, height } = dimensionsRef.current;
      const canvasBox = canvas.getBoundingClientRect();
      const colors = colorsRef.current;

      const relativeMouseX = withMotion ? mousePosition.x - canvasBox.left : -Infinity;
      const relativeMouseY = withMotion ? mousePosition.y - canvasBox.top : -Infinity;

      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach((particle) => {
        const dx = relativeMouseX - particle.x;
        const dy = relativeMouseY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const influence = withMotion ? clamp(1 - distance / MOUSE_INFLUENCE_RADIUS, 0, 1) : 0;

        if (withMotion) {
          if (influence > 0 && distance > 5) {
            const targetAngle = Math.atan2(dy, dx);
            particle.angle += (targetAngle - particle.angle) * influence * 0.1;
          } else {
            particle.angle += (0 - particle.angle) * 0.05;
          }

          particle.x += particle.vx * particle.speed + Math.cos(particle.angle) * influence * 2;
          particle.y += particle.vy * particle.speed + Math.sin(particle.angle) * influence * 2;

          if (particle.x > width + 20) particle.x = -20;
          else if (particle.x < -20) particle.x = width + 20;

          particle.y += Math.sin(Date.now() * 0.001 + particle.x * 0.01) * 0.2;
        }

        ctx.save();
        ctx.translate(particle.x, particle.y);

        // Interpolate from --accent toward --accent2 as mouse influence
        // rises, mirroring the legacy's "hue shifts near the cursor"
        // behavior but parameterized by the active theme's own tokens
        // instead of a hardcoded green pair.
        const hue = colors.accentH + influence * (colors.accent2H - colors.accentH);
        const saturation = clamp(colors.accentS + influence * 20, 0, 100);
        const lightness = clamp(colors.accentL + influence * 10, 0, 100);
        const opacity = (particle.opacity + influence * 0.3) * bottomEdgeFade(particle.y, height);

        // A soft round glow (radial gradient, center to transparent edge)
        // rather than `particle.angle`-rotated *linear* gradient bars. Bars
        // are directional line segments: strung along the sine-wave river
        // path and alpha-blended hundreds deep, they read as streaky, warped
        // "oil slick" lines instead of a soft flowing gradient. A radial
        // gradient is rotationally symmetric, so orienting it to
        // `particle.angle` would have had no visual effect anyway.
        const radius = particle.size * 2;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, hsla(hue, saturation, lightness, opacity));
        gradient.addColorStop(1, hsla(hue, saturation, lightness, 0));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      if (
        withMotion &&
        relativeMouseX > 0 &&
        relativeMouseX < width &&
        relativeMouseY > 0 &&
        relativeMouseY < height
      ) {
        const glow = ctx.createRadialGradient(
          relativeMouseX,
          relativeMouseY,
          0,
          relativeMouseX,
          relativeMouseY,
          MOUSE_INFLUENCE_RADIUS,
        );
        const { accentH, accentS, accentL } = colors;
        glow.addColorStop(0, hsla(accentH, accentS, accentL, 0.1));
        glow.addColorStop(1, hsla(accentH, accentS, accentL, 0));

        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }
    }

    if (reducedMotion) {
      draw(false);
      return;
    }

    function animate() {
      draw(true);
      animationFrameId.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (animationFrameId.current !== undefined) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [mousePosition, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className} pointer-events-none`}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
