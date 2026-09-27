/**
 * Open/close state for the cart drawer.
 *
 * A module-level store rather than React context, because the two things that open
 * the drawer — the header button and the buy box on a product page — sit in
 * completely different parts of the tree, and the drawer itself is mounted in the
 * layout. Threading a provider around all three would mean turning layout chrome into
 * client components for the sake of one boolean.
 *
 * `useSyncExternalStore` is the supported way to read this from a component without
 * tearing during concurrent rendering.
 */

type Listener = () => void

let open = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeCartUi(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCartUiOpen(): boolean {
  return open
}

/** The server never renders the drawer open, so the SSR snapshot is always closed. */
export function getCartUiServerSnapshot(): boolean {
  return false
}

export function openCart(): void {
  if (open) return
  open = true
  emit()
}

export function closeCart(): void {
  if (!open) return
  open = false
  emit()
}
