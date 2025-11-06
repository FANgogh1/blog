<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../lib/supabase';

// 获取用户信息（优先从user_profiles表，其次从posts表，最后默认值）
const getUserInfoFromProfiles = async (userId) => {
  try {
    // 1. 首先尝试从user_profiles表获取
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profileData) {
      return { 
        nickname: profileData.nickname || '用户', 
        avatar_url: profileData.avatar_url || '' 
      };
    }
    
    // 2. 如果user_profiles表没有数据，尝试从posts表获取
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('author_name, author_avatar')
      .eq('author', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!postsError && postsData && postsData.length > 0) {
      return { 
        nickname: postsData[0].author_name || '用户', 
        avatar_url: postsData[0].author_avatar || '' 
      };
    }
    
    // 3. 如果都没有数据，返回默认值
    return { nickname: '用户', avatar_url: '' };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { nickname: '用户', avatar_url: '' };
  }
};

const loading = ref(true);
const errorMsg = ref('');
const items = ref([]); // [{ post, likeCount }]

// HTML 清理函数
const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
};

const fetchHot = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    // 1) 拉取所有点赞的 post_id，再在前端聚合计数（简化实现）
    const { data: likes, error: likeErr } = await supabase
      .from('post_likes')
      .select('post_id');
    if (likeErr) throw likeErr;

    const countMap = new Map();
    (likes || []).forEach(l => {
      const k = l.post_id;
      countMap.set(k, (countMap.get(k) || 0) + 1);
    });

    let posts = [];
    if (countMap.size > 0) {
      const ids = Array.from(countMap.keys());
    const { data: postsRes, error: postErr } = await supabase
      .from('posts')
      .select('*')
      .in('id', ids);
    if (postErr) throw postErr;
    posts = postsRes || [];
    
    // 对每个文章作者同步获取最新的用户信息
    const postsWithLatestInfo = await Promise.all(
      posts.map(async (post) => {
        if (post.author) {
          try {
            const userInfo = await getUserInfoFromProfiles(post.author);
            return {
              ...post,
              author_name: userInfo.nickname,
              author_avatar: userInfo.avatar_url
            };
          } catch (error) {
            console.error('获取用户信息失败:', error);
            return post;
          }
        }
        return post;
      })
    );
    
    // 组合并按点赞数降序
    const mapById = new Map(postsWithLatestInfo.map(p => [p.id, p]));
    items.value = ids
      .map(id => ({ post: mapById.get(id), likeCount: countMap.get(id) || 0 }))
      .filter(it => !!it.post)
      .sort((a, b) => b.likeCount - a.likeCount);
    } else {
      // 无点赞数据：按时间降序展示最近文章，点赞数视为 0
      const { data: postsRes, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (postErr) throw postErr;
      posts = postsRes || [];
      
      // 对每个文章作者同步获取最新的用户信息
      const postsWithLatestInfo = await Promise.all(
        posts.map(async (post) => {
          if (post.author) {
            try {
              const userInfo = await getUserInfoFromProfiles(post.author);
              return {
                ...post,
                author_name: userInfo.nickname,
                author_avatar: userInfo.avatar_url
              };
            } catch (error) {
              console.error('获取用户信息失败:', error);
              return post;
            }
          }
          return post;
        })
      );
      
      items.value = postsWithLatestInfo.map(p => ({ post: p, likeCount: 0 }));
    }
  } catch (e) {
    errorMsg.value = e?.message || '加载失败';
    items.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(fetchHot);
</script>

<template>
  <div>
    <h2 style="margin:0 0 16px;">热榜</h2>
    <div style="color:var(--muted); margin-bottom:12px;">注：排行依据博客点赞数量</div>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>
    <div v-else-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
    <div v-else-if="!items.length" style="color:var(--muted);">暂无数据</div>

    <div v-else class="posts-grid">
      <router-link v-for="it in items" :key="it.post.id" class="card post-card" :to="{ name: 'post', params: { id: it.post.id } }">
        <!-- 右上角获赞数 -->
        <div class="like-badge">
          <span class="like-count">{{ it.likeCount }}</span>
          <span class="like-text">获赞</span>
        </div>
        
        <h3 class="post-title">{{ it.post.title }}</h3>
        <div class="post-meta">
          <div class="author-info">
            <router-link v-if="it.post.author" :to="{ name: 'user', params: { id: it.post.author } }" style="text-decoration:none; color:inherit;">
              <div style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <img v-if="it.post.author_avatar" :src="it.post.author_avatar" alt="avatar" class="author-avatar" />
                <div v-else class="author-avatar-placeholder">
                  {{ (it.post.author_name || '匿名').slice(0,1).toUpperCase() }}
                </div>
                <span class="author-name">{{ it.post.author_name || '匿名' }}</span>
              </div>
            </router-link>
            <div v-else style="display:flex; align-items:center; gap:8px;">
              <img v-if="it.post.author_avatar" :src="it.post.author_avatar" alt="avatar" class="author-avatar" />
              <div v-else class="author-avatar-placeholder">
                {{ (it.post.author_name || '匿名').slice(0,1).toUpperCase() }}
              </div>
              <span class="author-name">{{ it.post.author_name || '匿名' }}</span>
            </div>
          </div>
          <span class="post-date">{{ it.post.created_at ? new Date(it.post.created_at).toLocaleString() : '' }}</span>
        </div>
        <p class="post-excerpt">{{ stripHtml(it.post.content)?.slice(0, 60) || '' }}</p>
        <div class="post-actions">
          <span class="btn view-btn">查看详情</span>
        </div>
      </router-link>
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
  position: relative;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 获赞数徽章样式 */
.like-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
  z-index: 2;
}

.like-count {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.like-text {
  font-size: 10px;
  opacity: 0.9;
}

.post-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
  padding-right: 60px; /* 为获赞数留出空间 */
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
  
  .like-badge {
    top: 12px;
    right: 12px;
    padding: 3px 6px;
  }
  
  .like-count {
    font-size: 14px;
  }
  
  .post-title {
    padding-right: 50px;
  }
}
</style>