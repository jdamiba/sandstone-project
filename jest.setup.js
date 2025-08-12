import "@testing-library/jest-dom";

// Mock environment variables
process.env.NEXT_PUBLIC_COLLABORATION_URL = "http://localhost:3002";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "test_key";
process.env.CLERK_SECRET_KEY = "test_secret";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

// Mock fetch globally
global.fetch = jest.fn();

// Mock Socket.IO
jest.mock("socket.io-client", () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Clerk authentication
jest.mock("@clerk/nextjs", () => ({
  auth: jest.fn(() => Promise.resolve({ userId: "test-user-id" })),
  currentUser: jest.fn(() =>
    Promise.resolve({
      id: "test-user-id",
      first_name: "Test",
      last_name: "User",
    })
  ),
  useAuth: jest.fn(() => ({
    isSignedIn: true,
    userId: "test-user-id",
  })),
  SignInButton: ({ children }) => children,
  SignUpButton: ({ children }) => children,
  UserButton: () => "UserButton",
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
