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
