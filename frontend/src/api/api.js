import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL;

if (!API_BASE_URL) {
  console.error("REACT_APP_API_URL is not defined");
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default api;
