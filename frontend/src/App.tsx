import './App.css';
import { Routes, Route, Link } from 'react-router-dom';


function Home() {
  return <h2>Welcome to Ballerz</h2>;
}

function Players() {
  return <h2>Players Page</h2>;
}


function Teams() {
  return <h2>Teams Page</h2>;
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
        <Route path="/teams" element={<Teams />} />
      </Routes>

    </div>
  );
}

export default App;
