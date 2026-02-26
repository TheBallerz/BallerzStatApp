
import Players from './pages/Players';
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';


function Home() {
  return <h2>Welcome to Ballerz</h2>;
}


function Teams() {
  return <h2>Teams Page</h2>;
}


function App() {
  return (
    <div className="app">
      <h1>Ballerz Stat App</h1>
    </div>
  );
}

export default App;