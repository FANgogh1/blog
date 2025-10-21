<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
const router = useRouter();
const form = ref({ email: '', password: '' });
const onSubmit = () => {
  // 仅演示：存入 localStorage，跳转个人中心
  localStorage.setItem('flatblog:user', JSON.stringify({ email: form.value.email }));
  router.push({ name: 'profile' });
};
</script>

<template>
  <div class="card" style="max-width:420px; margin:0 auto; padding:20px;">
    <h2 style="margin:0 0 16px;">登录</h2>
    <div style="display:grid; gap:12px;">
      <label>
        邮箱
        <input class="input" type="email" v-model="form.email" placeholder="you@example.com" />
      </label>
      <label>
        密码
        <input class="input" type="password" v-model="form.password" placeholder="••••••••" />
      </label>
      <button class="btn primary" @click="onSubmit">登录</button>
      <div style="text-align:center; color:var(--muted);">
        还没有账号？<router-link to="/register">去注册</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>