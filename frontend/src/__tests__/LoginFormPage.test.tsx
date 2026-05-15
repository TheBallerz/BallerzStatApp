// Mock Objects: replace the real service module so import.meta.env is never evaluated
jest.mock('../services/authService', () => ({ login: jest.fn() }));
// Mock react-router-dom so useNavigate returns a controllable Dummy function
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import LoginFormPage from '../pages/Login/LoginFormPage';

const mockLogin = login as jest.Mock;
// Dummy: mockNavigate fills the useNavigate() contract but is only used for verification
const mockNavigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
});

describe('LoginFormPage', () => {
  test('renders email and password input fields', () => {
    render(<LoginFormPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  test('shows a validation error when fields are empty and login is clicked', async () => {
    render(<LoginFormPage />);

    // Dummy: no input is provided — fields stay empty
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Email and password are required.')).toBeInTheDocument();
    // Mock verification: login() must not be called when validation fails
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('calls login() with the entered email and password', async () => {
    // Stub: login resolves successfully with no return value
    mockLogin.mockResolvedValue(undefined);

    render(<LoginFormPage />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    // Mock verification: confirm the right credentials were passed to the service
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'pass123');
    });
  });

  test('navigates to "/" after a successful login', async () => {
    // Stub: canned successful response from the auth service
    mockLogin.mockResolvedValue({ token: 'tok', user: { id: 'u1' } });

    render(<LoginFormPage />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    // Mock verification: Dummy mockNavigate was called with the right route
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('displays the backend error message when login fails', async () => {
    // Stub: canned error response simulating invalid credentials
    mockLogin.mockRejectedValue(new Error('Invalid email or password.'));

    render(<LoginFormPage />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'wrong@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'badpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    // Dummy mockNavigate should never be called on failure
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('navigates to "/login" when the back arrow is clicked', () => {
    render(<LoginFormPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    // Mock verification: Dummy mockNavigate called with the back route
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('disables the submit button while the login request is in flight', async () => {
    // Stub: a never-settling promise keeps the component in the loading state
    mockLogin.mockReturnValue(new Promise(() => {}));

    render(<LoginFormPage />);

    fireEvent.change(screen.getByLabelText('Email'),    { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    // The submit arrow must be disabled while loading is true
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
    });
  });
});
