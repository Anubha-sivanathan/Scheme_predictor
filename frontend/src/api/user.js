import client from './client'

export const updateLanguage = (language) =>
  client.put('/users/me/language', { language }).then((res) => res.data)
