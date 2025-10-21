<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from './lib/supabase';

const currentUser = ref(null);

const loadUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  currentUser.value = error ? null : data.user || null;
};

onMounted(async () => {
  await loadUser();
  supabase.auth.onAuthStateChange((_event, _session) => {
    // 任何登录/登出/更新事件都刷新用户
    loadUser();
  });
});

const displayName = () =>
  currentUser.value?.user_metadata?.nickname ||
  currentUser.value?.email ||
  '';
const avatarUrl = () => currentUser.value?.user_metadata?.avatar_url || '';
const initial = () =>
  (displayName() || 'U').slice(0, 1).toUpperCase();
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="brand">FlatBlog</router-link>
      <div class="nav" style="margin-left:auto; display:flex; align-items:center; gap:8px;">
        <router-link to="/">首页</router-link>
        <router-link to="/profile">个人中心</router-link>

        <!-- 登录态：显示头像与昵称 -->
        <template v-if="currentUser">
          <router-link to="/profile" style="display:flex; align-items:center; gap:10px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; overflow:hidden; border:1px solid var(--border); background:#163229;">
              <img v-if="avatarUrl()" :src="avatarUrl()" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />
              <span v-else style="color:var(--primary); font-size:14px; font-weight:700;">{{ initial() }}</span>
            </span>
            <span style="color:var(--text);">{{ displayName() }}</span>
          </router-link>
        </template>

        <!-- 未登录态：显示登录/注册 -->
        <template v-else>
          <router-link to="/login">登录</router-link>
          <router-link to="/register">注册</router-link>
        </template>
      </div>
    </div>
  </nav>

  <div class="container">
    <router-view />
  </div>

  <footer class="footer">© 2025 FlatBlog</footer>
</template>

<style scoped>
/* 导航右侧元素对齐由内联样式控制 */
</style>