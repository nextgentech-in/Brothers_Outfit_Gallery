# Mr. Munim POS synchronization

This integration is a button-triggered, offline-first synchronization between Mr. Munim and Brothers Outfit Gallery. It is not real time. The website remains vulnerable to an overselling window between POS syncs; operational stock buffers or more frequent syncs are still required.

## Production setup

1. Generate a long random token and set `POS_SYNC_API_TOKEN` in the server/Vercel environment. Give it to the POS developer over a secure channel. Do not use the example token from the original specification and do not use a `VITE_` variable.
2. Configure Firebase Admin credentials as described in `.env.example`.
3. Validate legacy product/SKU mappings:

   ```powershell
   npm run migrate:pos-sync
   ```

   The first command is a read-only dry run. Resolve every reported duplicate SKU, then apply:

   ```powershell
   npm run migrate:pos-sync -- --apply
   ```

4. Deploy the server and require HTTPS. Do not send the bearer token over plain HTTP.
5. Test with a staging token and staging Firestore project before enabling the shop button.

Firestore has no SQL-style schema migration. The backfill preserves all product/order/stock data, marks legacy products as `website` origin, uses their existing Firestore document ID as the stable `web_product_id`, and creates SKU reservation records. The script never invents a second external ID. Initial/backfilled stock is a baseline and is not written to the movement feed.

Rollback can remove code and routes, but already-consumed products or movements cannot safely be “un-synced.” Preserve movement/event collections and coordinate any data rollback with the POS checkpoint state.

## Authentication and limits

### Connection and deployment checklist

This website receives POS updates; it does not poll an external POS stock API.
An API token alone does not establish a connection. Configure the POS software to
send HTTPS `POST /api/pos/stock-sync` requests to the deployed website, using the
stock payload below. If the POS instead exposes a stock API for the website to
call, its URL, authentication contract, stock semantics, pagination and network
access requirements are needed for a separate fetch integration.

Configure `POS_SYNC_API_TOKEN` securely on the deployed server, together with
Firebase Admin credentials for the same project used by the storefront. Redeploy
after changing deployment environment variables. Never put the token in browser
code, a `VITE_` variable, source control or a query string.

For one staging sale, inspect the HTTP status and JSON response. `updated_count`
must reflect newly applied events; `duplicate_count` means those event IDs were
already accepted and were not deducted again. Each sale needs a stable, unique
`event_id`, reused for retries. Requests missing it return `422`.

Unknown products reject the entire stock batch with `409 unknown_product` and
`details.rejected_items`; no stock or replay records from that batch are written.
Fix product mappings before resending. Shared parent SKUs need enough size/colour
information to select exactly one variant; ambiguous matches return
`409 ambiguous_variant` rather than changing an arbitrary variant.

Confirm the result using `GET /api/pos/stock-snapshot?sku=<variant-sku>` with the
same bearer authentication. The shop page subscribes to Firebase catalog updates,
so accepted stock changes are reflected while the page is open. The existing
500-product catalog limit still applies. This does not bypass missing Firebase
permissions, different project configurations or a POS that never sends updates.

Every route requires:

```http
Authorization: Bearer <POS_SYNC_API_TOKEN>
Content-Type: application/json
```

Missing or invalid credentials return `401`. The POS routes have a dedicated 60 requests/minute limit and return `429` with `Retry-After`. JSON bodies use the global 1 MB limit. Product batches are limited to 25, stock batches to 100, variants per product to 50, and feed pages to 100. A product batch whose combined variants would exceed Firestore's safe atomic-write budget is rejected with `batch_too_large` and must be split.

Errors are JSON and include a safe `code` and `correlation_id`. Expected identity/replay/inventory conflicts return `409`; validation errors return `422`. Authorization headers are never logged.

## Product identity

- `web_product_id` is the durable cross-system product identity. POS-created IDs are mapped to internal Firestore IDs. Website-created and legacy website products use the existing Firestore product document ID.
- Variant SKU is the durable sellable-variant identity. SKU mappings are unique across parent and variant SKUs. Conflicts reject the complete batch.
- Category/subcategory keys are whitespace-collapsed and case-insensitive; the first canonical display spelling is retained in the product/taxonomy record.
- POS product slugs are normalized and receive a numeric suffix on collision.
- Money is stored using the website's existing two-decimal number convention.
- Re-delivering a known product is a no-op when its product ID and SKU set match. It returns `created_count: 0`, does not reset stock, and does not overwrite admin-managed text, prices, images, or other website edits. Reusing the ID with a different SKU set returns `409`.
- Website admin creates/edits now pass through a trusted transaction and the same SKU registry. SKU identity changes after creation are rejected because the current POS contract has no product-update/delete feed; use a new product or a coordinated migration. Ordinary text/price/image edits remain available, and stock edits create signed `admin_adjustment` movements.
- The source specification contains no image fields. POS products use the existing `/images/hero.png` storefront fallback. An admin should add real images in the existing product editor after import.

Only active website-origin products are returned to the POS. POS-origin products are never echoed through the new-website-product feed.

## 1. Publish POS products

`POST /api/pos/products`

```json
{
  "products": [
    {
      "web_product_id": "WktOIP6ZuIxc0VCsNR9Z",
      "product_name": "Premium Oversized Cotton Shirt",
      "category": "Shirts",
      "sub_category": "Oversized Fit",
      "sku": "SHT-BLK-001",
      "slug": "premium-oversized-cotton-shirt",
      "gsl_spec": "180 GSM Cotton, Bio-Washed",
      "color": "Black",
      "description": "Premium 100% combed cotton oversized shirt.",
      "mrp": 2499,
      "sale_price": 1499,
      "sizes": [
        { "size": "M", "stock": 10, "price": 1499, "sku": "SHT-BLK-001-M" }
      ]
    }
  ]
}
```

```json
{
  "success": true,
  "message": "Products published successfully",
  "created_count": 1
}
```

The complete batch is validated first and created in one Firestore transaction. A conflict rolls back the batch.

## 2. Download website products

`GET /api/pos/products-sync?since=2026-10-11T10:00:00.000Z&limit=100`

Omit `since` for the first sync; this starts at the beginning of the catalog. Timestamps must be UTC ISO-8601 values ending in `Z`.

```json
{
  "success": true,
  "server_time": "2026-10-11T12:45:00.000Z",
  "new_products": [],
  "has_more": false,
  "next_cursor": null
}
```

The server freezes an upper bound for each page sequence and sorts by creation timestamp plus document ID. When `has_more` is true, call the same endpoint with `cursor=<next_cursor>`; the cursor already contains the window and last tuple, so do not change `since`. Import all pages durably before advancing the POS checkpoint to `server_time`. A plain timestamp request intentionally includes records exactly equal to `since` to avoid gaps; deduplicate by `web_product_id`. Cursor continuation is exclusive and handles equal timestamps precisely.

## 3. Upload POS stock movements

`POST /api/pos/stock-sync`

The original request is not production-safe without stable event identity. The following fields are mandatory contract extensions:

- `sync_id`: stable identifier for the local upload batch/attempt.
- `event_id`: stable identifier for each genuine local stock movement. It must be generated once, persisted by the POS, and reused on every retry. It must not be regenerated when the event moves into another batch.

```json
{
  "sync_id": "SYNC-20261011-000042",
  "sync_timestamp": "2026-10-11T12:45:00.000Z",
  "items": [
    {
      "event_id": "POS-EVENT-93881",
      "web_product_id": "WktOIP6ZuIxc0VCsNR9Z",
      "sku": "SHT-BLK-001-M",
      "size": "M",
      "color": "Black",
      "delta_change": -2,
      "final_stock": 8
    }
  ]
}
```

```json
{
  "success": true,
  "message": "Stock updated successfully",
  "updated_count": 1,
  "duplicate_count": 0,
  "reconciliation": []
}
```

The website applies each new `delta_change` atomically and never overwrites stock with `final_stock`. `final_stock` is compared with the post-delta website value; differences create an open reconciliation record and are returned in `reconciliation`. A repeated identical `event_id` is skipped. Reusing it with different product/SKU/size/color/delta/final stock returns `409` and rolls back the batch.

Product ID, SKU, size, and color must all agree. Unknown or mismatched variants return `409`. The endpoint never clamps below zero: a movement that would make website stock negative is rejected for manual reconciliation. For an already-completed offline sale, staff must reconcile the baseline first or explicitly authorize a stock adjustment; changing the sale delta or silently setting zero is not allowed.

## 4. Download website movements

`GET /api/pos/stock-changes?since=2026-10-11T10:00:00.000Z&limit=100`

```json
{
  "success": true,
  "server_time": "2026-10-11T12:45:00.000Z",
  "stock_changes": [
    {
      "movement_id": "web_abc123",
      "web_product_id": "WktOIP6ZuIxc0VCsNR9Z",
      "sku": "SHT-BLK-001-S",
      "size": "S",
      "color": "Black",
      "current_website_stock": 4,
      "deducted_qty": 1,
      "delta_change": -1,
      "reason": "online_order",
      "order_id": "ORD-BROTHERS-5042",
      "created_at": "2026-10-11T11:45:00.000Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

Every movement is separate. POS must deduplicate and persist `movement_id`, then apply `delta_change` exactly once. Negative values deduct; positive values restore. `deducted_qty` remains compatible with the original contract for deductions and is `0` on restorations. `current_website_stock` is informational: never replace POS stock with it and never both apply the delta and copy the snapshot.

Current website reasons are `online_order`, `order_cancelled`, and `admin_adjustment`. Inventory-page changes are transactional absolute targets on the website, but are exported as signed deltas. POS-origin movements are excluded, preventing echo loops. Pagination/checkpoint rules are identical to the product feed.

## Website order policy

COD and successfully captured Razorpay orders deduct physical/available stock at secure server-side order creation. Razorpay failure never creates an order or movement. Order creation, inventory update, and one deterministic movement per line commit in one Firestore transaction. Razorpay retries use the payment ID; COD retries use a stable browser-generated `checkout_id`. A replay with changed order data is rejected, so neither path can deduct twice. There is no separate reservation quantity today.

Cancellation restores only inventory that was deducted, writes one positive `order_cancelled` movement per line, and uses the existing `stockRestoredAt` marker for retry safety. The site currently implements exchanges, not refunds/returns. Exchange approval does not automatically add returned units because condition/QC and replacement-stock rules are business decisions. A future full/partial return flow must add a transactional `return_received` movement only after accepted QC; until that rule and item quantities are defined, it is intentionally not fabricated here.

## Recommended SYNC STOCK sequence

1. Persist local sale/inward events before attempting network sync.
2. Upload unsent local events using their existing `event_id`; mark them sent only after a successful response.
3. Download every page of website products; upsert/deduplicate by `web_product_id` and variant SKU.
4. Download every page of website stock movements; deduplicate by `movement_id` and apply signed `delta_change` once.
5. Do not enqueue imported website movements into the POS outbound local-event queue.
6. Only after all records/pages are durably committed, save the returned `server_time` as that feed's next `since` checkpoint.

Example:

```powershell
$headers = @{ Authorization = "Bearer $env:POS_SYNC_API_TOKEN" }
Invoke-RestMethod -Method Get -Headers $headers -Uri "https://www.brothersoutfitgallery.com/api/pos/products-sync?since=2026-10-11T10%3A00%3A00.000Z"
```

## Operational records

- `posProductMappings`: POS external ID to website document ID.
- `productSkuMappings` / `productSlugMappings`: uniqueness reservations for product/variant SKUs and storefront slugs.
- `stockMovements`: auditable signed movements; only `source=website` is exported.
- `posStockEvents`: durable inbound-event replay records.
- `posReconciliationDiscrepancies`: `final_stock` diagnostic differences requiring investigation.
- `posTaxonomy`: normalized category/subcategory registry.

Server logs contain endpoint/correlation IDs and safe counts/IDs, never bearer tokens or customer payloads.

## Known limitations and rollout gates

- The POS must implement persistent `event_id`, `sync_id`, incoming `movement_id` deduplication, signed restoration deltas, and cursor paging before production enablement. The legacy payload alone is not production-safe.
- The contract has no product update/delete feed. SKU identity edits are therefore blocked after website creation; price/text/image changes are website-only until a versioned update contract is agreed.
- Full/partial returns are not a current website feature. Define accepted-QC timing and item quantities before adding `return_received` movements.
- The application-level rate limiter follows the project's existing in-memory design. On a multi-instance deployment, add a gateway/distributed rate limiter for a global quota; authentication and idempotency remain enforced in Firestore.
- Feed queries use a stable application cursor but scan the applicable Firestore collection before paging. If the catalog/ledger grows substantially, add indexed cursor fields and a migration without changing the response contract.
- A staging Firestore integration/concurrency run is required before rollout. The repository test suite exercises validation, identity, cursor, authentication, delta/reconciliation, and replay primitives without touching production data.
