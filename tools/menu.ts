import { tool } from 'ai';
import { z } from 'zod';

export interface MenuItem {
  name: string;
  price: number;
  category: string;
}

const menu: MenuItem[] = [
  { name: '冰美式', price: 18, category: '美式' },
  { name: '醒醒美式', price: 20, category: '美式' },
  { name: '青柚美式', price: 22, category: '美式' },
  { name: '轻盈生椰拿铁', price: 25, category: '拿铁' },
  { name: '生椰拿铁（多椰少咖）', price: 26, category: '拿铁' },
  { name: '青柚拿铁', price: 28, category: '特调' },
  { name: '袋鼠特调', price: 30, category: '特调' },
  { name: '厚乳拿铁（冰博客版）', price: 32, category: '拿铁' },
];

export const queryMenuTool = tool({
  description: '查询 NOWWA 咖啡菜单，返回咖啡名称和价钱。支持按类别筛选（美式、拿铁、特调），不传 category 则返回全部',
  inputSchema: z.object({
    category: z.string().optional(),
  }),
  // outputSchema: z.array(z.object({
  //   name: z.string(),
  //   price: z.number(),
  //   category: z.string(),
  // })),
  execute: async ({ category }) => {
    if (!category) return menu;

    const filtered = menu.filter(
      item => item.category === category,
    );
    return filtered.length > 0 ? filtered : `未找到类别「${category}」下的商品`;
  },
});

export const weatherTool = tool({
  description: '获取城市天气',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  // location below is inferred to be a string:
  execute: async ({ city }) => ({
    city,
    temperature: 20,
    description: 'Sunny',
  }),
});
