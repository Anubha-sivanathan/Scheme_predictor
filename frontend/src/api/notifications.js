import client from './client'

export const getNotifications = () => client.get('/notifications').then((res) => res.data)
export const markNotificationRead = (id) => client.put(`/notifications/${id}/read`).then((res) => res.data)
export const deleteNotification = (id) => client.delete(`/notifications/${id}`).then((res) => res.data)
