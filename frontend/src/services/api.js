import axios from 'axios'

// Conexión directa al backend FastAPI en http://localhost:8000 (o variable de entorno si existe)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}

export const getModelMetadata = async () => {
  const response = await api.get('/api/v1/model-metadata')
  return response.data
}

export const getScorecardTable = async () => {
  const response = await api.get('/api/v1/scorecard-table')
  return response.data
}

export const scoreIndividual = async (payload) => {
  const response = await api.post('/api/v1/score', payload)
  return response.data
}

export const simulatePortfolio = async (payload) => {
  const response = await api.post('/api/v1/simulate-portfolio', payload)
  return response.data
}

export default api
