import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const tree = <App />

createRoot(document.getElementById('root')!).render(
  PUBLISHABLE_KEY
    ? <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{tree}</ClerkProvider>
    : tree
)
