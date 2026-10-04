import React from 'react'
import { PortfolioStrategyView } from '../components/PortfolioStrategyView'

/**
 * Página principal de Estrategia de Cartera y Simulación de Riesgo de Crédito.
 * Re-exporta el motor interactivo de simulación vectorial de cartera.
 */
export function PortfolioPage(props) {
  return <PortfolioStrategyView {...props} />
}

export { PortfolioStrategyView }
export default PortfolioPage
