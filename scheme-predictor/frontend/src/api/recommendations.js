import client from './client'

export const getRecommendations = () => client.get('/recommendations').then((res) => res.data)
