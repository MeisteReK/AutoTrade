import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from './RegisterForm'
import { AuthProvider } from '../../context/AuthContext'

// Mock API
vi.mock('../../config/api', () => ({
  default: 'http://localhost:8000'
}))

// Mock axios - zwraca sukces dla rejestracji
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios')
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(() => Promise.resolve({ 
        data: { id: 1, username: 'newuser', email: 'newuser@example.com' } 
      })),
      get: vi.fn(() => Promise.resolve({ 
        data: { id: 1, username: 'newuser', email: 'newuser@example.com', role: 'user' } 
      })),
    },
  }
})

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render register form', () => {
    render(
      <AuthProvider>
        <RegisterForm onSwitchToLogin={() => {}} />
      </AuthProvider>
    )
    
    // Użyj getByPlaceholderText zamiast getByLabelText (label nie ma htmlFor)
    expect(screen.getByPlaceholderText(/min\. 3 znaki/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/twoj@email\.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/min\. 8 znaków/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/powtórz hasło/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zarejestruj się/i })).toBeInTheDocument()
  })

  it('should show error for invalid email', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <AuthProvider>
        <RegisterForm onSwitchToLogin={() => {}} />
      </AuthProvider>
    )
    
    // Wypełnij wymagane pola
    const usernameInput = screen.getByPlaceholderText(/min\. 3 znaki/i)
    await user.type(usernameInput, 'testuser')
    
    const emailInput = screen.getByPlaceholderText(/twoj@email\.com/i)
    await user.type(emailInput, 'invalid-email')
    
    const passwordInput = screen.getByPlaceholderText(/min\. 8 znaków/i)
    await user.type(passwordInput, 'Password123!')
    
    const confirmPasswordInput = screen.getByPlaceholderText(/powtórz hasło/i)
    await user.type(confirmPasswordInput, 'Password123!')
    
    const form = container.querySelector('form')
    if (form) {
      fireEvent.submit(form)
    }
    
    await waitFor(() => {
      expect(screen.getByText(/podaj poprawny adres email/i)).toBeInTheDocument()
    })
  })

  it('should show error for password mismatch', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <RegisterForm onSwitchToLogin={() => {}} />
      </AuthProvider>
    )
    
    const passwordInput = screen.getByPlaceholderText(/min\. 8 znaków/i)
    const confirmPasswordInput = screen.getByPlaceholderText(/powtórz hasło/i)
    
    await user.type(passwordInput, 'Password123!')
    await user.type(confirmPasswordInput, 'Different123!')
    
    const submitButton = screen.getByRole('button', { name: /zarejestruj się/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/hasła nie są identyczne/i)).toBeInTheDocument()
    })
  })

  it('should show password requirements', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <RegisterForm onSwitchToLogin={() => {}} />
      </AuthProvider>
    )
    
    const passwordInput = screen.getByPlaceholderText(/min\. 8 znaków/i)
    await user.type(passwordInput, 'test')
    
    await waitFor(() => {
      expect(screen.getByText(/co najmniej 8 znaków/i)).toBeInTheDocument()
    })
  })
})

