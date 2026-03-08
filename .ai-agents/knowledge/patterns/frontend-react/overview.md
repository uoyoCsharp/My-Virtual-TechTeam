# Frontend (React) Pattern

Modern React application patterns for scalable, maintainable frontend development.

## When to Use

This pattern is suitable for:

- **Single Page Applications (SPA)**
- **Next.js / Remix applications**
- **React-based web applications**
- **Progressive Web Apps (PWA)**

## Project Structure

### Standard Structure

| Directory/File | Purpose |
|----------------|---------|
| `src/app/` | App-level configuration, providers |
| `src/app/App.tsx` | Main application component |
| `src/app/providers.tsx` | Context providers |
| `src/app/router.tsx` | Route configuration |
| `src/features/` | Feature-based modules |
| `src/features/auth/` | Authentication feature module |
| `src/features/auth/components/` | Auth-specific components |
| `src/features/auth/hooks/` | Auth-specific hooks |
| `src/features/auth/api.ts` | Auth API calls |
| `src/features/auth/types.ts` | Auth TypeScript types |
| `src/features/dashboard/` | Dashboard feature module |
| `src/components/` | Shared components |
| `src/components/ui/` | Basic UI components |
| `src/components/forms/` | Form components |
| `src/components/layout/` | Layout components |
| `src/hooks/` | Shared custom hooks |
| `src/lib/` | Utilities, helpers |
| `src/api/` | API client, endpoints |
| `src/types/` | Shared TypeScript types |
| `src/styles/` | Global styles |

### Next.js App Router Structure

| Directory/File | Purpose |
|----------------|---------|
| `app/(auth)/` | Route groups for authentication |
| `app/(auth)/login/` | Login page |
| `app/(auth)/register/` | Register page |
| `app/dashboard/` | Dashboard pages |
| `app/api/` | API routes |
| `app/layout.tsx` | Root layout |
| `app/page.tsx` | Home page |
| `components/ui/` | Shared UI components |
| `components/features/` | Feature components |
| `lib/utils/` | Utility functions |

## Component Patterns

### Component Organization

```tsx
// Feature component with co-located files
// features/user/components/UserCard.tsx
// features/user/hooks/useUser.ts
// features/user/types.ts

// Component structure
interface UserCardProps {
  userId: string;
}

export function UserCard({ userId }: UserCardProps) {
  const { user, isLoading } = useUser(userId);

  if (isLoading) return <UserCardSkeleton />;
  if (!user) return null;

  return (
    <div className="user-card">
      {/* ... */}
    </div>
  );
}
```

### Component Principles

1. **Single Responsibility**: One purpose per component
2. **Composition over Inheritance**: Build with composition
3. **Props Interface**: Clear, typed props
4. **Error Boundaries**: Handle errors gracefully

## State Management

### Decision Guide

| Complexity | Recommended Solution |
|------------|---------------------|
| Local UI state | `useState` |
| Complex local state | `useReducer` |
| Shared state (simple) | Context + `useState` |
| Shared state (complex) | Zustand / Jotai |
| Server state | React Query / SWR |
| Global complex state | Redux Toolkit |

### Local State

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Context Pattern

```tsx
// 1. Create context
const ThemeContext = createContext<ThemeContextValue | null>(null);

// 2. Provider component
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 3. Custom hook for consumption
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Hooks Patterns

### Custom Hooks

```tsx
// Reusable data fetching hook
function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const data = await api.getUser(id);
        if (!cancelled) setUser(data);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; };
  }, [id]);

  return { user, isLoading, error };
}
```

### Hook Rules

- Call at the top level only
- Only call from React functions
- Name with `use` prefix
- Return stable references

## Data Fetching

### React Query Pattern (Recommended)

```tsx
function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {data.map(user => <UserItem key={user.id} user={user} />)}
    </ul>
  );
}
```

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserCard.tsx` |
| Hook | camelCase with use prefix | `useUser.ts` |
| Utility | camelCase | `formatDate.ts` |
| Type | camelCase | `user.types.ts` |
| Test | same name + .test | `UserCard.test.tsx` |
| Style module | same name + .module | `UserCard.module.css` |

## Performance Patterns

### Memoization

```tsx
// Memoize expensive components
const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  return (
    <ul>
      {items.map(item => <Item key={item.id} {...item} />)}
    </ul>
  );
});

// Memoize expensive computations
function Dashboard({ data }: Props) {
  const processedData = useMemo(
    () => data.filter(/* ... */).map(/* ... */),
    [data]
  );

  return <ExpensiveList items={processedData} />;
}

// Memoize callbacks
const handleSubmit = useCallback(
  (values: FormValues) => {
    submitForm(values);
  },
  [/* deps */]
);
```

### Code Splitting

```tsx
// Lazy load components
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}
```

## Testing Strategy

### Component Testing

```tsx
// UserCard.test.tsx
describe('UserCard', () => {
  it('renders user information', () => {
    render(<UserCard user={mockUser} />);
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    render(<UserCard isLoading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

## Anti-Patterns to Avoid

- Prop drilling (use context/state management)
- Mutable state directly
- Stale closures in effects
- Missing effect dependencies
- Large, monolithic components
- Fetching in render (use effects or React Query)
