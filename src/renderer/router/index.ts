import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/TEST_3D renderer.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router

