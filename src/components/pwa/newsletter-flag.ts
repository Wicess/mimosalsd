/**
 * "This browser has joined the email list", remembered so the sign-up pop-up stops.
 * Its own module so the account page's form can set it without loading the pop-ups.
 */
const NEWSLETTER_KEY = 'sg-newsletter-subscribed'

export function hasJoinedNewsletter(): boolean {
  try {
    return localStorage.getItem(NEWSLETTER_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberNewsletterSubscribed(): void {
  try {
    localStorage.setItem(NEWSLETTER_KEY, '1')
  } catch {
    // Storage blocked: the pop-up returns next visit, and signing up again is harmless.
  }
}
