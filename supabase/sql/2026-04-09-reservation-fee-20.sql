-- Lower reservation fee from 100 PHP (10000 centavos) to 20 PHP (2000 centavos).
-- All 20 PHP goes to the RESEATO system — vendors no longer receive any commission.

begin;

-- Update column default so new reservations use the new fee
alter table if exists public.reservations
  alter column payment_amount set default 2000;

-- Update existing unpaid reservations that still use the old 10000 default.
-- Paid reservations are left untouched to preserve historical records.
update public.reservations
set payment_amount = 2000
where payment_amount = 10000
  and payment_status in ('unpaid', 'processing', 'failed');

commit;
