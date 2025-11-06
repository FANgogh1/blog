<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

const loading = ref(true);
const posts = ref([]);
const errorMsg = ref('');
const user = ref(null);

// HTML 清理函数
const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

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
      <div v-else class="posts-grid">
        <router-link v-for="p in posts" :key="p.id" class="card post-card" :to="{ name: 'post', params: { id: p.id } }">
          <h3 class="post-title">{{ p.title }}</h3>
          <div class="post-meta">
            <span class="post-date">{{ p.created_at ? new Date(p.created_at).toLocaleString() : '' }}</span>
          </div>
          <p class="post-excerpt">{{ stripHtml(p.content)?.slice(0, 80) || '' }}</p>
          <div class="post-actions">
            <span class="btn view-btn">查看详情</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.post-card {
  padding: 20px;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.post-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
}

.post-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.post-date {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.post-excerpt {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  flex: 1;
  font-size: 14px;
}

.post-actions {
  margin-top: auto;
  display: flex;
  gap: 8px;
  padding-top: 16px;
}

.view-btn {
  pointer-events: none;
  font-size: 14px;
  padding: 8px 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .posts-grid {
    grid-template-columns: 1fr;
  }
}
</style>