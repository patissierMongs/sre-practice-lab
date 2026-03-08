import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import PostCreate from './pages/PostCreate';
import SecurityLab from './pages/SecurityLab';
import NetworkMonitor from './pages/NetworkMonitor';

function AppContent() {
  const location = useLocation();
  const isNetworkPage = location.pathname === '/network';

  return (
    <>
      <Navbar />
      {isNetworkPage ? (
        <NetworkMonitor />
      ) : (
        <div className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/posts" element={<PostList />} />
            <Route path="/posts/new" element={<PostCreate />} />
            <Route path="/posts/:id" element={<PostDetail />} />
            <Route path="/security" element={<SecurityLab />} />
            <Route path="/network" element={null} />
          </Routes>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
