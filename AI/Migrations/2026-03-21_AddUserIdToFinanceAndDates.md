# Database Schema Changes (2026-03-21)

## Finance Collections
The following interfaces were updated to require a generic `userId: string` parameter to conform with multi-tenant/Firestore indexing:
- `Account`
- `Transaction`
- `Budget`
- `FinancialGoal`
- `NetWorthEntry`
- `CompoundInterestInput` (re-typed correctly during resolving)

## Important Dates Collection
The `ImportantDate` baseline interface was updated:
- Added `userId: string`

## Impact on App
The `CreateDatePayload`, `CreateGoalPayload`, etc., must all now combine with `{ userId: 'local' }` sequentially when they hit the stores (or be passed in directly from the UI for dummy creation) so that they properly slot into index queries where `userId == 'local'`.
