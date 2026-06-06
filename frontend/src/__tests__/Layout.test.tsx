// TopNav uses NavLink which requires Router context — mock the whole component.
jest.mock('../components/layout/TopNav', () => () => <nav>TopNav</nav>);

import { render, screen } from '@testing-library/react';
import Layout from '../components/layout/Layout';

beforeEach(() => jest.clearAllMocks());

describe('Layout', () => {
  test('renders TopNav', () => {
    render(<Layout>content</Layout>);

    expect(screen.getByText('TopNav')).toBeInTheDocument();
  });

  test('renders children inside layout content wrapper', () => {
    render(
      <Layout>
        <p>Hello World</p>
      </Layout>,
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  test('layout-content wrapper contains the children', () => {
    const { container } = render(<Layout>child content</Layout>);

    const wrapper = container.querySelector('.layout-content');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveTextContent('child content');
  });
});
