# React Code Review Checklist

## Component Structure

- [ ] Component has single responsibility
- [ ] Component is properly typed (TypeScript)
- [ ] Props interface is defined and documented
- [ ] Default values provided where appropriate
- [ ] Component handles loading states
- [ ] Component handles error states

## React Best Practices

- [ ] Keys are used correctly in lists (not index)
- [ ] useEffect dependencies are complete
- [ ] Cleanup functions provided in effects
- [ ] State updates are immutable
- [ ] useCallback/useMemo used appropriately (not prematurely)
- [ ] No direct DOM manipulation

## Performance

- [ ] No unnecessary re-renders
- [ ] Large lists are virtualized if needed
- [ ] Images are optimized
- [ ] Code splitting applied for large features
- [ ] Lazy loading used where appropriate

## State Management

- [ ] State is as local as possible
- [ ] Derived state is computed, not stored
- [ ] Context is not overused
- [ ] Server state uses proper solution (React Query/SWR)

## Hooks

- [ ] Custom hooks follow naming convention (use*)
- [ ] Hooks are at top level of component
- [ ] Custom hooks return stable references
- [ ] Hook dependencies are correct

## Accessibility

- [ ] Semantic HTML elements used
- [ ] ARIA attributes where needed
- [ ] Focus management considered
- [ ] Keyboard navigation works
- [ ] Screen reader tested

## Error Handling

- [ ] Error boundaries used appropriately
- [ ] API errors are handled
- [ ] User sees meaningful error messages
- [ ] Errors are logged appropriately

## Code Quality

- [ ] No console.log in production code
- [ ] No commented out code
- [ ] Consistent formatting
- [ ] Meaningful variable names
- [ ] No magic numbers/strings

## Testing

- [ ] Critical paths are tested
- [ ] User interactions tested
- [ ] Edge cases covered
- [ ] Accessibility tested

## Security

- [ ] No XSS vulnerabilities (dangerouslySetInnerHTML avoided)
- [ ] User input is sanitized
- [ ] Sensitive data not in client bundle
- [ ] Environment variables used correctly
