import { Container, Typography } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ChatsPage from './pages/ChatsPage';
import ChatInterfacePage from './pages/ChatInterfacePage'; 
import { AuthProvider } from './contexts/AuthContext'; 

function App() {
  return (
    <AuthProvider> 
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

         
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/chat/:conversationId" 
            element={
              <ProtectedRoute>
                <ChatInterfacePage />
              </ProtectedRoute>
            }
          />
          

          
          <Route path="*" element={<Typography sx={{ textAlign: 'center', mt: 5 }}>404 - Page Not Found</Typography>} />
        </Routes>
      </Container>
    </AuthProvider>
  )
}

export default App
