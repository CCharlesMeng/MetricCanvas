/**
 * 计算层 utility 的 Tailwind 默认值对照表。
 *
 * 只收录**两份在用稿里实际出现过的 22 个 utility**,不搬整份 Tailwind 主题。
 * 表里的值**不是设计稿里读到的**,是按 Tailwind 默认主题解出来的,所以在产物里单列
 * `themeResolution`,绝不混进 `literals`。
 *
 * 为什么要解:字重是 R3 要判的量。设计稿的字重闭集只有 `{400, 500}`(`font-normal` /
 * `font-medium`),Tailwind 提供的 `font-semibold`(600)/ `font-bold`(700)在稿里
 * **零命中**;不把这两个 utility 解出来,这条判据根本写不了。
 *
 * 解与不解的界线:**该 utility 决定的量,是不是由布局算法分配出来的。**
 * - 不是 → 解。字重、对齐、换行策略、溢出、背景定位、变换原点、0 间距,这些声明的值就是
 *   要比的那个量,取值固定,不依赖祖先盒、视口或主题配置。
 * - 是 → 不解,留在计算层。`flex` / `flex-col` / `justify-between` / `items-*` /
 *   `block` / `inline-block` / `absolute` / `relative` 的 CSS 声明本身也是确定的
 *   (`display: flex` 等),但这些 utility 的作用就是把尺寸和间距交给布局算法去分配;
 *   把声明解出来会让人误以为分配结果也可判,而那正是 `PATTERN-STYLE-4 ②` 判不了的东西。
 *   `w-full` / `h-full` 同理,不过这两个在两份在用稿里并未出现。
 */

/** 对照表的版本依据。所有值都对着下面两份 Tailwind 源文件逐条核过 */
export const TAILWIND_BASIS = {
  cdn: 'https://cdn.tailwindcss.com',
  versionPinned: false,
  versionAdopted: 'tailwindcss 3.x 默认主题',
  howVersionWasDetermined:
    '稿里是 `<script src="https://cdn.tailwindcss.com"></script>`,未固定版本,所以确切补丁号无法从文件确定。该 URL 是 v3 的 Play CDN(v4 起改用 @tailwindcss/browser,见 tailwindcss.com/docs/installation/play-cdn),故版本线必为 v3、加载时取当时最新的 v3.x。',
  verifiedAgainst: [
    'tailwindlabs/tailwindcss v3.4.17 · stubs/config.full.js(theme.* 项)',
    'tailwindlabs/tailwindcss v3.4.17 · src/corePlugins.js(静态 utility 项)',
    'tailwindlabs/tailwindcss v3.0.0 · stubs/defaultConfig.stub.js(确认 v3 首版取值相同)'
  ],
  stabilityNote:
    '本表 13 个已解 utility 的取值在 v3.0.0 与 v3.4.17 上完全一致,即 v3 全线未变,所以版本号不确定不影响这 13 条。theme.margin 与 theme.padding 在 v3 默认继承 theme.spacing,故 m-0 / p-0 取 spacing.0 = 0px。'
} as const;

export type UtilityResolution =
  | {
      resolved: true;
      /** CSS 属性 → 值。这是按 Tailwind 主题解出来的,不是稿里的字面量 */
      declarations: Record<string, string>;
      /** 取值出处,`theme.*` 来自 config.full.js,`corePlugins.*` 来自 corePlugins.js */
      origin: string;
    }
  | {
      resolved: false;
      family: 'layout-allocation' | 'unlisted';
      reason: string;
    };

const LAYOUT = (reason: string): UtilityResolution => ({
  resolved: false,
  family: 'layout-allocation',
  reason
});

/**
 * 键是两份在用稿里出现过的全部 22 个计算层 utility。
 * 稿里出现了表外的 utility 时,extract 会记成 `family: 'unlisted'` 并计入
 * `stats.unlistedUtilities`,由测试拦住——不会被静默忽略。
 */
export const UTILITY_TABLE: Record<string, UtilityResolution> = {
  // ——— 已解:取值固定,且该值就是要比的那个量 ———
  'font-normal': {
    resolved: true,
    declarations: { 'font-weight': '400' },
    origin: 'theme.fontWeight.normal'
  },
  'font-medium': {
    resolved: true,
    declarations: { 'font-weight': '500' },
    origin: 'theme.fontWeight.medium'
  },
  'whitespace-nowrap': {
    resolved: true,
    declarations: { 'white-space': 'nowrap' },
    origin: 'corePlugins.whitespace'
  },
  'text-left': {
    resolved: true,
    declarations: { 'text-align': 'left' },
    origin: 'corePlugins.textAlign'
  },
  'text-center': {
    resolved: true,
    declarations: { 'text-align': 'center' },
    origin: 'corePlugins.textAlign'
  },
  'text-right': {
    resolved: true,
    declarations: { 'text-align': 'right' },
    origin: 'corePlugins.textAlign'
  },
  'overflow-hidden': {
    resolved: true,
    declarations: { overflow: 'hidden' },
    origin: 'corePlugins.overflow'
  },
  isolate: {
    resolved: true,
    declarations: { isolation: 'isolate' },
    origin: 'corePlugins.isolation'
  },
  'bg-no-repeat': {
    resolved: true,
    declarations: { 'background-repeat': 'no-repeat' },
    origin: 'corePlugins.backgroundRepeat'
  },
  'bg-center': {
    resolved: true,
    declarations: { 'background-position': 'center' },
    origin: 'theme.backgroundPosition.center'
  },
  'origin-top-left': {
    resolved: true,
    declarations: { 'transform-origin': 'top left' },
    origin: "theme.transformOrigin['top-left']"
  },
  'm-0': {
    resolved: true,
    declarations: { margin: '0px' },
    origin: 'theme.margin.0(继承 theme.spacing.0)'
  },
  'p-0': {
    resolved: true,
    declarations: { padding: '0px' },
    origin: 'theme.padding.0(继承 theme.spacing.0)'
  },

  // ——— 不解:声明本身确定,但该 utility 决定的量由布局算法分配 ———
  flex: LAYOUT('display:flex 本身确定,但这个 utility 的作用是把子盒交给 flex 算法分配尺寸与间距,分配结果不在稿里'),
  'flex-col': LAYOUT('只定主轴方向,尺寸与间距仍由 flex 算法分配'),
  'justify-between': LAYOUT('主轴剩余空间的分配方式,实际间距由算法按容器宽度与子盒尺寸算出'),
  'items-start': LAYOUT('交叉轴对齐方式,实际位置由算法按容器与子盒尺寸算出'),
  'items-center': LAYOUT('交叉轴对齐方式,实际位置由算法按容器与子盒尺寸算出'),
  block: LAYOUT('display:block 本身确定,但块级盒的宽度由父盒分配,不是稿里写死的量'),
  'inline-block': LAYOUT('display:inline-block 本身确定,但盒宽由内容收缩决定,不是稿里写死的量'),
  absolute: LAYOUT('position:absolute 本身确定,但实际盒由包含块与同节点的 left/top/w/h 共同算出;几何要看那些字面量'),
  relative: LAYOUT('position:relative 本身确定,它的作用是给子节点定包含块,自身不产生可判的量')
};

export function resolveUtility(token: string): UtilityResolution {
  return (
    UTILITY_TABLE[token] ?? {
      resolved: false,
      family: 'unlisted',
      reason: '对照表未收录这个 utility,不猜它的值;要解就先在 tailwind-theme.ts 里核过再加'
    }
  );
}
