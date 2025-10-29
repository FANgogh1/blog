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
      <router-link v-for="p in results" :key="p.id" class="card" :to="{ name: 'post', params: { id: p.id } }" style="padding:16px; text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%;">
        <h3 style="margin:0 0 8px;">{{ p.title }}</h3>
        
        <!-- 作者信息和日期 - 显示在标题下面 -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px; color:var(--muted);">
            <!-- 作者头像 -->
            <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
            <div v-else style="width:24px; height:24px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--primary); font-weight:700;">
              {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
            </div>
            <span style="font-size:12px;">{{ p.author_name || '匿名' }}</span>
          </div>
          
          <!-- 发布日期 -->
          <span style="color:var(--muted); font-size:12px;">
            {{ p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '' }}
          </span>
        </div>
        
        <p style="color:var(--muted); margin:0 0 12px; flex:1;">{{ (p.content || '').replace(/<[^>]+>/g, '')?.slice(0, 80) }}</p>
        
        <span class="btn primary" style="pointer-events:none; margin-top:auto;">查看详情</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
</style>