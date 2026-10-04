import React from 'react'

/**
 * Acelerómetro / Velocímetro semicircular sin flecha para el Punto de Corte (Cutoff Score: 450 - 750 pts).
 * 
 * Características:
 * - Animación fluida de arco semicircular con gradiente reactivo (Ámbar -> Cian -> Esmeralda).
 * - Perla/marcador luminoso guía sobre la circunferencia (sin aguja/flecha).
 * - Lectura numérica central de alto impacto y badge de postura de apetito al riesgo.
 * - Deslizador integrado liquid glass de precisión con extremos 450 y 750.
 */
export function CutoffGauge({
  cutoff = 580,
  onChange,
  min = 450,
  max = 750,
  step = 5,
}) {
  const totalRange = max - min
  const clampedCutoff = Math.min(Math.max(cutoff, min), max)
  const pct = (clampedCutoff - min) / totalRange

  // Geometría del arco semicircular
  const cx = 130
  const cy = 110
  const r = 82
  const strokeWidth = 13
  const arcLength = Math.PI * r // ~257.61px
  const dashOffset = arcLength * (1 - pct)

  // Posición del marcador sobre el arco (theta de PI a 0 rad)
  const theta = Math.PI * (1 - pct)
  const markerX = cx + r * Math.cos(theta)
  const markerY = cy - r * Math.sin(theta)

  // Evaluación de postura de apetito de riesgo y colorimetría
  let stanceColor = '#06b6d4' // Cian (Equilibrada)
  let stanceLabel = 'Equilibrada (Institucional)'

  if (clampedCutoff < 540) {
    stanceColor = '#f59e0b' // Ámbar (Agresiva / Crecimiento)
    stanceLabel = 'Crecimiento (Mayor Volumen / Mora)'
  } else if (clampedCutoff >= 620) {
    stanceColor = '#10b981' // Esmeralda (Conservadora)
    stanceLabel = 'Conservadora (Baja Mora / Estricto)'
  }

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[290px] mx-auto">
      {/* Gráfico SVG del Acelerómetro sin aguja */}
      <svg
        viewBox="0 0 260 135"
        className="w-full max-w-[260px] overflow-visible drop-shadow-lg"
      >
        <defs>
          {/* Gradiente reactivo del arco */}
          <linearGradient id="cutoffArcGradient" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          {/* Sombra sutil para el marcador luminoso */}
          <filter id="markerGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* 1. Pista Base Tenue (Arco completo de fondo) */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* 2. Pista Activa Animada con Gradiente */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#cutoffArcGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        />

        {/* 3. Marcador Luminoso en el Arco (Sin aguja/flecha) */}
        <circle
          cx={markerX}
          cy={markerY}
          r="8"
          fill="#ffffff"
          stroke={stanceColor}
          strokeWidth="3.5"
          filter="url(#markerGlow)"
          style={{
            transition: 'cx 0.35s cubic-bezier(0.2, 0.9, 0.3, 1), cy 0.35s cubic-bezier(0.2, 0.9, 0.3, 1), stroke 0.3s ease',
          }}
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="3"
          fill={stanceColor}
          style={{
            transition: 'cx 0.35s cubic-bezier(0.2, 0.9, 0.3, 1), cy 0.35s cubic-bezier(0.2, 0.9, 0.3, 1), fill 0.3s ease',
          }}
        />

        {/* Marcas de Extremos 450 y 750 */}
        <text
          x={cx - r - 2}
          y={cy + 18}
          fill="#94a3b8"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="monospace"
        >
          {min}
        </text>
        <text
          x={cx + r + 2}
          y={cy + 18}
          fill="#94a3b8"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="monospace"
        >
          {max}
        </text>

        {/* Lectura Central del Corte */}
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          fill={stanceColor}
          fontSize="26"
          fontWeight="900"
          fontFamily="monospace"
          className="tracking-tight"
          style={{ transition: 'fill 0.3s ease' }}
        >
          {clampedCutoff}
          <tspan fontSize="12" fontWeight="700" fill="#94a3b8" dx="3">
            pts
          </tspan>
        </text>

        {/* Subtítulo de Postura */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
          fontWeight="600"
        >
          {stanceLabel}
        </text>
      </svg>

      {/* Slider Horizontal de Ajuste Fino */}
      <div className="w-full mt-1.5 space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clampedCutoff}
          onChange={(e) => onChange && onChange(parseInt(e.target.value, 10))}
          className="cutoff-slider w-full cursor-pointer"
          title={`Punto de Corte actual: ${clampedCutoff} pts`}
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
          <span>450 (Flexible)</span>
          <span>750 (Estricto)</span>
        </div>
      </div>
    </div>
  )
}
