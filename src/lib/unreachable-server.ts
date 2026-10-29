/** Fetch failed before JSON came back. Never tell production visitors to open XAMPP. */
export function unreachableServerMessage() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'Cannot reach the server. Start Apache and MySQL in XAMPP.'
    }
  }
  return 'Cannot reach the server. Please try again.'
}
