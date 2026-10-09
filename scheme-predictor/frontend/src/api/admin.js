import client from './client'

export const getAdminSchemes = () => client.get('/admin/schemes').then((res) => res.data)

export const getAdminSchemeById = (id) => client.get(`/admin/schemes/${id}`).then((res) => res.data)

export const createAdminScheme = (data) => client.post('/admin/schemes', data).then((res) => res.data)

export const updateAdminScheme = (id, data) => client.put(`/admin/schemes/${id}`, data).then((res) => res.data)

export const toggleAdminSchemeStatus = (id) => client.patch(`/admin/schemes/${id}/toggle-status`).then((res) => res.data)

export const deleteAdminScheme = (id) => client.delete(`/admin/schemes/${id}`).then((res) => res.data)
