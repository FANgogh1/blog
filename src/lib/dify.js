import { ref } from 'vue';

// Dify API 配置 - 使用您的实际凭据
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY || 'app-Vg3kxeMJHGPROlzKscALQHyX';
const DIFY_WORKFLOW_ID = import.meta.env.VITE_DIFY_WORKFLOW_ID || '3ad2dd21-eb37-4946-abe0-0a1f46c1d8ae';
const DIFY_BASE_URL = import.meta.env.VITE_DIFY_BASE_URL || 'https://dify.aipfuture.com/v1';
// 使用代理URL绕过CORS问题，实际目标URL为 https://dify.aipfuture.com/v1/workflows/run
const DIFY_WORKFLOW_RUN_URL = '/api/dify/v1/workflows/run';

/**
 * 调用Dify工作流进行文章总结
 * @param {string} content - 文章内容
 * @param {string} title - 文章标题
 * @returns {Promise<string>} - 返回总结结果
 */
export const summarizeArticle = async (content, title) => {
  try {
    // 清理HTML标签，获取纯文本内容
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    
    // 如果内容为空，返回提示
    if (!textContent) {
      throw new Error('文章内容为空，无法进行AI总结');
    }
    
    // 如果内容过长，截取前8000字符（Dify可能有长度限制）
    const truncatedContent = textContent.length > 8000 
      ? textContent.substring(0, 8000) + '...'
      : textContent;

    console.log('发送到Dify的内容长度:', truncatedContent.length);
    console.log('Dify API URL:', DIFY_WORKFLOW_RUN_URL);
    console.log('工作流ID:', DIFY_WORKFLOW_ID);
    
    // 调试：尝试不同的输入字段结构
    console.log('=== Dify API 调试信息 ===');
    console.log('工作流ID:', DIFY_WORKFLOW_ID);
    console.log('内容长度:', truncatedContent.length);
    console.log('标题:', title);
    
    // 根据错误信息调整请求体结构
    // 确保内容长度≤256字符
    const textInput = truncatedContent.length > 256 
      ? truncatedContent.substring(0, 256) + '...'
      : truncatedContent;
    
    // 尝试不同的请求体格式来解决"Missing required parameter in the JSON body"错误
    console.log('=== 尝试不同的请求体格式 ===');
    
    // 方案1: inputs作为顶层字段（直接传递）
    const requestBody1 = {
      workflow_id: DIFY_WORKFLOW_ID,
      inputs: {
        "inputs": textInput  // 使用"inputs"作为变量名
      },
      response_mode: "blocking",
      user: "blog-user"
    };
    
    // 方案2: inputs作为字符串直接传递
    const requestBody2 = {
      workflow_id: DIFY_WORKFLOW_ID,
      inputs: textInput,  // 直接传递字符串
      response_mode: "blocking",
      user: "blog-user"
    };
    
    // 方案3: 使用form字段但调整结构
    const requestBody3 = {
      workflow_id: DIFY_WORKFLOW_ID,
      inputs: {
        "text": textInput
      },
      response_mode: "blocking",
      user: "blog-user"
    };
    
    console.log('开始尝试不同的请求体格式...');

    let response;
    let lastError = '';
    
    // 尝试不同的请求体格式
    const requestBodies = [
      { name: '方案1 - inputs作为对象', body: requestBody1 },
      { name: '方案2 - inputs作为字符串', body: requestBody2 },
      { name: '方案3 - 使用text字段', body: requestBody3 }
    ];
    
    for (const { name, body } of requestBodies) {
      console.log(`尝试 ${name}`);
      console.log('请求体:', JSON.stringify(body, null, 2));
      
      try {
        response = await fetch(DIFY_WORKFLOW_RUN_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        console.log('响应状态:', response.status, response.statusText);

        if (response.ok) {
          console.log(`${name} 成功!`);
          break; // 成功则跳出循环
        } else {
          // 获取错误信息
          const errorData = await response.json();
          lastError = errorData.message || `请求失败: ${response.status}`;
          console.error(`${name} 失败:`, errorData);
          
          // 如果是最后一个方案，抛出错误
          if (name === requestBodies[requestBodies.length - 1].name) {
            throw new Error(lastError);
          }
        }
      } catch (error) {
        lastError = error.message;
        console.error(`${name} 异常:`, error);
        
        // 如果是最后一个方案，抛出错误
        if (name === requestBodies[requestBodies.length - 1].name) {
          throw error;
        }
      }
    }

    const data = await response.json();
    console.log('Dify API 响应数据:', data);
    
    // 处理不同的响应格式
    if (data.data && data.data.outputs && data.data.outputs.result) {
      return data.data.outputs.result;
    } else if (data.data && data.data.outputs) {
      // 尝试获取第一个输出值
      const outputKeys = Object.keys(data.data.outputs);
      if (outputKeys.length > 0) {
        return data.data.outputs[outputKeys[0]];
      }
    } else if (data.answer) {
      return data.answer;
    } else if (data.result) {
      return data.result;
    } else {
      console.error('Dify API 返回格式异常，完整响应:', data);
      throw new Error('Dify API 返回格式异常，请检查工作流配置');
    }
  } catch (error) {
    console.error('AI总结失败:', error);
    throw new Error(`AI总结失败: ${error.message}`);
  }
};

/**
 * 使用Vue响应式状态管理AI总结功能
 */
export const useAISummary = () => {
  const isSummarizing = ref(false);
  const summaryResult = ref('');
  const summaryError = ref('');

  const summarize = async (content, title) => {
    isSummarizing.value = true;
    summaryError.value = '';
    summaryResult.value = '';

    try {
      const result = await summarizeArticle(content, title);
      summaryResult.value = result;
      return result;
    } catch (error) {
      summaryError.value = error.message;
      throw error;
    } finally {
      isSummarizing.value = false;
    }
  };

  const clearSummary = () => {
    summaryResult.value = '';
    summaryError.value = '';
  };

  return {
    isSummarizing,
    summaryResult,
    summaryError,
    summarize,
    clearSummary,
  };
};