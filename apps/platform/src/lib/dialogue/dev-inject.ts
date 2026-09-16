
/**
 * DEV 环境本地验证注入（方案 B,白名单内自含）。
 * 生产由 IOC 主服务注入 window.__METRICCANVAS_PANGU__ 与 window.currentLoginUser,
 * 本地无主服务,在此 mock 以便手工验证对话模块。
 */

/** 本地验证用的盘古 loader 地址（真实环境地址,随验证环境更新）。 */
const DEV_PANGU_RESOURCE_URL =
  'https://wsr.his-op-beta.huawei.com/6721cb94c4354ca68e46a4789292bde3/beta/pangu-chat-client/1.1.29.20260814094602/loader/js/pangu-chat-loader.js';

/** 本地 mock 的 IOC 登录用户（对应 getCurrentUser 的 userNo/userName）。 */
const DEV_IOC_USER = { userNo: 'm00980160', userName: '孟鑫' };

/** Mock 应用的页面 ID（联调时改为真实 page_id）。 */
const MOCK_APPLY_PAGE_ID = 'mock-page-001';

/** Adaptive 卡片配置：故障恢复动作入口（确认后派发 metriccanvas:apply-page）。 */
const MOCK_ADAPTIVE_CARD = {
  data: {
    cardName: '故障恢复动作',
    components: [
      {
        type: 'pangu-entrance',
        attributes: {
          entrances: [
            {
              title: '应用页面修改',
              linkText: '确认应用',
              desc: '点击确认后，工作台按 pageId 重新读取当前页面并更新画布。',
              disableInHistory: true,
              once: true,
              events: [
                {
                  eventName: 'dispatch_event',
                  eventParams: {
                    eventType: 'metriccanvas:apply-page',
                    eventDetail: { pageId: MOCK_APPLY_PAGE_ID }
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  },
  card_config: {
    framework: 'adaptive'
  }
};

const markdownList =[
  {
    "additional_info": {},
    "content": null,
        "content_id" :111,
    "content_type": null,
    "conversation_id": "fdf095f6a6b74723b5d5616c219e69e8",
    "event": "start",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": "2025-06-12T12:09:45.455330913"
  },
  {
    "additional_info": null,
    "content": "本次修改已完成，点击确认后将刷新当前页面。",
    "content_type": "text",
    "content_id" :111,
    "conversation_id": null,
    "event": "generate",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": null
  },

  {
    "additional_info": null,
    "content": null,
        "content_id" :111,

    "content_type": "text",
    "conversation_id": null,
    "event": "done",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": null
  },

  {
    "additional_info": null,
    "content_id" :111,
    "content":JSON.stringify(MOCK_ADAPTIVE_CARD),
    "content_type": "card",
    "conversation_id": null,
    "event": "generate",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": null
  },

  {
    "additional_info": null,
        "content_id" :111,

    "content": null,
    "content_type": "card",
    "conversation_id": null,
    "event": "done",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": null
  },
  {
    "content": null,
    "content_id" :111,
    "content_type": "multiple",
    "conversation_id": "fdf095f6a6b74723b5d5616c219e69e8",
    "event": "finish",
    "request_id": "3b418084bcc747378d80a571a97dd568",
    "topic_keep_id": null,
    "role_type": null,
    "start_time": "2025-06-12T12:09:45.455330913"
  }
]


declare global {
  interface Window {
    __METRICCANVAS_PANGU__?: { resourceUrl: string; version: string };
    currentLoginUser?:any;
    panguMock?: { switch: boolean; card?: unknown; markdown?: unknown[] };
  }
}

/** DEV 下注入盘古资源与 mock 用户；仅 import.meta.env.DEV 时由布局调用。 */
export function installPanguDevConfig(): void {
  window.__METRICCANVAS_PANGU__ = {
    resourceUrl: DEV_PANGU_RESOURCE_URL,
    version: `dev-1.0.0`
  };
  if (!window.currentLoginUser) window.currentLoginUser = DEV_IOC_USER;
  // 盘古 mock 链路：switch=true 时 SDK 走 mockEventSource/mockReturn；card 直接喂给 PanguBotCard。
  // 注：SDK 消费的是 panguMock.card（PanguBotCard setCardConfig），不消费 panguMock.markdown。
  window.panguMock = { switch: true, markdown: markdownList };
}
