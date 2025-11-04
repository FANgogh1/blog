<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { supabase } from './lib/supabase';
import { useRouter } from 'vue-router';

const router = useRouter();
const currentUser = ref(null);
const unreadCount = ref(0);

const loadUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  currentUser.value = error ? null : data.user || null;
};

onMounted(async () => {
  await loadUser();
  await fetchUnreadCount();
  supabase.auth.onAuthStateChange((_event, _session) => {
    loadUser();
    fetchUnreadCount();
  });
});

onMounted(() => {
  window.addEventListener('refresh-unread', fetchUnreadCount);
});
onUnmounted(() => {
  window.removeEventListener('refresh-unread', fetchUnreadCount);
});

const fetchUnreadCount = async () => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id || userRes?.data?.user?.id || null;
    if (!uid) { return; }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient', uid)
      .eq('read', false);
    if (typeof count === 'number') unreadCount.value = count;
  } catch (_) { /* noop */ }
};

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
const searchQuery = ref('');
const doSearch = () => {
  const q = searchQuery.value.trim();
  if (!q) return;
  router.push({ name: 'search', query: { q } });
};

const theme = ref(localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
const applyTheme = () => { document.documentElement.setAttribute('data-theme', theme.value); };
const toggleTheme = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark'; localStorage.setItem('theme', theme.value); applyTheme(); };
onMounted(() => { applyTheme(); });
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="brand">FlatBlog</router-link>
      <div class="nav-center" style="flex:1; display:flex; justify-content:center; align-items:center; gap:8px;">
        <div style="position:relative; min-width:280px;">
          <input class="input" v-model="searchQuery" placeholder="搜索博客标题..." @keyup.enter="doSearch" style="padding-right:36px; width:100%;" />
          <button class="btn" @click="doSearch" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="nav" style="margin-left:auto; display:flex; align-items:center; gap:12px;">
        <button class="btn" @click="toggleTheme" title="切换主题" style="display:flex; align-items:center; gap:6px; padding:6px 10px;">
          <svg v-if="theme==='dark'" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>
        <router-link to="/">首页</router-link>
        <router-link to="/hot">热榜</router-link>
        <router-link to="/following">关注</router-link>
        <router-link to="/my">我的博客</router-link>
        <router-link to="/notifications" style="position:relative;">通知
          <span v-if="unreadCount>0" class="badge">{{ unreadCount }}</span>
        </router-link>

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
.badge { position:absolute; top:-6px; right:-10px; background:#ff4d4f; color:#fff; border-radius:10px; padding:0 6px; font-size:12px; line-height:18px; min-width:18px; text-align:center; }
</style>