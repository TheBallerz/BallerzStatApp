import { render, screen } from '@testing-library/react';
import PlayerBio from '../pages/Players/PlayerBio';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  window.fetch = mockFetch as typeof window.fetch;
});

function makeResponse(body: object, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(body),
  });
}

describe('PlayerBio', () => {
  test('shows loading state before fetch resolves', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<PlayerBio playerId={2544} fullName="LeBron James" team="LAL" />);

    expect(screen.getByText('Loading biography...')).toBeInTheDocument();
  });

  test('displays bio text after a successful fetch', async () => {
    mockFetch.mockReturnValue(
      makeResponse({ bio: 'LeBron James is a forward.' }),
    );

    render(<PlayerBio playerId={2544} fullName="LeBron James" />);

    expect(
      await screen.findByText('LeBron James is a forward.'),
    ).toBeInTheDocument();
  });

  test('renders a source link when sourceUrl is provided', async () => {
    mockFetch.mockReturnValue(
      makeResponse({
        bio: 'Some bio text.',
        sourceUrl: 'https://en.wikipedia.org/wiki/LeBron_James',
      }),
    );

    render(<PlayerBio playerId={2544} fullName="LeBron James" />);

    const link = await screen.findByRole('link', { name: /wikipedia/i });
    expect(link).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/LeBron_James',
    );
  });

  test('does not render source link when sourceUrl is absent', async () => {
    mockFetch.mockReturnValue(makeResponse({ bio: 'Bio text.' }));

    render(<PlayerBio playerId={2544} fullName="LeBron James" />);

    await screen.findByText('Bio text.');
    expect(screen.queryByRole('link')).toBeNull();
  });

  test('shows placeholder bio on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<PlayerBio playerId={2544} fullName="LeBron James" />);

    expect(
      await screen.findByText('Biography unavailable.'),
    ).toBeInTheDocument();
  });

  test('shows placeholder bio when response is not ok', async () => {
    mockFetch.mockReturnValue(makeResponse({}, false));

    render(<PlayerBio playerId={2544} fullName="LeBron James" />);

    expect(
      await screen.findByText('Biography unavailable.'),
    ).toBeInTheDocument();
  });

  test('builds fetch URL with correct playerId and query params', async () => {
    mockFetch.mockReturnValue(makeResponse({ bio: 'Bio.' }));

    render(<PlayerBio playerId={2544} fullName="LeBron James" team="LAL" />);

    await screen.findByText('Bio.');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/players/2544/bio');
    expect(url).toContain('fullName=LeBron+James');
    expect(url).toContain('team=LAL');
  });
});
