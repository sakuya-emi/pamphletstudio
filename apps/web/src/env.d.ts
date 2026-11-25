/// <reference types="vite/client" />
declare module "@pdf-lib/fontkit" {
  const value: { create(bytes: Uint8Array): any };
  export default value;
}
