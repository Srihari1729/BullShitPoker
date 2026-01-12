import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './storage'; // Initialize storage adapter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
