import React from 'react'
import { FileSpreadsheet, Sliders, BookOpen } from 'lucide-react'

export function Navbar({ activeTab, setActiveTab }) {
  return (
    <>
      {/* 1. Header Principal Transparente de Extremo a Extremo */}
      <header className="bg-transparent w-full sticky top-0 z-40">
        <div className="w-full px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Título en el extremo izquierdo */}
            <div className="flex items-center">
              <span className="font-bold text-sm sm:text-lg tracking-tight text-white drop-shadow">
                Credit Risk Engine
              </span>
            </div>

            {/* Acciones en el extremo derecho: Botón "Más sobre el proyecto" */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab('methodology')}
                className={`text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl liquid-glass-interactive cursor-pointer border transition-all ${
                  activeTab === 'methodology' || activeTab === 'notebooks'
                    ? 'bg-emerald-500/25 border-emerald-400/50 text-white font-semibold shadow-lg shadow-emerald-500/20 backdrop-blur-md'
                    : 'text-slate-200 hover:text-white border-white/10 hover:border-white/20'
                }`}
                title="Ver metodología y auditoría de notebooks del motor de riesgo"
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="hidden xs:inline sm:inline">Más sobre el proyecto</span>
                <span className="xs:hidden sm:hidden">Proyecto</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Selector de Vistas Segmentado Tipo Píldora (Estrictamente en una sola fila en móvil) */}
      <nav className="w-full py-1.5 sm:py-2 sticky top-14 sm:top-16 z-30 pointer-events-none">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 flex justify-center pointer-events-auto">
          {/* Segmented Pill Control: flex-row nowrap estricto, rounded-full */}
          <div className="inline-flex items-center liquid-glass p-1 rounded-full shadow-xl border border-white/10 flex-row flex-nowrap justify-center gap-1 max-w-full">
            {/* Píldora 1: Simulación */}
            <button
              type="button"
              onClick={() => setActiveTab('underwriting')}
              className={`flex items-center justify-center space-x-1.5 sm:space-x-2 py-1.5 px-3 sm:px-5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'underwriting'
                  ? 'bg-emerald-500/25 border border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 font-semibold backdrop-blur-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span>Simulación</span>
            </button>

            {/* Píldora 2: Cartera */}
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center justify-center space-x-1.5 sm:space-x-2 py-1.5 px-3 sm:px-5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'portfolio'
                  ? 'bg-emerald-500/25 border border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 font-semibold backdrop-blur-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
              <span>Cartera</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
