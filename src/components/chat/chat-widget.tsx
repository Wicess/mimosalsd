'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { closeChat, getChatUiOpen, getChatUiServerSnapshot, openChat, subscribeChatUi } from '@/lib/chat/chat-ui'
import { ChatIcon } from '@/components/ui/icon'
import { ChatPanel } from './chat-panel'
import { ChatUnreadBadge } from './unread-badge'
import { useViewportHeight } from './use-viewport-height'

/**
 * Live chat — the launcher and the frame around the conversation.
 *
 * Replaces the canned-reply "quick chat" with WHAM's two-way chat.
 *
 * DESKTOP: WHAM's floating launcher, bottom-right, opening a corner card.
 *
 * PHONE: no floating bubble. WHAM floats one there too, and in WHAM's own screenshot
 * it sits on top of the BUY NOW button. This site already decided the thumb zone
 * belongs to the tab bar and the sticky Add-to-Cart, so on a phone chat is a fifth
 * tab (see ChatTab) and opens as a full-screen sheet — a conversation needs the whole
 * screen for its keyboard anyway.
 *
 * Mounted lazily after the browser goes idle (components/ui/deferred.tsx), so none
 * of this is on the critical path. A Chat-tab tap that lands before the code arrives
 * is held in the shared store and honoured on mount.
 */
export function ChatWidget() {
  const open = useSyncExternalStore(subscribeChatUi, getChatUiOpen, getChatUiServerSnapshot)

  // WHAM's deep link: an alert or an email can open `/?openchat=1` straight onto the
  // conversation. The parameter is then stripped so a refresh or a shared link does
  // not keep re-opening it.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('openchat') === '1') {
      openChat()
      url.searchParams.delete('openchat')
      window.history.replaceState(null, '', url.toString())
    }
  }, [])

  // Sizes the phone panel to what the keyboard leaves visible, so the conversation
  // scrolls above the typing field instead of the field being pushed off screen.
  useViewportHeight(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeChat()
    window.addEventListener('keydown', onKey)
    // On a phone the panel sits over the page; the page behind it must not scroll.
    const phone = window.matchMedia('(max-width: 767px)').matches
    if (phone) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      if (phone) document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={openChat}
          aria-label="Chat with us"
          className="fixed right-5 bottom-5 z-(--z-drawer) hidden min-h-12 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-on-primary shadow-lg transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 motion-reduce:transition-none md:inline-flex"
        >
          <ChatIcon className="size-5" />
          Chat with us
          <ChatUnreadBadge className="-top-1.5 -right-1.5" />
        </button>
      ) : null}

      {open ? (
        <>
          {/* Phone: the site stays visible beside the panel; tapping it closes the chat. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close chat"
            onClick={closeChat}
            className="fixed inset-0 z-(--z-drawer) cursor-default bg-stone-950/45 motion-safe:animate-[fade-in_180ms_ease-out] md:hidden"
          />
          <div
            className={[
              'fixed z-(--z-drawer) overflow-hidden bg-background shadow-2xl',
              // Phone: a side panel over the site, as tall as the visible screen (keyboard
              // included), so the field stays put while the messages scroll. Desktop: a corner card.
              // Sizes come from .chat-card in globals.css (phones only), which follow the keyboard.
              'chat-card right-3 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border',
              'md:top-auto md:right-5 md:bottom-5 md:h-[min(640px,calc(100dvh-2.5rem))] md:w-[380px] md:rounded-2xl md:border',
              'motion-safe:animate-[fade-in_180ms_ease-out]',
            ].join(' ')}
          >
            <ChatPanel open={open} onClose={closeChat} />
          </div>
        </>
      ) : null}
    </>
  )
}
