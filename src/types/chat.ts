export interface ChatUser {
  id: string
  name: string
  online?: boolean
}

export interface MessagePreview {
  text: string
  sentAt: string
  senderName: string
  fromMe: boolean
}

export interface Conversation {
  id: string
  type: 'direct' | 'group'
  name: string
  members: ChatUser[]
  lastMessage: MessagePreview
  unreadCount: number
}
