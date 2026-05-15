// Mock Objects: replace service modules (import.meta.env blockers) and the two
// step sub-components (which also use import.meta.env for player/team search).
jest.mock('../services/authService', () => ({ register: jest.fn() }));
jest.mock('../services/favoritesService', () => ({ saveFavorites: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));
// Dummy components: render a testid so tests can confirm which step is active,
// without loading the real files (which contain import.meta.env).
jest.mock('../pages/GetStarted/GetStartedStep2', () => ({
  __esModule: true,
  default: () => <div data-testid="step2" />,
}));
jest.mock('../pages/GetStarted/GetStartedStep3', () => ({
  __esModule: true,
  default: () => <div data-testid="step3" />,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { register } from '../services/authService';
import { saveFavorites } from '../services/favoritesService';
import { useNavigate } from 'react-router-dom';
import GetStartedPage from '../pages/GetStarted/GetStartedPage';

const mockRegister = register as jest.Mock;
const mockSaveFavorites = saveFavorites as unknown as jest.Mock;
// Dummy: mockNavigate fills the useNavigate() contract but is only used for verification
const mockNavigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  // saveFavorites must have a default resolved value so step-2/3 Next clicks don't hang
  mockSaveFavorites.mockResolvedValue(undefined);
});

// Helper: fill all Step 1 fields with values that pass every validation rule
function fillStep1({
  firstName = 'Ken',
  lastName = 'Suon',
  email = 'ken@example.com',
  password = 'Secret1!',
  confirmPassword = 'Secret1!',
} = {}) {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: firstName } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: lastName } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirmPassword } });
}

describe('GetStartedPage — Step 1', () => {
  test('renders all five account-info fields', () => {
    render(<GetStartedPage />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  test('shows a validation error when any field is empty', async () => {
    render(<GetStartedPage />);

    // Dummy: no input provided — all fields stay empty
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    expect(await screen.findByText('All fields are required.')).toBeInTheDocument();
    // Mock verification: register must not be called when validation fails
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('shows a password-rules error when the password is too weak', async () => {
    render(<GetStartedPage />);

    fillStep1({ password: 'weakpass', confirmPassword: 'weakpass' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    expect(
      await screen.findByText(
        'Password must be at least 8 characters and include an uppercase letter and a special character.',
      ),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('shows a mismatch error when passwords differ', async () => {
    render(<GetStartedPage />);

    fillStep1({ password: 'Secret1!', confirmPassword: 'Different1!' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('calls register() with the correct arguments on valid submission', async () => {
    // Stub: register resolves successfully
    mockRegister.mockResolvedValue(undefined);

    render(<GetStartedPage />);

    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    // Mock verification: the right credentials were forwarded to the service
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Ken', 'Suon', 'ken@example.com', 'Secret1!');
    });
  });

  test('advances to step 2 after a successful registration', async () => {
    mockRegister.mockResolvedValue(undefined);

    render(<GetStartedPage />);

    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    // Dummy GetStartedStep2 renders a testid div — its presence confirms step changed
    expect(await screen.findByTestId('step2')).toBeInTheDocument();
    // Step 1 fields are unmounted
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
  });

  test('displays the backend error message when register() rejects', async () => {
    // Stub: canned error from the server
    mockRegister.mockRejectedValue(new Error('An account with this email already exists.'));

    render(<GetStartedPage />);

    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
    // Dummy mockNavigate must not be called on failure
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('disables the Next button while the register request is in flight', async () => {
    // Stub: never-settling promise keeps loading === true
    mockRegister.mockReturnValue(new Promise(() => {}));

    render(<GetStartedPage />);

    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Go to next step' })).toBeDisabled();
    });
  });

  test('navigates to "/login" when the back arrow is clicked on step 1', () => {
    render(<GetStartedPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    // Mock verification: Dummy mockNavigate called with the login route
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

describe('GetStartedPage — Step 2 → 3 → finish', () => {
  // Helper: complete step 1 and advance to step 2
  async function advanceToStep2() {
    mockRegister.mockResolvedValue(undefined);
    render(<GetStartedPage />);
    fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));
    await screen.findByTestId('step2');
  }

  test('the back arrow on step 2 returns to step 1', async () => {
    await advanceToStep2();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    // Step 1 fields reappear — confirms we went back
    expect(await screen.findByLabelText('First Name')).toBeInTheDocument();
  });

  test('advances from step 2 to step 3 when Next is clicked', async () => {
    await advanceToStep2();

    // No players selected — Next simply calls setStep(3)
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    expect(await screen.findByTestId('step3')).toBeInTheDocument();
  });

  test('navigates to "/" when Next is clicked on step 3 with no teams selected', async () => {
    await advanceToStep2();

    // Advance step 2 → 3
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));
    await screen.findByTestId('step3');

    // Advance step 3 → finish (no teams selected, so navigate immediately)
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
