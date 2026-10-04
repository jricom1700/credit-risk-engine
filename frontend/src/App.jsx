import React, { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { UnderwritingView } from './components/UnderwritingView'
import { PortfolioStrategyView } from './components/PortfolioStrategyView'
import { NotebooksPage } from './pages/NotebooksPage'
import { checkHealth, getModelMetadata, API_BASE_URL } from './services/api'
import { AlertCircle } from 'lucide-react'

export function App() {
  const [activeTab, setActiveTab] = useState('underwriting')
  const [backendStatus, setBackendStatus] = useState({ healthy: true, checking: true })
  const [modelMetadata, setModelMetadata] = useState(null)

  // Fijación permanente de Tema Oscuro conforme a las directrices de interfaz
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  useEffect(() => {
    let isMounted = true

    const verifyBackend = async () => {
      try {
        const health = await checkHealth()
        if (isMounted) {
          setBackendStatus({ healthy: health.status === 'healthy', checking: false })
        }
        const meta = await getModelMetadata()
        if (isMounted) {
          setModelMetadata(meta)
        }
      } catch {
        if (isMounted) {
          setBackendStatus({ healthy: false, checking: false })
        }
      }
    }

    verifyBackend()
    const interval = setInterval(verifyBackend, 20000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-x-hidden">
      {/* Luces difusas orgánicas de fondo (sutiles en modo oscuro) */}
      <div className="fixed top-[-10%] left-[-5%] w-[50vw] h-[50vw] rounded-full bg-emerald-500/5 blur-[130px] pointer-events-none -z-10" />
      <div className="fixed top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-sky-500/5 blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[20%] w-[50vw] h-[40vw] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none -z-10" />

      {/* Header y Navegación Secundaria */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        modelMetadata={modelMetadata}
      />

      {/* Alerta de Desconexión solo si falla el backend */}
      {!backendStatus.checking && !backendStatus.healthy && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-3 sm:px-4 py-2 text-center text-xs text-rose-300 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">
            No se detectó el backend de FastAPI en <code className="bg-rose-950/40 px-1.5 py-0.5 rounded font-mono">{API_BASE_URL}</code>. Verifica el servicio o inicia localmente con:{' '}
            <code className="bg-rose-950/60 px-2 py-0.5 rounded text-rose-200 font-mono text-[10px] sm:text-[11px]">
              python -m uvicorn app.main:app --port 8000
            </code>
          </span>
        </div>
      )}

      {/* Contenido Principal con padding responsivo */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-6">
        {activeTab === 'underwriting' && <UnderwritingView />}
        {activeTab === 'portfolio' && <PortfolioStrategyView />}
        {(activeTab === 'methodology' || activeTab === 'notebooks') && <NotebooksPage />}
      </main>
    </div>
  )
}

export default App
