<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const loading = ref(false);
const errorMsg = ref('');
const items = ref([]);

const fetchNotifications = async () => {
  loading.value = true; errorMsg.value = '';
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id || userRes?.data?.user?.id || null;
  if (!uid) { loading.value = false; items.value = []; errorMsg.value = '请先登录'; return; }
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient', uid)
    .order('created_at', { ascending: false })
    .limit(100);
  loading.value = false;
  if (error) { errorMsg.value = error.message || '加载失败'; items.value = []; return; }
  items.value = (data || []).map(d => ({ ...d }));
};

const markRead = async (n) => {
  if (!n?.id) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', n.id);
  if (error) {
    errorMsg.value = error.message || '标记已读失败';
    return;
  }
  n.read = true;
  window.dispatchEvent(new CustomEvent('refresh-unread'));
};

onMounted(() => {
  fetchNotifications();
  window.addEventListener('refresh-unread', fetchNotifications);
});
</script>

<template>
  <div class="card" style="padding:20px;">
    <h2 style="margin:0 0 12px;">通知</h2>
    <div v-if="loading">加载中...</div>
    <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
    <div v-if="!loading && !items.length" style="color:var(--muted);">暂无通知</div>
    <ul v-else style="display:grid; gap:8px; list-style:none; padding:0; margin:0;">
      <li v-for="n in items" :key="n.id" class="card" style="padding:12px; display:flex; align-items:center; gap:8px;">
        <router-link :to="{ name: 'post', params: { id: n.post_id } }" style="display:flex; align-items:center; gap:8px; flex:1; text-decoration:none; color:inherit;">
          <span :style="{ color: n.type==='comment' ? '#2b9e6e' : '#1f7aec', fontWeight: 600 }">
            {{ n.type==='comment' ? '评论' : '点赞' }}
          </span>
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <img v-if="n.actor_avatar" :src="n.actor_avatar" alt="avatar" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
            <span v-else style="width:22px; height:22px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--primary); font-weight:700;">
              {{ (n.actor_name || '用户').slice(0,1).toUpperCase() }}
            </span>
            <span style="color:var(--text);">{{ n.actor_name || '用户' }}</span>
          </span>
          <span style="color:var(--muted);">文章：{{ n.post_title || ('#' + n.post_id) }}</span>
          <span v-if="n.content" style="color:var(--text);">内容：{{ n.content }}</span>
          <span style="margin-left:auto; font-size:12px; color:var(--muted);">{{ new Date(n.created_at).toLocaleString() }}</span>
        </router-link>
        <router-link class="btn" :to="{ name: 'post', params: { id: n.post_id } }">前往文章</router-link>
        <button class="btn" v-if="!n.read" @click="markRead(n)">标记已读</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
</style>