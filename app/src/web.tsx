import React from 'react';
import { createRoot } from 'react-dom/client';
import { DokuApp } from './Prototype';
import './prototype.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><DokuApp /></React.StrictMode>);
