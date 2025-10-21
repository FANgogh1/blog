<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from './lib/supabase';
import { useRouter } from 'vue-router';

const router = useRouter();
const currentUser = ref(null);

const loadUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  currentUser.value = error ? null : data.user || null;
};

onMounted(async () => {
  await loadUser();
  supabase.auth.onAuthStateChange((_event, _session) => {
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

const logout = async () => {
  await supabase.auth.signOut();
  await loadUser();
  router.push('/');
};
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="brand">FlatBlog</router-link>
      <div class="nav" style="margin-left:auto; display:flex; align-items:center; gap:12px;">
        <router-link to="/">首页</router-link>

        <!-- 登录态：头像+昵称（点击进个人中心） + 退出 -->
        <template v-if="currentUser">
          <router-link to="/profile" style="display:flex; align-items:center; gap:10px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; overflow:hidden; border:1px solid var(--border); background:#163229;">
              <img v-if="avatarUrl()" :src="avatarUrl()" alt="avatar" style="width:100%; height:100%; object-fit:cover;" />
              <span v-else style="color:var(--primary); font-size:14px; font-weight:700;">{{ initial() }}</span>
            </span>
            <span style="color:var(--text); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ displayName() }}</span>
          </router-link>
          <button class="btn" @click="logout">退出</button>
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