-- Demo seed data (fictional brands, outlets and people). Generated; dates are relative to the
-- migration date so the dashboard always shows recent activity.

INSERT INTO outlet (code, name, channel, city, credit_limit, outstanding_balance, sales_rep_id) VALUES
  ('OUT-1001', 'Al Noor Grocery', 'GROCERY', 'Dubai', 50000.00, 18500.00, 'rep-001'),
  ('OUT-1002', 'Marina Bay Cafe', 'HORECA', 'Dubai', 60000.00, 22400.00, 'rep-001'),
  ('OUT-1003', 'Sahara Fresh Hypermarket', 'MODERN_TRADE', 'Dubai', 250000.00, 96000.00, 'rep-001'),
  ('OUT-1004', 'Palm Crescent Resort', 'HORECA', 'Dubai', 120000.00, 41250.00, 'rep-001'),
  ('OUT-1005', 'Karama Corner Supermarket', 'GROCERY', 'Dubai', 40000.00, 39200.00, 'rep-001'),
  ('OUT-1006', 'Corniche Mini Mart', 'GROCERY', 'Abu Dhabi', 35000.00, 9800.00, 'rep-002'),
  ('OUT-1007', 'Saadiyat Grill House', 'HORECA', 'Abu Dhabi', 70000.00, 31500.00, 'rep-002'),
  ('OUT-1008', 'Capital Mart Al Reem', 'MODERN_TRADE', 'Abu Dhabi', 200000.00, 154000.00, 'rep-002'),
  ('OUT-1009', 'Mussafah Workers Canteen', 'HORECA', 'Abu Dhabi', 30000.00, 28900.00, 'rep-002'),
  ('OUT-1010', 'Al Majaz Family Grocery', 'GROCERY', 'Sharjah', 45000.00, 12750.00, 'rep-003'),
  ('OUT-1011', 'Qasba Juice Lounge', 'HORECA', 'Sharjah', 50000.00, 19200.00, 'rep-003'),
  ('OUT-1012', 'Sharjah Value Hypermarket', 'MODERN_TRADE', 'Sharjah', 180000.00, 61000.00, 'rep-003');

INSERT INTO product (sku, name, brand, category, pack_size, case_price, active) VALUES
  ('FZ-COLA-330-24', 'FizzUp Cola 330ml Can', 'FizzUp', 'CARBONATED', '24 x 330ml can', 38.00, TRUE),
  ('FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 'FizzUp', 'CARBONATED', '24 x 330ml can', 40.00, TRUE),
  ('FZ-ORNG-330-24', 'FizzUp Orange 330ml Can', 'FizzUp', 'CARBONATED', '24 x 330ml can', 36.00, TRUE),
  ('FZ-COLA-1500-6', 'FizzUp Cola 1.5L Bottle', 'FizzUp', 'CARBONATED', '6 x 1.5L PET', 27.00, TRUE),
  ('FZ-LEMN-330-24', 'FizzUp Lemon-Lime 330ml Can', 'FizzUp', 'CARBONATED', '24 x 330ml can', 36.00, FALSE),
  ('OJ-ORNG-1000-12', 'Oasis Juice Orange 1L', 'Oasis Juice', 'JUICE', '12 x 1L carton', 66.00, TRUE),
  ('OJ-MANG-250-24', 'Oasis Juice Mango 250ml', 'Oasis Juice', 'JUICE', '24 x 250ml carton', 54.00, TRUE),
  ('OJ-APPL-1000-12', 'Oasis Juice Apple 1L', 'Oasis Juice', 'JUICE', '12 x 1L carton', 62.00, TRUE),
  ('OJ-GUAV-250-24', 'Oasis Juice Guava 250ml', 'Oasis Juice', 'JUICE', '24 x 250ml carton', 52.00, TRUE),
  ('PP-STIL-500-24', 'Pure Peak Still Water 500ml', 'Pure Peak Water', 'WATER', '24 x 500ml PET', 18.00, TRUE),
  ('PP-STIL-1500-12', 'Pure Peak Still Water 1.5L', 'Pure Peak Water', 'WATER', '12 x 1.5L PET', 16.50, TRUE),
  ('PP-SPRK-330-24', 'Pure Peak Sparkling 330ml Glass', 'Pure Peak Water', 'WATER', '24 x 330ml glass', 42.00, TRUE),
  ('PP-GALN-5000-4', 'Pure Peak Family 5L', 'Pure Peak Water', 'WATER', '4 x 5L PET', 22.00, TRUE),
  ('VX-ORIG-250-24', 'VoltX Original 250ml Can', 'VoltX Energy', 'ENERGY', '24 x 250ml can', 96.00, TRUE),
  ('VX-SFRE-250-24', 'VoltX Sugar Free 250ml Can', 'VoltX Energy', 'ENERGY', '24 x 250ml can', 98.00, TRUE),
  ('VX-TROP-500-12', 'VoltX Tropical 500ml Can', 'VoltX Energy', 'ENERGY', '12 x 500ml can', 84.00, TRUE);

INSERT INTO inventory (sku, warehouse, on_hand_cases, reserved_cases) VALUES
  ('FZ-COLA-330-24', 'DXB', 900, 0),
  ('FZ-COLA-330-24', 'AUH', 540, 0),
  ('FZ-COLA-330-24', 'SHJ', 400, 0),
  ('FZ-ZERO-330-24', 'DXB', 520, 0),
  ('FZ-ZERO-330-24', 'AUH', 310, 0),
  ('FZ-ZERO-330-24', 'SHJ', 230, 0),
  ('FZ-ORNG-330-24', 'DXB', 410, 0),
  ('FZ-ORNG-330-24', 'AUH', 240, 0),
  ('FZ-ORNG-330-24', 'SHJ', 180, 0),
  ('FZ-COLA-1500-6', 'DXB', 380, 0),
  ('FZ-COLA-1500-6', 'AUH', 220, 0),
  ('FZ-COLA-1500-6', 'SHJ', 170, 0),
  ('FZ-LEMN-330-24', 'DXB', 60, 0),
  ('FZ-LEMN-330-24', 'AUH', 30, 0),
  ('FZ-LEMN-330-24', 'SHJ', 20, 0),
  ('OJ-ORNG-1000-12', 'DXB', 300, 0),
  ('OJ-ORNG-1000-12', 'AUH', 180, 0),
  ('OJ-ORNG-1000-12', 'SHJ', 130, 0),
  ('OJ-MANG-250-24', 'DXB', 310, 50),
  ('OJ-MANG-250-24', 'AUH', 22, 0),
  ('OJ-MANG-250-24', 'SHJ', 110, 0),
  ('OJ-APPL-1000-12', 'DXB', 245, 25),
  ('OJ-APPL-1000-12', 'AUH', 130, 0),
  ('OJ-APPL-1000-12', 'SHJ', 90, 0),
  ('OJ-GUAV-250-24', 'DXB', 180, 0),
  ('OJ-GUAV-250-24', 'AUH', 100, 0),
  ('OJ-GUAV-250-24', 'SHJ', 15, 0),
  ('PP-STIL-500-24', 'DXB', 1480, 80),
  ('PP-STIL-500-24', 'AUH', 840, 0),
  ('PP-STIL-500-24', 'SHJ', 630, 0),
  ('PP-STIL-1500-12', 'DXB', 800, 0),
  ('PP-STIL-1500-12', 'AUH', 480, 0),
  ('PP-STIL-1500-12', 'SHJ', 360, 0),
  ('PP-SPRK-330-24', 'DXB', 40, 0),
  ('PP-SPRK-330-24', 'AUH', 90, 0),
  ('PP-SPRK-330-24', 'SHJ', 110, 40),
  ('PP-GALN-5000-4', 'DXB', 462, 12),
  ('PP-GALN-5000-4', 'AUH', 270, 0),
  ('PP-GALN-5000-4', 'SHJ', 200, 0),
  ('VX-ORIG-250-24', 'DXB', 400, 60),
  ('VX-ORIG-250-24', 'AUH', 200, 0),
  ('VX-ORIG-250-24', 'SHJ', 150, 0),
  ('VX-SFRE-250-24', 'DXB', 290, 80),
  ('VX-SFRE-250-24', 'AUH', 120, 0),
  ('VX-SFRE-250-24', 'SHJ', 90, 0),
  ('VX-TROP-500-12', 'DXB', 140, 0),
  ('VX-TROP-500-12', 'AUH', 80, 0),
  ('VX-TROP-500-12', 'SHJ', 8, 0);

INSERT INTO promotion (sku, channel, discount_pct, min_cases, valid_from, valid_to, description) VALUES
  ('FZ-COLA-330-24', NULL, 5.00, 10, CAST(CURRENT_DATE - INTERVAL '25' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '30' DAY AS DATE), 'FizzUp Cola volume deal: 5% off 10+ cases'),
  ('FZ-COLA-330-24', 'GROCERY', 8.00, 25, CAST(CURRENT_DATE - INTERVAL '25' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '30' DAY AS DATE), 'Grocery stock-up: 8% off 25+ cases of FizzUp Cola'),
  ('OJ-ORNG-1000-12', 'HORECA', 10.00, 15, CAST(CURRENT_DATE - INTERVAL '40' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '20' DAY AS DATE), 'HORECA breakfast juice: 10% off 15+ cases'),
  ('PP-STIL-500-24', NULL, 6.00, 40, CAST(CURRENT_DATE - INTERVAL '30' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '45' DAY AS DATE), 'Pure Peak bulk water: 6% off 40+ cases'),
  ('VX-ORIG-250-24', 'MODERN_TRADE', 12.00, 20, CAST(CURRENT_DATE - INTERVAL '15' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '30' DAY AS DATE), 'VoltX shelf launch: 12% off 20+ cases in modern trade'),
  ('OJ-MANG-250-24', NULL, 7.00, 12, CAST(CURRENT_DATE - INTERVAL '20' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '25' DAY AS DATE), 'Mango season: 7% off 12+ cases'),
  ('FZ-ORNG-330-24', NULL, 10.00, 10, CAST(CURRENT_DATE - INTERVAL '75' DAY AS DATE), CAST(CURRENT_DATE - INTERVAL '35' DAY AS DATE), 'Summer orange splash (expired)'),
  ('VX-SFRE-250-24', NULL, 9.00, 15, CAST(CURRENT_DATE + INTERVAL '20' DAY AS DATE), CAST(CURRENT_DATE + INTERVAL '40' DAY AS DATE), 'UAE National Day energy pack (starts soon)');

INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00001', id, 'DISPATCHED', 2280.00, 0.00, 2280.00, 'UI', 'mgr-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '29' DAY + INTERVAL '432' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1003';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00002', id, 'DISPATCHED', 550.00, 0.00, 550.00, 'UI', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '28' DAY + INTERVAL '828' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1001';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00003', id, 'DISPATCHED', 1240.00, 0.00, 1240.00, 'UI', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '26' DAY + INTERVAL '648' MINUTE, 'Weekend restock'
  FROM outlet WHERE code = 'OUT-1007';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00004', id, 'DISPATCHED', 5080.00, 64.80, 5015.20, 'AI_AGENT', 'rep-003', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '25' DAY + INTERVAL '521' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1012';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00005', id, 'DISPATCHED', 800.00, 0.00, 800.00, 'UI', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '23' DAY + INTERVAL '814' MINUTE, 'Weekend restock'
  FROM outlet WHERE code = 'OUT-1004';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00006', id, 'CANCELLED', 1900.00, 152.00, 1748.00, 'UI', 'rep-003', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '22' DAY + INTERVAL '475' MINUTE, 'Call store manager on arrival'
  FROM outlet WHERE code = 'OUT-1010';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00007', id, 'DISPATCHED', 3920.00, 0.00, 3920.00, 'UI', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '21' DAY + INTERVAL '612' MINUTE, 'Deliver before 10am'
  FROM outlet WHERE code = 'OUT-1008';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00008', id, 'DISPATCHED', 1610.00, 99.00, 1511.00, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '19' DAY + INTERVAL '475' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1002';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00009', id, 'DISPATCHED', 1440.00, 28.50, 1411.50, 'UI', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '17' DAY + INTERVAL '605' MINUTE, 'Use loading bay 2'
  FROM outlet WHERE code = 'OUT-1006';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00010', id, 'DISPATCHED', 1000.00, 0.00, 1000.00, 'AI_AGENT', 'rep-003', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '16' DAY + INTERVAL '852' MINUTE, 'Weekend restock'
  FROM outlet WHERE code = 'OUT-1011';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00011', id, 'DISPATCHED', 9400.00, 108.00, 9292.00, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '14' DAY + INTERVAL '415' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1003';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00012', id, 'DISPATCHED', 675.00, 0.00, 675.00, 'UI', 'mgr-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '12' DAY + INTERVAL '708' MINUTE, 'Weekend restock'
  FROM outlet WHERE code = 'OUT-1005';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00013', id, 'DISPATCHED', 2495.00, 0.00, 2495.00, 'UI', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '11' DAY + INTERVAL '380' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1009';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00014', id, 'DISPATCHED', 1890.00, 75.60, 1814.40, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '10' DAY + INTERVAL '440' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1001';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00015', id, 'DISPATCHED', 14400.00, 43.20, 14356.80, 'UI', 'rep-003', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '8' DAY + INTERVAL '334' MINUTE, 'Split delivery if short'
  FROM outlet WHERE code = 'OUT-1012';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00016', id, 'CANCELLED', 400.00, 0.00, 400.00, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '7' DAY + INTERVAL '732' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1004';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00017', id, 'DISPATCHED', 3932.00, 0.00, 3932.00, 'AI_AGENT', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '6' DAY + INTERVAL '888' MINUTE, 'Use loading bay 2'
  FROM outlet WHERE code = 'OUT-1007';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00018', id, 'DISPATCHED', 19280.00, 1458.40, 17821.60, 'UI', 'rep-002', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '5' DAY + INTERVAL '725' MINUTE, 'Use loading bay 2'
  FROM outlet WHERE code = 'OUT-1008';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00019', id, 'DISPATCHED', 730.00, 0.00, 730.00, 'AI_AGENT', 'rep-003', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '4' DAY + INTERVAL '835' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1010';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00020', id, 'CONFIRMED', 1550.00, 0.00, 1550.00, 'UI', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '3' DAY + INTERVAL '574' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1002';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00021', id, 'PENDING_APPROVAL', 1080.00, 0.00, 1080.00, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '2' DAY + INTERVAL '814' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1005';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00022', id, 'CONFIRMED', 15040.00, 777.60, 14262.40, 'AI_AGENT', 'rep-001', CAST(CURRENT_DATE AS TIMESTAMP) - INTERVAL '1' DAY + INTERVAL '860' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1003';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00023', id, 'CONFIRMED', 1680.00, 0.00, 1680.00, 'UI', 'rep-003', CURRENT_TIMESTAMP - INTERVAL '150' MINUTE, NULL
  FROM outlet WHERE code = 'OUT-1011';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00024', id, 'PENDING_APPROVAL', 3542.50, 0.00, 3542.50, 'AI_AGENT', 'rep-002', CURRENT_TIMESTAMP - INTERVAL '80' MINUTE, 'Deliver before 10am'
  FROM outlet WHERE code = 'OUT-1009';
INSERT INTO sales_order (order_no, outlet_id, status, subtotal, discount, total, source, created_by, created_at, notes)
  SELECT 'SO-2026-00025', id, 'CONFIRMED', 2964.00, 189.00, 2775.00, 'AI_AGENT', 'rep-001', CURRENT_TIMESTAMP - INTERVAL '25' MINUTE, 'Split delivery if short'
  FROM outlet WHERE code = 'OUT-1001';

INSERT INTO order_line (order_id, line_no, sku, product_name, qty_cases, unit_price, discount_pct, line_total)
  SELECT id, 1, 'FZ-COLA-330-24', 'FizzUp Cola 330ml Can', 60, 38.00, 0.00, 2280.00 FROM sales_order WHERE order_no = 'SO-2026-00001'
  UNION ALL
  SELECT id, 1, 'PP-GALN-5000-4', 'Pure Peak Family 5L', 25, 22.00, 0.00, 550.00 FROM sales_order WHERE order_no = 'SO-2026-00002'
  UNION ALL
  SELECT id, 1, 'OJ-APPL-1000-12', 'Oasis Juice Apple 1L', 20, 62.00, 0.00, 1240.00 FROM sales_order WHERE order_no = 'SO-2026-00003'
  UNION ALL
  SELECT id, 1, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 100, 40.00, 0.00, 4000.00 FROM sales_order WHERE order_no = 'SO-2026-00004'
  UNION ALL
  SELECT id, 2, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 60, 18.00, 6.00, 1015.20 FROM sales_order WHERE order_no = 'SO-2026-00004'
  UNION ALL
  SELECT id, 1, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 20, 40.00, 0.00, 800.00 FROM sales_order WHERE order_no = 'SO-2026-00005'
  UNION ALL
  SELECT id, 1, 'FZ-COLA-330-24', 'FizzUp Cola 330ml Can', 50, 38.00, 8.00, 1748.00 FROM sales_order WHERE order_no = 'SO-2026-00006'
  UNION ALL
  SELECT id, 1, 'VX-SFRE-250-24', 'VoltX Sugar Free 250ml Can', 40, 98.00, 0.00, 3920.00 FROM sales_order WHERE order_no = 'SO-2026-00007'
  UNION ALL
  SELECT id, 1, 'OJ-ORNG-1000-12', 'Oasis Juice Orange 1L', 15, 66.00, 10.00, 891.00 FROM sales_order WHERE order_no = 'SO-2026-00008'
  UNION ALL
  SELECT id, 2, 'OJ-APPL-1000-12', 'Oasis Juice Apple 1L', 10, 62.00, 0.00, 620.00 FROM sales_order WHERE order_no = 'SO-2026-00008'
  UNION ALL
  SELECT id, 1, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 30, 18.00, 0.00, 540.00 FROM sales_order WHERE order_no = 'SO-2026-00009'
  UNION ALL
  SELECT id, 2, 'FZ-COLA-330-24', 'FizzUp Cola 330ml Can', 15, 38.00, 5.00, 541.50 FROM sales_order WHERE order_no = 'SO-2026-00009'
  UNION ALL
  SELECT id, 3, 'PP-GALN-5000-4', 'Pure Peak Family 5L', 15, 22.00, 0.00, 330.00 FROM sales_order WHERE order_no = 'SO-2026-00009'
  UNION ALL
  SELECT id, 1, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 25, 40.00, 0.00, 1000.00 FROM sales_order WHERE order_no = 'SO-2026-00010'
  UNION ALL
  SELECT id, 1, 'OJ-GUAV-250-24', 'Oasis Juice Guava 250ml', 100, 52.00, 0.00, 5200.00 FROM sales_order WHERE order_no = 'SO-2026-00011'
  UNION ALL
  SELECT id, 2, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 60, 40.00, 0.00, 2400.00 FROM sales_order WHERE order_no = 'SO-2026-00011'
  UNION ALL
  SELECT id, 3, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 100, 18.00, 6.00, 1692.00 FROM sales_order WHERE order_no = 'SO-2026-00011'
  UNION ALL
  SELECT id, 1, 'FZ-COLA-1500-6', 'FizzUp Cola 1.5L Bottle', 25, 27.00, 0.00, 675.00 FROM sales_order WHERE order_no = 'SO-2026-00012'
  UNION ALL
  SELECT id, 1, 'PP-STIL-1500-12', 'Pure Peak Still Water 1.5L', 30, 16.50, 0.00, 495.00 FROM sales_order WHERE order_no = 'SO-2026-00013'
  UNION ALL
  SELECT id, 2, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 50, 40.00, 0.00, 2000.00 FROM sales_order WHERE order_no = 'SO-2026-00013'
  UNION ALL
  SELECT id, 1, 'FZ-COLA-1500-6', 'FizzUp Cola 1.5L Bottle', 30, 27.00, 0.00, 810.00 FROM sales_order WHERE order_no = 'SO-2026-00014'
  UNION ALL
  SELECT id, 2, 'OJ-MANG-250-24', 'Oasis Juice Mango 250ml', 20, 54.00, 7.00, 1004.40 FROM sales_order WHERE order_no = 'SO-2026-00014'
  UNION ALL
  SELECT id, 1, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 40, 18.00, 6.00, 676.80 FROM sales_order WHERE order_no = 'SO-2026-00015'
  UNION ALL
  SELECT id, 2, 'OJ-GUAV-250-24', 'Oasis Juice Guava 250ml', 150, 52.00, 0.00, 7800.00 FROM sales_order WHERE order_no = 'SO-2026-00015'
  UNION ALL
  SELECT id, 3, 'VX-SFRE-250-24', 'VoltX Sugar Free 250ml Can', 60, 98.00, 0.00, 5880.00 FROM sales_order WHERE order_no = 'SO-2026-00015'
  UNION ALL
  SELECT id, 1, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 10, 40.00, 0.00, 400.00 FROM sales_order WHERE order_no = 'SO-2026-00016'
  UNION ALL
  SELECT id, 1, 'PP-STIL-1500-12', 'Pure Peak Still Water 1.5L', 40, 16.50, 0.00, 660.00 FROM sales_order WHERE order_no = 'SO-2026-00017'
  UNION ALL
  SELECT id, 2, 'OJ-APPL-1000-12', 'Oasis Juice Apple 1L', 40, 62.00, 0.00, 2480.00 FROM sales_order WHERE order_no = 'SO-2026-00017'
  UNION ALL
  SELECT id, 3, 'OJ-ORNG-1000-12', 'Oasis Juice Orange 1L', 12, 66.00, 0.00, 792.00 FROM sales_order WHERE order_no = 'SO-2026-00017'
  UNION ALL
  SELECT id, 1, 'OJ-GUAV-250-24', 'Oasis Juice Guava 250ml', 120, 52.00, 0.00, 6240.00 FROM sales_order WHERE order_no = 'SO-2026-00018'
  UNION ALL
  SELECT id, 2, 'FZ-COLA-330-24', 'FizzUp Cola 330ml Can', 40, 38.00, 5.00, 1444.00 FROM sales_order WHERE order_no = 'SO-2026-00018'
  UNION ALL
  SELECT id, 3, 'VX-ORIG-250-24', 'VoltX Original 250ml Can', 120, 96.00, 12.00, 10137.60 FROM sales_order WHERE order_no = 'SO-2026-00018'
  UNION ALL
  SELECT id, 1, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 10, 18.00, 0.00, 180.00 FROM sales_order WHERE order_no = 'SO-2026-00019'
  UNION ALL
  SELECT id, 2, 'PP-GALN-5000-4', 'Pure Peak Family 5L', 25, 22.00, 0.00, 550.00 FROM sales_order WHERE order_no = 'SO-2026-00019'
  UNION ALL
  SELECT id, 1, 'OJ-APPL-1000-12', 'Oasis Juice Apple 1L', 25, 62.00, 0.00, 1550.00 FROM sales_order WHERE order_no = 'SO-2026-00020'
  UNION ALL
  SELECT id, 1, 'FZ-COLA-1500-6', 'FizzUp Cola 1.5L Bottle', 40, 27.00, 0.00, 1080.00 FROM sales_order WHERE order_no = 'SO-2026-00021'
  UNION ALL
  SELECT id, 1, 'VX-ORIG-250-24', 'VoltX Original 250ml Can', 60, 96.00, 12.00, 5068.80 FROM sales_order WHERE order_no = 'SO-2026-00022'
  UNION ALL
  SELECT id, 2, 'VX-SFRE-250-24', 'VoltX Sugar Free 250ml Can', 80, 98.00, 0.00, 7840.00 FROM sales_order WHERE order_no = 'SO-2026-00022'
  UNION ALL
  SELECT id, 3, 'PP-STIL-500-24', 'Pure Peak Still Water 500ml', 80, 18.00, 6.00, 1353.60 FROM sales_order WHERE order_no = 'SO-2026-00022'
  UNION ALL
  SELECT id, 1, 'PP-SPRK-330-24', 'Pure Peak Sparkling 330ml Glass', 40, 42.00, 0.00, 1680.00 FROM sales_order WHERE order_no = 'SO-2026-00023'
  UNION ALL
  SELECT id, 1, 'FZ-ZERO-330-24', 'FizzUp Cola Zero 330ml Can', 70, 40.00, 0.00, 2800.00 FROM sales_order WHERE order_no = 'SO-2026-00024'
  UNION ALL
  SELECT id, 2, 'PP-STIL-1500-12', 'Pure Peak Still Water 1.5L', 45, 16.50, 0.00, 742.50 FROM sales_order WHERE order_no = 'SO-2026-00024'
  UNION ALL
  SELECT id, 1, 'PP-GALN-5000-4', 'Pure Peak Family 5L', 12, 22.00, 0.00, 264.00 FROM sales_order WHERE order_no = 'SO-2026-00025'
  UNION ALL
  SELECT id, 2, 'OJ-MANG-250-24', 'Oasis Juice Mango 250ml', 50, 54.00, 7.00, 2511.00 FROM sales_order WHERE order_no = 'SO-2026-00025';

ALTER SEQUENCE order_no_seq RESTART WITH 26;
