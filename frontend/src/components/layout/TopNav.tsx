type NavItem = {
    label: string;
    active?: boolean;
    onClick?: () => void;
  };
  
  const navItems: NavItem[] = [
    { label: "Home" },
    { label: "Teams", active: true },
    { label: "Players" },
    { label: "Favorites" },
    { label: "Standings" },
    { label: "Schedule" },
    { label: "Account" }
  ];
  
  export default function TopNav() {
    return (
      <div className="topbar">
        <div className="navpill">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`navitem ${item.active ? "active" : ""}`}
              onClick={item.onClick}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
  
        <button className="searchpill" type="button">
          Search
        </button>
      </div>
    );
  }