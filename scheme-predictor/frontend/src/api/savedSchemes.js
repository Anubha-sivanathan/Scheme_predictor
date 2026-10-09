import client from './client'

export const getSavedSchemes = () => client.get('/saved-schemes').then((res) => res.data)
