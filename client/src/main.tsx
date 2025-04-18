import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Define a basic theme (can be customized later)
const theme = createTheme({
  palette: {
    mode: 'light', // Or 'dark'
    primary: {
      main: '#1976d2', // primary color
    },
    secondary: {
      main: '#dc004e', // secondary color
    },
  },
  // we can Add other theme customizations here (typography, components, etc.)
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Provides baseline styling and normalization */}
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
