import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Sliders,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  BookOpen,
  X,
  HelpCircle,
} from 'lucide-react'
import { CutoffGauge } from './CutoffGauge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { simulatePortfolio } from '../services/api'
import { formatMXN, formatMXNValue, formatMXNCompact, formatPercent, getCNBVBadgeColor } from '../utils/formatters'

// Parámetros Fijos de Referencia Institucional y Regulatoria (México)
const FIXED_FUNDING_COST = 11.0 // 11.0% anual anclado a TIIE + spread pasivo institucional
const FIXED_LGD = 45.0 // 45.0% severidad regulatoria obligatoria CNBV CUB Anexo 33
const COST_OF_CAPITAL_RATE = 0.12 // 12.0% anual: Costo de oportunidad del capital líquido inmovilizado en reservas obligatorias CNBV

// Escenarios preajustados de política institucional
const STRATEGY_PRESETS = {
  conservative: {
    name: 'Conservadora (Baja Mora)',
    params: { cutoff_score: 640, interest_rate: 28.0 },
    description: 'Prioriza solidez de balance y bajas reservas preventivas con alta exigencia en Score (Cutoff 640 pts, Tasa 28%).',
  },
  balanced: {
    name: 'Equilibrada (Institucional)',
    params: { cutoff_score: 580, interest_rate: 35.0 },
    description: 'Punto de corte óptimo donde se maximiza el margen financiero neto mitigando impago (Cutoff 580 pts, Tasa 35%).',
  },
  growth: {
    name: 'Crecimiento / Agresiva',
    params: { cutoff_score: 500, interest_rate: 42.0 },
    description: 'Mayor colocación y penetración de mercado compensada con mayor tasa activa (Cutoff 500 pts, Tasa 42%).',
  },
}

const CNBV_COLORS = {
  'A-1': '#10b981',
  'A-2': '#059669',
  'B-1': '#14b8a6',
  'B-2': '#0d9488',
  'C-1': '#f59e0b',
  'C-2': '#d97706',
  'D': '#f97316',
  'E': '#ef4444',
}

// Glosario estructurado de términos financieros y regulatorios
const GLOSSARY_ITEMS = [
  {
    id: 'approved_volume',
    title: '1. Monto Total Prestado (Cartera Colocada)',
    badge: 'Capital Total en Riesgo',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    definition: 'Monto acumulado de capital financiero que la institución otorga y dispersa a los clientes aprobados.',
    explanation:
      'Representa el saldo insoluto inicial de la cartera originada bajo la política y punto de corte activos. Es la base sobre la cual se calculan los intereses brutos, la pérdida esperada (EAD) y las reservas preventivas mínimas de acuerdo a la CNBV.',
    impact: 'Define el tamaño de la exposición de crédito y el volumen de balance activo colocado en el mercado.',
  },
  {
    id: 'funding',
    title: '2. Costo de Fondeo (11.0% TIIE+)',
    badge: '11.0% Anual · Tasa Pasiva',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    definition: 'El costo en que incurre la institución financiera para conseguir el dinero prestado.',
    explanation:
      'Representa la tasa pasiva requerida para levantar capital ante bancos comerciales, inversionistas institucionales o depositantes. En México, se encuentra anclado a la Tasa de Interés Interbancaria de Equilibrio (TIIE de Fondeo a 28 días) fijada por el Banco de México (Banxico) más un diferencial o spread de tesorería institucional (~1.0% a 1.5%).',
    impact: 'Todo crédito debe colocarse a una tasa activa superior a este 11.0% para cubrir el costo del dinero antes de provisiones y gastos operativos.',
  },
  {
    id: 'lgd',
    title: '2. Severidad o LGD (Loss Given Default - 45.0%)',
    badge: '45.0% · CNBV CUB Anexo 33',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    definition: 'Porcentaje del crédito que se pierde definitivamente cuando un cliente entra en mora prolongada.',
    explanation:
      'La severidad de la pérdida (LGD) refleja la porción del saldo insoluto que no se logra recuperar tras agotar las gestiones de cobranza preventiva y judicial. El 45.0% es el estándar prudencial obligatorio fijado por la Comisión Nacional Bancaria y de Valores (CNBV) en el Anexo 33 de la Circular Única de Bancos (CUB) para la cartera de créditos al consumo no garantizados (sin colateral prendario o hipotecario).',
    impact: 'Alimenta el cálculo de Pérdida Esperada (EL = PD × LGD × EAD) para determinar las provisiones preventivas obligatorias.',
  },
  {
    id: 'capital_cost',
    title: '3. Costo de Capital de Reservas Inmovilizadas (12.0%)',
    badge: '12.0% Anual · RAROC de Capital',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    formula: 'Costo de Capital de Reservas = Reservas Regulatorias (CUB) × 0.12',
    definition: 'Costo financiero y de oportunidad derivado de congelar capital líquido en balance para respaldar reservas.',
    explanation:
      'Las reservas preventivas ordenadas por la CNBV no son dinero disponible para reinvertir en cartera productiva: quedan inmovilizadas como salvaguarda contable. Mantener esos fondos tiene un costo de capital propio del 12.0% anual (tasa libre de riesgo soberana de Cetes a 28/91 días más prima de liquidez bancaria). Una cartera con alta concentración de mora exige reservas gigantescas cuyo costo de inmovilización anula el margen de intermediación.',
    impact: 'Elimina el "espejismo contable" donde cobrar tasas del 55% aparenta falsas utilidades ignorando la asfixia de liquidez provocada por las reservas regulatorias.',
  },
  {
    id: 'prudential_threshold',
    title: '4. Umbral Prudencial de Morosidad y Límite CNBV (Máx 6.0%)',
    badge: 'Límite de Alerta Bancaria',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    definition: 'Tolerancia máxima de mora tolerada antes de que el modelo de negocio colapse o sea intervenido.',
    explanation:
      'En la banca mexicana, una probabilidad de incumplimiento agregada mayor al 6.0% coloca a la institución en foco rojo. Tasas de morosidad superiores al 8%–9% deterioran rápidamente el Índice de Capitalización (ICAP) ante la CNBV, disparando auditorías especiales, vetos de colocación y órdenes forzosas de inyección de capital accionario, sin importar qué tan alta sea la tasa activa pactada.',
    impact: 'Garantiza que la estrategia de crédito preserve la licencia operativa y la estabilidad patrimonial institucional.',
  },
  {
    id: 'cutoff',
    title: '5. Punto de Corte (Cut-off Score)',
    badge: '450 a 750 pts · Política de Riesgo',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    definition: 'Puntuación mínima en el Scorecard para otorgar la aprobación automática del crédito.',
    explanation:
      'Es el eje central de la estrategia de apetito al riesgo de la entidad. Un corte alto (ej. 640 pts) blinda la cartera reduciendo el impago pero disminuye el volumen comercial; un corte permisivo (ej. 450 pts) abre la colocación pero admite solicitantes con mora grave que disparan las reservas CUB.',
    impact: 'Permite regular en tiempo real el balance institucional entre volumen de negocio y control de pérdidas crediticias.',
  },
  {
    id: 'tradeoff',
    title: '6. Tasa de Aprobación vs Mora Esperada (Trade-off)',
    badge: 'Eficiencia y Calidad de Cartera',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    definition: 'Relación económica inversa entre permisividad en originación y riesgo de impago.',
    explanation:
      'A mayor volumen de solicitudes aprobadas, la probabilidad de incumplimiento ponderada (PD) del portafolio se incrementa de forma no lineal. La simulación proyecta el comportamiento agregado a 12 meses sobre los 9,773 contratos de la cartera.',
    impact: 'Ayuda al comité de crédito a definir metas de crecimiento sin sobrepasar la tolerancia de mora institucional.',
  },
  {
    id: 'margin',
    title: '7. Margen Neto Final Ajustado por Riesgo (RAROC)',
    badge: 'Rentabilidad Operativa Real',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    formula: 'Margen Neto Final = Intereses Brutos - Costo de Fondeo - Pérdida Esperada (EL) - Costo Capital Reservas',
    definition: 'Utilidad neta real generada por la cartera tras descontar fondeo, riesgo crediticio y costo de capital de reservas.',
    explanation:
      'Refleja la verdadera ganancia económica del negocio de crédito. Deduce del ingreso por intereses tanto el costo de los pasivos (11%), como la Pérdida Esperada (EL con LGD 45%) y el costo de capital de las reservas inmovilizadas (12%). Si el resultado es negativo, la cartera destruye valor de forma sistémica.',
    impact: 'Mide la rentabilidad real sobre cartera colocada (ROC / Yield Neto Ajustado) con plena solidez metodológica.',
  },
  {
    id: 'reserves',
    title: '8. Reservas Regulatorias (CUB) e Índice de Absorción',
    badge: 'Colchón de Capital Obligatorio',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    formula: 'Índice de Absorción = (Reservas Regulatorias / Margen Bruto antes de Reservas) × 100',
    definition: 'Porcentaje del margen bruto que es devorado por la constitución obligatoria de reservas preventivas ante CNBV.',
    explanation:
      'Si el Índice de Absorción supera el 40%, el margen operativo se encuentra en zona de alta presión. Si rebasa el 60%, se produce un "Déficit de Eficiencia de Capital", indicando que la institución está consumiendo excesiva liquidez para cubrir perfiles riesgosos.',
    impact: 'Protege la solvencia institucional y alerta tempranamente sobre ineficiencias críticas en la asignación de capital.',
  },
]

// Tooltip con fondo 100% opaco y contraste nítido para la Cascada
function WaterfallTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div
        className="p-3.5 rounded-xl border text-xs space-y-1.5 shadow-2xl"
        style={{
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.75)',
          color: '#f8fafc',
        }}
      >
        <div className="font-bold text-slate-300 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
          <span>{data.step}</span>
        </div>
        <div className="text-base font-black font-mono tracking-tight" style={{ color: data.color }}>
          {data.formattedAmount}
        </div>
        <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-700 max-w-[260px] leading-relaxed">
          {data.description}
        </div>
      </div>
    )
  }
  return null
}

export function PortfolioStrategyView() {
  // Solo 2 controles interactivos; fondeo (11%) y LGD (45%) son fijos
  const [params, setParams] = useState({
    cutoff_score: 580,
    interest_rate: 35.0,
  })

  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Control de colapso/despliegue de la sección de parámetros
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false)

  // Control del Modal de Glosario y Explicabilidad
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false)
  const [glossaryTargetId, setGlossaryTargetId] = useState(null)

  const openGlossary = (targetId = null) => {
    setGlossaryTargetId(targetId)
    setIsGlossaryOpen(true)
  }

  // Ejecuta la simulación sobre el portafolio en memoria RAM
  const runSimulation = useCallback(async (currentParams) => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        cutoff_score: parseInt(currentParams.cutoff_score, 10),
        interest_rate: parseFloat(currentParams.interest_rate) / 100.0,
        funding_cost: FIXED_FUNDING_COST / 100.0, // Fijo al 11.0%
        lgd: FIXED_LGD / 100.0, // Fijo al 45.0%
      }
      const data = await simulatePortfolio(payload)
      setSimulation(data)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Error al conectar con la simulación en memoria.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    runSimulation(params)
  }, [params, runSimulation])

  // Detección automática del escenario activo o Personalizada
  const currentPresetKey = useMemo(() => {
    for (const [key, preset] of Object.entries(STRATEGY_PRESETS)) {
      if (
        Number(params.cutoff_score) === preset.params.cutoff_score &&
        Number(params.interest_rate) === preset.params.interest_rate
      ) {
        return key
      }
    }
    return 'custom'
  }, [params])

  const handleSliderChange = (field, value) => {
    setParams((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePresetSelect = (presetKey) => {
    if (presetKey && STRATEGY_PRESETS[presetKey]) {
      setParams({ ...STRATEGY_PRESETS[presetKey].params })
    }
  }

  // ========================================================
  // LÓGICA FINANCIERA AVANZADA: RAROC, COSTO DE CAPITAL Y SEMÁFORO CNBV
  // ========================================================
  const {
    reservesCapitalCost,
    netFinancialMarginRAROC,
    rocRAROC,
    absorptionRatioPct,
    viabilityStatus,
  } = useMemo(() => {
    if (!simulation) {
      return {
        reservesCapitalCost: 0,
        netFinancialMarginRAROC: 0,
        rocRAROC: 0,
        absorptionRatioPct: 0,
        viabilityStatus: 'healthy',
      }
    }

    const gross = simulation.gross_interest_income_mxn || 0
    const funding = simulation.funding_expenses_mxn || 0
    const el = simulation.total_expected_loss_mxn || 0
    const reserves = simulation.total_regulatory_reserves_mxn || 0
    const volume = simulation.approved_volume_mxn || 0
    const pdPct = simulation.expected_portfolio_pd_pct || 0

    // 1. Costo de Capital por Reservas Inmovilizadas (12% anual)
    const capCost = reserves * COST_OF_CAPITAL_RATE

    // 2. Margen Neto Final Ajustado por Riesgo (RAROC)
    const netRAROC = gross - funding - el - capCost

    // 3. Retorno sobre Cartera Ajustado (ROC / Yield Neto)
    const roc = volume > 0 ? (netRAROC / volume) * 100 : 0

    // 4. Índice de Absorción de Reservas sobre Margen Bruto (antes de reservas)
    const grossMargin = gross - funding
    const absorption = grossMargin > 0 ? (reserves / grossMargin) * 100 : 100

    // 5. Semáforo y Alerta de Viabilidad Regulatoria / Riesgo Sistémico CNBV
    const reservesToVolumeRatio = volume > 0 ? reserves / volume : 0

    let status = 'healthy'
    if (pdPct > 9.0 || reservesToVolumeRatio > 0.10 || netRAROC <= 0) {
      status = 'critical'
    } else if (pdPct > 6.0 || reservesToVolumeRatio > 0.05) {
      status = 'moderate'
    } else {
      status = 'healthy'
    }

    return {
      reservesCapitalCost: capCost,
      netFinancialMarginRAROC: netRAROC,
      rocRAROC: roc,
      absorptionRatioPct: absorption,
      viabilityStatus: status,
    }
  }, [simulation])

  // ========================================================
  // GRÁFICO DE CASCADA REAL DE 5 PASOS CON COSTO DE CAPITAL
  // ========================================================
  const waterfallData = useMemo(() => {
    if (!simulation) return []

    const gross = simulation.gross_interest_income_mxn || 0
    const funding = simulation.funding_expenses_mxn || 0
    const el = simulation.total_expected_loss_mxn || 0
    const capCost = reservesCapitalCost
    const netFinal = netFinancialMarginRAROC

    // Niveles escalonados
    const afterFunding = Math.max(0, gross - funding)
    const afterEL = Math.max(0, afterFunding - el)
    const isNetPositive = netFinal >= 0

    return [
      {
        name: 'Ingreso Bruto',
        step: '1. Intereses Brutos',
        base: 0,
        amount: gross,
        realAmount: gross,
        formattedAmount: `+ ${formatMXN(gross)}`,
        color: '#0284c7', // Cian / Azul
        description: 'Ingresos devengados por tasa activa pactada sobre la cartera colocada.',
      },
      {
        name: 'Costo Fondeo',
        step: '2. Costo de Fondeo (11%)',
        base: afterFunding,
        amount: funding,
        realAmount: -funding,
        formattedAmount: `- ${formatMXN(funding)}`,
        color: '#64748b', // Pizarra / Gris suave
        description: 'Costo del pasivo exigible para fondear la cartera (TIIE + spread).',
      },
      {
        name: 'Pérdida Esperada',
        step: '3. Pérdida Esperada (EL)',
        base: afterEL,
        amount: el,
        realAmount: -el,
        formattedAmount: `- ${formatMXN(el)}`,
        color: '#f43f5e', // Rojo / Ámbar
        description: 'Provisiones contables por riesgo de crédito (PD × LGD 45% × EAD).',
      },
      {
        name: 'Costo Cap. Reservas',
        step: '4. Costo Cap. Reservas (12%)',
        base: isNetPositive ? netFinal : 0,
        amount: isNetPositive ? capCost : afterEL,
        realAmount: -capCost,
        formattedAmount: `- ${formatMXN(capCost)}`,
        color: '#8b5cf6', // Violeta / Púrpura institucional
        description: 'Costo de oportunidad por inmovilizar capital líquido en reservas ante la CNBV (12.0% anual).',
      },
      {
        name: 'Margen Neto RAROC',
        step: '5. Margen Neto Final (RAROC)',
        base: isNetPositive ? 0 : netFinal,
        amount: isNetPositive ? netFinal : Math.abs(netFinal),
        realAmount: netFinal,
        formattedAmount: `${netFinal >= 0 ? '+ ' : '- '}${formatMXN(Math.abs(netFinal))}`,
        color: isNetPositive ? '#10b981' : '#ef4444', // Verde esmeralda si es positivo, rojo carmesí si es negativo
        description: isNetPositive
          ? 'Utilidad neta real generada tras absorber fondeo, morosidad y costo de reservas congeladas.'
          : 'Pérdida neta: el nivel de impago y las reservas congeladas destruyen el patrimonio institucional.',
      },
    ]
  }, [simulation, reservesCapitalCost, netFinancialMarginRAROC])

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* 1. Panel Unificado: Simulador de Portafolio, Estrategia, Parámetros Fijos y Acelerómetro de Corte */}
      <div className="liquid-glass p-3.5 sm:p-6 rounded-2xl border border-white/10 shadow-xl space-y-3 sm:space-y-4">
        {/* Cabecera: Título, Resumen Compacto cuando está plegado, Glosario y Botón Plegar/Desplegar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <span>Simulador de Portafolio y Estrategia de Riesgo</span>
              {loading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-2xl">
              Simulación interactiva sobre la cartera de prueba (9,773 contratos). Ajusta las variables de apetito al riesgo.
            </p>

            {/* Resumen Compacto visible cuando la sección está PLEGADA para mantener contexto sin robar espacio */}
            {isControlsCollapsed && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Configuración:
                </span>
                <span className="text-[11px] sm:text-xs font-bold font-mono text-white bg-slate-800/80 border border-white/10 px-2 py-0.5 rounded-md">
                  {STRATEGY_PRESETS[currentPresetKey]?.name || 'Personalizada'}
                </span>
                <span className="text-[11px] sm:text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  Corte: {params.cutoff_score} pts
                </span>
                <span className="text-[11px] sm:text-xs font-bold font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  Tasa: {formatPercent(params.interest_rate)}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-400 bg-slate-900/50 border border-white/5 px-2 py-0.5 rounded-md hidden sm:inline-block">
                  Fondeo 11% | LGD 45%
                </span>
              </div>
            )}
          </div>

          {/* Acciones Superiores: Botón Glosario y Botón Plegar / Desplegar */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {/* Botón Glosario */}
            <button
              type="button"
              onClick={() => openGlossary()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 liquid-glass-interactive cursor-pointer border border-white/10 hover:border-emerald-500/40 hover:text-white transition shadow-sm"
              title="Abrir glosario con justificación metodológica y fórmulas"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Glosario y Metodología</span>
              <span className="sm:hidden">Glosario</span>
            </button>

            {/* Botón Plegar / Desplegar Controles */}
            <button
              type="button"
              onClick={() => setIsControlsCollapsed((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 liquid-glass-interactive cursor-pointer border border-white/10 hover:border-emerald-500/40 hover:text-white transition shadow-sm"
              title={isControlsCollapsed ? 'Desplegar controles de simulación' : 'Plegar controles para ahorrar espacio'}
            >
              {isControlsCollapsed ? (
                <>
                  <ChevronDown className="w-4 h-4 text-emerald-400" />
                  <span>Desplegar Parámetros</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                  <span>Plegar Parámetros</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sección de Parámetros Plegable */}
        {!isControlsCollapsed && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Fila Superior de la Sección: Selector de Estrategia (ahora abajo) + Parámetros Institucionales Fijos */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3.5 rounded-2xl liquid-glass-subtle border border-white/10">
              {/* Selector Desplegable de Escenarios */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                <label htmlFor="strategy-select" className="text-xs font-semibold text-slate-300 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Estrategia de Cartera:</span>
                </label>
                <div className="relative w-full sm:w-auto min-w-0 max-w-full">
                  <select
                    id="strategy-select"
                    value={currentPresetKey}
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    className="w-full sm:w-auto max-w-full appearance-none pl-3 pr-8 py-2 sm:py-1.5 rounded-xl text-xs font-semibold liquid-glass-input text-white cursor-pointer focus:outline-none transition shadow-sm border border-white/15"
                  >
                    <option value="conservative" className="bg-slate-900 text-white">Conservadora (Baja Mora)</option>
                    <option value="balanced" className="bg-slate-900 text-white">Equilibrada (Institucional)</option>
                    <option value="growth" className="bg-slate-900 text-white">Crecimiento / Agresiva</option>
                    {currentPresetKey === 'custom' && (
                      <option value="custom" className="bg-slate-900 text-amber-300">Personalizada</option>
                    )}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Badges de Parámetros Institucionales Fijos */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Parámetros Fijos:</span>
                </span>

                {/* Badge Fondeo Fijo 11.0% */}
                <button
                  type="button"
                  onClick={() => openGlossary('funding')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold liquid-glass-subtle border border-sky-500/40 text-sky-300 hover:bg-sky-500/10 hover:border-sky-400 transition cursor-pointer group"
                  title="Clic para ver qué significa el Costo de Fondeo Institucional"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span>Fondeo: 11.0% (TIIE+)</span>
                  <Info className="w-3.5 h-3.5 text-sky-400/80 group-hover:text-sky-300 transition" />
                </button>

                {/* Badge Severidad LGD Fija 45.0% */}
                <button
                  type="button"
                  onClick={() => openGlossary('lgd')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold liquid-glass-subtle border border-teal-500/40 text-teal-300 hover:bg-teal-500/10 hover:border-teal-400 transition cursor-pointer group"
                  title="Clic para ver justificación regulatoria CNBV de la Severidad LGD"
                >
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span>LGD: 45.0% (CNBV Anexo 33)</span>
                  <Info className="w-3.5 h-3.5 text-teal-400/80 group-hover:text-teal-300 transition" />
                </button>
              </div>
            </div>

            {/* Fila de Controles Interactivos: Acelerómetro de Corte a la izquierda + Tasa Activa a la derecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Control 1: Acelerómetro Animado de Corte (sin flecha) */}
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col items-center justify-between">
                <div className="w-full flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Punto de Corte (Cut-off Score)
                    </span>
                    <button
                      type="button"
                      onClick={() => openGlossary('cutoff')}
                      className="text-slate-400 hover:text-white transition cursor-pointer"
                      title="Ver explicación del Punto de Corte"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Escala 450 - 750
                  </span>
                </div>

                <CutoffGauge
                  cutoff={params.cutoff_score}
                  onChange={(val) => handleSliderChange('cutoff_score', val)}
                  min={450}
                  max={750}
                  step={5}
                />
              </div>

              {/* Control 2: Tasa de Interés Activa Promedio */}
              <div className="p-4 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col justify-between space-y-3">
                <div>
                  <div className="w-full flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Tasa de Interés Activa Promedio
                      </span>
                      <button
                        type="button"
                        onClick={() => openGlossary('margin')}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                        title="Ver explicación de la Tasa Activa"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-lg shadow-sm">
                      {formatPercent(params.interest_rate)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Tasa anual pactada con acreditados aprobados. Determina el margen financiero de colocación.
                  </p>
                </div>

                <div className="space-y-1.5 py-2">
                  <input
                    type="range"
                    min="20.0"
                    max="55.0"
                    step="0.5"
                    value={params.interest_rate}
                    onChange={(e) => handleSliderChange('interest_rate', parseFloat(e.target.value))}
                    className="cutoff-slider w-full cursor-pointer"
                    title={`Tasa Activa actual: ${formatPercent(params.interest_rate)}`}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
                    <span>20.0% (Mínimo institucional)</span>
                    <span>55.0% (Toque de usura)</span>
                  </div>
                </div>

                {/* Métricas de contexto financiero */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                  <div className="p-2 rounded-xl bg-slate-900/40 border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Spread sobre Fondeo
                    </span>
                    <span className="text-xs font-black font-mono text-sky-400">
                      +{ (params.interest_rate - FIXED_FUNDING_COST).toFixed(1) }%
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/40 border border-white/5 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Costo Pasivo Base
                    </span>
                    <span className="text-xs font-black font-mono text-slate-300">
                      {FIXED_FUNDING_COST.toFixed(1)}% TIIE+
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl liquid-glass border border-rose-500/40 text-rose-300 text-sm flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Tarjetas KPI de Resultados: Formato Píldora en Móvil vs Tarjetas en Escritorio */}
      {simulation && (
        <div className="space-y-3 sm:space-y-4">
          {/* Versión Móvil: Formato Píldora Clave : Valor + Botón (ℹ) (Sin truncar datos) */}
          <div className="md:hidden flex flex-col gap-2.5">
            {/* Píldora 1: Cartera Colocada */}
            <div
              onClick={() => openGlossary('approved_volume')}
              className="flex items-center justify-between gap-2.5 p-3 rounded-2xl liquid-glass-subtle border border-white/10 hover:border-white/20 transition cursor-pointer shadow-sm group"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  Cartera Colocada:
                </span>
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-tight">
                  {formatMXNValue(simulation.approved_volume_mxn)} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openGlossary('approved_volume')
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-300 transition shrink-0 cursor-pointer"
                title="Más información sobre Cartera Colocada"
                aria-label="Más información sobre Cartera Colocada"
              >
                <Info className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            {/* Píldora 2: Margen Financiero Neto (RAROC) */}
            <div
              onClick={() => openGlossary('margin')}
              className={`flex items-center justify-between gap-2.5 p-3 rounded-2xl border transition cursor-pointer shadow-sm group ${
                viabilityStatus === 'critical'
                  ? 'liquid-glass border-rose-500/50 bg-rose-950/20'
                  : viabilityStatus === 'moderate'
                  ? 'liquid-glass border-amber-500/40 bg-amber-950/15'
                  : 'liquid-glass-subtle border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  Margen Neto:
                </span>
                <span
                  className={`text-xs font-bold font-mono tracking-tight ${
                    viabilityStatus === 'critical'
                      ? 'text-rose-400'
                      : viabilityStatus === 'moderate'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formatMXNValue(netFinancialMarginRAROC)} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold ${
                    netFinancialMarginRAROC <= 0 ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  ({formatPercent(rocRAROC)} ROC)
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openGlossary('margin')
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-300 transition shrink-0 cursor-pointer"
                title="Más información sobre Margen Financiero Neto"
                aria-label="Más información sobre Margen Financiero Neto"
              >
                <Info className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            {/* Píldora 3: Tasa de Aprobación */}
            <div
              onClick={() => openGlossary('tradeoff')}
              className="flex items-center justify-between gap-2.5 p-3 rounded-2xl liquid-glass-subtle border border-white/10 hover:border-white/20 transition cursor-pointer shadow-sm group"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  Aprobación:
                </span>
                <span className="text-xs font-bold text-white font-mono tracking-tight">
                  {formatPercent(simulation.approval_rate_pct)}
                </span>
                <span className="text-[10px] text-emerald-400 font-sans">
                  ({simulation.approved_contracts.toLocaleString()} contratos)
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openGlossary('tradeoff')
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
                title="Más información sobre Tasa de Aprobación"
                aria-label="Más información sobre Tasa de Aprobación"
              >
                <Info className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            {/* Píldora 4: PD Ponderada */}
            <div
              onClick={() => openGlossary('prudential_threshold')}
              className="flex items-center justify-between gap-2.5 p-3 rounded-2xl liquid-glass-subtle border border-white/10 hover:border-white/20 transition cursor-pointer shadow-sm group"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  PD Ponderada:
                </span>
                <span
                  className={`text-xs font-bold font-mono tracking-tight ${
                    simulation.expected_portfolio_pd_pct > 9.0
                      ? 'text-rose-400'
                      : simulation.expected_portfolio_pd_pct > 6.0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formatPercent(simulation.expected_portfolio_pd_pct)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">
                  (Mora {formatPercent(simulation.observed_default_rate_pct)})
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openGlossary('prudential_threshold')
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-sky-300 transition shrink-0 cursor-pointer"
                title="Más información sobre Probabilidad de Incumplimiento"
                aria-label="Más información sobre Probabilidad de Incumplimiento"
              >
                <Info className="w-4 h-4 text-sky-400" />
              </button>
            </div>

            {/* Píldora 5: Reservas Regulatorias (CUB) */}
            <div
              onClick={() => openGlossary('reserves')}
              className="flex items-center justify-between gap-2.5 p-3 rounded-2xl liquid-glass-subtle border border-white/10 hover:border-white/20 transition cursor-pointer shadow-sm group"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                  Reservas CUB:
                </span>
                <span className="text-xs font-bold text-teal-400 font-mono tracking-tight">
                  {formatMXNValue(simulation.total_regulatory_reserves_mxn)} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openGlossary('reserves')
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-teal-300 transition shrink-0 cursor-pointer"
                title="Más información sobre Reservas Regulatorias"
                aria-label="Más información sobre Reservas Regulatorias"
              >
                <Info className="w-4 h-4 text-teal-400" />
              </button>
            </div>
          </div>

          {/* Versión Tablet y Escritorio: Tarjetas Expandidas en 2 Filas */}
          <div className="hidden md:block space-y-4">
            {/* Fila 1: Indicadores Financieros Principales de Capital y Margen (2 columnas amplias) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Tarjeta 1: Monto Total Prestado (Cartera Colocada) */}
              <div className="liquid-glass-subtle p-3.5 sm:p-5 lg:p-6 rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition flex flex-col justify-between min-h-[145px] sm:min-h-[160px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Monto Total Prestado (Cartera Colocada)
                  </span>
                  <button
                    type="button"
                    onClick={() => openGlossary('approved_volume')}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                    title="Ver explicación del Monto Total Prestado"
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="my-2 sm:my-2.5">
                  <div className="flex items-baseline flex-wrap gap-x-1.5 sm:gap-x-2">
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 font-mono tracking-tight whitespace-nowrap">
                      {formatMXNValue(simulation.approved_volume_mxn)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      MXN
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-slate-300 font-medium block mt-1">
                    Capital dispersado en {simulation.approved_contracts.toLocaleString()} créditos autorizados
                  </span>
                </div>
              </div>
              <div className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/5 flex items-center justify-between">
                <span>Tasa de Aprobación de Cartera:</span>
                <strong className="text-slate-200 font-mono text-xs font-semibold">{formatPercent(simulation.approval_rate_pct)}</strong>
              </div>
            </div>

            {/* Tarjeta 2: Margen Financiero Neto (Con Semáforo de Viabilidad CNBV y RAROC) */}
            <div
              className={`p-3.5 sm:p-5 lg:p-6 rounded-2xl border shadow-lg transition flex flex-col justify-between min-h-[145px] sm:min-h-[160px] ${
                viabilityStatus === 'critical'
                  ? 'liquid-glass border-rose-500/80 bg-rose-950/25 shadow-rose-950/50 ring-1 ring-rose-500/50'
                  : viabilityStatus === 'moderate'
                  ? 'liquid-glass border-amber-500/60 bg-amber-950/20 shadow-amber-950/30 ring-1 ring-amber-500/30'
                  : 'liquid-glass-subtle border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Margen Financiero Neto (RAROC)
                    </span>
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border uppercase ${
                        viabilityStatus === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : viabilityStatus === 'moderate'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {viabilityStatus === 'critical' ? 'Inviable' : viabilityStatus === 'moderate' ? 'Vigilancia' : 'Solvente'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGlossary('margin')}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Ver fórmula y desglose metodológico del Margen Neto RAROC"
                    aria-label="Abrir glosario del Margen Neto"
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  </button>
                </div>

                <div className="my-2 sm:my-2.5">
                  <div className="flex items-baseline flex-wrap gap-x-1.5 sm:gap-x-2">
                    <span
                      className={`text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight whitespace-nowrap ${
                        viabilityStatus === 'critical'
                          ? 'text-rose-400'
                          : viabilityStatus === 'moderate'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {formatMXNValue(netFinancialMarginRAROC)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      MXN
                    </span>
                    <span
                      className={`text-[11px] sm:text-xs font-semibold font-mono flex items-center ml-1.5 sm:ml-2 ${
                        netFinancialMarginRAROC <= 0 ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                      title="Retorno sobre Cartera Ajustado por Riesgo (ROC / Yield Neto)"
                    >
                      {netFinancialMarginRAROC <= 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 shrink-0" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 shrink-0" />
                      )}
                      {formatPercent(rocRAROC)} ROC
                    </span>
                  </div>
                </div>
              </div>

              {/* Banners del Semáforo de Viabilidad Regulatoria CNBV */}
              {viabilityStatus === 'critical' ? (
                <div className="mt-2.5 sm:mt-3 pt-2 border-t border-rose-500/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400 animate-pulse" />
                    <span>Estrategia Inviable ante CNBV</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-rose-300/90 leading-tight">
                    Morosidad ({formatPercent(simulation.expected_portfolio_pd_pct)} vs 6.0% máx) y absorción crítica de reservas ({formatMXN(simulation.total_regulatory_reserves_mxn)}).
                  </p>
                </div>
              ) : viabilityStatus === 'moderate' ? (
                <div className="mt-2.5 sm:mt-3 pt-2 border-t border-amber-500/30 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Precaución Regulatoria</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-amber-300/90 leading-tight">
                    Morosidad en vigilancia ({formatPercent(simulation.expected_portfolio_pd_pct)}) con reservas preventivas crecientes.
                  </p>
                </div>
              ) : (
                <div className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span>Costo Cap. Reservas (12%): <strong className="text-slate-200 font-mono">{formatMXN(reservesCapitalCost)}</strong></span>
                  <span className="text-[10px] sm:text-[11px] text-emerald-400 font-medium">✓ Solvente CNBV</span>
                </div>
              )}
            </div>
          </div>

          {/* Fila 2: Indicadores de Riesgo, Eficiencia y Regulación CNBV (3 columnas equilibradas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Tarjeta 3: Tasa de Aprobación */}
            <div className="liquid-glass-subtle p-3.5 sm:p-5 rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition flex flex-col justify-between min-h-[130px] sm:min-h-[145px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Tasa de Aprobación
                  </span>
                  <button
                    type="button"
                    onClick={() => openGlossary('tradeoff')}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                    title="Ver explicación de la Tasa de Aprobación"
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="my-1.5 sm:my-2">
                  <span className="text-xl sm:text-2xl lg:text-3xl font-black text-white font-mono tracking-tight block">
                    {formatPercent(simulation.approval_rate_pct)}
                  </span>
                  <span className="text-[11px] sm:text-xs text-emerald-400 font-semibold font-mono block mt-0.5 sm:mt-1">
                    {simulation.approved_contracts.toLocaleString()} contratos autorizados
                  </span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/5 flex items-center justify-between">
                <span>Base analizada:</span>
                <strong className="text-slate-200 font-mono text-[11px] sm:text-xs">{simulation.total_applications.toLocaleString()} solicitudes</strong>
              </div>
            </div>

            {/* Tarjeta 4: Probabilidad de Incumplimiento Ponderada */}
            <div className="liquid-glass-subtle p-3.5 sm:p-5 rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition flex flex-col justify-between min-h-[130px] sm:min-h-[145px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    PD Ponderada de Cartera
                  </span>
                  <button
                    type="button"
                    onClick={() => openGlossary('prudential_threshold')}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                    title="Ver umbral prudencial de morosidad CNBV"
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="my-1.5 sm:my-2">
                  <span
                    className={`text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight block ${
                      simulation.expected_portfolio_pd_pct > 9.0
                        ? 'text-rose-400'
                        : simulation.expected_portfolio_pd_pct > 6.0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatPercent(simulation.expected_portfolio_pd_pct)}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400 font-mono block mt-0.5 sm:mt-1">
                    Mora Observada: {formatPercent(simulation.observed_default_rate_pct)}
                  </span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-slate-400 pt-2 border-t border-white/5 flex items-center justify-between">
                <span>Pérdida Esperada (EL):</span>
                <strong className="text-rose-400 font-mono text-[11px] sm:text-xs">{formatMXN(simulation.total_expected_loss_mxn)}</strong>
              </div>
            </div>

            {/* Tarjeta 5: Reservas Regulatorias (CNBV CUB) con Índice de Absorción */}
            <div className="liquid-glass-subtle p-3.5 sm:p-5 rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition flex flex-col justify-between min-h-[130px] sm:min-h-[145px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Reservas Regulatorias (CUB)
                  </span>
                  <button
                    type="button"
                    onClick={() => openGlossary('reserves')}
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                    title="Ver explicación de las Reservas Regulatorias y Ratio de Absorción"
                  >
                    <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="my-1.5 sm:my-2">
                  <div className="flex items-baseline flex-wrap gap-x-1.5">
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black text-teal-400 font-mono tracking-tight whitespace-nowrap">
                      {formatMXNValue(simulation.total_regulatory_reserves_mxn)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      MXN
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-slate-400 font-mono block mt-0.5 sm:mt-1">
                    Provisión Contable Anexo 33
                  </span>
                </div>
              </div>

              {/* Métrica de Ratio de Absorción de Reservas */}
              <div className="mt-2 sm:mt-3 pt-2 border-t border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="text-slate-400">Absorción Utilidad:</span>
                  <span
                    className={`font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] border ${
                      absorptionRatioPct > 60
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : absorptionRatioPct > 40
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {formatPercent(absorptionRatioPct)}
                  </span>
                </div>
                {absorptionRatioPct > 60 ? (
                  <span className="text-[10px] text-rose-400 font-bold block leading-tight">
                    ⚠️ Déficit Eficiencia Capital
                  </span>
                ) : absorptionRatioPct > 40 ? (
                  <span className="text-[10px] text-amber-300 font-medium block leading-tight">
                    Margen bajo presión de reservas
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-medium block leading-tight">
                    Absorción de capital prudencial
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Gráficos de Portafolio y Cascada Liquid Glass con Tooltips Opacos */}
      {simulation && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Gráfico de Cascada Real (Waterfall Chart) de 5 Pasos */}
          <div className="lg:col-span-6 liquid-glass p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Descomposición del Margen Financiero (MXN)
              </h3>
              <button
                type="button"
                onClick={() => openGlossary('margin')}
                className="text-xs text-teal-400 hover:text-teal-300 underline font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>Fórmula RAROC (5 Pasos)</span>
                <Info className="w-3 h-3" />
              </button>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 15, left: 15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `$${(val / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip content={<WaterfallTooltip />} />
                  {/* Barra base transparente para lograr el efecto flotante de cascada */}
                  <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
                  {/* Barra visible que conecta los saltos de la cascada */}
                  <Bar dataKey="amount" stackId="waterfall" radius={[5, 5, 0, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`waterfall-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Margen Neto Final = Intereses Brutos - Fondeo (11%) - EL (LGD 45%) - Costo Capital Reservas (12%).
            </p>
          </div>

          {/* Gráfico de Distribución Regulatoria CNBV con Tooltip Opaco y Etiquetas en Barras */}
          <div className="lg:col-span-6 liquid-glass p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Distribución de Cartera por Calificación CNBV
              </h3>
              <button
                type="button"
                onClick={() => openGlossary('reserves')}
                className="text-xs text-teal-400 hover:text-teal-300 underline font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>CUB Anexo 33</span>
                <Info className="w-3 h-3" />
              </button>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={simulation.cnbv_distribution}
                  margin={{ top: 25, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                  <XAxis dataKey="rating" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) => `$${(val / 1_000_000).toFixed(1)}M`}
                  />
                  {/* Tooltip opaco sólido sin transparencia borrosa */}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.75)',
                      color: '#f8fafc',
                      padding: '12px 14px',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
                    formatter={(value, name) => [
                      name === 'approved_volume_mxn' ? formatMXN(value) : value,
                      name === 'approved_volume_mxn' ? 'Saldo Colocado' : 'Contratos',
                    ]}
                  />
                  {/* Barras con Etiquetas Numéricas en la parte superior con cantidades completas en pesos */}
                  <Bar dataKey="approved_volume_mxn" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="approved_volume_mxn"
                      position="top"
                      formatter={(val) => (val > 0 ? formatMXNCompact(val) : '')}
                      fill="#94a3b8"
                      fontSize={9}
                      fontWeight="bold"
                      offset={6}
                    />
                    {simulation.cnbv_distribution.map((entry, index) => (
                      <Cell key={`cnbv-${index}`} fill={CNBV_COLORS[entry.rating] || '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Mayor concentración en tramos A-1 y A-2 asegura requerimientos de capital mínimos y alta rentabilidad ajustada por riesgo.
            </p>
          </div>
        </div>
      )}

      {/* Tabla Regulatoria de Provisiones y Concentración Liquid Glass */}
      {simulation && simulation.cnbv_distribution && (
        <div className="liquid-glass rounded-2xl border border-white/10 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Estratificación Regulatoria de Riesgo (Circular Única de Bancos)
            </h3>
            <button
              type="button"
              onClick={() => openGlossary('reserves')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-mono flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Criterios CUB</span>
              <Info className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-400 uppercase text-[11px]">
                  <th className="py-3 px-4">Calificación</th>
                  <th className="py-3 px-4">Nivel de Riesgo (CUB)</th>
                  <th className="py-3 px-4 text-right">Contratos Aprobados</th>
                  <th className="py-3 px-4 text-right">% Cartera</th>
                  <th className="py-3 px-4 text-right">Saldo Colocado (MXN)</th>
                  <th className="py-3 px-4 text-right">Reserva Mínima CUB</th>
                  <th className="py-3 px-4 text-right">Provisión a Constituir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-mono">
                {simulation.cnbv_distribution.map((row) => (
                  <tr key={row.rating} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-4 font-bold font-sans">
                      <span className={`px-2 py-0.5 rounded text-xs border ${getCNBVBadgeColor(row.rating)}`}>
                        {row.rating}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-sans">{row.description}</td>
                    <td className="py-2.5 px-4 text-right">{row.approved_contracts.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-slate-400">{formatPercent(row.approved_share_pct)}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-white">{formatMXN(row.approved_volume_mxn)}</td>
                    <td className="py-2.5 px-4 text-right text-amber-400">{formatPercent(row.minimum_reserve_pct)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-teal-400">{formatMXN(row.reserve_amount_mxn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL FLOTANTE: GLOSARIO Y DEFINICIONES DE CARTERA */}
      {isGlossaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsGlossaryOpen(false)}
        >
          <div
            className="liquid-glass border border-white/20 rounded-2xl max-w-3xl sm:max-w-4xl w-full max-h-[88vh] overflow-y-auto shadow-2xl relative text-left animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal con botón "X" en la esquina superior derecha */}
            <div className="sticky top-0 bg-slate-900/95 sm:bg-slate-900/90 backdrop-blur-xl border-b border-white/10 p-4 sm:p-6 lg:p-7 flex items-start justify-between z-20 shadow-md">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-white tracking-tight">
                    Glosario y Definiciones de Cartera
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Fundamento metodológico, fórmulas financieras y marco regulatorio (CNBV CUB Anexo 33).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                title="Cerrar glosario"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Contenido Estructurado de los Términos */}
            <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
              {GLOSSARY_ITEMS.map((item) => {
                const isHighlighted = glossaryTargetId === item.id
                return (
                  <div
                    key={item.id}
                    id={`glossary-item-${item.id}`}
                    className={`p-5 rounded-2xl border transition-all ${
                      isHighlighted
                        ? 'liquid-glass border-emerald-500/60 ring-2 ring-emerald-500/20 bg-emerald-950/20'
                        : 'liquid-glass-subtle border-white/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        {item.title}
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-200 mb-3 leading-relaxed">
                      {item.definition}
                    </p>

                    {item.formula && (
                      <div className="my-3 p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-emerald-400 text-xs sm:text-sm">
                        {item.formula}
                      </div>
                    )}

                    <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                      <p>{item.explanation}</p>
                      <div className="pt-2 border-t border-white/5 text-slate-400">
                        <strong className="text-slate-200">Impacto en Decisión / Balance: </strong>
                        {item.impact}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer con Botón de Cierre */}
            <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="px-5 py-2.5 rounded-xl liquid-glass-interactive text-white font-semibold text-xs transition cursor-pointer"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PortfolioStrategyView
