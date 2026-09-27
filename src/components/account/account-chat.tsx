'use client'

import { useEffect } from 'react'
import { ChatPanel } from '@/components/chat/chat-panel'
import { ProfileFrame, useProfileBack } from '@/components/account/profile-frame'
import { closeChat } from '@/lib/chat/chat-ui'

/**
 * The profile chat, full screen like a messaging app: the profile's bar on top, the
 * conversation below, and the typing field always in view above the keyboard.
 */
export function AccountChat() {
  const back = useProfileBack()

  // One conversation on screen at a time: the floating chat is closed while this is open.
  useEffect(() => {
    closeChat()
  }, [])

  return (
    <ProfileFrame current="chat">
      <ChatPanel open variant="page" onClose={back} />
    </ProfileFrame>
  )
}
