import client from './client'

export const getSchemeHistory = () => client.get('/scheme-history').then((res) => res.data)
