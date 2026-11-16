import type { Conversation } from '@/types/chat'

// Temporary hardcoded data until the conversations API exists.
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const mockConversations: Conversation[] = [
  {
    id: 'project-team',
    type: 'group',
    name: 'Project Team',
    members: [
      { id: 'erik', name: 'Erik Nilsson' },
      { id: 'oskar', name: 'Oskar Berg' },
      { id: 'sara', name: 'Sara Holm' },
      { id: 'emma', name: 'Emma Lind' },
    ],
    lastMessage: { text: 'On it tonight.', sentAt: minutesAgo(12), senderName: 'You', fromMe: true },
    unreadCount: 0,
  },
  {
    id: 'emma',
    type: 'direct',
    name: 'Emma Lind',
    members: [{ id: 'emma', name: 'Emma Lind', online: true }],
    lastMessage: {
      text: 'Sending the photos from Saturday',
      sentAt: minutesAgo(130),
      senderName: 'Emma Lind',
      fromMe: false,
    },
    unreadCount: 1,
  },
]
