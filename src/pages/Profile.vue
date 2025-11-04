<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../lib/supabase';
import ContributionCalendar from '../components/ContributionCalendar.vue';
import { 
  followUser, 
  unfollowUser, 
  isFollowing, 
  getFollowingCount, 
  getFollowersCount,
  getFollowingList,
  getFollowersList
} from '../lib/follow';

const route = useRoute();
const props = defineProps({
  id: {
    type: String,
    default: ''
  }
});

const user = ref(null);
const currentUser = ref(null);
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

// 关注相关状态
const followingCount = ref(0);
const followersCount = ref(0);
const isFollowingUser = ref(false);
const followLoading = ref(false);
const followError = ref('');
const showFollowingList = ref(false);
const showFollowersList = ref(false);
const followingList = ref([]);
const followersList = ref([]);
const listLoading = ref(false);

// 判断是否是查看自己的主页
const isOwnProfile = computed(() => {
  if (!currentUser.value || !user.value) return false;
  return currentUser.value.id === user.value.id;
});

/** 加载用户资料 */
const loadUserProfile = async (userId) => {
  loading.value = true;
  errorMsg.value = '';
  
  try {
    // 获取当前登录用户
    const { data: currentUserData } = await supabase.auth.getUser();
    currentUser.value = currentUserData?.user || null;
    
    // 如果是查看自己的主页，使用当前用户信息
    if (!userId || userId === currentUser.value?.id) {
      user.value = currentUser.value;
      if (user.value) {
        const meta = user.value.user_metadata || {};
        form.value.nickname = meta.nickname || '';
        form.value.bio = meta.bio || '';
        form.value.avatarPreview = meta.avatar_url || '';
      }
    } else {
      // 查看其他用户的主页，通过ID查询用户信息
      // 首先尝试从posts表中获取用户的基本信息
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('author_name, author_avatar')
        .eq('author', userId)
        .limit(1);
        
      if (!postsError && postsData && postsData.length > 0) {
        // 从文章表中获取用户信息
        user.value = {
          id: userId,
          email: '用户',
          user_metadata: {
            nickname: postsData[0].author_name || '用户',
            avatar_url: postsData[0].author_avatar || ''
          }
        };
      } else {
        // 如果文章表中也没有信息，显示默认用户信息
        user.value = {
          id: userId,
          email: '用户',
          user_metadata: {
            nickname: '用户',
            avatar_url: ''
          }
        };
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    // 显示友好的错误信息
    errorMsg.value = '用户信息暂时无法访问';
    user.value = null;
  } finally {
    loading.value = false;
  }
  
  // 加载关注数据
  if (user.value) {
    await loadFollowData(user.value.id);
  }
};

/** 组件挂载时加载数据 */
onMounted(async () => {
  await loadUserProfile(props.id);
});

// 监听路由参数变化
import { watch } from 'vue';
watch(() => props.id, async (newId) => {
  await loadUserProfile(newId);
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

/** 加载关注数据 */
const loadFollowData = async (userId) => {
  try {
    // 获取关注数和粉丝数
    followingCount.value = await getFollowingCount(userId);
    followersCount.value = await getFollowersCount(userId);
    
    // 检查当前用户是否已关注该用户
    if (currentUser.value && userId !== currentUser.value.id) {
      isFollowingUser.value = await isFollowing(userId);
    }
  } catch (error) {
    console.error('加载关注数据失败:', error);
  }
};

/** 关注/取消关注用户 */
const toggleFollow = async () => {
  if (!user.value || !currentUser.value) {
    followError.value = '请先登录';
    return;
  }
  
  if (user.value.id === currentUser.value.id) {
    followError.value = '不能关注自己';
    return;
  }
  
  followLoading.value = true;
  followError.value = '';
  
  try {
    if (isFollowingUser.value) {
      // 取消关注
      const result = await unfollowUser(user.value.id);
      if (result.success) {
        isFollowingUser.value = false;
        followersCount.value = Math.max(0, followersCount.value - 1);
      } else {
        followError.value = result.error;
      }
    } else {
      // 关注
      const result = await followUser(user.value.id);
      if (result.success) {
        isFollowingUser.value = true;
        followersCount.value += 1;
      } else {
        followError.value = result.error;
      }
    }
  } catch (error) {
    followError.value = '操作失败，请重试';
    console.error('关注操作失败:', error);
  } finally {
    followLoading.value = false;
  }
};

/** 加载关注列表 */
const loadFollowingList = async () => {
  if (!user.value) return;
  
  listLoading.value = true;
  try {
    followingList.value = await getFollowingList(user.value.id);
  } catch (error) {
    console.error('加载关注列表失败:', error);
    followingList.value = [];
  } finally {
    listLoading.value = false;
  }
};

/** 加载粉丝列表 */
const loadFollowersList = async () => {
  if (!user.value) return;
  
  listLoading.value = true;
  try {
    followersList.value = await getFollowersList(user.value.id);
  } catch (error) {
    console.error('加载粉丝列表失败:', error);
    followersList.value = [];
  } finally {
    listLoading.value = false;
  }
};

/** 显示关注列表弹窗 */
const showFollowingModal = async () => {
  showFollowingList.value = true;
  await loadFollowingList();
};

/** 显示粉丝列表弹窗 */
const showFollowersModal = async () => {
  showFollowersList.value = true;
  await loadFollowersList();
};

</script>

<template>
  <div class="card" style="max-width:960px; margin:0 auto; padding:30px;">
    <h2 style="margin:0 0 16px;">
      {{ isOwnProfile ? '个人中心' : '个人主页' }}
      <span v-if="!isOwnProfile && user" style="font-size:14px; color:var(--muted); font-weight:normal;">
        - {{ user.user_metadata?.nickname || '用户' }}
      </span>
    </h2>

    <div v-if="loading" style="color:var(--muted);">加载中...</div>

    <div v-else-if="!user" style="color:var(--muted);">
      <div v-if="isOwnProfile">
        尚未登录，<router-link to="/login">去登录</router-link>
      </div>
      <div v-else>
        用户不存在或无法访问
      </div>
    </div>

    <div v-else style="display:grid; gap:16px;">
      <!-- 头像与基础信息 -->
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div style="position:relative;">
            <img v-if="user.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" alt="avatar"
                 style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
            <div v-else
                 style="width:80px; height:80px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
              {{ (user.user_metadata?.nickname || user.email || 'U').slice(0,1).toUpperCase() }}
            </div>
          </div>
          <div>
            <div style="font-weight:600; font-size:20px;">{{ user.user_metadata?.nickname || '未设置昵称' }}</div>
            <div style="color:var(--muted); font-size:13px;">{{ user.email }}</div>
            <div style="margin-top:8px; white-space:pre-wrap; color:var(--text); max-width:400px;">{{ user.user_metadata?.bio || '尚未填写个人简介' }}</div>
            
            <!-- 关注数据 -->
            <div style="display:flex; gap:20px; margin-top:12px;">
              <div style="text-align:center; cursor:pointer;" @click="showFollowingModal">
                <div style="font-weight:600; font-size:16px;">{{ followingCount }}</div>
                <div style="color:var(--muted); font-size:12px;">关注</div>
              </div>
              <div style="text-align:center; cursor:pointer;" @click="showFollowersModal">
                <div style="font-weight:600; font-size:16px;">{{ followersCount }}</div>
                <div style="color:var(--muted); font-size:12px;">粉丝</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div v-if="isOwnProfile" style="display:flex; gap:8px; align-self:flex-start;">
          <button class="btn" @click="editMode ? cancelEdit() : (editMode = true)">
            {{ editMode ? '取消编辑' : '编辑资料' }}
          </button>
          <button class="btn" @click="logout">退出登录</button>
        </div>
        <div v-else style="display:flex; gap:8px; align-self:flex-start;">
          <router-link class="btn" to="/">返回首页</router-link>
          <!-- 关注按钮 -->
          <button v-if="currentUser && !isOwnProfile" 
                  class="btn" 
                  :class="{ primary: isFollowingUser }"
                  @click="toggleFollow"
                  :disabled="followLoading">
            {{ followLoading ? '处理中...' : (isFollowingUser ? '取消关注' : '关注') }}
          </button>
        </div>
      </div>

      <!-- 关注错误提示 -->
      <div v-if="followError" style="color:#ff6b6b; padding:8px; background:#fff5f5; border-radius:4px; margin-top:8px;">
        {{ followError }}
      </div>

      <!-- 编辑表单（仅自己可见） -->
      <div v-if="isOwnProfile && editMode" class="card" style="padding:16px; display:grid; gap:12px;">
        <label>
          昵称
          <input class="input" v-model="form.nickname" placeholder="输入新的昵称" />
        </label>
        <label>
          头像
          <input class="input" type="file" accept="image/*" @change="onPickAvatar" />
        </label>
        <label>
          个人简介
          <textarea class="input" v-model="form.bio" placeholder="用几句话介绍自己..." rows="4" style="resize: none;"></textarea>
        </label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn primary" :disabled="saving" @click="onSave">
            {{ saving ? '保存中...' : '保存资料' }}
          </button>
        </div>
        <div v-if="errorMsg" style="color:#ff6b6b;">{{ errorMsg }}</div>
        <div v-if="successMsg" style="color:#18c37a;">{{ successMsg }}</div>
      </div>
      
      <!-- 贡献日历 -->
      <div class="card" style="padding:16px;">
        <h3 style="margin:0 0 16px;">创作日历</h3>
        <ContributionCalendar v-if="user" :userId="user.id" />
      </div>

      <!-- 关注列表弹窗 -->
      <div v-if="showFollowingList" class="modal-overlay" @click="showFollowingList = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>关注列表 ({{ followingCount }})</h3>
            <button class="close-btn" @click="showFollowingList = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="listLoading" style="text-align:center; color:var(--muted); padding:20px;">
              加载中...
            </div>
            <div v-else-if="followingList.length === 0" style="text-align:center; color:var(--muted); padding:20px;">
              还没有关注任何人
            </div>
            <div v-else>
              <div v-for="item in followingList" :key="item.following_id" class="user-item">
                <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
                  <div style="position:relative;">
                    <img v-if="item.user.user_metadata?.avatar_url" :src="item.user.user_metadata.avatar_url" alt="avatar"
                         style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
                    <div v-else
                         style="width:40px; height:40px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
                      {{ (item.user.user_metadata?.nickname || item.user.email || 'U').slice(0,1).toUpperCase() }}
                    </div>
                  </div>
                  <div style="flex:1;">
                    <div style="font-weight:600;">{{ item.user.user_metadata?.nickname || '用户' }}</div>
                    <div style="color:var(--muted); font-size:12px;">{{ item.user.email }}</div>
                  </div>
                  <div style="color:var(--muted); font-size:12px;">
                    {{ new Date(item.created_at).toLocaleDateString('zh-CN') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 粉丝列表弹窗 -->
      <div v-if="showFollowersList" class="modal-overlay" @click="showFollowersList = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>粉丝列表 ({{ followersCount }})</h3>
            <button class="close-btn" @click="showFollowersList = false">×</button>
          </div>
          <div class="modal-body">
            <div v-if="listLoading" style="text-align:center; color:var(--muted); padding:20px;">
              加载中...
            </div>
            <div v-else-if="followersList.length === 0" style="text-align:center; color:var(--muted); padding:20px;">
              还没有粉丝
            </div>
            <div v-else>
              <div v-for="item in followersList" :key="item.follower_id" class="user-item">
                <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
                  <div style="position:relative;">
                    <img v-if="item.user.user_metadata?.avatar_url" :src="item.user.user_metadata.avatar_url" alt="avatar"
                         style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border);" />
                    <div v-else
                         style="width:40px; height:40px; border-radius:50%; background:#163229; display:flex; align-items:center; justify-content:center; color:var(--primary); font-weight:700;">
                      {{ (item.user.user_metadata?.nickname || item.user.email || 'U').slice(0,1).toUpperCase() }}
                    </div>
                  </div>
                  <div style="flex:1;">
                    <div style="font-weight:600;">{{ item.user.user_metadata?.nickname || '用户' }}</div>
                    <div style="color:var(--muted); font-size:12px;">{{ item.user.email }}</div>
                  </div>
                  <div style="color:var(--muted); font-size:12px;">
                    {{ new Date(item.created_at).toLocaleDateString('zh-CN') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--border);
}

.modal-body {
  padding: 0;
  max-height: 400px;
  overflow-y: auto;
}
</style>