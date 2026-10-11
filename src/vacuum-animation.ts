/**
 * Animated vacuum, ported from the Home Assistant frontend
 * (src/state-control/vacuum/ha-state-control-vacuum-status.ts).
 * Copyright Home Assistant contributors, licensed under Apache-2.0:
 * https://github.com/home-assistant/frontend/blob/dev/LICENSE.md
 *
 * Changes: state colour is computed locally, the non-standard cleaning
 * states of this card are mapped, and the docked state is not animated.
 */
import { LitElement, css, html } from 'lit';
import type { CSSResultGroup, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { VacuumEntity } from './types';

type VacuumVisualState =
  'cleaning' | 'docked' | 'returning' | 'paused' | 'error' | 'idle';

const CLEANING_STATES = [
  'on',
  'auto',
  'spot',
  'edge',
  'single_room',
  'cleaning',
];
const INACTIVE_STATES = ['docked', 'idle', 'paused', 'off'];

const computeVisualState = ({ state }: VacuumEntity): VacuumVisualState => {
  if (CLEANING_STATES.includes(state)) {
    return 'cleaning';
  }
  if (
    state === 'error' ||
    state === 'returning' ||
    state === 'paused' ||
    state === 'docked'
  ) {
    return state;
  }
  return 'idle';
};

// Same theme variables Home Assistant uses to colour a vacuum by state
const computeColor = ({ state }: VacuumEntity): string => {
  if (state === 'unavailable') {
    return 'var(--state-unavailable-color)';
  }
  if (state === 'error') {
    return 'var(--state-vacuum-error-color, var(--error-color))';
  }
  const activity = INACTIVE_STATES.includes(state) ? 'inactive' : 'active';
  return `var(--state-vacuum-${state}-color, var(--state-vacuum-${activity}-color, var(--state-${activity}-color)))`;
};

export class VacuumCardAnimation extends LitElement {
  @property({ attribute: false }) public stateObj!: VacuumEntity;

  protected render(): TemplateResult {
    const visualState = computeVisualState(this.stateObj);
    const style = {
      '--vacuum-color': computeColor(this.stateObj),
    };

    return html`
      <div class="container ${visualState}" style=${styleMap(style)}>
        <svg
          viewBox="0 0 240 240"
          xmlns="http://www.w3.org/2000/svg"
          class="vacuum-svg"
        >
          <!-- Soft background glow -->
          <circle
            cx="120"
            cy="120"
            r="110"
            class="glow"
            fill="var(--vacuum-color)"
            opacity="0.06"
          />

          <!-- Robot body group -->
          <g class="vacuum-body-rotate">
            <g class="vacuum-body">
              <!-- Side brush (front-right, rendered before body so body covers half) -->
              <g class="brush brush-right">
                <g class="brush-spokes">
                  <line
                    x1="174"
                    y1="76"
                    x2="174"
                    y2="64"
                    stroke="var(--vacuum-color)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    opacity="0.5"
                  />
                  <line
                    x1="174"
                    y1="76"
                    x2="174"
                    y2="88"
                    stroke="var(--vacuum-color)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    opacity="0.5"
                  />
                  <line
                    x1="174"
                    y1="76"
                    x2="162"
                    y2="76"
                    stroke="var(--vacuum-color)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    opacity="0.5"
                  />
                  <line
                    x1="174"
                    y1="76"
                    x2="186"
                    y2="76"
                    stroke="var(--vacuum-color)"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    opacity="0.5"
                  />
                </g>
                <circle
                  cx="174"
                  cy="76"
                  r="2"
                  fill="var(--vacuum-color)"
                  opacity="0.5"
                />
              </g>

              <!-- Outer body shell -->
              <circle
                cx="120"
                cy="120"
                r="72"
                fill="var(--card-background-color, #fff)"
                stroke="var(--vacuum-color)"
                stroke-width="2"
              />

              <!-- Inner body ring -->
              <circle
                cx="120"
                cy="120"
                r="66"
                fill="none"
                stroke="var(--vacuum-color)"
                stroke-width="0.8"
                opacity="0.2"
              />

              <!-- Bumper arc (front half, prominent) -->
              <path
                d="M 60 94 A 68 68 0 0 1 180 94"
                fill="none"
                stroke="var(--vacuum-color)"
                stroke-width="3"
                stroke-linecap="round"
                class="bumper"
              />

              <!-- Direction indicator lines (navigation feel) -->
              <g class="nav-lines" opacity="0.15">
                <line
                  x1="120"
                  y1="56"
                  x2="120"
                  y2="74"
                  stroke="var(--vacuum-color)"
                  stroke-width="1.5"
                />
                <line
                  x1="88"
                  y1="63"
                  x2="96"
                  y2="78"
                  stroke="var(--vacuum-color)"
                  stroke-width="1.5"
                />
                <line
                  x1="152"
                  y1="63"
                  x2="144"
                  y2="78"
                  stroke="var(--vacuum-color)"
                  stroke-width="1.5"
                />
              </g>

              <!-- LIDAR turret (static) -->
              <circle
                cx="120"
                cy="108"
                r="14"
                fill="var(--card-background-color, #fff)"
                stroke="var(--vacuum-color)"
                stroke-width="2"
                class="lidar-housing"
              />
              <circle
                cx="120"
                cy="108"
                r="9"
                fill="none"
                stroke="var(--vacuum-color)"
                stroke-width="0.8"
                opacity="0.25"
              />

              <!-- Power button area (center) -->
              <circle
                cx="120"
                cy="140"
                r="8"
                fill="var(--vacuum-color)"
                opacity="0.08"
                class="power-ring"
              />
              <circle
                cx="120"
                cy="140"
                r="4"
                fill="var(--vacuum-color)"
                opacity="0.25"
                class="power-dot"
              />
            </g>
          </g>

          <!-- Dust particles (cleaning state) - sucked toward vacuum -->
          <g class="particles">
            <circle
              class="particle p1"
              cx="120"
              cy="120"
              r="2"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p2"
              cx="120"
              cy="120"
              r="1.5"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p3"
              cx="120"
              cy="120"
              r="1.5"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p4"
              cx="120"
              cy="120"
              r="2"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p5"
              cx="120"
              cy="120"
              r="1.5"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p6"
              cx="120"
              cy="120"
              r="1.5"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p7"
              cx="120"
              cy="120"
              r="1"
              fill="var(--vacuum-color)"
            />
            <circle
              class="particle p8"
              cx="120"
              cy="120"
              r="1"
              fill="var(--vacuum-color)"
            />
          </g>

          <!-- Dock station (docked state) -->
          <g class="dock-indicator">
            <!-- Dock base plate -->
            <rect
              x="76"
              y="188"
              width="88"
              height="28"
              rx="8"
              fill="var(--card-background-color, #fff)"
              stroke="var(--vacuum-color)"
              stroke-width="2"
            />
          </g>

          <!-- Return arrow (returning state) -->
          <g class="return-path">
            <polygon
              points="120,220 110,206 130,206"
              fill="var(--vacuum-color)"
              stroke="var(--vacuum-color)"
              stroke-width="2"
              stroke-linejoin="round"
              opacity="0.55"
            />
          </g>
        </svg>
      </div>
    `;
  }

  static styles: CSSResultGroup = css`
    :host {
      display: flex;
      cursor: pointer;
      align-items: center;
      justify-content: center;
    }

    .container {
      width: 200px;
      height: 200px;
      position: relative;
    }

    .vacuum-svg {
      width: 100%;
      height: 100%;
    }

    /* -- Hide state-specific elements by default -- */
    .particles,
    .dock-indicator,
    .return-path {
      opacity: 0;
      transition: opacity 400ms ease;
    }

    /* ======================== */
    /* CLEANING                 */
    /* ======================== */
    .cleaning .vacuum-body {
      animation: vacuum-wander 12s ease-in-out infinite;
      transform-origin: 120px 120px;
    }

    .cleaning .brush-right .brush-spokes {
      animation: brush-spin 0.6s linear infinite;
      transform-origin: 174px 76px;
    }

    .cleaning .particles {
      opacity: 1;
    }

    .cleaning .particle {
      animation: particle-suck 2.4s ease-in infinite;
      transform-origin: 120px 120px;
    }

    .cleaning .p1 {
      animation-delay: 0s;
    }
    .cleaning .p2 {
      animation-delay: -0.3s;
    }
    .cleaning .p3 {
      animation-delay: -0.6s;
    }
    .cleaning .p4 {
      animation-delay: -0.9s;
    }
    .cleaning .p5 {
      animation-delay: -1.2s;
    }
    .cleaning .p6 {
      animation-delay: -1.5s;
    }
    .cleaning .p7 {
      animation-delay: -1.8s;
    }
    .cleaning .p8 {
      animation-delay: -2.1s;
    }

    .cleaning .p1 {
      --particle-x: -90px;
      --particle-y: -25px;
    }
    .cleaning .p2 {
      --particle-x: 90px;
      --particle-y: 20px;
    }
    .cleaning .p3 {
      --particle-x: -85px;
      --particle-y: 40px;
    }
    .cleaning .p4 {
      --particle-x: 85px;
      --particle-y: -35px;
    }
    .cleaning .p5 {
      --particle-x: -65px;
      --particle-y: 70px;
    }
    .cleaning .p6 {
      --particle-x: 70px;
      --particle-y: -65px;
    }
    .cleaning .p7 {
      --particle-x: -75px;
      --particle-y: -55px;
    }
    .cleaning .p8 {
      --particle-x: 80px;
      --particle-y: 55px;
    }

    .cleaning .nav-lines {
      animation: nav-pulse 2s ease-in-out infinite;
    }

    /* ======================== */
    /* RETURNING                */
    /* ======================== */
    .vacuum-body-rotate {
      transform-origin: 120px 120px;
      transform: rotate(0deg);
      transition: transform 600ms ease-in-out;
    }

    .returning .vacuum-body-rotate {
      transform: rotate(180deg);
    }

    .returning .vacuum-body {
      animation: returning-drift 3s ease-in-out infinite;
    }

    .returning .return-path {
      opacity: 1;
      animation: return-arrow 1.6s ease-in-out infinite;
      transform-origin: 120px 210px;
    }

    .returning .brush-right {
      opacity: 0.4;
    }

    /* ======================== */
    /* DOCKED                   */
    /* ======================== */
    .docked .dock-indicator {
      opacity: 1;
    }

    .docked .vacuum-body {
      opacity: 0.75;
    }

    .docked .brush-right {
      opacity: 0.5;
    }

    /* ======================== */
    /* ERROR                    */
    /* ======================== */
    .error .glow {
      animation: error-glow 1.8s ease-in-out infinite;
    }

    /* ======================== */
    /* IDLE                     */
    /* ======================== */
    .idle .vacuum-body {
      opacity: 0.65;
    }

    .idle .brush-right {
      opacity: 0.4;
    }

    /* ============================== */
    /* KEYFRAME ANIMATIONS            */
    /* ============================== */

    @keyframes vacuum-wander {
      0% {
        transform: rotate(0deg) translate(0, 0);
      }
      15% {
        transform: rotate(0deg) translate(0, -30px);
      }
      25% {
        transform: rotate(0deg) translate(0, 0);
      }
      32% {
        transform: rotate(-18deg) translate(0, 0);
      }
      47% {
        transform: rotate(-18deg) translate(0, -28px);
      }
      57% {
        transform: rotate(-18deg) translate(0, 0);
      }
      63% {
        transform: rotate(12deg) translate(0, 0);
      }
      78% {
        transform: rotate(12deg) translate(0, -25px);
      }
      88% {
        transform: rotate(12deg) translate(0, 0);
      }
      95% {
        transform: rotate(0deg) translate(0, 0);
      }
      100% {
        transform: rotate(0deg) translate(0, 0);
      }
    }

    @keyframes brush-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes particle-suck {
      0% {
        opacity: 0;
        transform: translate(var(--particle-x), var(--particle-y)) scale(1.2);
      }
      25% {
        opacity: 0.8;
      }
      80% {
        opacity: 0;
        transform: translate(
            calc(var(--particle-x) * 0.82),
            calc(var(--particle-y) * 0.82)
          )
          scale(0.6);
      }
      100% {
        opacity: 0;
        transform: translate(
            calc(var(--particle-x) * 0.82),
            calc(var(--particle-y) * 0.82)
          )
          scale(0.6);
      }
    }

    @keyframes nav-pulse {
      0%,
      100% {
        opacity: 0.15;
      }
      50% {
        opacity: 0.35;
      }
    }

    @keyframes returning-drift {
      0%,
      100% {
        transform: translateY(-6px);
      }
      50% {
        transform: translateY(4px);
      }
    }

    @keyframes return-arrow {
      0%,
      100% {
        transform: translateY(-6px);
        opacity: 0.3;
      }
      50% {
        transform: translateY(4px);
        opacity: 0.85;
      }
    }

    @keyframes error-glow {
      0%,
      100% {
        opacity: 0.08;
      }
      50% {
        opacity: 0.35;
      }
    }

    /* Respect prefers-reduced-motion */
    @media (prefers-reduced-motion: reduce) {
      .cleaning .vacuum-body,
      .cleaning .brush-right .brush-spokes,
      .cleaning .particle,
      .cleaning .nav-lines,
      .returning .vacuum-body,
      .returning .return-path,
      .error .glow {
        animation: none;
      }
      .vacuum-body-rotate {
        transition: none;
      }
    }
  `;
}

if (!customElements.get('vacuum-card-animation')) {
  customElements.define('vacuum-card-animation', VacuumCardAnimation);
}
