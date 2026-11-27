# Website courier-label printing

The website's Admin Orders screen offers **Download label / print** in the desktop order table, mobile order cards and order details once a shipment has an AWB. It downloads the original Delhivery PDF using the order's saved waybill. Open the downloaded PDF and print with the SEZNIK Shakti using 4 × 6 inch stock and actual-size scaling. Copy quantities and other paper choices remain available in the PDF viewer's print dialog.

Select A6 / 4 × 6 inch shipping labels in Delhivery One. The PDF returned by the provider is preserved; it is not replaced by a locally generated address sticker.

The admin-only endpoint is `GET /api/delhivery/orders/:orderId/label`. It uses the website's existing Firebase admin authentication, trusted Firestore connection and server-only `DELHIVERY_API_KEY`. `DELHIVERY_ENV` defaults to `production`; use `staging` only with a staging token. The API key is not sent to the browser or forwarded to the signed PDF download host.

This action only retrieves the existing shipment's label. Missing AWBs, cancelled orders, POS sales and provider failures produce errors rather than booking shipments or changing orders.

Verification: `node --test test/delhiveryLabels.test.js test/delhiveryLabelDownload.test.js`. Tests use fixtures and perform no live shipment creation or data changes.

Provider documentation: [Package Slip API](https://one.delhivery.com/developer-portal/document/b2c/detail/faq), [shipping-label configuration](https://help.delhivery.com/docs/shipping-label-configuration).
