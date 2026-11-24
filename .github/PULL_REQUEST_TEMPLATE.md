## Summary

Provide a concise description of the changes made and the motivation behind them.

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Architectural change (modifies contracts, schemas, or data pipeline)
- [ ] Documentation update
- [ ] Performance optimization

## Verification and Testing

Detail the deterministic verification steps executed:

- [ ] `npm run type-check` (Exit code: 0)
- [ ] `npm test` (All Vitest tests passing)
- [ ] `npm run build` (Next.js production build exits code 0)
- [ ] Manual verification performed (describe below):

### Test Output

```
Paste command output here
```

## Architectural and Security Checklist

- [ ] `src/types/contracts.ts` has NOT been modified directly (or includes Architect approval).
- [ ] All database queries use 100% parameterized statements (`?`).
- [ ] No secrets, tokens, or private credentials are included or committed.
- [ ] UI changes comply with the Frontend Craft Triad (WCAG AA contrast, 44x44px touch targets).
- [ ] Relevant documentation in `docs/` has been updated.
