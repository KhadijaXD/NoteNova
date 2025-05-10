import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';

// Pages
import Home from './pages/Home';
import Note from './pages/Note';
import NotFound from './pages/NotFound';
import Flashcards from './pages/Flashcards';

// Components
import Header from './components/Header';
import Footer from './components/Footer';

// Context
import { ToastProvider } from './contexts/ToastContext';

function App() {
  return (
    <ToastProvider>
      <div className="app-container">
        <Header />
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/note/:id" element={<Note />} />
            <Route path="/note/:id/flashcards" element={<Flashcards />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}

export default App;
