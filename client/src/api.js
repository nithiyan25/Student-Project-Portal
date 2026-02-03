import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Enable credentials for CORS
});

// Request interceptor - Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivityTime');
      window.location.href = '/';
    }

    // Handle 403 Forbidden - Insufficient permissions
    if (error.response && error.response.status === 403) {
      console.error('Access denied:', error.response.data);
    }

    // Handle 429 Too Many Requests - Rate limit exceeded
    if (error.response && error.response.status === 429) {
      console.error('Rate limit exceeded. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
