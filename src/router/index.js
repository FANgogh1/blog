import { createRouter, createWebHistory } from 'vue-router';

import Home from '../pages/Home.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import PostDetail from '../pages/PostDetail.vue';
import Profile from '../pages/Profile.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
  { path: '/register', name: 'register', component: Register },
  { path: '/post/:id', name: 'post', component: PostDetail, props: true },
  { path: '/profile', name: 'profile', component: Profile },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;