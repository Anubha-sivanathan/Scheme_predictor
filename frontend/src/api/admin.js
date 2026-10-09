import client from './client'

export const getAdminSchemes = () => client.get('/admin/schemes').then((res) => res.data)

export const getAdminSchemeById = (id) => client.get(`/admin/schemes/${id}`).then((res) => res.data)

export const createAdminScheme = (data) => client.post('/admin/schemes', data).then((res) => res.data)

export const updateAdminScheme = (id, data) => client.put(`/admin/schemes/${id}`, data).then((res) => res.data)

export const toggleAdminSchemeStatus = (id) => client.patch(`/admin/schemes/${id}/toggle-status`).then((res) => res.data)

export const deleteAdminScheme = (id) => client.delete(`/admin/schemes/${id}`).then((res) => res.data)

// Staging & Ingestion APIs (Phase 8)
export const getPendingStagingSchemes = (status = 'PENDING') =>
  client.get(`/admin/staging?status=${status}`).then((res) => res.data)

export const getStagingSchemeById = (id) =>
  client.get(`/admin/staging/${id}`).then((res) => res.data)

export const importStagingFile = (formData) =>
  client.post('/admin/staging/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data)

export const importStagingJson = (data, params = {}) =>
  client.post('/admin/staging/import-json', data, { params }).then((res) => res.data)

export const updateStagingScheme = (id, data) =>
  client.put(`/admin/staging/${id}`, data).then((res) => res.data)

export const approveStagingScheme = (id) =>
  client.post(`/admin/staging/${id}/approve`).then((res) => res.data)

export const rejectStagingScheme = (id, data) =>
  client.post(`/admin/staging/${id}/reject`, data).then((res) => res.data)
