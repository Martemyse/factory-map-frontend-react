/// <reference types="vite/client" />

declare module '*.geojson' {
  const src: string;
  export default src;
}

declare module '*.json' {
  const value: any;
  export default value;
}
