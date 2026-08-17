INSERT INTO users (id, name, email, avatar_initials, is_demo, loyalty_stamps) VALUES
  ('alex', 'Alex Rivera', 'alex@example.com', 'AR', 1, 7),
  ('jordan', 'Jordan Lee', 'jordan@example.com', 'JL', 1, 1);

INSERT INTO saved_sandwiches (id, user_id, name, build_json) VALUES
  ('seed-saved-1', 'alex', 'The Italian Stack', '{"kind":"menu","slug":"italian-stack"}');

INSERT INTO orders (id, user_id, status, pickup_time, subtotal_cents, created_at) VALUES
  ('seed-order-1', 'alex', 'completed', '12:30', 1100, datetime('now', '-14 days')),
  ('seed-order-2', 'alex', 'completed', '12:45', 2500, datetime('now', '-7 days')),
  ('seed-order-3', 'alex', 'completed', '12:15', 2000, datetime('now', '-2 days'));

INSERT INTO order_items (id, order_id, kind, label, unit_price_cents, qty, build_json) VALUES
  ('seed-item-1', 'seed-order-1', 'menu', 'The Italian Stack', 1100, 1, NULL),
  ('seed-item-2', 'seed-order-2', 'custom', 'Green Machine', 1400, 1, '{"bread":"Sourdough"}'),
  ('seed-item-3', 'seed-order-2', 'menu', 'The Cubano', 1100, 1, NULL),
  ('seed-item-4', 'seed-order-3', 'menu', 'Turkey Club Stack', 1000, 2, NULL);
