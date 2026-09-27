'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

export interface SelectOption {
  readonly value: string
  readonly label: string
}

/**
 * A select whose open list looks like the rest of the site.
 *
 * The native `<select>` opens the operating system's own menu: a grey system
 * sheet on Android, a wheel on iOS, a flat OS menu on desktop. None of them carry
 * the site's type, colour or corners, and on the one form a wholesale buyer fills
 * in, that menu was the only part of the page that did not look like the page.
 *
 * It follows the WAI-ARIA "select-only combobox" pattern, so it still behaves like
 * a select for everyone who does not use a mouse:
 *
 *  · focus stays on the button; the highlighted option is announced through
 *    `aria-activedescendant`, the way a native select announces it
 *  · arrow keys, Home and End move; Enter or Space picks; Escape closes without
 *    changing anything; typing letters jumps ("Tex" lands on Texas, the only way to
 *    cross 51 states quickly)
 *  · a tap outside closes it, and the list opens upward when the screen has more
 *    room above the button than below it
 *
 * The value posts through a hidden input under `name`, so the form and its server
 * action cannot tell it apart from the native control it replaces. Browsers do not
 * validate hidden inputs, so a required select is checked by its form, which sets
 * `invalid` and names the field in its message.
 */
export function Select({
  name,
  options,
  placeholder,
  defaultValue = '',
  id,
  labelId,
  invalid = false,
  describedBy,
  onChange,
  size = 'md',
  className,
}: {
  name: string
  options: readonly SelectOption[]
  /** Shown while nothing is chosen. It is not itself an option. */
  placeholder: string
  defaultValue?: string
  /**
   * The button's id, so an existing `<label htmlFor>` names it. A button is a
   * labelable element, so a wrapping <label> works too.
   */
  id?: string
  /** The id of the visible label, when it is not a <label> element. */
  labelId?: string
  invalid?: boolean
  /** The id of an error message to associate while `invalid`. */
  describedBy?: string
  onChange?: (value: string) => void
  /** `sm` for toolbars and table rows. Both sizes are more compact on phones. */
  size?: 'md' | 'sm'
  /** Classes for the outer wrapper (it carries `mt-1` by default). */
  className?: string
}) {
  const listId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [upward, setUpward] = useState(false)
  const typed = useRef({ text: '', at: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const optionId = (i: number) => `${listId}-option-${i}`

  const openList = useCallback(
    (index?: number) => {
      /*
        Room is measured at the moment of opening, not on scroll: the list is
        short-lived, and a list that moved while a thumb was on it would be worse
        than one that opened on the tighter side.
      */
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        // Below `lg` a fixed tab bar covers the last ~72px of the screen.
        const bottomBar = window.matchMedia('(width < 64rem)').matches ? 72 : 0
        const below = window.innerHeight - bottomBar - rect.bottom
        setUpward(below < 300 && rect.top > below)
      }
      setActive(index ?? (selectedIndex >= 0 ? selectedIndex : 0))
      setOpen(true)
    },
    [selectedIndex],
  )

  const choose = (index: number) => {
    const option = options[index]
    if (!option) return
    setValue(option.value)
    onChange?.(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  /*
    Keep the highlighted option in view as the keyboard moves through a long list.

    The LIST scrolls, never the page. This was `scrollIntoView({ block: 'nearest' })`,
    which scrolls every scrollable ancestor, the window included: on a phone,
    opening a dropdown moved the whole page until the button sat under the header,
    or pushed the list off the bottom of the screen.
  */
  useEffect(() => {
    const list = listRef.current
    const option = list?.children[active] as HTMLElement | undefined
    if (!open || !list || !option) return
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop - 4
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight + 4
    }
  }, [open, active])

  // A tap or click anywhere else closes the list without changing the value.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /** Jump to the next option whose label starts with what has been typed. */
  const typeAhead = (key: string) => {
    const now = Date.now()
    typed.current.text = now - typed.current.at > 600 ? key : typed.current.text + key
    typed.current.at = now
    const query = typed.current.text.toLowerCase()
    const from = open ? active : Math.max(selectedIndex, 0)
    const order = [...options.keys()].map((k) => (from + (query.length === 1 ? 1 : 0) + k) % options.length)
    const hit = order.find((i) => options[i]!.label.toLowerCase().startsWith(query))
    if (hit === undefined) return
    if (open) setActive(hit)
    else openList(hit)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      } else if (event.key.length === 1 && /\S/.test(event.key)) {
        typeAhead(event.key)
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(i + 1, last))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(last)
        break
      case 'PageDown':
        event.preventDefault()
        setActive((i) => Math.min(i + 10, last))
        break
      case 'PageUp':
        event.preventDefault()
        setActive((i) => Math.max(i - 10, 0))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(active)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) typeAhead(event.key)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className ?? 'mt-1')}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-surface text-left transition-colors duration-150 ease-[var(--ease-standard)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none',
          // Phones get the compact control; from md it grows to the desktop size.
          size === 'sm'
            ? 'min-h-9 px-3 py-1.5 text-sm md:min-h-10'
            : 'min-h-10 px-3 py-1.5 text-sm md:min-h-11 md:gap-3 md:px-3.5 md:py-2 md:text-base',
          invalid
            ? 'border-danger-fg'
            : open
              ? 'border-primary'
              : 'border-border-strong hover:border-foreground-subtle',
        )}
      >
        <span className={cn('min-w-0 truncate', selected ? 'text-foreground' : 'text-foreground-subtle')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 shrink-0 text-foreground-muted transition-transform duration-150 ease-[var(--ease-standard)] motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          tabIndex={-1}
          className={cn(
            'absolute z-10 max-h-56 min-w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1 shadow-lg motion-safe:animate-[bubble-in_150ms_var(--ease-standard)] md:max-h-72',
            size === 'sm' ? 'right-0' : 'inset-x-0',
            upward ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value
            return (
              <li
                key={option.value || `empty-${i}`}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                /*
                  pointerdown, not click: the button would otherwise lose focus first
                  and the outside-tap handler would close the list before the choice
                  landed.
                */
                onPointerDown={(event) => {
                  event.preventDefault()
                  choose(i)
                }}
                onPointerMove={() => setActive(i)}
                className={cn(
                  'flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 text-sm whitespace-nowrap text-foreground md:min-h-11 md:px-3',
                  size === 'md' && 'md:text-base',
                  i === active && 'bg-surface-sunken',
                  isSelected && 'font-medium',
                )}
              >
                <span className="min-w-0">{option.label}</span>
                {isSelected && <CheckIcon className="size-4 shrink-0 text-primary" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
