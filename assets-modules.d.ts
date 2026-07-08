// Asset module declarations so images can be ES-imported (Metro resolves
// these to asset ids). Keeps eslint's no-require-imports rule satisfied.
declare module '*.png' {
  const value: number;
  export default value;
}
declare module '*.jpg' {
  const value: number;
  export default value;
}
