<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const user = ref(null);
const loading = ref(true);

const form = ref({
  nickname: '',
  avatarFile: null,
  avatarPreview: ''
});
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

/** 加载当前用户与资料 */
onMounted(async () => {
  const { data, error } = await supabase.auth.getUser();
  loading.value = false;
  if (error) {
    user.value = null;
    return;
  }
  user.value = data.user || null;

  const meta = user.value?.user_metadata || {};
  form.value.nickname = meta.nickname || '';
  const url = meta.avatar_url || '';
  form.value.avatarPreview = url;
});

/** 选择头像文件，做本地预览 */
const onPickAvatar = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  form.value.avatarFile = file;
  try {
    form.value.avatarPreview = URL.createObjectURL(file);
  } catch {}
};

/** 保存资料：先上传头像(如有)，再更新用户 metadata */
const onSave = async () => {
  if (!user.value) return;
  errorMsg.value = '';
  successMsg.value = '';
  saving.value = true;

  let avatarUrl = form.value.avatarPreview || '';

  try {
    // 若选择了新文件则上传
    if (form.value.avatarFile) {
      const uid = user.value.id;
      const ext = form.value.avatarFile.name.split('.').pop() || 'png';
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, form.value.avatarFile, { upsert: true, cacheControl: '3600', contentType: form.value.avatarFile.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = pub?.publicUrl || avatarUrl;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        nickname: form.value.nickname?.trim() || '',
        avatar_url: avatarUrl || ''
      }
    });
    if (error) throw error;

    // 同步本地 user
    user.value = data.user;
    successMsg.value = '保存成功';
  } catch (e) {
    errorMsg.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
};

const logout = async () => {
  await supabase.auth.signOut();
  location.href = '/';
};
</script>

<template>
  <div class="card" style="max-width:760px; margin:0 auto; padding:20px;">
    <h2 style="margin:0 0 16px;">个人中心</h2>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>

    <div v-else-if="!user" style="color:var(--muted);">
      尚未登录，<router-link to="/login">去登录</router-link>
    </div>

    <div v-else style="display:grid; gap:16px;">
      <!-- 头像与基础信息 -->
      <div style="display:flex; align-items:center; gap:16px;">
        <div style="position:relative;">
          <img v-if="form.avatarPreview" :src="form.avatarPreview" alt="avatar"
               style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
          <div v-else
               style="width:80px; height:80px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
            {{ (user.user_metadata?.nickname || user.email || 'U').slice(0,1).toUpperCase() }}
          </div>
        </div>
        <div>
          <div style="font-weight:600;">{{ user.user_metadata?.nickname || '未设置昵称' }}</div>
          <div style="color:var(--muted); font-size:13px;">{{ user.email }}</div>
        </div>
      </div>

      <!-- 编辑表单 -->
      <div class="card" style="padding:16px; display:grid; gap:12px;">
        <label>
          昵称
          <input class="input" v-model="form.nickname" placeholder="输入新的昵称" />
        </label>
        <label>
          头像
          <input class="input" type="file" accept="image/*" @change="onPickAvatar" />
        </label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn primary" :disabled="saving" @click="onSave">
            {{ saving ? '保存中...' : '保存资料' }}
          </button>
          <router-link class="btn" to="/">返回首页</router-link>
          <button class="btn" @click="logout">退出登录</button>
        </div>
        <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
        <div v-if="successMsg" style="color:#18c37a;">{{ successMsg }}</div>
        <div style="color:var(--muted); font-size:12px;">
          提示：需在 Supabase Storage 中创建公开桶 “avatars”，并允许已登录用户上传/读取。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>