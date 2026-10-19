/** Stripe test cards (https://docs.stripe.com/testing). */
export const CARDS = {
  visa: { number: '4242 4242 4242 4242', expiry: '12 / 34', cvc: '123' },
  declined: { number: '4000 0000 0000 0002', expiry: '12 / 34', cvc: '123' },
  threeDS: { number: '4000 0027 6000 3184', expiry: '12 / 34', cvc: '123' },
} as const;
