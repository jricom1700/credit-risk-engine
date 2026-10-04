import React from 'react'
import { X, ShieldCheck, HelpCircle, Calculator, FileSpreadsheet, ChevronRight, ExternalLink } from 'lucide-react'
import { formatMXN, formatPercent, getCNBVBadgeColor } from '../utils/formatters'

// Diccionario de traducción de nombres crudos a terminología financiera y de Buró
const FEATURE_LABELS = {
  loan_percent_income: 'Capacidad de Pago (DTI / Endeudamiento)',
  person_home_ownership: 'Estabilidad de Vivienda',
  loan_intent: 'Destino del Crédito',
  cb_person_default_on_file: 'Historial de Quebranto en Buró',
  cb_person_cred_hist_length: 'Antigüedad Crediticia',
  person_emp_length: 'Estabilidad Laboral',
  person_age: 'Edad del Acreditado',
  loan_amnt_mxn: 'Monto Solicitado',
  person_income_mxn: 'Nivel de Ingresos',
  loan_int_rate: 'Tasa de Interés',
  loan_int_rate_imputed: 'Tasa de Interés',
}

export function TechnicalDetailsModal({ isOpen, onClose, result }) {
  if (!isOpen || !result) return null

  const ead = result.loan_amnt_mxn || 0
  const pd = result.probability_of_default || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-left">
        {/* Header del Modal */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-5 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Detalles Técnicos y Regulatorios</h3>
              <p className="text-xs text-slate-400">
                Cumplimiento CUB (
                <a
                  href="https://www.gob.mx/cnbv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:text-teal-300 underline inline-flex items-center gap-0.5 font-medium"
                >
                  CNBV
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                ) y Metodología de{' '}
                <a
                  href="https://www.burodecredito.com.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5 font-medium"
                >
                  Buró de Crédito
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-slate-300">
          {/* 1. Calificación Regulatoria CNBV y Provisiones */}
          <section className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                  1. Calificación Regulatoria CNBV (CUB Anexo 33)
                </h4>
                <a
                  href="https://www.gob.mx/cnbv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-teal-400 hover:text-teal-300 underline inline-flex items-center gap-0.5 font-medium"
                  title="Consultar portal oficial CNBV"
                >
                  Normativa
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCNBVBadgeColor(result.cnbv_rating)}`}>
                {result.cnbv_rating}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/70 p-2.5 rounded-lg">
                <span className="text-slate-400 block">Nivel de Riesgo Regulatorio</span>
                <span className="font-semibold text-white mt-0.5 block">{result.cnbv_description || 'Evaluado por CUB'}</span>
              </div>
              <div className="bg-slate-900/70 p-2.5 rounded-lg">
                <span className="text-slate-400 block">Reserva Preventiva Obligatoria</span>
                <span className="font-semibold text-amber-400 mt-0.5 block">
                  {formatPercent(result.cnbv_minimum_reserve_pct)} de provisión contable
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Corresponde al porcentaje de saldo que la institución financiera debe constituir inmediatamente en reservas ante la CNBV para salvaguardar el balance.
            </p>
          </section>

          {/* 2. Probabilidad de Incumplimiento (PD) con Tooltip Educativo */}
          <section className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              2. Probabilidad de Incumplimiento (PD)
            </h4>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-white font-mono">
                {formatPercent(pd * 100, 2)}
              </span>
              <span className="text-xs text-slate-400">Horizonte: 12 meses</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-300">
              <p className="leading-relaxed">
                <strong className="text-emerald-400 font-semibold">¿Qué es la PD? </strong>
                Estimación estadística cuantitativa de la probabilidad de que el acreditado incurra en impago grave (mora de 90 o más días / MOP-04+) durante los próximos 12 meses.
              </p>
            </div>
          </section>

          {/* 3. Pérdida Esperada (EL) y Desglose de la Fórmula */}
          <section className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-amber-400" />
                3. Pérdida Esperada (Expected Loss - EL)
              </h4>
              <span className="text-base font-bold text-amber-400 font-mono">
                {formatMXN(result.expected_loss_mxn)}
              </span>
            </div>

            {/* Desglose de Fórmula */}
            <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="text-slate-300 font-mono text-center pb-2 border-b border-slate-800 text-sm font-semibold">
                EL = PD × LGD × EAD (Pérdida Esperada)
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                <div className="bg-slate-950 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">PD (Default)</span>
                  <span className="font-bold text-emerald-400">{formatPercent(pd * 100, 2)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">LGD (Severidad)</span>
                  <span className="font-bold text-slate-300">45.0%</span>
                  <span className="text-[9px] text-slate-500 block font-sans">Norma CNBV</span>
                </div>
                <div className="bg-slate-950 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">EAD (Exposición)</span>
                  <span className="font-bold text-slate-200">{formatMXN(ead)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Aportación de Puntos por Variable (Scorecard Champion) */}
          {result.points_breakdown && Object.keys(result.points_breakdown).length > 0 && (
            <section className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                4. Aportación de Puntos por Variable (Scorecard Calibrado)
              </h4>
              <p className="text-[11px] text-slate-500">
                Puntuación acumulada por bin del modelo logístico regulatorio (Puntuación final: {result.credit_score} pts).
              </p>

              <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
                {Object.entries(result.points_breakdown).map(([variableKey, points]) => {
                  const readableName = FEATURE_LABELS[variableKey] || variableKey
                  const isHigh = points >= 65
                  const isLow = points < 50
                  return (
                    <div key={variableKey} className="py-2 flex items-center justify-between text-xs hover:bg-slate-900/40 px-2 rounded transition">
                      <div className="flex items-center space-x-2">
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <span className="font-medium text-slate-200">{readableName}</span>
                      </div>
                      <span className={`font-mono font-bold ${isHigh ? 'text-emerald-400' : isLow ? 'text-rose-400' : 'text-amber-400'}`}>
                        {points.toFixed(1)} pts
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Cerrar Detalles
          </button>
        </div>
      </div>
    </div>
  )
}
