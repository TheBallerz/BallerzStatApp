import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Players from './pages/Players';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/players" element={<Players />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;