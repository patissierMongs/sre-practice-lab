import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PostList from './pages/PostList';
import PostDetail from './pages/PostDetail';
import PostCreate from './pages/PostCreate';
import SecurityLab from './pages/SecurityLab';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/new" element={<PostCreate />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/security" element={<SecurityLab />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
