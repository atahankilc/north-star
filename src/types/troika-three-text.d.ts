// troika-three-text ships no types; drei's <Text> wraps it. Only what the app calls directly.
declare module 'troika-three-text' {
  export type TextRenderInfo = { blockBounds: [number, number, number, number] }
  export function getTextRenderInfo(
    args: {
      text: string
      font?: string
      fontSize?: number
      lineHeight?: number
      letterSpacing?: number
      maxWidth?: number
      overflowWrap?: 'normal' | 'break-word'
      anchorX?: 'left' | 'center' | 'right' | number
      anchorY?: 'top' | 'middle' | 'bottom' | number
    },
    callback: (info: TextRenderInfo) => void,
  ): void
}
