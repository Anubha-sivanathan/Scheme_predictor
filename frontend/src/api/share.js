import axios from 'axios'
import { API_BASE_URL } from './client'

// Public endpoints: deliberately a bare axios instance so no account credentials are ever sent with a share link.
const publicClient = axios.create({ baseURL: API_BASE_URL })

export const getSharedInfo = (token) =>
  publicClient.get(`/share/${encodeURIComponent(token)}`).then((res) => res.data)

export const sharedViewUrl = (token) => `${API_BASE_URL}/share/${encodeURIComponent(token)}/view`
export const sharedDownloadUrl = (token) => `${API_BASE_URL}/share/${encodeURIComponent(token)}/download`
