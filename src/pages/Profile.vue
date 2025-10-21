<script setup>
import { ref, onMounted } from 'vue';
const user = ref(null);
onMounted(() => {
  try { user.value = JSON.parse(localStorage.getItem('flatblog:user') || 'null'); }
  catch { user.value = null; }
});
const logout = () => {
  localStorage.removeItem('flatblog:user');
  location.href = '/';
};
</script>

<template>
  <div class="card" style="max-width:680px; margin:0 auto; padding:20px;">
    <h2 style="margin:0 0 16px;">个人中心</h2>
    <div v-if="!user" style="color:var(--muted);">
      尚未登录，<router-link to="/login">去登录</router-link>
    </div>
    <div v-else style="display:grid; gap:12px;">
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="width:64px; height:64px; border-radius:50%; background:#eef4ff; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
          {{ (user.nickname || user.email || 'U').slice(0,1).toUpperCase() }}
        </div>
        <div>
          <div style="font-weight:600;">{{ user.nickname || '未设置昵称' }}</div>
          <div style="color:var(--muted); font-size:13px;">{{ user.email }}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <router-link class="btn" to="/">返回首页</router-link>
        <button class="btn" @click="logout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>