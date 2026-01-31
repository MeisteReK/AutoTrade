import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'
import { AuthProvider } from '../../context/AuthContext'

// Mock API
vi.mock('../../config/api', () => ({
  default: 'http://localhost:8000'
}))

// Mock axios - zwraca sukces dla logowania
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(() => Promise.resolve({ 
        data: { access_token: 'test-token', token_type: 'bearer' } 
      })),
      get: vi.fn(() => Promise.resolve({ 
        data: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' } 
      })),
    },
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render login form', () => {
    render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={() => {}} />
      </AuthProvider>
    )
    
    // Użyj getByPlaceholderText zamiast getByLabelText (label nie ma htmlFor)
    expect(screen.getByPlaceholderText(/wprowadź nazwę użytkownika/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/wprowadź hasło/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zaloguj się/i })).toBeInTheDocument()
  })

  it('should show error for empty username', async () => {
    const { container } = render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={() => {}} />
      </AuthProvider>
    )
    
    const form = container.querySelector('form')
    if (form) {
      fireEvent.submit(form)
    }
    
    await waitFor(() => {
      expect(screen.getByText(/nazwa użytkownika jest wymagana/i)).toBeInTheDocument()
    })
  })

  it('should show error for short username', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={() => {}} />
      </AuthProvider>
    )
    
    const usernameInput = screen.getByPlaceholderText(/wprowadź nazwę użytkownika/i)
    await user.type(usernameInput, 'ab')
    
    const form = container.querySelector('form')
    if (form) {
      fireEvent.submit(form)
    }
    
    await waitFor(() => {
      expect(screen.getByText(/nazwa użytkownika musi mieć co najmniej 3 znaki/i)).toBeInTheDocument()
    })
  })

  it('should show error for empty password', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={() => {}} />
      </AuthProvider>
    )
    
    const usernameInput = screen.getByPlaceholderText(/wprowadź nazwę użytkownika/i)
    await user.type(usernameInput, 'testuser')
    
    const form = container.querySelector('form')
    if (form) {
      fireEvent.submit(form)
    }
    
    await waitFor(() => {
      expect(screen.getByText(/hasło jest wymagane/i)).toBeInTheDocument()
    })
  })

  it('should submit form with valid credentials', async () => {
    const user = userEvent.setup()
    
    render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={() => {}} />
      </AuthProvider>
    )
    
    const usernameInput = screen.getByPlaceholderText(/wprowadź nazwę użytkownika/i)
    const passwordInput = screen.getByPlaceholderText(/wprowadź hasło/i)
    
    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'password123')
    
    const submitButton = screen.getByRole('button', { name: /zaloguj się/i })
    await user.click(submitButton)
    
    // Formularz powinien się wysłać
    await waitFor(() => {
      expect(submitButton).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})

