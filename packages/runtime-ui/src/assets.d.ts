declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.svg?no-inline' {
  const url: string;
  export default url;
}

/* widgets 的 .svelte 被 svelte-check 一并纳入本项目，其内联资产查询也要能解析。 */
declare module '*.svg?inline' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}
