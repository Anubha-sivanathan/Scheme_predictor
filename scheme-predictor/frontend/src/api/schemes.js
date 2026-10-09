import client from './client'

export const getSchemes = () => client.get('/schemes').then((res) => res.data)
export const searchSchemes = (query) =>
  client.get('/schemes/search', { params: { q: query } }).then((res) => res.data)
export const getSchemesByCategory = (category) =>
  client.get(`/schemes/category/${encodeURIComponent(category)}`).then((res) => res.data)
export const getSchemeById = (id) => client.get(`/schemes/${id}`).then((res) => res.data)
export const saveScheme = (id) => client.post(`/schemes/${id}/save`).then((res) => res.data)
export const unsaveScheme = (id) => client.delete(`/schemes/${id}/save`).then((res) => res.data)
