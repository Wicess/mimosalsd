'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { ACCOUNT_SECTIONS, type AccountSection } from '@/components/account/account-shell'
import { ChatUnreadBadge } from '@/components/chat/unread-badge'
import { UnreadWatcher } from '@/components/chat/unread-watcher'
import { useViewportHeight } from '@/components/chat/use-viewport-height'
import { ArrowLeftIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'

/** Back to wherever the customer came from, or the home page when the profile was opened directly. */
export function useProfileBack() {
  const router = useRouter()
  return useCallback(() => {
    if (window.history.length > 1) router.back()
    else router.push(url.home())
  }, [router])
}

/**
 * The profile, as its own app (owner, 2026-09-14): every profile page fills the
 * screen, with no site header, footer or tab bar. One bar across the top holds the
 * back button and the three pages; below it, the chat fills the rest, sized to what
 * the keyboard leaves visible, or the page scrolls on its own.
 */
export function ProfileFrame({ current, children }: { current: AccountSection; children: React.ReactNode }) {
  const back = useProfileBack()
  const chat = current === 'chat'
  useViewportHeight(chat)

  // Nothing of the page behind scrolls: the profile is the whole screen.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-[var(--app-vv-top,0px)] z-(--z-modal) flex h-[var(--app-vh,100dvh)] flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full! text-foreground hover:bg-surface-sunken"
        >
          <ArrowLeftIcon className="size-5" />
        </button>
        <nav aria-label="Profile" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex gap-1">
            {ACCOUNT_SECTIONS.map((section) => {
              const active = section.id === current
              return (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    prefetch={false}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex min-h-11 items-center rounded-full! px-4 text-sm font-medium whitespace-nowrap transition-colors',
                      active ? 'bg-primary-muted text-foreground' : 'text-foreground-muted hover:text-foreground',
                    )}
                  >
                    {section.label}
                    {section.id === 'chat' && !active ? <ChatUnreadBadge className="top-0.5 -right-0.5" /> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      {chat ? (
        <div className="min-h-0 flex-1">{children}</div>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] md:px-6">{children}</div>
        </main>
      )}
      {/* Replies from the team still count up on the Chat tab while an other page is open. */}
      {chat ? null : <UnreadWatcher />}
    </div>
  )
}
