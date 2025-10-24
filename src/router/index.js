import { createRouter, createWebHistory } from 'vue-router';

import Home from '../pages/Home.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import PostDetail from '../pages/PostDetail.vue';
import Profile from '../pages/Profile.vue';
import MyPosts from '../pages/MyPosts.vue';
import Hot from '../pages/Hot.vue';
import Search from '../pages/Search.vue';

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
  { path: '/register', name: 'register', component: Register },
  { path: '/post/:id', name: 'post', component: PostDetail, props: true },
  { path: '/profile', name: 'profile', component: Profile },
  { path: '/my', name: 'my', component: MyPosts },
  { path: '/hot', name: 'hot', component: Hot },
  { path: '/search', name: 'search', component: Search },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;