# Automatic website SKUs and barcodes

New website products receive an automatic sequential SKU such as `BOG-000123`. The website and POS use the same transactional `erp_sequences/productNumber` counter, so simultaneous creates cannot allocate the same number. Existing products retain their current SKUs and barcode numbers.

Each variant receives its own SKU (`BOG-000123-V001`) and barcode (`BOG-000123-001`). The product barcode points to the first variant. The website product list, product editor and variant table display the saved barcode numbers. New-product fields show “Assigned automatically when saved”; a number is allocated only when the save transaction succeeds.

SKU and slug mappings, opening-stock movements, product data and the counter commit together. Existing identifiers are preserved during edits. The allocator skips occupied legacy identifiers and respects a higher existing product number if needed.

Verification: `node --test test/catalogNumbering.test.js`. Tests cover concurrent creation, continuity after POS allocation, collisions, failed saves and preserving existing identities.
