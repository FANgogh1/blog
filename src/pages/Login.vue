<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../lib/supabase';
const router = useRouter();
const form = ref({ email: '', password: '' });
const loading = ref(false);
const errorMsg = ref('');

const onSubmit = async () => {
  errorMsg.value = '';
  loading.value = true;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.value.email.trim(),
    password: form.value.password
  });
  loading.value = false;
  if (error) {
    errorMsg.value = error.message || '登录失败';
    return;
  }
  router.push({ name: 'home' });
};
</script>

<template>
  <div style="min-height:80vh; display:flex; align-items:center; justify-content:center; padding:20px;">
    <div class="card" style="max-width:420px; width:100%; padding:30px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <h2 style="margin:0 0 24px; text-align:center; font-size:28px; font-weight:600;">登录</h2>
      <div style="display:grid; gap:16px;">
        <label style="display:grid; gap:6px;">
          <span style="font-weight:500; color:var(--text);">邮箱</span>
          <input class="input" type="email" v-model="form.email" placeholder="youremail@example.com" style="padding:12px; font-size:16px;" />
        </label>
        <label style="display:grid; gap:6px;">
          <span style="font-weight:500; color:var(--text);">密码</span>
          <input class="input" type="password" v-model="form.password" placeholder="请输入密码" style="padding:12px; font-size:16px;" />
        </label>
        <button class="btn primary" @click="onSubmit" style="padding:12px; font-size:16px; font-weight:500; margin-top:8px;">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <div v-if="errorMsg" style="color:#ff6b6b; margin-top:8px; text-align:center; padding:8px; background:#fff5f5; border-radius:4px;">{{ errorMsg }}</div>
        <div style="text-align:center; color:var(--muted); margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
          还没有账号？<router-link to="/register" style="color:var(--primary); font-weight:500;">去注册</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>