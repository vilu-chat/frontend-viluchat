import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', redirect: { name: 'chats' } },
        {
          path: 'chats/:id?',
          name: 'chats',
          // `default` fills the middle column, `sidebar` fills the list under the tabs.
          components: {
            default: () => import('@/views/ChatView.vue'),
            sidebar: () => import('@/components/chats/ConversationList.vue'),
          },
          props: { default: true },
        },
        { path: 'friends', name: 'friends', component: () => import('@/views/FriendsView.vue') },
        { path: 'groups', name: 'groups', component: () => import('@/views/GroupsView.vue') },
        { path: 'alerts', name: 'alerts', component: () => import('@/views/AlertsView.vue') },
      ],
    },
  ],
})
