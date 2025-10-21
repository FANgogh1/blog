<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../lib/supabase';
const router = useRouter();
const form = ref({ email: '', password: '', nickname: '' });
const loading = ref(false);
const errorMsg = ref('');
const infoMsg = ref('');

const onSubmit = async () => {
  errorMsg.value = ''; infoMsg.value = '';
  loading.value = true;
  const { data, error } = await supabase.auth.signUp({
    email: form.value.email.trim(),
    password: form.value.password,
    options: {
      data: { nickname: form.value.nickname?.trim() || '' }
    }
  });
  loading.value = false;
  if (error) {
    errorMsg.value = error.message || '注册失败';
    return;
  }
  infoMsg.value = '注册成功，请前往邮箱验证后登录';
  router.push({ name: 'login' });
};
</script>

<template>
  <div class="card" style="max-width:480px; margin:0 auto; padding:20px;">
    <h2 style="margin:0 0 16px;">注册</h2>
    <div style="display:grid; gap:12px;">
      <label>
        昵称
        <input class="input" v-model="form.nickname" placeholder="起一个好听的名字" />
      </label>
      <label>
        邮箱
        <input class="input" type="email" v-model="form.email" placeholder="you@example.com" />
      </label>
      <label>
        密码
        <input class="input" type="password" v-model="form.password" placeholder="至少 6 位" />
      </label>
      <button class="btn primary" @click="onSubmit">注册</button>
      <div style="text-align:center; color:var(--muted);">
        已有账号？<router-link to="/login">去登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>