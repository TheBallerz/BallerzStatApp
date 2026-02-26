import { NavLink } from "react-router-dom";
import "./topNav.css";

type NavItem = {
  label: string;
  path: string;
};

const navItems: NavItem[] = [
  { label: "Home",       path: "/"          },
  { label: "Teams",      path: "/teams"     },
  { label: "Players",    path: "/players"   },
  { label: "Favorites",  path: "/favorites" },
  { label: "Standings",  path: "/standings" },
  { label: "Schedule",   path: "/schedule"  },
  { label: "Account",    path: "/account"   },
];

export default function TopNav() {
  return (
    <div className="topbar">
      <nav className="navpill">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `navitem${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button className="searchpill" type="button">
        Search
      </button>
    </div>
  );
}
