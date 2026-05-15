// Mock Object: replace react-router-dom with a controllable NavLink stub.
// The real NavLink requires a Router context which pulls in TextEncoder — a Node
// built-in that jsdom does not expose without extra polyfilling. Mocking the
// module avoids that dependency entirely and lets us control isActive directly.
jest.mock('react-router-dom', () => ({ NavLink: jest.fn(), }));

import { render, screen } from '@testing-library/react';
import { NavLink } from 'react-router-dom';
import TopNav from '../components/layout/TopNav';

const mockNavLink = NavLink as unknown as jest.Mock;

// Stub: NavLink renders a plain <a> and calls the className function with a
// controllable isActive flag so we can test both active and inactive states.
function setupNavLink(isActive: boolean) {
  mockNavLink.mockImplementation(
    ({ to, children, className }: {
      to: string;
      children: React.ReactNode;
      className: (opts: { isActive: boolean }) => string;
    }) => {
      const cls = typeof className === 'function' ? className({ isActive }) : className;
      return <a href={to} className={cls}>{children}</a>;
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setupNavLink(false); // default: no link is active
});

describe('TopNav', () => {
  test('renders all eight nav link labels', () => {
    render(<TopNav />);

    ['Home', 'Teams', 'Players', 'Fantasy', 'Favorites', 'Standings', 'Schedule', 'Account'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  test('renders the Search button', () => {
    render(<TopNav />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  test('applies the "active" class when NavLink reports isActive true', () => {
    // Stub: all links appear active — verifies the className callback is wired correctly
    setupNavLink(true);

    render(<TopNav />);

    expect(screen.getByText('Standings')).toHaveClass('active');
  });

  test('does not apply the "active" class when NavLink reports isActive false', () => {
    render(<TopNav />); // default stub: isActive = false

    expect(screen.getByText('Teams')).not.toHaveClass('active');
    expect(screen.getByText('Home')).not.toHaveClass('active');
  });

  test('renders one link per nav item (eight total)', () => {
    render(<TopNav />);

    expect(screen.getAllByRole('link')).toHaveLength(8);
  });

  test('each link has the correct href', () => {
    render(<TopNav />);

    expect(screen.getByRole('link', { name: 'Standings' })).toHaveAttribute('href', '/standings');
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('href', '/teams');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});
