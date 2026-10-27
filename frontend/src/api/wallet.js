import client from './client'

export const getDocuments = () => client.get('/wallet').then((res) => res.data)

export const uploadDocument = (documentType, file) => {
  const formData = new FormData()
  formData.append('documentType', documentType)
  formData.append('file', file)
  return client
    .post('/wallet/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data)
}

export const verifyDocumentFields = (id, fields) =>
  client.put(`/wallet/${id}/verify`, fields).then((res) => res.data)

export const deleteDocument = (id) => client.delete(`/wallet/${id}`).then((res) => res.data)

export const syncWallet = () => client.post('/wallet/sync').then((res) => res.data)

// ---- Sharing ----
export const createShare = (id, { permission, expiresInHours, acknowledgeRisk }) =>
  client.post(`/wallet/${id}/shares`, { permission, expiresInHours, acknowledgeRisk }).then((res) => res.data)

export const getShares = (id) => client.get(`/wallet/${id}/shares`).then((res) => res.data)

export const revokeShare = (id, shareId) =>
  client.delete(`/wallet/${id}/shares/${shareId}`).then((res) => res.data)

export const getShareEvents = (id, shareId) =>
  client.get(`/wallet/${id}/shares/${shareId}/events`).then((res) => res.data)

// ---- Versions ----
export const getVersions = (id) => client.get(`/wallet/${id}/versions`).then((res) => res.data)

export const uploadVersion = (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return client
    .post(`/wallet/${id}/versions`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data)
}

export const restoreVersion = (id, versionNumber) =>
  client.post(`/wallet/${id}/versions/${versionNumber}/restore`).then((res) => res.data)

// ---- Profile review ----
// Profile values that a confirmed document disagrees with. Nothing changes until the user accepts a field.
export const getProfileChanges = (id) => client.get(`/wallet/${id}/profile-changes`).then((res) => res.data)

export const applyProfileChanges = (id, fields) =>
  client.post(`/wallet/${id}/profile-changes/apply`, { fields }).then((res) => res.data)
