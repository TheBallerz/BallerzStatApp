import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import TeamsPage from "./pages/TeamsPage";
import PlayersPage from "./pages/PlayersPage";
import FavoritesPage from "./pages/FavoritesPage";
import StandingsPage from "./pages/StandingsPage";
import SchedulePage from "./pages/SchedulePage";
import AccountPage from "./pages/AccountPage";

function App() {
  return (
    <Routes>
      {/* Login is a standalone full-screen page — no nav bar */}
      <Route path="/login" element={<LoginPage />} />

      {/* All other routes share the fixed nav Layout */}
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/"          element={<HomePage />}      />
              <Route path="/teams"     element={<TeamsPage />}     />
              <Route path="/players"   element={<PlayersPage />}   />
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
