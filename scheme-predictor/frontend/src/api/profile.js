import client from './client'

export const getProfile = () => client.get('/profile').then((res) => res.data)
export const updateProfile = (data) => client.put('/profile', data).then((res) => res.data)
