import { supabase } from './supabase';

// 从user_profiles表中获取用户信息
const getUserInfoFromProfiles = async (userId) => {
  try {
    // 首先尝试从user_profiles表获取最新用户信息
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('email, nickname, bio, avatar_url, background_url')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profileData) {
      return {
        id: userId,
        email: profileData.email || '用户',
        user_metadata: {
          nickname: profileData.nickname || '用户',
          bio: profileData.bio || '',
          avatar_url: profileData.avatar_url || '',
          background_url: profileData.background_url || ''
        }
      };
    }
    
    // 如果user_profiles表没有数据，回退到从posts表获取
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('author_name, author_avatar')
      .eq('author', userId)
      .limit(1);
    
    if (!postsError && postsData && postsData.length > 0) {
      return {
        id: userId,
        email: '用户',
        user_metadata: {
          nickname: postsData[0].author_name || '用户',
          avatar_url: postsData[0].author_avatar || ''
        }
      };
    }
    
    // 最后使用默认用户信息
    return {
      id: userId,
      email: '用户',
      user_metadata: {
        nickname: '用户',
        avatar_url: ''
      }
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return {
      id: userId,
      email: '用户',
      user_metadata: {
        nickname: '用户',
        avatar_url: ''
      }
    };
  }
};

/**
 * 关注用户
 * @param {string} targetUserId - 要关注的用户ID
 * @returns {Promise<Object>}
 */
export const followUser = async (targetUserId) => {
  try {
    // 获取当前用户
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) {
      throw new Error('请先登录');
    }
    
    if (currentUser.id === targetUserId) {
      throw new Error('不能关注自己');
    }
    
    // 检查是否已经关注
    const { data: existingFollow, error: checkError } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId)
      .maybeSingle(); // 使用maybeSingle而不是single，避免404错误
    
    if (existingFollow) {
      throw new Error('已经关注该用户');
    }
    
    // 插入关注记录
    const { data, error } = await supabase
      .from('user_follows')
      .insert([{
        follower_id: currentUser.id,
        following_id: targetUserId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // 发送关注通知给被关注用户
    try {
      // 获取当前用户信息
      const currentUserInfo = await getUserInfoFromProfiles(currentUser.id);
      
      // 发送关注通知到新的关注通知表
      const notificationResult = await supabase
        .from('follow_notifications')
        .insert([{
          recipient: targetUserId,
          actor: currentUser.id,
          actor_name: currentUserInfo.user_metadata?.nickname || '用户',
          actor_avatar: currentUserInfo.user_metadata?.avatar_url || '',
          created_at: new Date().toISOString(),
          read: false
        }]);
      
      if (notificationResult.error) {
        console.error('发送关注通知失败:', notificationResult.error);
      } else {
        console.log('关注通知发送成功');
        // 触发未读通知更新
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('refresh-unread'));
        }
      }
    } catch (notificationError) {
      console.error('发送关注通知失败:', notificationError);
      // 通知发送失败不影响关注操作
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 取消关注用户
 * @param {string} targetUserId - 要取消关注的用户ID
 * @returns {Promise<Object>}
 */
export const unfollowUser = async (targetUserId) => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) {
      throw new Error('请先登录');
    }
    
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * 检查是否已关注用户
 * @param {string} targetUserId - 要检查的用户ID
 * @returns {Promise<boolean>}
 */
export const isFollowing = async (targetUserId) => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const currentUser = userRes?.user || userRes?.data?.user;
    
    if (!currentUser) return false;
    
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', targetUserId)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
};

/**
 * 获取用户的关注数（关注了多少人）
 * @param {string} userId - 用户ID
 * @returns {Promise<number>}
 */
export const getFollowingCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('获取关注数失败:', error);
    return 0;
  }
};

/**
 * 获取用户的粉丝数（被多少人关注）
 * @param {string} userId - 用户ID
 * @returns {Promise<number>}
 */
export const getFollowersCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('获取粉丝数失败:', error);
    return 0;
  }
};

/**
 * 获取用户的关注列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>}
 */
export const getFollowingList = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 为每个关注关系获取用户信息
    const followingList = [];
    for (const item of data || []) {
      const userInfo = await getUserInfoFromProfiles(item.following_id);
      followingList.push({
        ...item,
        user: userInfo
      });
    }
    
    return followingList;
  } catch (error) {
    console.error('获取关注列表失败:', error);
    return [];
  }
};

/**
 * 获取用户的粉丝列表
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>}
 */
export const getFollowersList = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 为每个粉丝关系获取用户信息
    const followersList = [];
    for (const item of data || []) {
      const userInfo = await getUserInfoFromProfiles(item.follower_id);
      followersList.push({
        ...item,
        user: userInfo
      });
    }
    
    return followersList;
  } catch (error) {
    console.error('获取粉丝列表失败:', error);
    return [];
  }
};