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

    <div v-else class="posts-grid">
      <router-link v-for="p in results" :key="p.id" class="card post-card" :to="{ name: 'post', params: { id: p.id } }">
        <h3 class="post-title">{{ p.title }}</h3>
        <div class="post-meta">
          <div class="author-info">
            <router-link v-if="p.author" :to="{ name: 'user', params: { id: p.author } }" style="text-decoration:none; color:inherit;">
              <div style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" class="author-avatar" />
                <div v-else class="author-avatar-placeholder">
                  {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
                </div>
                <span class="author-name">{{ p.author_name || '匿名' }}</span>
              </div>
            </router-link>
            <div v-else style="display:flex; align-items:center; gap:8px;">
              <img v-if="p.author_avatar" :src="p.author_avatar" alt="avatar" class="author-avatar" />
              <div v-else class="author-avatar-placeholder">
                {{ (p.author_name || '匿名').slice(0,1).toUpperCase() }}
              </div>
              <span class="author-name">{{ p.author_name || '匿名' }}</span>
            </div>
          </div>
          <span class="post-date">{{ p.created_at ? new Date(p.created_at).toLocaleString() : '' }}</span>
        </div>
        <p class="post-excerpt">{{ (p.content || '').replace(/<[^>]+>/g, '')?.slice(0, 60) || '' }}</p>
        <div class="post-actions">
          <span class="btn view-btn">查看详情</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
/* 文章网格布局 */
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

.author-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}

.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.author-avatar-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #163229;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--primary);
  font-weight: 700;
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