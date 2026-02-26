import TeamsPage from "./pages/TeamsPage";
import Players from './pages/Players';
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';


function Home() {
  return <h2>Welcome to Ballerz</h2>;
}


function App() {
  return (
    <div className="app">
      <h1>Ballerz Stat App</h1>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/players">Players</Link>
        <Link to="/teams">Teams</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<Players />} />
        <Route path="/teams" element={<TeamsPage />} />
      </Routes>

    </div>
  );
}



export default App;