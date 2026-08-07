# RUKHNAV Customer Returns - Step 1

## Install

1. Copy `controllers`, `services`, and `routes` into the backend folder.
2. In MySQL Workbench, run:
   `database/migrations/2026_07_25_create_customer_returns.sql`
3. Add the route imports and mounts shown in `SERVER_PATCH.md`.
4. Add to `.env` if you want a period other than 14 days:
   `CUSTOMER_RETURN_WINDOW_DAYS=14`
5. Restart: `npm run dev`

## Customer endpoints

- `POST /api/returns`
- `GET /api/returns`
- `GET /api/returns/:id`
- `PUT /api/returns/:id/cancel`

Create body example:

```json
{
  "order_id": 4,
  "reason": "Product damaged during delivery",
  "customer_notes": "The bottle leaked inside the parcel.",
  "items": [
    { "order_item_id": 7, "quantity": 1 }
  ]
}
```

## Admin endpoints

- `GET /api/admin/returns/summary`
- `GET /api/admin/returns?status=Requested&page=1&limit=20`
- `GET /api/admin/returns/:id`
- `PUT /api/admin/returns/:id/review`

Review body examples:

```json
{ "decision": "review", "admin_notes": "Checking evidence." }
```

```json
{ "decision": "approve", "admin_notes": "Return approved." }
```

```json
{ "decision": "reject", "admin_notes": "Outside policy." }
```

## Rules in Step 1

- Only the owner can create/view/cancel a return.
- Only delivered orders can be returned.
- Default return window is 14 days from `delivered_at`.
- A customer cannot request more than the purchased, unreturned quantity.
- No stock or payment is changed in Step 1.
- Inventory receipt, inspection and refund processing come in Step 2.
