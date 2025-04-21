import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext'; 

const darkTheme = createTheme({
  palette: {
    mode: 'dark', 
    primary: {
      main: '#a78bfa', 
      // contrastText: '#111827', // Optional: Define text color for primary background
    },
    secondary: {
      main: '#f472b6',
    },
    background: {
      default: '#111827',
      paper: '#1f2937',   
    },
    
    text: {
      primary: '#e5e7eb',   
      secondary: '#9ca3af', 
    },
    // accent color if needed, e.g., for specific highlights
    info: { // Using 'info' palette for the accent color
        main: '#38bdf8', 
    },
    // border color 
    divider: '#374151', 
  },
  // default font family
  typography: {
    fontFamily: '"Outfit", sans-serif',
    // Optionally define specific weights if needed, e.g.,
    // h1: { fontWeight: 700 },
    // button: { fontWeight: 600 },
  },
  // Optional: Customize component defaults
  components: {
    MuiButton: {
        styleOverrides: {
            root: {
                // Example: Add gradient to contained primary buttons
                // Note: Applying gradients directly here can be complex.
                // It might be easier to create custom styled components later.
                // For now, let's rely on the primary color.
                // fontWeight: 600, // Example
            }
        }
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                // Example: Customize input styles if needed beyond palette
            }
        }
    }
    // Add other component customizations
  }
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline /> {/* Provides baseline styling and normalization */}
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
