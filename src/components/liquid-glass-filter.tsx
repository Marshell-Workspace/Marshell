"use client";

export interface LiquidGlassFilterProps {
  idPrefix?: string;
}

export function LiquidGlassFilter({
  idPrefix = "hyperion",
}: LiquidGlassFilterProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -top-full -left-full size-0 opacity-0"
      tabIndex={-1}
    >
      <defs>
        {/* Standard Liquid Glass optical refraction filter for panels, sidebars, headers */}
        <filter
          colorInterpolationFilters="sRGB"
          height="100%"
          id={`${idPrefix}-liquid-glass`}
          width="100%"
          x="0%"
          y="0%"
        >
          <feTurbulence
            baseFrequency="0.04 0.04"
            numOctaves={1}
            result="noise"
            seed={1}
            type="fractalNoise"
          />
          <feGaussianBlur in="noise" result="blurredNoise" stdDeviation="2" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={45}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="3" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>

        {/* Liquid Button optical distortion filter */}
        <filter
          colorInterpolationFilters="sRGB"
          height="100%"
          id={`${idPrefix}-liquid-glass-button`}
          width="100%"
          x="0%"
          y="0%"
        >
          <feTurbulence
            baseFrequency="0.05 0.05"
            numOctaves={1}
            result="turbulence"
            seed={1}
            type="fractalNoise"
          />
          <feGaussianBlur
            in="turbulence"
            result="blurredNoise"
            stdDeviation="2"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={65}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="4" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>

        {/* Deep / Floating optical refraction filter for dialogs, popovers, composer */}
        <filter
          colorInterpolationFilters="sRGB"
          height="100%"
          id={`${idPrefix}-liquid-glass-elevated`}
          width="100%"
          x="0%"
          y="0%"
        >
          <feTurbulence
            baseFrequency="0.035 0.035"
            numOctaves={2}
            result="noise"
            seed={2}
            type="fractalNoise"
          />
          <feGaussianBlur in="noise" result="blurredNoise" stdDeviation="2.5" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={55}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="5" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>

        {/* Subtle optical refraction filter for gentle background displacement */}
        <filter
          colorInterpolationFilters="sRGB"
          height="100%"
          id={`${idPrefix}-liquid-glass-subtle`}
          width="100%"
          x="0%"
          y="0%"
        >
          <feTurbulence
            baseFrequency="0.03 0.03"
            numOctaves={1}
            result="noise"
            seed={3}
            type="fractalNoise"
          />
          <feGaussianBlur in="noise" result="blurredNoise" stdDeviation="1.5" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={28}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="3" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>

        {/* Container glass filter compatibility alias */}
        <filter
          colorInterpolationFilters="sRGB"
          height="100%"
          id="container-glass"
          width="100%"
          x="0%"
          y="0%"
        >
          <feTurbulence
            baseFrequency="0.05 0.05"
            numOctaves={1}
            result="turbulence"
            seed={1}
            type="fractalNoise"
          />
          <feGaussianBlur
            in="turbulence"
            result="blurredNoise"
            stdDeviation="2"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            result="displaced"
            scale={70}
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="4" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}
