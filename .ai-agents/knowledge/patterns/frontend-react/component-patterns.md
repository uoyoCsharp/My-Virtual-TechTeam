# React Component Patterns

## Component Types

### Presentational Components

Focus on how things look. Receive data via props.

```tsx
interface UserCardProps {
  name: string;
  email: string;
  avatar?: string;
}

export function UserCard({ name, email, avatar }: UserCardProps) {
  return (
    <div className="user-card">
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
}
```

### Container Components

Focus on how things work. Provide data and behavior.

```tsx
export function UserCardContainer({ userId }: { userId: string }) {
  const { user, isLoading, error } = useUser(userId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return null;

  return <UserCard {...user} />;
}
```

### Compound Components

Components that work together as a group.

```tsx
// Tabs compound component
<Tabs>
  <Tabs.List>
    <Tabs.Tab value="profile">Profile</Tabs.Tab>
    <Tabs.Tab value="settings">Settings</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="profile">
    <ProfileContent />
  </Tabs.Panel>
  <Tabs.Panel value="settings">
    <SettingsContent />
  </Tabs.Panel>
</Tabs>
```

## Component Composition

### Slots Pattern

```tsx
interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ header, children, footer }: CardProps) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// Usage
<Card
  header={<CardTitle>Title</CardTitle>}
  footer={<CardActions>...</CardActions>}
>
  Content here
</Card>
```

### Render Props

```tsx
interface DataFetcherProps<T> {
  url: string;
  render: (data: T) => React.ReactNode;
  loading?: React.ReactNode;
  error?: (error: Error) => React.ReactNode;
}

export function DataFetcher<T>({
  url,
  render,
  loading,
  error
}: DataFetcherProps<T>) {
  const { data, isLoading, error: err } = useFetch<T>(url);

  if (isLoading) return <>{loading}</>;
  if (err) return <>{error?.(err)}</>;

  return <>{render(data)}</>;
}
```

## Common Hooks Patterns

### Form Handling

```tsx
function useForm<T extends Record<string, unknown>>(
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = (field: keyof T) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setValues(prev => ({ ...prev, [field]: e.target.value }));
  };

  const setFieldError = (field: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  };

  const clearErrors = () => setErrors({});

  const reset = () => {
    setValues(initialValues);
    clearErrors();
  };

  return {
    values,
    errors,
    handleChange,
    setFieldError,
    clearErrors,
    reset,
  };
}
```

### Toggle Pattern

```tsx
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);

  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse };
}
```

### Async Operation

```tsx
function useAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error';
    data: T | null;
    error: E | null;
  }>({
    status: 'idle',
    data: null,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ status: 'pending', data: null, error: null });
    try {
      const data = await asyncFunction();
      setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      setState({ status: 'error', data: null, error: error as E });
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) execute();
  }, [immediate, execute]);

  return { ...state, execute };
}
```

### Debounced Value

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## Component Patterns for Specific Use Cases

### Modal/Dialog

```tsx
function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  return { isOpen, open, close, toggle };
}

// Usage
function MyComponent() {
  const modal = useModal();

  return (
    <>
      <Button onClick={modal.open}>Open Modal</Button>
      <Modal isOpen={modal.isOpen} onClose={modal.close}>
        Content
      </Modal>
    </>
  );
}
```

### Infinite Scroll

```tsx
function useInfiniteScroll(
  callback: () => void,
  options: { threshold?: number } = {}
) {
  const { threshold = 100 } = options;
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [callback, threshold]);

  return loaderRef;
}
```

## Best Practices Summary

1. **Prefer composition** over inheritance
2. **Keep components small** and focused
3. **Lift state up** only as high as needed
4. **Extract custom hooks** for reusable logic
5. **Use TypeScript** for props and state
6. **Handle all states**: loading, error, empty, success
7. **Memoize wisely** - profile before optimizing
