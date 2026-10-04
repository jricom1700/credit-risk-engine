import React from 'react'
import { FileSpreadsheet, Sliders, BookOpen, Sun, Moon } from 'lucide-react'

export function Navbar({ activeTab, setActiveTab, theme = 'dark', toggleTheme }) {
  return (
    <>
      {/* 1. Header Principal Transparente de Extremo a Extremo */}
      <header className="bg-transparent w-full sticky top-0 z-40">
        <div className="w-full px-6 sm:px-10 lg:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Título en el extremo izquierdo */}
            <div className="flex items-center">
              <span className={`font-bold text-base sm:text-lg tracking-tight ${theme === 'dark' ? 'text-white drop-shadow' : 'text-slate-900 font-extrabold'}`}>
                Credit Risk Engine
              </span>
            </div>

            {/* Acciones en el extremo derecho: Switch de Tema (Luna y Sol) y Botón "Más sobre el proyecto" */}
            <div className="flex items-center gap-3">
              {/* Switch deslizante interactivo con Luna y Sol */}
              <div className="flex items-center" title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  onClick={toggleTheme}
                  className={`relative inline-flex items-center h-8 w-16 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 cursor-pointer shadow-inner border ${
                    theme === 'dark'
                      ? 'bg-slate-900/90 border-white/20 hover:border-white/30'
                      : 'bg-slate-200/90 border-slate-300 shadow-slate-300/60 hover:border-slate-400'
                  }`}
                  aria-label="Alternar modo claro y oscuro"
                >
                  {/* Icono de Sol a la izquierda (Modo Claro) */}
                  <Sun
                    className={`w-3.5 h-3.5 absolute left-2 transition-all duration-300 ${
                      theme === 'dark' ? 'text-amber-400/30' : 'text-amber-500 font-bold opacity-100'
                    }`}
                  />

                  {/* Icono de Luna a la derecha (Modo Oscuro) */}
                  <Moon
                    className={`w-3.5 h-3.5 absolute right-2 transition-all duration-300 ${
                      theme === 'dark' ? 'text-indigo-400 opacity-100' : 'text-slate-400/30'
                    }`}
                  />

                  {/* Knob deslizante con icono activo */}
                  <span
                    className={`w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${
                      theme === 'dark'
                        ? 'translate-x-8 bg-slate-800 border border-indigo-400/40 text-indigo-300 shadow-indigo-950/50'
                        : 'translate-x-0 bg-white border border-amber-300/80 text-amber-500 shadow-amber-500/20'
                    }`}
                  >
                    {theme === 'dark' ? (
                      <Moon className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 fill-current" />
                    )}
                  </span>
                </button>
              </div>

              {/* Botón en la parte superior derecha: "Más sobre el proyecto" */}
              <button
                type="button"
                onClick={() => setActiveTab('methodology')}
                className={`text-xs sm:text-sm font-medium flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl liquid-glass-interactive cursor-pointer border transition-all ${
                  activeTab === 'methodology' || activeTab === 'notebooks'
                    ? theme === 'dark'
                      ? 'bg-emerald-500/25 border-emerald-400/50 text-white font-semibold shadow-lg shadow-emerald-500/20 backdrop-blur-md'
                      : 'bg-emerald-600 border border-emerald-700 text-white font-bold shadow-md'
                    : theme === 'dark'
                    ? 'text-slate-200 hover:text-white border-white/10'
                    : 'text-slate-700 hover:text-slate-900 border-slate-300 font-semibold'
                }`}
                title="Ver metodología y notebooks del motor de riesgo"
              >
                <BookOpen className={`w-4 h-4 ${(activeTab === 'methodology' || activeTab === 'notebooks') && theme === 'light' ? 'text-white' : 'text-emerald-400'}`} />
                <span>Más sobre el proyecto</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegación Secundaria Liquid Glass (Solo los 2 simuladores principales) */}
      <nav className="w-full py-2 sticky top-16 z-30 pointer-events-none">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 flex justify-center pointer-events-auto">
          <div className="inline-flex items-center liquid-glass p-1.5 rounded-2xl shadow-xl border border-white/10 gap-1.5 flex-wrap justify-center">
            {/* Pestaña 1: Originación Individual */}
            <button
              onClick={() => setActiveTab('underwriting')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'underwriting'
                  ? theme === 'dark'
                    ? 'bg-emerald-500/25 border border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 font-semibold backdrop-blur-md'
                    : 'bg-emerald-600 border border-emerald-700 text-white shadow-md font-bold'
                  : theme === 'dark'
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent font-medium'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'underwriting' && theme === 'light' ? 'text-white' : 'text-emerald-400'}`} />
              <span>Originación Individual</span>
            </button>

            {/* Pestaña 2: Estrategia de Cartera */}
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'portfolio'
                  ? theme === 'dark'
                    ? 'bg-emerald-500/25 border border-emerald-400/40 text-white shadow-lg shadow-emerald-500/20 font-semibold backdrop-blur-md'
                    : 'bg-teal-600 border border-teal-700 text-white shadow-md font-bold'
                  : theme === 'dark'
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent font-medium'
              }`}
            >
              <Sliders className={`w-4 h-4 ${activeTab === 'portfolio' && theme === 'light' ? 'text-white' : 'text-teal-400'}`} />
              <span>Estrategia de Cartera</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}
