import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { isLoggedIn } from '@/lib/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without being logged in. */
    public?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
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
        {
          path: 'groups',
          name: 'groups',
          components: {
            default: () => import('@/views/GroupsView.vue'),
            sidebar: () => import('@/components/groups/GroupList.vue'),
          },
        },
        { path: 'alerts', name: 'alerts', component: () => import('@/views/AlertsView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  // Switching users goes through logout(), which reloads the page and clears all cached data.
  if (to.name === 'login' && isLoggedIn()) return { name: 'chats' }
  if (!to.meta.public && !isLoggedIn()) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
})
