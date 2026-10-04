import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Scale,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  X,
  Layers
} from 'lucide-react'
import { scoreIndividual } from '../services/api'
import { ScoreGauge } from './ScoreGauge'
import { formatMXN, formatMXNValue, formatPercent, getCNBVBadgeColor } from '../utils/formatters'

// Matriz y tabla de equivalencias regulatorias de la CNBV (Circular Única de Bancos - CUB Anexo 33)
const CNBV_EQUIVALENCE_TABLE = [
  { grade: 'A-1', maxPd: '0.00% - 2.00%', minReserve: '0.50%', desc: 'Riesgo Mínimo', policy: 'Aprobación Inmediata / Tasa Preferencial' },
  { grade: 'A-2', maxPd: '2.01% - 3.00%', minReserve: '0.90%', desc: 'Riesgo Muy Bajo', policy: 'Aprobación Estándar' },
  { grade: 'B-1', maxPd: '3.01% - 4.00%', minReserve: '1.50%', desc: 'Riesgo Bajo', policy: 'Aprobación con Monitoreo' },
  { grade: 'B-2', maxPd: '4.01% - 6.50%', minReserve: '2.50%', desc: 'Riesgo Moderado-Bajo', policy: 'Aprobación Condicionada' },
  { grade: 'C-1', maxPd: '6.51% - 10.00%', minReserve: '5.00%', desc: 'Riesgo Moderado-Alto', policy: 'Revisión Manual / Comité' },
  { grade: 'C-2', maxPd: '10.01% - 20.00%', minReserve: '15.00%', desc: 'Riesgo Alto', policy: 'Revisión Estricta / Requiere Aval' },
  { grade: 'D',   maxPd: '20.01% - 50.00%', minReserve: '45.00%', desc: 'Riesgo Muy Alto', policy: 'Rechazo Institucional' },
  { grade: 'E',   maxPd: '> 50.00%', minReserve: '80.00%', desc: 'Pérdida Severa', policy: 'Veto Obligatorio (Quebranto)' },
]

// Traducción de variables a lenguaje natural financiero
const FEATURE_TRANSLATIONS = {
  loan_percent_income: { label: 'Capacidad de Pago (DTI / Endeudamiento)', format: (v) => `${(v * 100).toFixed(1)}%` },
  person_income_mxn: { label: 'Nivel de Ingreso Anual Comprobable', format: (v) => formatMXN(v) },
  person_home_ownership: {
    label: 'Régimen de Vivienda y Arraigo',
    format: (v) => ({ RENT: 'Renta', OWN: 'Propia', MORTGAGE: 'Hipoteca', OTHER: 'Otro' }[v] || v),
  },
  person_emp_length: { label: 'Antigüedad y Estabilidad Laboral', format: (v) => (v != null ? `${v} años` : 'Thin-File / Informal') },
  cb_person_default_on_file: { label: 'Historial de Mora Grave en Buró', format: (v) => (v === 'Y' ? 'Con Mora MOP-04+' : 'Limpio') },
  loan_intent: {
    label: 'Destino o Propósito del Crédito',
    format: (v) => ({
      PERSONAL: 'Personal',
      EDUCATION: 'Educación',
      MEDICAL: 'Gastos Médicos',
      VENTURE: 'Negocio / Emprendimiento',
      HOMEIMPROVEMENT: 'Mejora de Vivienda',
      DEBTCONSOLIDATION: 'Consolidación de Deuda',
    }[v] || v),
  },
  loan_amnt_mxn: { label: 'Monto Solicitado', format: (v) => formatMXN(v) },
  loan_int_rate_imputed: { label: 'Tasa de Interés Pactada', format: (v) => `${v}%` },
  cb_person_cred_hist_length: { label: 'Antigüedad en Buró de Crédito', format: (v) => `${v} años` },
  person_age: { label: 'Edad del Solicitante', format: (v) => `${v} años` },
}

export function UnderwritingView() {
  // Manejo de valores como cadenas de texto para evitar el bug del '0' al borrar
  const [formData, setFormData] = useState({
    person_age: '30',
    monthly_income: '20000',
    person_home_ownership: 'RENT',
    is_thin_file: false,
    person_emp_length: '3.5',
    loan_intent: 'PERSONAL',
    loan_amnt_mxn: '35000',
    loan_int_rate: '12.5',
    cb_person_default_on_file: 'N',
    cb_person_cred_hist_length: '4',
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Control de formulario plegable / acordeón
  const [isFormExpanded, setIsFormExpanded] = useState(true)

  // Control de umbral de corte manual en tiempo real (Cut-off slider)
  const [cutoffThreshold, setCutoffThreshold] = useState(560)

  // Control para mostrar todas las variables del Scorecard ordenadas de mayor a menor
  const [showAllVariables, setShowAllVariables] = useState(false)

  // Control del KPI seleccionado para desglose y explicación detallada interactiva
  const [selectedKpi, setSelectedKpi] = useState(null)

  // Manejador seguro para inputs numéricos: permite que queden vacíos "" sin inyectar 0
  const handleNumericChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Manejador específico de ingreso mensual (sin fallback forzado a 0)
  const handleMonthlyIncomeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      monthly_income: value,
    }))
  }

  // DTI dinámico calculado a partir de los valores actuales en pantalla
  const numericMonthly = parseFloat(formData.monthly_income) || 0
  const numericAnnualIncome = numericMonthly * 12
  const numericLoanAmnt = parseFloat(formData.loan_amnt_mxn) || 0
  const currentDti = numericAnnualIncome > 0 ? (numericLoanAmnt / numericAnnualIncome) * 100 : 0
  const isDtiExceeded = currentDti > 40.0

  // Cerrar ventanas flotantes al presionar tecla Escape (ESC)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedKpi(null)
        setShowAllVariables(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        person_age: formData.person_age === '' ? 18 : parseInt(formData.person_age, 10),
        person_income_mxn: numericAnnualIncome > 0 ? numericAnnualIncome : 1.0,
        monthly_income_mxn: numericMonthly > 0 ? numericMonthly : 1.0,
        person_home_ownership: formData.person_home_ownership,
        person_emp_length: formData.is_thin_file
          ? null
          : formData.person_emp_length === ''
          ? null
          : parseFloat(formData.person_emp_length),
        loan_intent: formData.loan_intent,
        loan_amnt_mxn: numericLoanAmnt > 0 ? numericLoanAmnt : 1000.0,
        loan_int_rate: formData.loan_int_rate === '' ? null : parseFloat(formData.loan_int_rate),
        cb_person_default_on_file: formData.cb_person_default_on_file,
        cb_person_cred_hist_length:
          formData.cb_person_cred_hist_length === '' ? 0 : parseInt(formData.cb_person_cred_hist_length, 10),
      }

      const res = await scoreIndividual(payload)
      setResult(res)
      // Plegar automáticamente el formulario tras obtener respuesta
      setIsFormExpanded(false)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.detail ||
          'Error al conectar con el motor de scoring. Verifica que la API esté activa.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Evaluación dinámica del veredicto según el Cut-off slider
  const getDynamicVerdict = () => {
    if (!result) return null

    // Si tiene veto de política institucional activo (DTI > 40% o MOP-04+ en Buró)
    if (result.policy_veto_applied) {
      return {
        decision: 'RECHAZADO',
        title: 'RECHAZADO POR POLÍTICA',
        colorClass: 'bg-gradient-to-r from-rose-950/70 via-rose-900/30 to-slate-900 border-rose-500/60 text-rose-300',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
        icon: XCircle,
        description: 'Solicitud rechazada automáticamente por superar el límite prudencial de endeudamiento o contar con antecedentes graves de quebranto.',
      }
    }

    const score = result.credit_score
    if (score >= cutoffThreshold) {
      return {
        decision: 'APROBADO',
        title: 'CRÉDITO APROBADO',
        colorClass: 'bg-gradient-to-r from-emerald-950/70 via-emerald-900/30 to-slate-900 border-emerald-500/60 text-emerald-300',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
        icon: CheckCircle2,
        description: null,
      }
    } else if (score >= cutoffThreshold - 45) {
      return {
        decision: 'REVISIÓN MANUAL',
        title: 'REVISIÓN MANUAL REQUERIDA',
        colorClass: 'bg-gradient-to-r from-amber-950/70 via-amber-900/30 to-slate-900 border-amber-500/60 text-amber-300',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
        icon: AlertTriangle,
        description: 'Puntaje en zona frontera. Se recomienda validar capacidad de pago adicional o solicitar coacreditado.',
      }
    } else {
      return {
        decision: 'RECHAZADO',
        title: 'SOLICITUD RECHAZADA',
        colorClass: 'bg-gradient-to-r from-rose-950/70 via-rose-900/30 to-slate-900 border-rose-500/60 text-rose-300',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
        icon: XCircle,
        description: 'El puntaje se encuentra por debajo del umbral de corte institucional definido.',
      }
    }
  }

  const currentVerdict = getDynamicVerdict()

  // Extraer razones de atención/riesgo dinámicas (tanto para Revisión Manual como Rechazo)
  const attentionReasons = (() => {
    if (!result) return []
    if (result.adverse_action_reasons && result.adverse_action_reasons.length > 0) {
      return result.adverse_action_reasons
    }
    if (result.key_risk_factors && result.key_risk_factors.length > 0) {
      return result.key_risk_factors.map((rf) =>
        typeof rf === 'string'
          ? rf
          : `${rf.description}: Representa un factor que presiona a la baja el score o incrementa el riesgo.`
      )
    }
    return []
  })()

  // Desglose de todas las variables del Scorecard ordenadas de mayor a menor contribución
  const sortedVariables = React.useMemo(() => {
    if (!result || !result.points_breakdown) return []
    return Object.entries(result.points_breakdown)
      .map(([key, points]) => {
        const info = FEATURE_TRANSLATIONS[key] || { label: key, format: (v) => String(v) }
        let val = null
        if (key === 'loan_percent_income') val = result.dti_ratio
        else if (key === 'loan_amnt_mxn') val = result.loan_amnt_mxn
        else if (key === 'person_income_mxn') val = numericAnnualIncome
        else if (key === 'person_home_ownership') val = formData.person_home_ownership
        else if (key === 'person_emp_length') val = formData.is_thin_file ? null : formData.person_emp_length
        else if (key === 'loan_intent') val = formData.loan_intent
        else if (key === 'cb_person_default_on_file') val = formData.cb_person_default_on_file
        else if (key === 'cb_person_cred_hist_length') val = formData.cb_person_cred_hist_length
        else if (key === 'person_age') val = formData.person_age
        else if (key === 'loan_int_rate_imputed') val = formData.loan_int_rate || 11.5

        return {
          key,
          label: info.label,
          formattedValue: val !== null && val !== undefined ? info.format(val) : '—',
          points: Number(points),
        }
      })
      .sort((a, b) => b.points - a.points)
  }, [result, formData, numericAnnualIncome])

  // Generador de explicaciones específicas e interactivas por KPI con datos reales del cliente
  const getKpiExplanation = (key) => {
    if (!result) return null

    const loanAmnt = result.loan_amnt_mxn || numericLoanAmnt || 0
    const pdPct = result.probability_of_default * 100
    const pdFormatted = formatPercent(pdPct, 2)
    const reservePctFormatted = formatPercent(result.cnbv_minimum_reserve_pct)
    const reserveMonto = formatMXN(loanAmnt * (result.cnbv_minimum_reserve_pct / 100))
    const elFormatted = formatMXN(result.expected_loss_mxn)

    const map = {
      loan_amount: {
        title: 'Monto de Crédito a Otorgar / Prestar',
        badge: formatMXN(loanAmnt),
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        description:
          'Importe total de financiamiento solicitado por el acreditado y evaluado conforme a la solvencia económica y capacidad de pago.',
        formula: 'Capacidad de Pago (DTI) = (Monto del Crédito / Ingreso Anual) × 100',
        formulaExplanation: 'Razón prudencial de apalancamiento que compara el capital total financiado contra el ingreso anual comprobado.',
        howItWasCalculated: [
          `Monto solicitado por el cliente: ${formatMXN(loanAmnt)} MXN.`,
          `Ingreso mensual neto declarado: ${formatMXN(numericMonthly)} MXN (Ingreso anual: ${formatMXN(numericAnnualIncome)} MXN).`,
          `Capacidad de pago calculada (DTI): ${formatPercent(currentDti)} (Límite prudencial: 40.0%).`,
          `Tasa de interés aplicable: ${formData.loan_int_rate || 12.5}% anual sobre saldo insoluto.`,
        ],
        businessImpact:
          'Constituye la Exposición al Incumplimiento (EAD) y determina el balance financiero colocado para este contrato.',
      },
      cnbv_rating: {
        title: 'Calificación Regulatoria CNBV (CUB Anexo 33)',
        badge: result.cnbv_rating,
        badgeColor: getCNBVBadgeColor(result.cnbv_rating),
        description:
          'Clasificación prudencial obligatoria estipulada en la Circular Única de Bancos emitida por la Comisión Nacional Bancaria y de Valores (CNBV) para la cartera de créditos al consumo no revolvente en México.',
        officialUrl: 'https://www.gob.mx/cnbv',
        formula: null,
        howItWasCalculated: [
          `Puntaje en Scorecard: ${result.credit_score} puntos (escala estándar 300 - 850).`,
          `Probabilidad de Incumplimiento (PD) calibrada: ${pdFormatted} a 12 meses.`,
          `Matriz Regulatoria CNBV: Conforme a la CUB Anexo 33, una PD de ${pdFormatted} ubica a esta solicitud en Grado ${result.cnbv_rating} (${result.cnbv_description || 'Riesgo Evaluado'}).`,
          `Reserva Preventiva Obligatoria: Este grado exige constituir una provisión contable de ${reservePctFormatted} sobre el monto financiado (${reserveMonto}).`,
        ],
        businessImpact: `Determina el porcentaje mínimo de reservas preventivas obligatorias (${reservePctFormatted}) que la entidad debe constituir en balance y su viabilidad ante comités de crédito.`,
        showEquivalenceTable: true,
      },
      pd: {
        title: 'Probabilidad de Incumplimiento (PD - Probability of Default)',
        badge: pdFormatted,
        badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        description:
          'Probabilidad de Default: estimación estadística rigurosa de que el acreditado incurra en impago grave o atraso de 90 o más días (mora MOP-04+) dentro de los próximos 12 meses.',
        formula: 'PD = 1 / (1 + e^-(Scorecard Logit))',
        formulaExplanation: 'Calibración logística sobre la suma ponderada de pesos de evidencia (Weight of Evidence - WoE) de los atributos del cliente.',
        howItWasCalculated: [
          `Puntos totales en el modelo: ${result.credit_score} puntos obtenidos tras la suma de aportes ponderados (WoE).`,
          `Factores con mayor impacto: Capacidad de pago (DTI actual: ${formatPercent(currentDti)}), régimen de vivienda (${formData.person_home_ownership === 'RENT' ? 'Renta' : formData.person_home_ownership === 'OWN' ? 'Propia' : 'Hipoteca'}), estabilidad laboral (${formData.is_thin_file ? 'Perfil Thin File' : (formData.person_emp_length ? formData.person_emp_length + ' años' : 'Sin comprobar')}) e historial en Buró (${formData.cb_person_default_on_file === 'Y' ? 'Con antecedente de quebranto' : 'Historial limpio'}).`,
          `Función Sigmoide Calibrada: El modelo de regresión logística traduce el score crediticio a una probabilidad estadística exacta de ${pdFormatted}.`,
        ],
        businessImpact:
          'Es el insumo clave para la fijación de precios basada en riesgo, determinación de límites prudenciales y evaluación de rentabilidad ajustada (RAROC).',
      },
      reserve: {
        title: 'Reserva Preventiva Obligatoria (Provisión Contable CUB)',
        badge: reservePctFormatted,
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        description:
          'Monto y porcentaje de provisiones de capital que la institución financiera debe apartar de inmediato en su balance contable como salvaguarda prudencial para absorber pérdidas crediticias.',
        formula: 'Reserva Contable (MXN) = EAD × % Reserva Mínima CUB',
        formulaExplanation: 'Exposición al Incumplimiento (EAD) multiplicada por el porcentaje fijado por la CNBV según el Grado de Riesgo asignado.',
        howItWasCalculated: [
          `Exposición al Incumplimiento (EAD): ${formatMXN(loanAmnt)} (monto total solicitado por el cliente).`,
          `Grado asignado por la CNBV: Categoría de riesgo ${result.cnbv_rating} (${result.cnbv_description || 'Evaluado'}).`,
          `Regla regulatoria CUB: Para la categoría ${result.cnbv_rating}, la CNBV fija una reserva mínima obligatoria del ${reservePctFormatted}.`,
          `Monto en dinero sobre esta operación: Para el financiamiento de ${formatMXN(loanAmnt)}, la entidad debe apartar ${reserveMonto} en sus reservas preventivas contables.`,
        ],
        businessImpact:
          'Se registra de inmediato como gasto preventivo contra el estado de resultados del banco al momento de la originación crediticia.',
      },
      el: {
        title: 'Pérdida Esperada (EL - Expected Loss)',
        badge: elFormatted,
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        description:
          'Monto en moneda nacional (MXN) que estadísticamente se proyecta no recuperar del crédito debido al riesgo inherente y la severidad regulatoria.',
        formula: 'Pérdida Esperada (EL) = EAD × PD × LGD',
        formulaExplanation: 'Exposición al Incumplimiento (EAD) × Probabilidad de Incumplimiento (PD) × Severidad de la Pérdida (LGD = 45% según CNBV).',
        howItWasCalculated: [
          `Exposición al Incumplimiento (EAD): ${formatMXN(loanAmnt)} (monto total solicitado por el cliente).`,
          `Severidad de la Pérdida (LGD): 45.0% (estándar prudencial fijado por la CNBV para consumo no revolvente).`,
          `Probabilidad de Incumplimiento (PD): ${pdFormatted} (estimada para este perfil mediante Scorecard).`,
          `Cálculo monetario ponderado: ${formatMXN(loanAmnt)} × ${pdFormatted} × 45.0% = ${elFormatted} MXN.`,
        ],
        businessImpact:
          'Costo financiero de riesgo que debe ser cubierto por el margen financiero neto derivado de la tasa de interés cobrada.',
      },
    }

    return map[key] || null
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* 1. SECCIÓN DE FORMULARIO PLEGABLE (Acordeón Liquid Glass) */}
      <div className="liquid-glass rounded-2xl overflow-hidden transition-all duration-300 border border-white/10 shadow-xl">
        {/* Cabecera del Acordeón con Botón para Expandir/Modificar */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Datos del Solicitante de Crédito
            </h2>
            {!isFormExpanded && result && (
              <p className="text-xs text-slate-400 mt-0.5">
                {formData.person_age} años · Ingreso: {formatMXN(numericMonthly)}/mes · Monto: {formatMXN(numericLoanAmnt)} · DTI: {formatPercent(currentDti)}
              </p>
            )}
          </div>

          {result && (
            <button
              type="button"
              onClick={() => setIsFormExpanded(!isFormExpanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 liquid-glass-interactive cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isFormExpanded ? 'Colapsar Formulario' : 'Modificar Datos / Ver Formulario'}</span>
              {isFormExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Cuerpo del Formulario Plegable */}
        {isFormExpanded && (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fila 1: Edad y Tipo de Vivienda (Etiquetas Limpias) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Edad del Solicitante (Años)
                </label>
                <input
                  type="number"
                  min="18"
                  max="95"
                  required
                  value={formData.person_age}
                  onChange={(e) => handleNumericChange('person_age', e.target.value)}
                  className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tipo de Vivienda
                </label>
                <select
                  value={formData.person_home_ownership}
                  onChange={(e) => handleNumericChange('person_home_ownership', e.target.value)}
                  className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                >
                  <option value="RENT" className="bg-slate-900 text-white">Renta</option>
                  <option value="MORTGAGE" className="bg-slate-900 text-white">Hipoteca</option>
                  <option value="OWN" className="bg-slate-900 text-white">Propia</option>
                  <option value="OTHER" className="bg-slate-900 text-white">Otro</option>
                </select>
              </div>

              {/* Fila 2: Ingreso Mensual y Antigüedad Laboral en una misma fila (2 columnas compactas) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ingreso Mensual (MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Ej. 16421"
                    required
                    value={formData.monthly_income}
                    onChange={(e) => handleMonthlyIncomeChange(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Antigüedad Laboral (Años)
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_thin_file}
                      onChange={(e) => handleNumericChange('is_thin_file', e.target.checked)}
                      className="rounded bg-slate-900 border-white/20 text-emerald-500 focus:ring-emerald-500 h-3 w-3"
                    />
                    <span className="text-[10px] text-amber-400 font-medium">Thin-File / Informal</span>
                  </label>
                </div>
                {!formData.is_thin_file ? (
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="any"
                    placeholder="Ej. 3.5"
                    value={formData.person_emp_length}
                    onChange={(e) => handleNumericChange('person_emp_length', e.target.value)}
                    className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                  />
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5 h-[38px]">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Evaluado con bin para sector informal</span>
                  </div>
                )}
              </div>

              {/* Fila 3: Destino del Crédito y Monto Solicitado con Capacidad de Pago Proyectada (DTI) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destino del Crédito
                </label>
                <select
                  value={formData.loan_intent}
                  onChange={(e) => handleNumericChange('loan_intent', e.target.value)}
                  className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                >
                  <option value="PERSONAL" className="bg-slate-900 text-white">Préstamo Personal</option>
                  <option value="EDUCATION" className="bg-slate-900 text-white">Educación</option>
                  <option value="MEDICAL" className="bg-slate-900 text-white">Gastos Médicos</option>
                  <option value="VENTURE" className="bg-slate-900 text-white">Negocio / Emprendimiento</option>
                  <option value="HOMEIMPROVEMENT" className="bg-slate-900 text-white">Mejora de Vivienda</option>
                  <option value="DEBTCONSOLIDATION" className="bg-slate-900 text-white">Consolidación de Deuda</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Monto Solicitado (MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Ej. 35000"
                    required
                    value={formData.loan_amnt_mxn}
                    onChange={(e) => handleNumericChange('loan_amnt_mxn', e.target.value)}
                    className="w-full pl-7 pr-3 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition font-medium"
                  />
                </div>

                {/* Capacidad de pago proyectada (DTI) ubicada justo debajo del Monto Solicitado */}
                <div className={`mt-2 p-2.5 rounded-xl border transition-all ${
                  isDtiExceeded ? 'bg-rose-500/10 border-rose-500/40' : 'liquid-glass-subtle border-white/10'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-300 flex items-center gap-1.5 text-[11px]">
                      <Scale className="w-3.5 h-3.5 text-emerald-400" />
                      Capacidad de Pago Proyectada (DTI):
                    </span>
                    <span className={`font-bold text-[11px] ${isDtiExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatPercent(currentDti)} {isDtiExceeded && '(Excede límite 40%)'}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDtiExceeded ? 'bg-rose-500' : currentDti > 30 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(currentDti, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Fila 4: Tasa de Interés y Antigüedad en Buró */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tasa de Interés Anual (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="Ej. 12.5"
                  value={formData.loan_int_rate}
                  onChange={(e) => handleNumericChange('loan_int_rate', e.target.value)}
                  className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Antigüedad en Buró de Crédito (Años)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  required
                  value={formData.cb_person_cred_hist_length}
                  onChange={(e) => handleNumericChange('cb_person_cred_hist_length', e.target.value)}
                  className="w-full px-3.5 py-2 liquid-glass-input rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>

              {/* Fila 5: Historial de Quebranto en Buró */}
              <div className="sm:col-span-2 liquid-glass-subtle p-3.5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Antecedente de Mora Grave / Quebranto en Buró
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Atrasos mayores a 90 días (MOP-04+) o quebranto en el historial de{' '}
                    <a
                      href="https://www.burodecredito.com.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5 font-medium"
                    >
                      Buró de Crédito
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>.
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
                    <input
                      type="radio"
                      name="cb_person_default_on_file"
                      value="N"
                      checked={formData.cb_person_default_on_file === 'N'}
                      onChange={() => handleNumericChange('cb_person_default_on_file', 'N')}
                      className="text-emerald-500 bg-slate-900 border-white/20"
                    />
                    No (Limpio)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-rose-300">
                    <input
                      type="radio"
                      name="cb_person_default_on_file"
                      value="Y"
                      checked={formData.cb_person_default_on_file === 'Y'}
                      onChange={() => handleNumericChange('cb_person_default_on_file', 'Y')}
                      className="text-rose-500 bg-slate-900 border-white/20"
                    />
                    Sí (Mora MOP-04+)
                  </label>
                </div>
              </div>
            </div>

            {/* Botón de Enviar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Calculando Decisión y Explicabilidad...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Evaluar Solicitud de Crédito</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-semibold text-xs">Error de Evaluación</p>
            <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 2. SECCIÓN DE RESULTADO: CONTENEDOR UNIFICADO INTEGRAL */}
      {result && currentVerdict && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          {/* CONTENEDOR PRINCIPAL INTEGRADO LIQUID GLASS:
              El contenedor se mantiene en elegante Liquid Glass neutro.
              El color se enfoca exclusivamente en el nivel de riesgo CNBV, dictamen y score. */}
          <div className="p-6 sm:p-7 rounded-2xl liquid-glass border border-white/12 shadow-2xl relative overflow-hidden transition-all space-y-6 text-white">
            
            {/* 1. SECCIÓN SUPERIOR: DICTAMEN FINAL Y NIVEL DE RIESGO CNBV A SU LADO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Lado izquierdo: Dictamen Final */}
              <div className="flex items-center space-x-4">
                <div className={`p-3.5 rounded-2xl border shrink-0 shadow-lg ${currentVerdict.badgeClass}`}>
                  <currentVerdict.icon className="w-9 h-9" />
                </div>
                <div>
                  <span className="text-[11px] font-bold tracking-widest uppercase text-slate-300 block">
                    Dictamen Final de Crédito
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
                    {currentVerdict.title}
                  </h1>
                  {currentVerdict.description && (
                    <p className="text-xs text-slate-200/90 mt-1 max-w-2xl leading-relaxed">
                      {currentVerdict.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Lado derecho: KPI de Nivel de Riesgo Regulatorio CNBV (iluminado según su nivel de riesgo y más grande) */}
              <div
                onClick={() => setSelectedKpi('cnbv_rating')}
                className={`p-4 sm:px-6 sm:py-4 rounded-2xl border backdrop-blur-md cursor-pointer transition-all flex items-center justify-between sm:justify-start gap-5 shrink-0 shadow-xl ${
                  result.cnbv_rating.startsWith('A')
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-500/10 hover:bg-emerald-950/60'
                    : result.cnbv_rating.startsWith('B')
                    ? 'bg-teal-950/40 border-teal-500/50 shadow-teal-500/10 hover:bg-teal-950/60'
                    : result.cnbv_rating.startsWith('C')
                    ? 'bg-amber-950/40 border-amber-500/50 shadow-amber-500/10 hover:bg-amber-950/60'
                    : 'bg-rose-950/40 border-rose-500/50 shadow-rose-500/10 hover:bg-rose-950/60'
                } hover:scale-[1.02]`}
                title="Haz clic para ver qué significa el Grado CNBV y tabla de equivalencias"
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Nivel de Riesgo CNBV
                  </span>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span className={`px-3 py-1 rounded-xl text-lg sm:text-xl font-black border font-mono tracking-wide ${getCNBVBadgeColor(result.cnbv_rating)}`}>
                      {result.cnbv_rating}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white">
                      {result.cnbv_description || 'Riesgo Evaluado'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedKpi('cnbv_rating')
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition cursor-pointer"
                >
                  ¿Qué significa?
                </button>
              </div>
            </div>

            {/* 2. KPIS REGULATORIOS Y FINANCIEROS (CON CONTENEDOR DE MONTO A PRESTAR) */}
            <div className="pt-4 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* KPI 0: Monto a Prestar (Crédito Solicitado) */}
                <div
                  onClick={() => setSelectedKpi('loan_amount')}
                  className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col justify-between cursor-pointer transition-all hover:bg-white/[0.08] hover:border-white/25 hover:scale-[1.01] group min-h-[140px]"
                  title="Haz clic para ver explicación del Monto a Prestar y Capacidad de Pago"
                >
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Monto a Prestar (Solicitado)
                    </span>
                    <div className="my-2">
                      <div className="flex items-baseline flex-wrap gap-x-1.5">
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-400 font-mono tracking-tight whitespace-nowrap">
                          {formatMXNValue(numericLoanAmnt)}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                          MXN
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-300 block mt-1">
                        Tasa: {formData.loan_int_rate || 12.5}% · DTI: {formatPercent(currentDti)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <span className="text-[11px] text-slate-400 group-hover:text-emerald-300 font-medium transition-colors">
                      Ver detalle ↗
                    </span>
                  </div>
                </div>

                {/* KPI 1: Probabilidad de Incumplimiento (PD) */}
                <div
                  onClick={() => setSelectedKpi('pd')}
                  className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col justify-between cursor-pointer transition-all hover:bg-white/[0.08] hover:border-white/25 hover:scale-[1.01] group min-h-[140px]"
                  title="Haz clic para ver explicación de la Probabilidad de Incumplimiento"
                >
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Probabilidad de Default (PD)
                    </span>
                    <div className="my-2">
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-sky-300 font-mono block tracking-tight">
                        {formatPercent(result.probability_of_default * 100, 2)}
                      </span>
                      <span className="text-xs font-medium text-slate-300 block mt-1">
                        Mora grave a 12 meses
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <span className="text-[11px] text-slate-400 group-hover:text-sky-300 font-medium transition-colors">
                      Ver detalle ↗
                    </span>
                  </div>
                </div>

                {/* KPI 2: Reserva Preventiva Obligatoria */}
                <div
                  onClick={() => setSelectedKpi('reserve')}
                  className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col justify-between cursor-pointer transition-all hover:bg-white/[0.08] hover:border-white/25 hover:scale-[1.01] group min-h-[140px]"
                  title="Haz clic para ver explicación de la Reserva Preventiva"
                >
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Reserva Preventiva CUB
                    </span>
                    <div className="my-2">
                      <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-300 font-mono block tracking-tight">
                        {formatPercent(result.cnbv_minimum_reserve_pct)}
                      </span>
                      <span className="text-xs font-medium text-slate-300 block mt-1">
                        Provisión contable requerida
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <span className="text-[11px] text-slate-400 group-hover:text-amber-300 font-medium transition-colors">
                      Ver detalle ↗
                    </span>
                  </div>
                </div>

                {/* KPI 3: Pérdida Esperada (EL) */}
                <div
                  onClick={() => setSelectedKpi('el')}
                  className="p-4 sm:p-5 rounded-2xl liquid-glass-subtle border border-white/10 flex flex-col justify-between cursor-pointer transition-all hover:bg-white/[0.08] hover:border-white/25 hover:scale-[1.01] group min-h-[140px]"
                  title="Haz clic para ver explicación de la Pérdida Esperada"
                >
                  <div>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                      Pérdida Esperada (EL)
                    </span>
                    <div className="my-2">
                      <div className="flex items-baseline flex-wrap gap-x-1.5">
                        <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-100 font-mono tracking-tight whitespace-nowrap">
                          {formatMXNValue(result.expected_loss_mxn)}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">
                          MXN
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-300 block mt-1">
                        Costo de riesgo proyectado
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-200 font-medium transition-colors">
                      Ver detalle ↗
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SECCIÓN DE SCORING Y DIAGNÓSTICO (50% / 50% MITAD Y MITAD) */}
            <div className="pt-5 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Columna Izquierda: Velocímetro Semicircular + Slider de Corte (6 columnas - 50%) */}
                <div className="md:col-span-6 liquid-glass-subtle border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                        Puntaje Crediticio (Score Buró)
                      </span>
                      <a
                        href="https://www.burodecredito.com.mx"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 transition"
                        title="Consultar Buró de Crédito oficial"
                      >
                        <span>Buró de Crédito</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Velocímetro Semicircular y Slider Ampliado hacia la derecha */}
                    <ScoreGauge
                      score={result.credit_score}
                      cutoff={cutoffThreshold}
                      onCutoffChange={setCutoffThreshold}
                    />
                  </div>
                </div>

                {/* Columna Derecha: Diagnóstico y Factores Clave (6 columnas - 50%) */}
                <div className="md:col-span-6 liquid-glass-subtle border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-3">
                      Diagnóstico y Factores Clave del Solicitante
                    </span>

                    <div className="space-y-3">
                      {/* Fortalezas del Perfil */}
                      {result.key_positive_factors && result.key_positive_factors.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Fortalezas del Perfil:
                          </span>
                          <ul className="space-y-1.5">
                            {result.key_positive_factors.map((factor, idx) => (
                              <li
                                key={idx}
                                className="text-xs text-slate-200 liquid-glass-subtle p-2.5 rounded-xl border border-white/10 flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{typeof factor === 'string' ? factor : factor.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Factores de Atención para Revisión Manual (Comité) */}
                      {currentVerdict.decision === 'REVISIÓN MANUAL' && attentionReasons.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Puntos de Atención para Revisión Manual (Comité):
                          </span>
                          <ul className="space-y-1.5">
                            {attentionReasons.map((reason, idx) => (
                              <li
                                key={idx}
                                className="text-xs text-slate-200 liquid-glass-subtle p-2.5 rounded-xl border border-amber-500/30 flex items-center gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-[10px] shrink-0 font-bold font-mono">
                                  {idx + 1}
                                </span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Factores de Riesgo / Motivos de Rechazo */}
                      {currentVerdict.decision === 'RECHAZADO' && attentionReasons.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                            Factores Críticos / Motivos de Rechazo:
                          </span>
                          <ul className="space-y-1.5">
                            {attentionReasons.map((reason, idx) => (
                              <li
                                key={idx}
                                className="text-xs text-slate-200 liquid-glass-subtle p-2.5 rounded-xl border border-rose-500/30 flex items-center gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center text-[10px] shrink-0 font-bold font-mono">
                                  {idx + 1}
                                </span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Factores Secundarios a Monitorear si está Aprobado */}
                      {currentVerdict.decision === 'APROBADO' && result.key_risk_factors && result.key_risk_factors.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                            Aspectos Secundarios de Seguimiento:
                          </span>
                          <ul className="space-y-1.5">
                            {result.key_risk_factors.slice(0, 2).map((rf, idx) => (
                              <li
                                key={idx}
                                className="text-xs text-slate-300 liquid-glass-subtle p-2 rounded-xl border border-white/10 flex items-center gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-white/10 text-slate-300 flex items-center justify-center text-[10px] shrink-0 font-bold font-mono">
                                  {idx + 1}
                                </span>
                                <span>{typeof rf === 'string' ? rf : `${rf.description} (Contribución: ${rf.points_contribution} pts)`}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón pequeño y alineado a la derecha para no confundirse con una característica */}
                  <div className="pt-3 border-t border-white/10 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllVariables(true)}
                      className="py-1.5 px-3.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white liquid-glass-interactive flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>Mostrar todas las variables</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. VENTANA FLOTANTE (MODAL): DETALLES TÉCNICOS Y REGULATORIOS DEL KPI SELECCIONADO */}
      {selectedKpi && getKpiExplanation(selectedKpi) && (() => {
        const kpi = getKpiExplanation(selectedKpi)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedKpi(null)}
          >
            <div
              className="liquid-glass border border-white/15 rounded-2xl max-w-3xl sm:max-w-4xl w-full max-h-[88vh] overflow-y-auto shadow-2xl relative text-left animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header de la ventana con título, indicador y única 'X' para cerrar en esquina superior derecha */}
              <div className="sticky top-0 liquid-glass-subtle border-b border-white/10 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3 flex-wrap pr-4">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${kpi.badgeColor}`}>
                    {kpi.badge}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {kpi.title}
                  </h3>
                  {kpi.officialUrl && (
                    <a
                      href={kpi.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 underline font-medium inline-flex items-center gap-1"
                      title="Consultar portal oficial de la CNBV"
                    >
                      <span>Normativa Oficial CNBV</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Única 'X' para cerrar en la parte superior derecha */}
                <button
                  type="button"
                  onClick={() => setSelectedKpi(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cuerpo de la ventana flotante */}
              <div className="p-6 space-y-5 text-sm text-slate-300">
                {/* Concepto / Qué significa */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                    ¿Qué significa este indicador?
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {kpi.description}
                  </p>
                </div>

                {/* Desglose de Fórmula Matemática (si aplica) */}
                {kpi.formula && (
                  <div className="liquid-glass-subtle border border-white/10 rounded-xl p-4 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Fórmula Metodológica:
                    </span>
                    <div className="font-mono text-sm sm:text-base font-bold text-emerald-300">
                      {kpi.formula}
                    </div>
                    {kpi.formulaExplanation && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {kpi.formulaExplanation}
                      </p>
                    )}
                  </div>
                )}

                {/* Cómo se calculó específicamente para este cliente */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    ¿Cómo se calculó para este caso en específico?
                  </span>
                  <ul className="space-y-2">
                    {kpi.howItWasCalculated.map((step, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-slate-300 flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tabla de Equivalencias Regulatoria CNBV (si aplica) */}
                {kpi.showEquivalenceTable && (
                  <div className="pt-3 border-t border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                        Tabla de Equivalencias Regulatorias CNBV (CUB Anexo 33)
                      </span>
                      <span className="text-xs text-slate-400">
                        Fila resaltada = Nivel del solicitante
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-white/10 liquid-glass-subtle">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-white/5 text-slate-300 text-[11px] uppercase font-bold border-b border-white/10">
                          <tr>
                            <th className="p-3">Grado</th>
                            <th className="p-3">Rango PD</th>
                            <th className="p-3">Reserva Mínima</th>
                            <th className="p-3">Nivel de Riesgo</th>
                            <th className="p-3">Política de Crédito</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 font-sans">
                          {CNBV_EQUIVALENCE_TABLE.map((row) => {
                            const isCurrent = row.grade === result.cnbv_rating
                            return (
                              <tr
                                key={row.grade}
                                className={`transition-colors ${
                                  isCurrent
                                    ? 'bg-emerald-950/60 border-l-4 border-l-emerald-400 text-white font-semibold'
                                    : 'hover:bg-white/5 text-slate-300'
                                }`}
                              >
                                <td className="p-3 font-bold font-mono">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getCNBVBadgeColor(row.grade)}`}>
                                      {row.grade}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[11px] text-emerald-400 font-bold">
                                        (Actual)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-slate-200">{row.maxPd}</td>
                                <td className="p-3 font-mono text-amber-300 font-bold">{row.minReserve}</td>
                                <td className="p-3">{row.desc}</td>
                                <td className="p-3 text-xs text-slate-400">{row.policy}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Impacto en la decisión y margen */}
                <div className="p-3.5 rounded-xl liquid-glass-subtle border border-white/10 text-xs sm:text-sm text-slate-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-white">Impacto en la Decisión y Margen: </strong>
                    {kpi.businessImpact}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 4. VENTANA FLOTANTE (MODAL): TODAS LAS VARIABLES DEL SCORECARD */}
      {showAllVariables && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowAllVariables(false)}
        >
          <div
            className="liquid-glass border border-white/15 rounded-2xl max-w-3xl sm:max-w-4xl w-full max-h-[88vh] overflow-y-auto shadow-2xl relative text-left animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header de la ventana con título, resumen y única 'X' para cerrar en esquina superior derecha */}
            <div className="sticky top-0 liquid-glass-subtle border-b border-white/10 p-5 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  Variables y Factores del Scorecard
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Desglose completo ordenado de mayor a menor contribución en puntos (Total Score: {result.credit_score} pts)
                </p>
              </div>

              {/* Única 'X' para cerrar en la parte superior derecha */}
              <button
                type="button"
                onClick={() => setShowAllVariables(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido: Tabla espaciosa con todas las variables */}
            <div className="p-6 space-y-4">
              <div className="overflow-x-auto rounded-xl border border-white/10 liquid-glass-subtle">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-white/5 text-slate-400 text-[11px] uppercase font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Variable / Factor Crediticio</th>
                      <th className="p-3">Valor Observado</th>
                      <th className="p-3 text-right">Aporte en Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-sans">
                    {sortedVariables.map((item, idx) => (
                      <tr
                        key={item.key}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3 text-center font-mono text-xs text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-200 block text-xs sm:text-sm">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {item.key}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 font-medium">
                          {item.formattedValue}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-mono font-bold text-xs sm:text-sm px-2.5 py-1 rounded-md inline-block ${
                              item.points >= 70
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : item.points >= 40
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            +{item.points} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 rounded-xl liquid-glass-subtle border border-white/10 text-xs text-slate-400 flex items-center justify-between">
                <span>Total de variables evaluadas: <strong className="text-slate-200">{sortedVariables.length} atributos</strong></span>
                <span>Puntaje Crediticio Final: <strong className="text-emerald-400 font-mono text-sm">{result.credit_score} pts</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
