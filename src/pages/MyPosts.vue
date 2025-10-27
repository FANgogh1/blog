<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const loading = ref(true);
const posts = ref([]);
const errorMsg = ref('');
const user = ref(null);

const fetchMyPosts = async () => {
  loading.value = true;
  errorMsg.value = '';
  const { data: userRes } = await supabase.auth.getUser();
  user.value = userRes?.user || userRes?.data?.user || null;
  if (!user.value) { loading.value = false; posts.value = []; return; }

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author', user.value.id)
    .order('created_at', { ascending: false });

  loading.value = false;
  if (error) { errorMsg.value = error.message || '加载失败'; posts.value = []; return; }
  posts.value = data || [];
};

onMounted(fetchMyPosts);
</script>

<template>
  <div>
    <h2 style="margin:0 0 16px;">我的博客</h2>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>

    <div v-else-if="!user" class="card" style="padding:16px;">
      你还未登录，<router-link to="/login">去登录</router-link>
    </div>

    <div v-else>
      <div v-if="errorMsg" style="color:#ff6b6b; margin-bottom:12px;">{{ errorMsg }}</div>
      <div v-if="!posts.length" style="color:var(--muted);">暂无文章</div>
      <div v-else class="grid cols-3">
        <router-link v-for="p in posts" :key="p.id" class="card" :to="{ name: 'post', params: { id: p.id } }" style="padding:16px; text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%;">
          <h3 style="margin:0 0 8px;">{{ p.title }}</h3>
          <p style="color:var(--muted); margin:0;">{{ (p.content || '').replace(/<[^>]+>/g, '')?.slice(0, 80) }}</p>
          <div style="margin-top:auto; display:flex; gap:8px;">
            <span class="btn primary" style="pointer-events:none;">查看详情</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>