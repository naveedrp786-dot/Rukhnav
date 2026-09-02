-- ============================================================
-- RUKHNAV
-- Improve ORDER_PLACED customer notifications
-- Email + WhatsApp
-- ============================================================

UPDATE notification_templates
SET
    subject = 'We received your RUKHNAV order {{order_number}}',
    email_heading = 'Order Received ✓',
    email_preheader = 'Thank you. Your RUKHNAV order has been received successfully.',
    body = 'Hello {{customer_name}},

Thank you for shopping with RUKHNAV.

Your order has been successfully received.

Order Number: {{order_number}}
Order Total: Rs {{grand_total}}
Payment Method: {{payment_method}}
Payment Status: {{payment_status}}
Order Status: {{order_status}}

We will review your order and notify you again when it is confirmed.

Track your order anytime:
https://www.rukhnav.store/store/track-order.html

To track your order:
1. Enter your Order Number: {{order_number}}
2. Enter the same email address or mobile number used when placing the order.
3. Select Track Order.

Please keep your order number for future reference.

Thank you for choosing RUKHNAV — Beauty Inspired by Nature.',
    email_button_text = 'Track My Order',
    email_button_url = 'https://www.rukhnav.store/store/track-order.html',
    updated_at = CURRENT_TIMESTAMP
WHERE template_key = 'order_received_email'
  AND channel = 'Email';


UPDATE notification_templates
SET
    body = '🛍️ *RUKHNAV Order Received*

Hello {{customer_name}},

Thank you for shopping with RUKHNAV. Your order has been successfully received.

*Order Number:* {{order_number}}
*Total:* Rs {{grand_total}}
*Payment:* {{payment_method}}
*Payment Status:* {{payment_status}}
*Order Status:* {{order_status}}

We will notify you again when your order is confirmed.

🔎 *Track Your Order:*
https://www.rukhnav.store/store/track-order.html

To track:
1. Enter order number *{{order_number}}*
2. Enter the same email address or mobile number used for the order
3. Select *Track Order*

Please keep your order number for future reference.

_RUKHNAV — Beauty Inspired by Nature_',
    updated_at = CURRENT_TIMESTAMP
WHERE template_key = 'order_received_whatsapp'
  AND channel = 'WhatsApp';


-- Ensure the existing ORDER_PLACED rules remain enabled.
UPDATE notification_event_rules
SET
    enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE event_key = 'ORDER_PLACED'
  AND channel IN ('Email', 'WhatsApp')
  AND template_key IN (
      'order_received_email',
      'order_received_whatsapp'
  );
