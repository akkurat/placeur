

export interface Bin {
  width: number;
  height: number;
  columns?: ColumnLayout;
}

export interface Block {
 id: string 
  heightForWidth(width: number): number
  minWidth?: number
  maxWidth?: number
}

export interface ColumnLayout {
  count: number
  gutter: number
}

export interface PlacedBlock {
  readonly block: Block
  readonly width: number
  readonly height: number
  readonly x: number
  readonly y: number
}

export interface PlacedBin {
  readonly bin: Bin
  readonly blocks: PlacedBlock[]
  readonly efficiency: number
}

export interface PlaceurOptions {
  bins: Bin[]
  blocks: Block[]
}

export interface PlaceurResult {
  readonly bins: PlacedBin[]
  readonly unpacked: Block[]
}
