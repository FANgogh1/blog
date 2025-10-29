<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const user = ref(null);
const loading = ref(true);

const form = ref({
  nickname: '',
  bio: '',
  avatarFile: null,
  avatarPreview: ''
});
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');
const editMode = ref(false);

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
  form.value.bio = meta.bio || '';
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
  if (!user.value || !editMode.value) return;
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
        bio: form.value.bio?.trim() || '',
        avatar_url: avatarUrl || ''
      }
    });
    if (error) throw error;

    // 同步本地 user
    user.value = data.user;
    successMsg.value = '保存成功';
    editMode.value = false;
  } catch (e) {
    errorMsg.value = e?.message || '保存失败';
  } finally {
    saving.value = false;
  }
};

const cancelEdit = () => {
  if (!user.value) return;
  const meta = user.value.user_metadata || {};
  form.value.nickname = meta.nickname || '';
  form.value.bio = meta.bio || '';
  form.value.avatarPreview = meta.avatar_url || '';
  form.value.avatarFile = null;
  errorMsg.value = '';
  successMsg.value = '';
  editMode.value = false;
};

const logout = async () => {
  await supabase.auth.signOut();
  location.href = '/';
};
</script>

<template>
  <div class="card" style="max-width:960px; margin:0 auto; padding:30px;">
    <h2 style="margin:0 0 16px;">个人中心</h2>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>

    <div v-else-if="!user" style="color:var(--muted);">
      尚未登录，<router-link to="/login">去登录</router-link>
    </div>

    <div v-else style="display:grid; gap:16px;">
      <!-- 头像与基础信息 -->
      <div style="display:flex; align-items:center; justify-content:space-between;">
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
            <div style="margin-top:8px; white-space:pre-wrap; color:var(--text);">{{ user.user_metadata?.bio || '尚未填写个人简介' }}</div>
          </div>
        </div>
        <!-- 退出登录按钮 - 与头像高度一致 -->
        <button class="btn" @click="logout" style="align-self:flex-start;">退出登录</button>
      </div>

      <!-- 编辑表单 -->
      <div class="card" style="padding:16px; display:grid; gap:12px;">
        <label>
          昵称
          <input class="input" v-model="form.nickname" placeholder="输入新的昵称" :disabled="!editMode" />
        </label>
        <label>
          头像
          <input class="input" type="file" accept="image/*" @change="onPickAvatar" :disabled="!editMode" />
        </label>
        <label>
          个人简介
          <textarea class="input" v-model="form.bio" placeholder="用几句话介绍自己..." rows="4" :disabled="!editMode" style="resize: none;"></textarea>
        </label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn" @click="editMode ? cancelEdit() : (editMode = true)">
            {{ editMode ? '取消编辑' : '编辑资料' }}
          </button>
          <button class="btn primary" :disabled="saving || !editMode" @click="onSave">
            {{ saving ? '保存中...' : '保存资料' }}
          </button>
        </div>
        <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
        <div v-if="successMsg" style="color:#18c37a;">{{ successMsg }}</div>

      </div>
    </div>
  </div>
</template>

<style scoped>
</style>