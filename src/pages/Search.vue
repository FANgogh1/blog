<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../lib/supabase';

const route = useRoute();
const q = ref(route.query.q ? String(route.query.q) : '');
const loading = ref(false);
const errorMsg = ref('');
const results = ref([]);

const search = async () => {
  const keyword = q.value.trim();
  if (!keyword) { results.value = []; return; }
  loading.value = true;
  errorMsg.value = '';
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .ilike('title', `%${keyword}%`)
    .order('created_at', { ascending: false });
  loading.value = false;
  if (error) { errorMsg.value = error.message || '搜索失败'; results.value = []; return; }
  results.value = data || [];
};

onMounted(search);
watch(() => route.query.q, (val) => { q.value = val ? String(val) : ''; search(); });
</script>

<template>
  <div>
    <h2 style="margin:0 0 16px;">搜索结果</h2>
    <div style="color:var(--muted); margin-bottom:12px;">关键词：{{ q }}</div>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>
    <div v-else-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
    <div v-else-if="!results.length" style="color:var(--muted);">未找到相关博客</div>

    <div v-else class="grid cols-3">
      <router-link v-for="p in results" :key="p.id" class="card" :to="{ name: 'post', params: { id: p.id } }" style="padding:16px; text-decoration:none; color:inherit; display:block;">
        <h3 style="margin:0 0 8px;">{{ p.title }}</h3>
        <p style="color:var(--muted); margin:0 0 12px;">{{ (p.content || '').replace(/<[^>]+>/g, '')?.slice(0, 80) }}</p>
        <span class="btn primary" style="pointer-events:none;">查看详情</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
</style>