import React, { useState } from 'react'
import {
  BookOpen,
  ExternalLink,
  Cpu,
  Layers,
} from 'lucide-react'

const NOTEBOOKS = [
  {
    id: 'eda',
    title: 'Notebook 01: Preparación de Datos & EDA',
    shortTitle: '01. Datos & EDA',
    description:
      'Tratamiento de anomalías, imputación de nulos, análisis univariado/bivariado, capacidad de pago (DTI) y cruce con indicadores de mora grave (MOP-04+).',
    file: '/notebooks/01_data_preparation_and_eda_dark.html',
    badge: 'Fase 1: Ingesta & Calidad',
    badgeColor: 'border-sky-500/40 text-sky-400 bg-sky-950/60',
    icon: Layers,
    stats: '32,581 registros | 12 variables',
  },
  {
    id: 'modeling',
    title: 'Notebook 02: Modelado & Scorecard Calibrado',
    shortTitle: '02. Scorecard CNBV',
    description:
      'Binning óptimo monotónico (OptBinning WoE/IV), regresión logística penalizada, calibración a escala de 600 pts @ 50:1 Odds y evaluación AUC/Gini/KS/PSI.',
    file: '/notebooks/02_modeling_and_scorecard_dark.html',
    badge: 'Fase 2: Calibración Regulatoria',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/60',
    icon: Cpu,
    stats: 'OptBinning WoE | Escala CUB',
  },
]

export function NotebooksPage() {
  const [selectedNotebookId, setSelectedNotebookId] = useState('eda')

  const currentNotebook = NOTEBOOKS.find((nb) => nb.id === selectedNotebookId) || NOTEBOOKS[0]

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* 1. Panel Superior: Encabezado Técnico y Badges */}
      <div className="liquid-glass p-3.5 sm:p-6 rounded-2xl border border-white/10 shadow-xl space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white">
            Metodología
          </h1>
        </div>

        {/* Badges Tecnológicos y Metodológicos */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-white/10 text-xs">
          <span className="text-slate-400 font-semibold text-[10px] sm:text-[11px] uppercase tracking-wider mr-1">
            Stack Metodológico:
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            OptBinning (Monotonic WoE)
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            Regresión Logística Calibrada
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            Escala 600 pts @ 50:1 (PDO 20)
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            AUC-ROC, Gini, KS & PSI
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            CUB Anexo 33 (LGD 45%)
          </span>
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-[11px] sm:text-xs">
            Python 3.11 & Jupyter
          </span>
        </div>
      </div>

      {/* 2. Selector de Notebooks y Enlace Externo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Selector de Pestañas de Notebook */}
        <div className="inline-flex p-1 rounded-2xl liquid-glass border border-white/10 shadow-lg gap-1.5 self-start sm:self-auto">
          {NOTEBOOKS.map((nb) => {
            const Icon = nb.icon
            const isSelected = selectedNotebookId === nb.id
            return (
              <button
                key={nb.id}
                type="button"
                onClick={() => setSelectedNotebookId(nb.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/25 border border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 backdrop-blur-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{nb.shortTitle}</span>
              </button>
            )
          })}
        </div>

        {/* Acciones del Notebook: Abrir en pestaña externa */}
        <div className="flex items-center">
          <a
            href={currentNotebook.file}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-200 liquid-glass-interactive cursor-pointer border border-white/15 hover:border-emerald-500/40 hover:text-white transition shadow-sm"
            title="Abrir notebook completo en una nueva pestaña del navegador"
          >
            <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>Abrir en Pestaña Independiente</span>
          </a>
        </div>
      </div>

      {/* Ficha Descriptiva del Notebook Activo */}
      <div className="liquid-glass-subtle p-3.5 sm:p-4 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-[11px] border ${currentNotebook.badgeColor}`}>
              {currentNotebook.badge}
            </span>
            <span className="font-bold text-white text-xs sm:text-sm">{currentNotebook.title}</span>
          </div>
          <p className="text-slate-400 max-w-3xl leading-relaxed text-[11px] sm:text-xs">
            {currentNotebook.description}
          </p>
        </div>
        <div className="shrink-0 text-slate-400 font-mono text-[10px] sm:text-[11px] self-end md:self-auto">
          {currentNotebook.stats}
        </div>
      </div>

      {/* 3. Contenedor del Visor HTML Estático Embebido con iFrame */}
      <div className="liquid-glass rounded-2xl p-1.5 sm:p-3 border border-white/10 shadow-2xl overflow-hidden">
        <div className="w-full bg-[#18181b] rounded-xl overflow-hidden border border-white/5 relative">
          <iframe
            key={currentNotebook.id}
            src={currentNotebook.file}
            title={currentNotebook.title}
            className="w-full h-[78vh] sm:h-[82vh] bg-[#18181b] rounded-lg shadow-inner"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  )
}

export default NotebooksPage
