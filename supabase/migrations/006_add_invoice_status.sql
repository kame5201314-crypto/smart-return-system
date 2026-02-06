-- Add invoice_status column to return_requests
ALTER TABLE return_requests
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(20)
CHECK (invoice_status IN ('未作廢', '已作廢', '已折讓'))
DEFAULT '未作廢';
