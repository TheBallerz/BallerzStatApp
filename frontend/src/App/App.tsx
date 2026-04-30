import TeamsPage from '../pages/Teams/TeamsPage';
import Players from '../pages/Players/Players';
import LoginPage from "../pages/Login/LoginPage";
import LoginFormPage from "../pages/Login/LoginFormPage";
import GetStartedPage from "../pages/GetStarted/GetStartedPage";
import HomePage from "../pages/Home/HomePage";
import FavoritesPage from "../pages/Favorites/FavoritesPage";
import StandingsPage from "../pages/Standings/StandingsPage";
/*import PlayersPage from "./pages/PlayersPage";*/
import SchedulePage from "../pages/Schedule/SchedulePage";
import AccountPage from "../pages/AccountPage";
import './App.css';
import { Routes, Route} from 'react-router-dom';
import Layout from "../components/layout/Layout";



function App() {
  return (
      <Routes>
      {/* Login is a standalone full-screen page — no nav bar */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login-form" element={<LoginFormPage />} />
            <Route path="/get-started" element={<GetStartedPage />} />
      
            {/* All other routes share the fixed nav Layout */}
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/"          element={<HomePage />}      />
                    <Route path="/teams"     element={<TeamsPage />}     />
                    <Route path="/players"   element={<Players />}   />
                    <Route path="/favorites" element={<FavoritesPage />} />
                    <Route path="/standings" element={<StandingsPage />} />
                    <Route path="/schedule"  element={<SchedulePage />}  />
                    <Route path="/account"   element={<AccountPage />}   />
                  </Routes>
                </Layout>
              }
            />  

      </Routes>

  );
}

export default App;
