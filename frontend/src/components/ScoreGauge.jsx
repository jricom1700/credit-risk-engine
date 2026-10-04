import React, { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

/**
 * Velocímetro Semicircular Sólido y Reactivo para Score de Crédito (300 a 850 puntos).
 * 
 * Características:
 * 1. Zonas como sectores de corona circular sólidos (Annular Sectors con fill="#..."):
 *    Grosor uniforme de 16px en todo el arco, 100% relleno sin deformaciones.
 * 2. Línea amarilla de demarcación:
 *    Ubicada con precisión milimétrica dentro de la zona amarilla en la frontera de corte.
 * 3. Barra de umbral de corte integrada:
 *    Mismo ancho exacto que el gráfico del velocímetro (max-w-[340px]), con diseño
 *    de barra vertical amarilla idéntico a la línea de corte del velocímetro.
 */
export function ScoreGauge({ score = 300, cutoff = 560, onCutoffChange }) {
  const [animatedScore, setAnimatedScore] = useState(300)

  useEffect(() => {
    // Animación de entrada suave hacia el puntaje real del cliente
    const timer = setTimeout(() => {
      setAnimatedScore(score)
    }, 80)
    return () => clearTimeout(timer)
  }, [score])

  // Normalización del score dentro del rango 300 a 850
  const minScore = 300
  const maxScore = 850
  const totalRange = maxScore - minScore // 550 puntos

  const clampedScore = Math.min(Math.max(animatedScore, minScore), maxScore)
  const scorePercent = (clampedScore - minScore) / totalRange

  // Ángulo de la aguja: de -90deg (300 pts) a +90deg (850 pts)
  const needleAngle = -90 + scorePercent * 180

  // Dimensiones del SVG y radios de corona circular sólida
  const cx = 170
  const cy = 155
  const rInner = 107
  const rOuter = 123 // Grosor uniforme de 16px en todo el arco
  const midR = (rInner + rOuter) / 2 // 115px
  const capRadius = (rOuter - rInner) / 2 // 8px

  // Conversión polar a cartesiana (0° = izquierda / 300 pts, 180° = derecha / 850 pts)
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((180 - angleInDegrees) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY - radius * Math.sin(angleInRadians),
    }
  }

  // Generador de sector de corona circular 2D completamente sólido (fill)
  const describeAnnularSector = (centerX, centerY, innerR, outerR, startAngle, endAngle) => {
    const pOutStart = polarToCartesian(centerX, centerY, outerR, startAngle)
    const pOutEnd = polarToCartesian(centerX, centerY, outerR, endAngle)
    const pInEnd = polarToCartesian(centerX, centerY, innerR, endAngle)
    const pInStart = polarToCartesian(centerX, centerY, innerR, startAngle)
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

    return [
      `M ${pOutStart.x.toFixed(2)} ${pOutStart.y.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${pOutEnd.x.toFixed(2)} ${pOutEnd.y.toFixed(2)}`,
      `L ${pInEnd.x.toFixed(2)} ${pInEnd.y.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${pInStart.x.toFixed(2)} ${pInStart.y.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  // CÁLCULO DINÁMICO DE ZONAS SEGÚN EL UMBRAL DE CORTE
  const REVIEW_WINDOW = 45
  const reviewThreshold = Math.max(minScore + 20, cutoff - REVIEW_WINDOW)
  const approvalThreshold = Math.min(maxScore - 20, Math.max(reviewThreshold + 15, cutoff))

  const angleRedEnd = Math.max(8, Math.min(155, ((reviewThreshold - minScore) / totalRange) * 180))
  const angleAmberEnd = Math.max(angleRedEnd + 10, Math.min(172, ((approvalThreshold - minScore) / totalRange) * 180))

  // Geometrías 2D sólidas
  const redSector = describeAnnularSector(cx, cy, rInner, rOuter, 0, angleRedEnd)
  const amberSector = describeAnnularSector(cx, cy, rInner, rOuter, angleRedEnd, angleAmberEnd)
  const greenSector = describeAnnularSector(cx, cy, rInner, rOuter, angleAmberEnd, 180)

  // Línea de demarcación amarilla: estrictamente ubicada dentro de la zona amarilla
  const lineAngle = Math.max(angleRedEnd + 1.5, angleAmberEnd - 1.2)
  const cutInner = polarToCartesian(cx, cy, rInner - 5, lineAngle)
  const cutOuter = polarToCartesian(cx, cy, rOuter + 5, lineAngle)

  // Posiciones de los números de umbral (verde arriba, rojo abajo)
  const greenUpperPos = polarToCartesian(cx, cy, rOuter + 16, angleAmberEnd)
  const redLowerPos = polarToCartesian(cx, cy, rInner - 16, angleRedEnd)

  // Evaluación del estatus reactivo del puntaje según el corte
  const isApproved = score >= cutoff
  const isReview = !isApproved && score >= (cutoff - REVIEW_WINDOW)

  const getScoreColor = () => {
    if (isApproved) return 'text-emerald-400'
    if (isReview) return 'text-amber-400'
    return 'text-rose-400'
  }

  const getScoreLabel = () => {
    if (isApproved) return 'Perfil Favorable (Aprobado)'
    if (isReview) return 'Zona de Revisión Manual'
    return 'Riesgo Crítico (Por debajo de Corte)'
  }

  return (
    <div className="flex flex-col items-center justify-center p-2 relative select-none w-full">
      {/* Gráfico SVG del Velocímetro Ampliado */}
      <svg
        viewBox="0 0 340 195"
        className="w-full max-w-[420px] overflow-visible drop-shadow-xl"
      >
        <defs>
          <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Grupo de sectores sólidos 2D con sombra suave */}
        <g filter="url(#gaugeShadow)">
          {/* 1. Zona Roja Sólida (Rechazo: 300 hasta reviewThreshold) */}
          <path d={redSector} fill="#ef4444" />

          {/* 2. Zona Ámbar Sólida SIEMPRE RELLENA (Revisión: reviewThreshold hasta cutoff) */}
          <path d={amberSector} fill="#f59e0b" />

          {/* 3. Zona Verde Sólida (Aprobado: cutoff hasta 850) */}
          <path d={greenSector} fill="#10b981" />

          {/* Casquetes redondeados en los extremos exteriores 300 y 850 */}
          <circle cx={cx - midR} cy={cy} r={capRadius} fill="#ef4444" />
          <circle cx={cx + midR} cy={cy} r={capRadius} fill="#10b981" />
        </g>

        {/* Línea Amarilla de Demarcación: estrictamente ubicada dentro de la zona amarilla */}
        <line
          x1={cutInner.x.toFixed(2)}
          y1={cutInner.y.toFixed(2)}
          x2={cutOuter.x.toFixed(2)}
          y2={cutOuter.y.toFixed(2)}
          stroke="#090d16"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <line
          x1={cutInner.x.toFixed(2)}
          y1={cutInner.y.toFixed(2)}
          x2={cutOuter.x.toFixed(2)}
          y2={cutOuter.y.toFixed(2)}
          stroke="#fde047"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Marcas de Graduación Extremos */}
        <text x="24" y="175" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle" className="score-gauge-mark">
          300
        </text>
        <text x="316" y="175" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle" className="score-gauge-mark">
          850
        </text>

        {/* Límite Rojo en la parte INFERIOR (interior del arco) */}
        <text
          x={redLowerPos.x.toFixed(2)}
          y={redLowerPos.y.toFixed(2)}
          fill="#ef4444"
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          {reviewThreshold}
        </text>

        {/* Límite Verde en la parte SUPERIOR (exterior del arco) */}
        <text
          x={greenUpperPos.x.toFixed(2)}
          y={greenUpperPos.y.toFixed(2)}
          fill="#10b981"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          {approvalThreshold}
        </text>

        {/* Aguja del Velocímetro Animada */}
        <g
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 1.1s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
          <polygon
            points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx},${cy - 96}`}
            fill="#e2e8f0"
            className="score-gauge-needle"
          />
          <polygon
            points={`${cx - 1.5},${cy} ${cx + 1.5},${cy} ${cx},${cy - 98}`}
            fill="#38bdf8"
          />
        </g>

        {/* Pivote Central */}
        <circle cx={cx} cy={cy} r="11" fill="#1e293b" stroke="#475569" strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r="5" fill="#38bdf8" />
      </svg>

      {/* Lectura Numérica Central Reactiva */}
      <div className="text-center -mt-4 w-full">
        <div className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${getScoreColor()} font-mono transition-colors duration-300`}>
          {score}
          <span className="text-xs sm:text-sm font-sans font-medium text-slate-400 ml-1">pts</span>
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-300 mt-0.5 sm:mt-1 transition-all duration-300">
          {getScoreLabel()}
        </div>
      </div>

      {/* Barra de Umbral de Corte: Mismo ancho exacto que el gráfico (max-w-[420px]) */}
      {onCutoffChange && (
        <div className="w-full max-w-[420px] mt-4 pt-3.5 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>Umbral de Aprobación (Corte):</span>
            </label>
            <span className="text-xs font-bold font-mono text-sky-400 bg-sky-950/70 border border-sky-500/30 px-2 py-0.5 rounded-md">
              {cutoff} pts
            </span>
          </div>

          {/* Input Range con barra vertical amarilla idéntica a la demarcación */}
          <div className="relative flex items-center py-1">
            <input
              type="range"
              min="450"
              max="650"
              step="5"
              value={cutoff}
              onChange={(e) => onCutoffChange(parseInt(e.target.value, 10))}
              className="cutoff-slider w-full cursor-pointer"
              title="Ajustar umbral de corte"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1 px-0.5">
            <span>450 (Flexible)</span>
            <span>650 (Estricto)</span>
          </div>
        </div>
      )}
    </div>
  )
}
